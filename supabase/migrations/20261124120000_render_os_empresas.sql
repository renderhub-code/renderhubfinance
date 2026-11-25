-- render.os: atualiza o cadastro de empresas do Grupo Render Hub.
-- Não apaga dados: A&F só é desativada; Use Noronha é renomeada mantendo o slug
-- (a integração Bling e o plano de contas próprio usam `use-noronha`).

UPDATE public.companies SET name = 'Nortrip' WHERE slug = 'use-noronha';

UPDATE public.companies SET active = false WHERE slug = 'a-e-f';

INSERT INTO public.companies (name, slug)
VALUES ('SX Paper', 'sx-paper')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.business_units (company_id, name, slug)
SELECT id, 'Principal', 'principal' FROM public.companies WHERE slug = 'sx-paper'
ON CONFLICT (company_id, slug) DO NOTHING;
