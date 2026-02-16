
-- Trial signups table for self-serve free trial flow
CREATE TABLE public.trial_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'HVAC',
  company_size TEXT,
  use_case TEXT,
  trial_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

-- Users can read their own trial
CREATE POLICY "Users can view own trial"
  ON public.trial_signups FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own trial signup
CREATE POLICY "Users can create own trial"
  ON public.trial_signups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all trials (org-level)
CREATE POLICY "Org admins can view all trials"
  ON public.trial_signups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
