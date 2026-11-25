-- ============================================================
-- render.os · Acessos por empresa × aba × nível
-- Cada pessoa recebe, por empresa, um nível em cada aba:
--   1 = só vê · 2 = vê e edita · (sem linha) = sem acesso.
-- Administrador do render.os (papel 'controller') tem tudo e gerencia acessos.
-- O banco passa a conferir essas permissões em todos os módulos.
-- Pode ser executado mais de uma vez.
-- ============================================================

-- ---------- 1) Tabela de acessos ----------
CREATE TABLE IF NOT EXISTS public.os_acessos (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'render','union','dompablyto','nortrip','erks','sxpaper' ou 'grupo' (áreas do grupo, ex.: IA)
  empresa text NOT NULL,
  -- aba, ex.: 'fin.lancamentos', 'con.atividades', 'cx.followup', 'ia.entregas'
  recurso text NOT NULL,
  nivel smallint NOT NULL CHECK (nivel IN (1, 2)),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, empresa, recurso)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_acessos TO authenticated;
GRANT ALL ON public.os_acessos TO service_role;
ALTER TABLE public.os_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS os_acessos_select ON public.os_acessos;
CREATE POLICY os_acessos_select ON public.os_acessos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_controller(auth.uid()));
DROP POLICY IF EXISTS os_acessos_admin ON public.os_acessos;
CREATE POLICY os_acessos_admin ON public.os_acessos FOR ALL TO authenticated
  USING (public.is_controller(auth.uid())) WITH CHECK (public.is_controller(auth.uid()));

