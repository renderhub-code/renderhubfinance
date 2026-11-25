CREATE TABLE public.contabil_identidades_union (
  original_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contabil_identidades_union TO authenticated;
GRANT ALL ON public.contabil_identidades_union TO service_role;
ALTER TABLE public.contabil_identidades_union ENABLE ROW LEVEL SECURITY;
CREATE POLICY contabil_identidades_union_admin ON public.contabil_identidades_union FOR SELECT TO authenticated USING (public.contabil_is_admin(auth.uid()));
CREATE TABLE public.contabil_bases_union (
  base text NOT NULL,
  registro_id text NOT NULL,
  destino_id text,
  dados jsonb NOT NULL,
  importado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base, registro_id),
  CONSTRAINT contabil_bases_union_base_check CHECK (base IN ('admin_allowlist','atividade_ciencias','atividades','categorias_atividade','contratos','controle_lancamentos','controle_snapshots','empresas','nibo_obrigacoes','ponto_colaboradores','ponto_dias','ponto_jornadas','ponto_meses','profiles','setores','user_roles'))
);
GRANT SELECT ON public.contabil_bases_union TO authenticated;
GRANT ALL ON public.contabil_bases_union TO service_role;
ALTER TABLE public.contabil_bases_union ENABLE ROW LEVEL SECURITY;
CREATE POLICY contabil_bases_union_admin ON public.contabil_bases_union FOR SELECT TO authenticated USING (public.contabil_is_admin(auth.uid()));
CREATE INDEX contabil_bases_union_destino ON public.contabil_bases_union (base, destino_id);