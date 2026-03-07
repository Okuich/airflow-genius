
-- Patent filings table: stores current status per invention
CREATE TABLE public.patent_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invention_id text NOT NULL UNIQUE,
  invention_number text NOT NULL,
  current_status text NOT NULL DEFAULT 'draft',
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Status history table: tracks all status transitions
CREATE TABLE public.patent_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id uuid REFERENCES public.patent_filings(id) ON DELETE CASCADE NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid NOT NULL,
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patent_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patent_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for patent_filings
CREATE POLICY "Org members can read patent filings"
  ON public.patent_filings FOR SELECT TO authenticated
  USING (
    CASE WHEN organization_id IS NOT NULL 
      THEN is_org_member(auth.uid(), organization_id)
      ELSE auth.uid() IS NOT NULL
    END
  );

CREATE POLICY "Authenticated users can insert patent filings"
  ON public.patent_filings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = updated_by);

CREATE POLICY "Authenticated users can update patent filings"
  ON public.patent_filings FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS policies for patent_status_history
CREATE POLICY "Org members can read status history"
  ON public.patent_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patent_filings pf
      WHERE pf.id = filing_id
      AND (
        CASE WHEN pf.organization_id IS NOT NULL
          THEN is_org_member(auth.uid(), pf.organization_id)
          ELSE auth.uid() IS NOT NULL
        END
      )
    )
  );

CREATE POLICY "Authenticated users can insert status history"
  ON public.patent_status_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);