CREATE OR REPLACE FUNCTION public.os_acessos_carimbo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); NEW.atualizado_por := auth.uid(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_os_acessos_carimbo ON public.os_acessos;
CREATE TRIGGER trg_os_acessos_carimbo BEFORE INSERT OR UPDATE ON public.os_acessos
FOR EACH ROW EXECUTE FUNCTION public.os_acessos_carimbo();

-- ---------- 2) Funções de permissão ----------
-- Empresa do render.os a partir do id da tabela companies.
CREATE OR REPLACE FUNCTION public.os_empresa_de(_company uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE c.slug
    WHEN 'render-comex' THEN 'render'
    WHEN 'union-contadores' THEN 'union'
    WHEN 'dom-pablyto' THEN 'dompablyto'
    WHEN 'use-noronha' THEN 'nortrip'
    WHEN 'erks' THEN 'erks'
    WHEN 'sx-paper' THEN 'sxpaper'
    ELSE c.slug END
  FROM public.companies c WHERE c.id = _company
$$;

-- Nível de uma pessoa numa aba de uma empresa (0, 1 ou 2).
CREATE OR REPLACE FUNCTION public.os_nivel(_uid uuid, _empresa text, _recurso text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN 0
    WHEN public.is_controller(_uid) THEN 2
    ELSE COALESCE((SELECT a.nivel::int FROM public.os_acessos a
                   WHERE a.user_id = _uid AND a.empresa = _empresa AND a.recurso = _recurso), 0)
  END
$$;

-- Maior nível entre as abas de um módulo (prefixo, ex.: 'fin.').
CREATE OR REPLACE FUNCTION public.os_nivel_modulo(_uid uuid, _empresa text, _prefixo text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN 0
    WHEN public.is_controller(_uid) THEN 2
    ELSE COALESCE((SELECT max(a.nivel)::int FROM public.os_acessos a
                   WHERE a.user_id = _uid AND a.empresa = _empresa AND a.recurso LIKE _prefixo || '%'), 0)
  END
$$;

CREATE OR REPLACE FUNCTION public.os_nivel_company(_uid uuid, _company uuid, _recurso text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel(_uid, public.os_empresa_de(_company), _recurso)
$$;

-- Para o servidor/telas: a pessoa logada pode isto?
CREATE OR REPLACE FUNCTION public.os_pode(_empresa text, _recurso text, _min integer DEFAULT 1)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel(auth.uid(), _empresa, _recurso) >= _min
$$;
CREATE OR REPLACE FUNCTION public.os_pode_company(_company uuid, _recurso text, _min integer DEFAULT 1)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel_company(auth.uid(), _company, _recurso) >= _min
$$;

REVOKE ALL ON FUNCTION public.os_empresa_de(uuid), public.os_nivel(uuid, text, text),
  public.os_nivel_modulo(uuid, text, text), public.os_nivel_company(uuid, uuid, text),
  public.os_pode(text, text, integer), public.os_pode_company(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.os_empresa_de(uuid), public.os_nivel(uuid, text, text),
  public.os_nivel_modulo(uuid, text, text), public.os_nivel_company(uuid, uuid, text),
  public.os_pode(text, text, integer), public.os_pode_company(uuid, text, integer) TO authenticated, service_role;

-- ---------- 3) Leva os acessos de hoje para o novo modelo (só na primeira vez) ----------
DO $$
DECLARE
  fin text[] := ARRAY['fin.dashboard','fin.lancamentos','fin.fluxo','fin.simulacoes','fin.plano','fin.centros'];
BEGIN
  IF EXISTS (SELECT 1 FROM public.os_acessos) THEN RETURN; END IF;

  -- Financeiro: quem tinha empresas liberadas. CEO (só leitura) = 1; demais = 2.
  INSERT INTO public.os_acessos (user_id, empresa, recurso, nivel)
  SELECT uc.user_id, public.os_empresa_de(uc.company_id), r,
         CASE WHEN EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = uc.user_id AND x.role = 'ceo_viewer')
               AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = uc.user_id AND x.role = 'financial_manager')
              THEN 1 ELSE 2 END
  FROM public.user_companies uc
  CROSS JOIN unnest(fin || CASE WHEN public.os_empresa_de(uc.company_id) = 'nortrip' THEN ARRAY['fin.bling'] ELSE ARRAY[]::text[] END) r
  WHERE NOT public.is_controller(uc.user_id) AND public.os_empresa_de(uc.company_id) IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Operacional da Union: equipe do Contábil.
  IF to_regclass('public.contabil_membros') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.os_acessos (user_id, empresa, recurso, nivel)
      SELECT m.user_id, 'union', r.recurso, r.nivel
      FROM public.contabil_membros m
      CROSS JOIN LATERAL (
        SELECT * FROM (VALUES
          ('con.painel', 2), ('con.atividades', 2), ('con.clientes', CASE WHEN m.papel = 'admin' THEN 2 ELSE 1 END),
          ('con.equipe', CASE WHEN m.papel = 'admin' THEN 2 ELSE 0 END),
          ('con.cadastros', CASE WHEN m.papel = 'admin' THEN 2 ELSE 0 END),
          ('con.bases', CASE WHEN m.papel = 'admin' THEN 2 ELSE 0 END),
          ('con.importar', CASE WHEN m.papel = 'admin' THEN 2 ELSE 0 END)
        ) v(recurso, nivel)
      ) r
      WHERE m.ativo AND r.nivel > 0 AND NOT public.is_controller(m.user_id)
      ON CONFLICT DO NOTHING
    $q$;
  END IF;

  -- IA (área do grupo).
  IF to_regclass('public.ia_acesso') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.os_acessos (user_id, empresa, recurso, nivel)
      SELECT a.user_id, 'grupo', r, CASE WHEN a.papel = 'leitor' THEN 1 ELSE 2 END
      FROM public.ia_acesso a
      CROSS JOIN unnest(ARRAY['ia.visao','ia.entregas','ia.empresas','ia.treinamento']) r
      WHERE NOT public.is_controller(a.user_id)
      ON CONFLICT DO NOTHING
    $q$;
  END IF;

  -- Follow-up da Render Comex.
  IF to_regclass('public.cs_equipe') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.os_acessos (user_id, empresa, recurso, nivel)
      SELECT e.user_id, 'render', r, 2
      FROM public.cs_equipe e
      CROSS JOIN unnest(ARRAY['cx.followup','cx.clientes']) r
      WHERE NOT public.is_controller(e.user_id)
      ON CONFLICT DO NOTHING
    $q$;
  END IF;
END $$;

-- ---------- 4) Financeiro ----------
-- Vê dados de uma empresa quem tem alguma aba do financeiro nela.
CREATE OR REPLACE FUNCTION public.user_has_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.os_nivel_modulo(_user_id, public.os_empresa_de(_company_id), 'fin.') >= 1
  END
$function$;

-- "Só leitura" = não edita nenhuma aba do financeiro (usado por tabelas mais antigas).
CREATE OR REPLACE FUNCTION public.user_is_ceo_only(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT NOT public.is_controller(_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.os_acessos WHERE user_id = _user_id AND recurso LIKE 'fin.%' AND nivel = 2)
$function$;

-- Empresas aparecem para quem tem qualquer aba nelas.
DROP POLICY IF EXISTS "companies_visible" ON public.companies;
CREATE POLICY "companies_visible" ON public.companies FOR SELECT TO authenticated
  USING (public.is_controller(auth.uid())
    OR EXISTS (SELECT 1 FROM public.os_acessos a WHERE a.user_id = auth.uid() AND a.empresa = public.os_empresa_de(companies.id)));

-- Escrita por aba.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('transactions', 'tx', 'fin.lancamentos'),
    ('accounts', 'acc', 'fin.plano'),
    ('account_groups', 'ag', 'fin.plano'),
    ('account_subgroups', 'asg', 'fin.plano'),
    ('cost_centers', 'cc', 'fin.centros')
  ) v(tabela, pre, recurso) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pre || '_write', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pre || '_insert', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pre || '_update', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pre || '_delete', t.tabela);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.os_nivel_company(auth.uid(), company_id, %L) = 2)', t.pre || '_insert', t.tabela, t.recurso);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.os_nivel_company(auth.uid(), company_id, %L) = 2) WITH CHECK (public.os_nivel_company(auth.uid(), company_id, %L) = 2)', t.pre || '_update', t.tabela, t.recurso, t.recurso);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.os_nivel_company(auth.uid(), company_id, %L) = 2)', t.pre || '_delete', t.tabela, t.recurso);
  END LOOP;
