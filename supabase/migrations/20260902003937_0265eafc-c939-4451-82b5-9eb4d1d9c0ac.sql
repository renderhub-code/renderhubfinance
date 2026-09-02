ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_unique
  ON public.transactions (company_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;