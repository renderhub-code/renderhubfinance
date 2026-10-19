ALTER TABLE public.cashflow_syncs ADD COLUMN next_page integer NOT NULL DEFAULT 1;
ALTER TABLE public.cashflow_syncs ADD COLUMN forecasts jsonb;
COMMENT ON COLUMN public.cashflow_syncs.forecasts IS 'Validated open balances by due date in the completed snapshot; never realized cash.';