END $$;

-- De-para de contas (aba Plano de contas).
DROP POLICY IF EXISTS am_insert ON public.account_mappings;
DROP POLICY IF EXISTS am_update ON public.account_mappings;
DROP POLICY IF EXISTS am_delete ON public.account_mappings;
CREATE POLICY am_insert ON public.account_mappings FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel_company(auth.uid(), company_id, 'fin.plano') = 2);
CREATE POLICY am_update ON public.account_mappings FOR UPDATE TO authenticated
  USING (public.os_nivel_company(auth.uid(), company_id, 'fin.plano') = 2)
  WITH CHECK (public.os_nivel_company(auth.uid(), company_id, 'fin.plano') = 2);
CREATE POLICY am_delete ON public.account_mappings FOR DELETE TO authenticated
  USING (public.os_nivel_company(auth.uid(), company_id, 'fin.plano') = 2);

-- Simulações: ver e editar pela aba Simulações.
DROP POLICY IF EXISTS "simulations_select" ON public.simulations;
DROP POLICY IF EXISTS "simulations_insert" ON public.simulations;
DROP POLICY IF EXISTS "simulations_update" ON public.simulations;
DROP POLICY IF EXISTS "simulations_delete" ON public.simulations;
CREATE POLICY "simulations_select" ON public.simulations FOR SELECT TO authenticated
  USING (public.os_nivel_company(auth.uid(), company_id, 'fin.simulacoes') >= 1);
CREATE POLICY "simulations_insert" ON public.simulations FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel_company(auth.uid(), company_id, 'fin.simulacoes') = 2);
CREATE POLICY "simulations_update" ON public.simulations FOR UPDATE TO authenticated
  USING (public.os_nivel_company(auth.uid(), company_id, 'fin.simulacoes') = 2)
  WITH CHECK (public.os_nivel_company(auth.uid(), company_id, 'fin.simulacoes') = 2);
CREATE POLICY "simulations_delete" ON public.simulations FOR DELETE TO authenticated
  USING (public.os_nivel_company(auth.uid(), company_id, 'fin.simulacoes') = 2);

DROP POLICY IF EXISTS "sim_lines_select" ON public.simulation_lines;
DROP POLICY IF EXISTS "sim_lines_write" ON public.simulation_lines;
CREATE POLICY "sim_lines_select" ON public.simulation_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id
    AND public.os_nivel_company(auth.uid(), s.company_id, 'fin.simulacoes') >= 1));
CREATE POLICY "sim_lines_write" ON public.simulation_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id
    AND public.os_nivel_company(auth.uid(), s.company_id, 'fin.simulacoes') = 2))
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id
    AND public.os_nivel_company(auth.uid(), s.company_id, 'fin.simulacoes') = 2));

