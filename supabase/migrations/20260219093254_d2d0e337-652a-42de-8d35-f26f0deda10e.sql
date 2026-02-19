-- Add trial_tier column to trial_signups
ALTER TABLE public.trial_signups
ADD COLUMN trial_tier text NOT NULL DEFAULT 'full';

-- Update the handle_trial_signup function to use trial_tier for org tier
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  slug_val TEXT;
BEGIN
  -- Generate a unique slug from company name
  slug_val := lower(regexp_replace(NEW.company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create the organization with the trial tier from signup
  INSERT INTO public.organizations (name, slug, tier, max_members)
  VALUES (NEW.company_name, slug_val, 'trial-' || COALESCE(NEW.trial_tier, 'full'), 10)
  RETURNING id INTO new_org_id;

  -- Add the user as owner of the new org
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$function$;