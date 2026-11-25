ALTER TABLE public.contabil_bases_union ADD COLUMN busca text GENERATED ALWAYS AS (lower(dados::text)) STORED;
CREATE FUNCTION public.contabil_resumo_bases_union() RETURNS TABLE(base text, quantidade bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT b.base, count(*) FROM public.contabil_bases_union b GROUP BY b.base ORDER BY b.base $$;
REVOKE ALL ON FUNCTION public.contabil_resumo_bases_union() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabil_resumo_bases_union() TO authenticated, service_role;