-- ---------- 5) Operacional da Union (Contábil) ----------
-- O acesso às abas vem de os_acessos; o papel interno (admin/coordenador/analista)
-- e o setor continuam em Contábil › Equipe, porque definem quem vê quais atividades.
CREATE OR REPLACE FUNCTION public.contabil_tem_acesso(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel_modulo(_uid, 'union', 'con.') >= 1
$$;
CREATE OR REPLACE FUNCTION public.contabil_is_membro(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.contabil_tem_acesso(_uid)
     AND EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = _uid AND ativo)
$$;
-- Administrador do Contábil = papel admin na equipe, ou "editar" numa aba administrativa
-- (Equipe, Setores e tipos, Bases da Union, Importar planilha).
CREATE OR REPLACE FUNCTION public.contabil_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.contabil_tem_acesso(_uid) AND (
    EXISTS (SELECT 1 FROM unnest(ARRAY['con.equipe','con.cadastros','con.bases','con.importar']) r
            WHERE public.os_nivel(_uid, 'union', r) = 2)
    OR EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = _uid AND ativo AND papel = 'admin')
  )
$$;
CREATE OR REPLACE FUNCTION public.contabil_papel_de(_uid uuid)
RETURNS public.contabil_papel LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT public.contabil_tem_acesso(_uid) THEN NULL
    WHEN public.contabil_is_admin(_uid) THEN 'admin'::public.contabil_papel
    ELSE (SELECT CASE WHEN papel = 'admin' THEN 'coordenador'::public.contabil_papel ELSE papel END
          FROM public.contabil_membros WHERE user_id = _uid AND ativo)
  END
$$;
CREATE OR REPLACE FUNCTION public.contabil_global(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.contabil_is_admin(_uid)
      OR (public.contabil_tem_acesso(_uid)
          AND EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = _uid AND ativo AND atribuicao_global))
$$;
REVOKE ALL ON FUNCTION public.contabil_tem_acesso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabil_tem_acesso(uuid) TO authenticated, service_role;

-- Travas por aba (RESTRICTIVE: somam-se às regras que já existem).
DROP POLICY IF EXISTS os_con_atividades_ver ON public.contabil_atividades;
CREATE POLICY os_con_atividades_ver ON public.contabil_atividades AS RESTRICTIVE FOR SELECT TO authenticated
  USING (GREATEST(public.os_nivel(auth.uid(), 'union', 'con.atividades'), public.os_nivel(auth.uid(), 'union', 'con.painel')) >= 1);
DROP POLICY IF EXISTS os_con_atividades_ins ON public.contabil_atividades;
CREATE POLICY os_con_atividades_ins ON public.contabil_atividades AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel(auth.uid(), 'union', 'con.atividades') = 2);
DROP POLICY IF EXISTS os_con_atividades_upd ON public.contabil_atividades;
CREATE POLICY os_con_atividades_upd ON public.contabil_atividades AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.atividades') = 2);
DROP POLICY IF EXISTS os_con_atividades_del ON public.contabil_atividades;
CREATE POLICY os_con_atividades_del ON public.contabil_atividades AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.atividades') = 2);

DROP POLICY IF EXISTS os_con_clientes_ins ON public.contabil_clientes;
CREATE POLICY os_con_clientes_ins ON public.contabil_clientes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel(auth.uid(), 'union', 'con.clientes') = 2 OR public.os_nivel(auth.uid(), 'union', 'con.importar') = 2);
DROP POLICY IF EXISTS os_con_clientes_upd ON public.contabil_clientes;
CREATE POLICY os_con_clientes_upd ON public.contabil_clientes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.clientes') = 2 OR public.os_nivel(auth.uid(), 'union', 'con.importar') = 2);
DROP POLICY IF EXISTS os_con_clientes_del ON public.contabil_clientes;
CREATE POLICY os_con_clientes_del ON public.contabil_clientes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.clientes') = 2);

DROP POLICY IF EXISTS os_con_setores_upd ON public.contabil_setores;
CREATE POLICY os_con_setores_upd ON public.contabil_setores AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.cadastros') = 2);
DROP POLICY IF EXISTS os_con_setores_ins ON public.contabil_setores;
CREATE POLICY os_con_setores_ins ON public.contabil_setores AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel(auth.uid(), 'union', 'con.cadastros') = 2);
DROP POLICY IF EXISTS os_con_setores_del ON public.contabil_setores;
CREATE POLICY os_con_setores_del ON public.contabil_setores AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.cadastros') = 2);

