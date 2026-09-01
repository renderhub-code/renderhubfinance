CREATE TABLE public.bling_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE UNIQUE INDEX bling_tokens_singleton ON public.bling_tokens ((true));
GRANT ALL ON public.bling_tokens TO service_role;
ALTER TABLE public.bling_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bling_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.bling_oauth_states TO service_role;
ALTER TABLE public.bling_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER bling_tokens_updated_at BEFORE UPDATE ON public.bling_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();