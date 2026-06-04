
-- Rate limit buckets (sliding window counters)
CREATE TABLE public.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_start)
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.rate_limit_buckets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_rate_limit_buckets_window ON public.rate_limit_buckets (window_start);

-- Client error log
CREATE TABLE public.client_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  route text,
  message text NOT NULL,
  stack text,
  user_agent text,
  severity text NOT NULL DEFAULT 'error',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_error_log TO authenticated;
GRANT ALL ON public.client_error_log TO service_role;
ALTER TABLE public.client_error_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own errors" ON public.client_error_log FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Admins+ can read org errors" ON public.client_error_log FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND private.has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));
CREATE INDEX idx_client_error_log_created ON public.client_error_log (created_at DESC);
CREATE INDEX idx_client_error_log_org ON public.client_error_log (organization_id);

-- Atomic rate-limit increment helper
CREATE OR REPLACE FUNCTION private.check_rate_limit(
  _bucket_key text,
  _limit integer,
  _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _current_count integer;
BEGIN
  _window_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % _window_seconds || ' seconds')::interval;
  INSERT INTO public.rate_limit_buckets (bucket_key, window_start, count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO _current_count;
  -- Cleanup old buckets opportunistically
  DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 hour';
  RETURN _current_count <= _limit;
END;
$$;
REVOKE ALL ON FUNCTION private.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.check_rate_limit(text, integer, integer) TO service_role;