DROP POLICY IF EXISTS os_con_categorias_upd ON public.contabil_categorias;
CREATE POLICY os_con_categorias_upd ON public.contabil_categorias AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.cadastros') = 2);
DROP POLICY IF EXISTS os_con_categorias_del ON public.contabil_categorias;
CREATE POLICY os_con_categorias_del ON public.contabil_categorias AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.cadastros') = 2);
-- Criar tipo de atividade na hora de abrir uma atividade continua permitido a quem edita Atividades.
DROP POLICY IF EXISTS os_con_categorias_ins ON public.contabil_categorias;
CREATE POLICY os_con_categorias_ins ON public.contabil_categorias AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (GREATEST(public.os_nivel(auth.uid(), 'union', 'con.cadastros'), public.os_nivel(auth.uid(), 'union', 'con.atividades')) = 2);

DROP POLICY IF EXISTS os_con_membros_ins ON public.contabil_membros;
CREATE POLICY os_con_membros_ins ON public.contabil_membros AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel(auth.uid(), 'union', 'con.equipe') = 2);
DROP POLICY IF EXISTS os_con_membros_upd ON public.contabil_membros;
CREATE POLICY os_con_membros_upd ON public.contabil_membros AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.equipe') = 2);
DROP POLICY IF EXISTS os_con_membros_del ON public.contabil_membros;
CREATE POLICY os_con_membros_del ON public.contabil_membros AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.os_nivel(auth.uid(), 'union', 'con.equipe') = 2);

-- Quem ganha acesso ao Operacional da Union entra na equipe do Contábil
-- (como analista, sem setor; o setor e o papel se ajustam em Contábil › Equipe).
-- Quem perde todas as abas sai da equipe (fica inativo, histórico preservado).
CREATE OR REPLACE FUNCTION public.os_sincroniza_contabil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  IF to_regclass('public.contabil_membros') IS NULL THEN RETURN NULL; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.empresa = 'union' AND NEW.recurso LIKE 'con.%' THEN
    INSERT INTO public.contabil_membros (user_id, nome, email, papel, ativo)
    SELECT u.id, COALESCE(p.full_name, u.email, ''), u.email, 'analista', true
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = v_uid
    ON CONFLICT (user_id) DO UPDATE SET ativo = true;
  ELSIF TG_OP = 'DELETE' AND OLD.empresa = 'union' AND OLD.recurso LIKE 'con.%' THEN
    IF NOT EXISTS (SELECT 1 FROM public.os_acessos WHERE user_id = v_uid AND empresa = 'union' AND recurso LIKE 'con.%') THEN
      UPDATE public.contabil_membros SET ativo = false WHERE user_id = v_uid;
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.os_sincroniza_contabil() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_os_sincroniza_contabil ON public.os_acessos;
CREATE TRIGGER trg_os_sincroniza_contabil AFTER INSERT OR UPDATE OR DELETE ON public.os_acessos
FOR EACH ROW EXECUTE FUNCTION public.os_sincroniza_contabil();

-- ---------- 6) IA (área do grupo) ----------
CREATE OR REPLACE FUNCTION public.ia_pode_ver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel_modulo(_uid, 'grupo', 'ia.') >= 1
$$;
CREATE OR REPLACE FUNCTION public.ia_pode_editar(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel_modulo(_uid, 'grupo', 'ia.') = 2
$$;
CREATE OR REPLACE FUNCTION public.ia_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_controller(_uid)
$$;
-- O acesso agora é dado em Pessoas › Acessos; o atalho de "primeiro admin" sai de cena.
CREATE OR REPLACE FUNCTION public.ia_bootstrap_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;

DROP POLICY IF EXISTS ia_solucoes_write ON public.ia_solucoes;
CREATE POLICY ia_solucoes_write ON public.ia_solucoes FOR ALL TO authenticated
  USING (public.os_nivel(auth.uid(), 'grupo', 'ia.entregas') = 2)
  WITH CHECK (public.os_nivel(auth.uid(), 'grupo', 'ia.entregas') = 2);
DROP POLICY IF EXISTS ia_atualizacoes_insert ON public.ia_atualizacoes;
CREATE POLICY ia_atualizacoes_insert ON public.ia_atualizacoes FOR INSERT TO authenticated
  WITH CHECK (public.os_nivel(auth.uid(), 'grupo', 'ia.entregas') = 2);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ia_pessoas', 'ia_modulos', 'ia_progresso'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_write ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated USING (public.os_nivel(auth.uid(), %2$L, %3$L) = 2) WITH CHECK (public.os_nivel(auth.uid(), %2$L, %3$L) = 2)', t, 'grupo', 'ia.treinamento');
  END LOOP;
END $$;

