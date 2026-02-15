
-- Table to store synced regulatory standards and rules
CREATE TABLE public.compliance_knowledge_sync (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL CHECK (sync_type IN ('standard', 'rule')),
  entry_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'ai_sync',
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (sync_type, entry_id)
);

-- Enable RLS
ALTER TABLE public.compliance_knowledge_sync ENABLE ROW LEVEL SECURITY;

-- Public read (compliance data is non-sensitive reference data)
CREATE POLICY "Anyone authenticated can read compliance knowledge"
  ON public.compliance_knowledge_sync FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role / edge functions write (no user writes)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Index for fast lookups
CREATE INDEX idx_compliance_sync_type_active ON public.compliance_knowledge_sync (sync_type, is_active);
CREATE INDEX idx_compliance_sync_entry ON public.compliance_knowledge_sync (entry_id);

-- Sync log table
CREATE TABLE public.compliance_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  standards_synced integer NOT NULL DEFAULT 0,
  rules_synced integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  ai_model text
);

ALTER TABLE public.compliance_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read sync logs"
  ON public.compliance_sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);
