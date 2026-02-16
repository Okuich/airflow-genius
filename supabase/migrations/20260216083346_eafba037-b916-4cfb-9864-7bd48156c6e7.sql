
-- Add role column to trial_signups
ALTER TABLE public.trial_signups ADD COLUMN IF NOT EXISTS job_role TEXT;

-- Create function to auto-provision a trial workspace when a trial signup is inserted
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_org_id UUID;
  slug_val TEXT;
BEGIN
  -- Generate a unique slug from company name
  slug_val := lower(regexp_replace(NEW.company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create the organization with trial tier
  INSERT INTO public.organizations (name, slug, tier, max_members)
  VALUES (NEW.company_name, slug_val, 'trial', 10)
  RETURNING id INTO new_org_id;

  -- Add the user as owner of the new org
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$$;

-- Trigger: auto-create workspace on trial signup
DROP TRIGGER IF EXISTS on_trial_signup ON public.trial_signups;
CREATE TRIGGER on_trial_signup
  AFTER INSERT ON public.trial_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trial_signup();