-- ---------- 7) Follow-up da Render Comex ----------
CREATE OR REPLACE FUNCTION public.cs_is_equipe(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.os_nivel_modulo(_uid, 'render', 'cx.') >= 1
$$;
CREATE OR REPLACE FUNCTION public.cs_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_controller(_uid)
$$;
CREATE OR REPLACE FUNCTION public.cs_bootstrap_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;

DROP POLICY IF EXISTS cs_clientes_equipe ON public.cs_clientes;
DROP POLICY IF EXISTS cs_clientes_ver ON public.cs_clientes;
DROP POLICY IF EXISTS cs_clientes_editar ON public.cs_clientes;
CREATE POLICY cs_clientes_ver ON public.cs_clientes FOR SELECT TO authenticated
  USING (public.cs_is_equipe(auth.uid()));
CREATE POLICY cs_clientes_editar ON public.cs_clientes FOR ALL TO authenticated
  USING (public.os_nivel(auth.uid(), 'render', 'cx.clientes') = 2)
  WITH CHECK (public.os_nivel(auth.uid(), 'render', 'cx.clientes') = 2);

DROP POLICY IF EXISTS cs_processos_equipe ON public.cs_processos;
DROP POLICY IF EXISTS cs_processos_ver ON public.cs_processos;
DROP POLICY IF EXISTS cs_processos_editar ON public.cs_processos;
CREATE POLICY cs_processos_ver ON public.cs_processos FOR SELECT TO authenticated
  USING (public.cs_is_equipe(auth.uid()));
CREATE POLICY cs_processos_editar ON public.cs_processos FOR ALL TO authenticated
  USING (public.os_nivel(auth.uid(), 'render', 'cx.followup') = 2)
  WITH CHECK (public.os_nivel(auth.uid(), 'render', 'cx.followup') = 2);

DROP POLICY IF EXISTS cs_atualizacoes_equipe ON public.cs_atualizacoes;
DROP POLICY IF EXISTS cs_atualizacoes_ver ON public.cs_atualizacoes;
DROP POLICY IF EXISTS cs_atualizacoes_editar ON public.cs_atualizacoes;
CREATE POLICY cs_atualizacoes_ver ON public.cs_atualizacoes FOR SELECT TO authenticated
  USING (public.cs_is_equipe(auth.uid()));
CREATE POLICY cs_atualizacoes_editar ON public.cs_atualizacoes FOR ALL TO authenticated
  USING (public.os_nivel(auth.uid(), 'render', 'cx.followup') = 2)
  WITH CHECK (public.os_nivel(auth.uid(), 'render', 'cx.followup') = 2);

-- Autor do feed pelo nome do perfil.
CREATE OR REPLACE FUNCTION public.cs_atualizacao_autor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.autor_id := auth.uid();
  IF NEW.autor IS NULL OR NEW.autor = '' THEN
    SELECT COALESCE(p.full_name, u.email) INTO NEW.autor
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = auth.uid();
  END IF;
  RETURN NEW;
END $$;

-- ---------- 8) Quem é interno / cliente (redirecionamento após o login) ----------
CREATE OR REPLACE FUNCTION public.render_os_perfil()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'interno', auth.uid() IS NOT NULL AND (public.is_controller(auth.uid())
               OR EXISTS (SELECT 1 FROM public.os_acessos WHERE user_id = auth.uid())),
    'cliente', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.cs_clientes c WHERE public.cs_is_cliente(auth.uid(), c.id))
  )
$$;

-- ---------- 9) Lista para a tela Pessoas › Acessos (só administradores) ----------
DROP FUNCTION IF EXISTS public.acessos_usuarios();
CREATE FUNCTION public.acessos_usuarios()
RETURNS TABLE (id uuid, nome text, email text, criado_em timestamptz, ultimo_acesso timestamptz,
               admin boolean, cliente boolean, acessos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, COALESCE(p.full_name, u.email)::text, u.email::text, u.created_at, u.last_sign_in_at,
    public.is_controller(u.id),
    EXISTS (SELECT 1 FROM public.cs_clientes c WHERE public.cs_is_cliente(u.id, c.id)),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('empresa', a.empresa, 'recurso', a.recurso, 'nivel', a.nivel))
              FROM public.os_acessos a WHERE a.user_id = u.id), '[]'::jsonb)
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.is_controller(auth.uid())
  ORDER BY u.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.acessos_usuarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acessos_usuarios() TO authenticated;
