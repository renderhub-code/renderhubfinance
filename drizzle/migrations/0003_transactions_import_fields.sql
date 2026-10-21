ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS document_number text, ADD COLUMN IF NOT EXISTS bank text, ADD COLUMN IF NOT EXISTS bank_account text;
