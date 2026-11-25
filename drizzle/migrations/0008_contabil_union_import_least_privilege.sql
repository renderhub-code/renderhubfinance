REVOKE ALL ON TABLE public.contabil_bases_union, public.contabil_identidades_union FROM anon, authenticated;
GRANT SELECT ON TABLE public.contabil_bases_union, public.contabil_identidades_union TO authenticated;
GRANT ALL ON TABLE public.contabil_bases_union, public.contabil_identidades_union TO service_role;