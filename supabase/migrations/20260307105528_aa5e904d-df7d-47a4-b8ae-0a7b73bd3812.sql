
-- Pricing plans table
CREATE TABLE public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tier_level integer NOT NULL DEFAULT 0,
  base_price_usd numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly',
  included_gpu_hours numeric NOT NULL DEFAULT 0,
  included_cpu_hours numeric NOT NULL DEFAULT 0,
  included_storage_gb numeric NOT NULL DEFAULT 0,
  overage_gpu_rate numeric NOT NULL DEFAULT 0,
  overage_cpu_rate numeric NOT NULL DEFAULT 0,
  overage_storage_rate numeric NOT NULL DEFAULT 0,
  max_concurrent_jobs integer NOT NULL DEFAULT 1,
  max_team_members integer NOT NULL DEFAULT 5,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Organization subscriptions
CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
  status text NOT NULL DEFAULT 'active',
  billing_cycle_start timestamptz NOT NULL DEFAULT now(),
  billing_cycle_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- Usage metering records (granular per-job)
CREATE TABLE public.usage_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  simulation_id uuid REFERENCES public.simulations(id),
  meter_type text NOT NULL DEFAULT 'gpu_hour',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price_usd numeric NOT NULL DEFAULT 0,
  billable boolean NOT NULL DEFAULT true,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Billing invoices
CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.org_subscriptions(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  base_amount_usd numeric NOT NULL DEFAULT 0,
  overage_amount_usd numeric NOT NULL DEFAULT 0,
  total_amount_usd numeric NOT NULL DEFAULT 0,
  gpu_hours_used numeric NOT NULL DEFAULT 0,
  cpu_hours_used numeric NOT NULL DEFAULT 0,
  storage_gb_used numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

-- Enable RLS
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- Pricing plans: readable by all authenticated users
CREATE POLICY "Authenticated users can read plans" ON public.pricing_plans
  FOR SELECT TO authenticated USING (true);

-- Subscriptions: org members can read, admins+ can manage
CREATE POLICY "Org members can read subscription" ON public.org_subscriptions
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins+ can manage subscription" ON public.org_subscriptions
  FOR ALL TO authenticated USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role))
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- Usage meters: org members can read, members+ can insert
CREATE POLICY "Org members can read usage" ON public.usage_meters
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert usage" ON public.usage_meters
  FOR INSERT TO authenticated WITH CHECK (
    has_org_role_gte(auth.uid(), organization_id, 'member'::app_role) AND auth.uid() = user_id
  );

-- Invoices: org members can read, admins+ can manage
CREATE POLICY "Org members can read invoices" ON public.billing_invoices
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins+ can manage invoices" ON public.billing_invoices
  FOR ALL TO authenticated USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role))
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));
