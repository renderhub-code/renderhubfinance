-- ============================================================
-- render.os · Contábil › Tarefas
-- Traz o Hub Contábil (Union) para o banco do render.os.
-- Tudo com prefixo contabil_; não altera nenhuma tabela existente.
-- Pode ser executado mais de uma vez (idempotente).
-- ============================================================

-- ---------- Tipos ----------
DO $$ BEGIN
  CREATE TYPE public.contabil_papel AS ENUM ('admin', 'coordenador', 'analista');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contabil_status AS ENUM ('nao_iniciado', 'em_andamento', 'concluido', 'atrasado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Setores ----------
CREATE TABLE IF NOT EXISTS public.contabil_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordem int NOT NULL DEFAULT 100,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Equipe (quem usa o Contábil, com papel e setor) ----------
CREATE TABLE IF NOT EXISTS public.contabil_membros (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text,
  setor_id uuid REFERENCES public.contabil_setores(id) ON DELETE SET NULL,
  papel public.contabil_papel NOT NULL DEFAULT 'analista',
  atribuicao_global boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Tipos de atividade por setor ----------
CREATE TABLE IF NOT EXISTS public.contabil_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES public.contabil_setores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setor_id, nome)
);

-- ---------- Empresas clientes da Union ----------
CREATE TABLE IF NOT EXISTS public.contabil_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  cnpj_digits text UNIQUE,
  codigo_dominio text,
  apelido text,
  grupo_economico text,
  regime text,
  segmento text,
  uf text,
  cidade text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Atividades ----------
CREATE TABLE IF NOT EXISTS public.contabil_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES public.contabil_setores(id) ON DELETE RESTRICT,
  categoria_id uuid REFERENCES public.contabil_categorias(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.contabil_clientes(id) ON DELETE SET NULL,
  atividade text NOT NULL,
  responsavel_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  prioridade smallint NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 4),
  status public.contabil_status NOT NULL DEFAULT 'nao_iniciado',
  prazo date,
  follow_up text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultima_atualizacao timestamptz,
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contabil_atividades_setor ON public.contabil_atividades(setor_id);
CREATE INDEX IF NOT EXISTS idx_contabil_atividades_resp ON public.contabil_atividades(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_contabil_atividades_cliente ON public.contabil_atividades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contabil_atividades_categoria ON public.contabil_atividades(categoria_id);

-- ---------- Ciência do responsável ----------
CREATE TABLE IF NOT EXISTS public.contabil_ciencias (
  atividade_id uuid NOT NULL REFERENCES public.contabil_atividades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciente_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atividade_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_contabil_ciencias_user ON public.contabil_ciencias(user_id);

-- ---------- Permissões de tabela ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.contabil_setores, public.contabil_membros, public.contabil_categorias,
  public.contabil_clientes, public.contabil_atividades, public.contabil_ciencias
TO authenticated;
GRANT ALL ON
  public.contabil_setores, public.contabil_membros, public.contabil_categorias,
  public.contabil_clientes, public.contabil_atividades, public.contabil_ciencias
TO service_role;

ALTER TABLE public.contabil_setores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabil_membros    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabil_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabil_clientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabil_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contabil_ciencias   ENABLE ROW LEVEL SECURITY;

-- ---------- Funções auxiliares (evitam recursão de RLS) ----------
CREATE OR REPLACE FUNCTION public.contabil_papel_de(_uid uuid)
RETURNS public.contabil_papel LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT papel FROM public.contabil_membros WHERE user_id = _uid AND ativo
$$;

CREATE OR REPLACE FUNCTION public.contabil_is_membro(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = _uid AND ativo)
$$;

CREATE OR REPLACE FUNCTION public.contabil_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = _uid AND ativo AND papel = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.contabil_setor_de(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT setor_id FROM public.contabil_membros WHERE user_id = _uid AND ativo
$$;

-- Pode receber/atribuir atividades em qualquer setor (admin ou liberação geral).
CREATE OR REPLACE FUNCTION public.contabil_global(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contabil_membros
    WHERE user_id = _uid AND ativo AND (papel = 'admin' OR atribuicao_global)
  )
$$;

REVOKE ALL ON FUNCTION public.contabil_papel_de(uuid), public.contabil_is_membro(uuid),
  public.contabil_is_admin(uuid), public.contabil_setor_de(uuid), public.contabil_global(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabil_papel_de(uuid), public.contabil_is_membro(uuid),
  public.contabil_is_admin(uuid), public.contabil_setor_de(uuid), public.contabil_global(uuid)
TO authenticated, service_role;

-- Primeiro acesso: se o Contábil ainda não tem administrador, quem chamar vira admin.
CREATE OR REPLACE FUNCTION public.contabil_bootstrap_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.contabil_membros WHERE papel = 'admin' AND ativo) THEN RETURN false; END IF;
  SELECT COALESCE(p.full_name, u.email), u.email INTO v_nome, v_email
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = auth.uid();
  INSERT INTO public.contabil_membros (user_id, nome, email, papel, ativo)
  VALUES (auth.uid(), COALESCE(v_nome, ''), v_email, 'admin', true)
  ON CONFLICT (user_id) DO UPDATE SET papel = 'admin', ativo = true;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.contabil_bootstrap_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabil_bootstrap_admin() TO authenticated;

-- Usuários do render.os que o admin do Contábil pode adicionar à equipe.
CREATE OR REPLACE FUNCTION public.contabil_usuarios_disponiveis()
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, COALESCE(p.full_name, u.email)::text, u.email::text
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.contabil_is_admin(auth.uid())
  ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.contabil_usuarios_disponiveis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabil_usuarios_disponiveis() TO authenticated;

-- ---------- Gatilhos das atividades ----------
CREATE OR REPLACE FUNCTION public.contabil_atividade_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.criado_por IS NULL THEN NEW.criado_por := auth.uid(); END IF;
  ELSE
    NEW.criado_por := OLD.criado_por;
    NEW.criado_em := OLD.criado_em;
    NEW.ultima_atualizacao := now();
    NEW.atualizado_por := auth.uid();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contabil_atividade_metadata() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_contabil_atividade_metadata ON public.contabil_atividades;
CREATE TRIGGER trg_contabil_atividade_metadata
BEFORE INSERT OR UPDATE ON public.contabil_atividades
FOR EACH ROW EXECUTE FUNCTION public.contabil_atividade_metadata();

-- Quem não é admin só altera status, prazo, follow-up, tipo e cliente.
CREATE OR REPLACE FUNCTION public.contabil_atividade_campos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.contabil_is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.setor_id IS DISTINCT FROM OLD.setor_id
     OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
     OR NEW.atividade IS DISTINCT FROM OLD.atividade THEN
    RAISE EXCEPTION 'Somente administradores podem alterar setor, responsável, prioridade ou descrição da atividade.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contabil_atividade_campos() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_contabil_atividade_campos ON public.contabil_atividades;
CREATE TRIGGER trg_contabil_atividade_campos
BEFORE UPDATE ON public.contabil_atividades
FOR EACH ROW EXECUTE FUNCTION public.contabil_atividade_campos();

CREATE OR REPLACE FUNCTION public.contabil_clientes_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.cnpj_digits := NULLIF(regexp_replace(COALESCE(NEW.cnpj, ''), '\D', '', 'g'), '');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contabil_clientes_touch ON public.contabil_clientes;
CREATE TRIGGER trg_contabil_clientes_touch
BEFORE INSERT OR UPDATE ON public.contabil_clientes
FOR EACH ROW EXECUTE FUNCTION public.contabil_clientes_touch();

-- ---------- Políticas (RLS) ----------
-- Setores
DROP POLICY IF EXISTS contabil_setores_select ON public.contabil_setores;
CREATE POLICY contabil_setores_select ON public.contabil_setores FOR SELECT TO authenticated
  USING (public.contabil_is_membro(auth.uid()));
DROP POLICY IF EXISTS contabil_setores_admin ON public.contabil_setores;
CREATE POLICY contabil_setores_admin ON public.contabil_setores FOR ALL TO authenticated
  USING (public.contabil_is_admin(auth.uid())) WITH CHECK (public.contabil_is_admin(auth.uid()));

-- Equipe
DROP POLICY IF EXISTS contabil_membros_select ON public.contabil_membros;
CREATE POLICY contabil_membros_select ON public.contabil_membros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.contabil_is_membro(auth.uid()));
DROP POLICY IF EXISTS contabil_membros_admin ON public.contabil_membros;
CREATE POLICY contabil_membros_admin ON public.contabil_membros FOR ALL TO authenticated
  USING (public.contabil_is_admin(auth.uid())) WITH CHECK (public.contabil_is_admin(auth.uid()));

-- Tipos de atividade
DROP POLICY IF EXISTS contabil_categorias_select ON public.contabil_categorias;
CREATE POLICY contabil_categorias_select ON public.contabil_categorias FOR SELECT TO authenticated
  USING (public.contabil_is_membro(auth.uid()));
DROP POLICY IF EXISTS contabil_categorias_insert ON public.contabil_categorias;
CREATE POLICY contabil_categorias_insert ON public.contabil_categorias FOR INSERT TO authenticated
  WITH CHECK (public.contabil_is_membro(auth.uid()));
DROP POLICY IF EXISTS contabil_categorias_update ON public.contabil_categorias;
CREATE POLICY contabil_categorias_update ON public.contabil_categorias FOR UPDATE TO authenticated
  USING (public.contabil_is_admin(auth.uid())) WITH CHECK (public.contabil_is_admin(auth.uid()));
DROP POLICY IF EXISTS contabil_categorias_delete ON public.contabil_categorias;
CREATE POLICY contabil_categorias_delete ON public.contabil_categorias FOR DELETE TO authenticated
  USING (public.contabil_is_admin(auth.uid()));

-- Clientes
DROP POLICY IF EXISTS contabil_clientes_select ON public.contabil_clientes;
CREATE POLICY contabil_clientes_select ON public.contabil_clientes FOR SELECT TO authenticated
  USING (public.contabil_is_membro(auth.uid()));
DROP POLICY IF EXISTS contabil_clientes_admin ON public.contabil_clientes;
CREATE POLICY contabil_clientes_admin ON public.contabil_clientes FOR ALL TO authenticated
  USING (public.contabil_is_admin(auth.uid())) WITH CHECK (public.contabil_is_admin(auth.uid()));

-- Atividades: admin vê tudo; coordenador vê o setor; analista vê as suas; autor vê as que criou.
DROP POLICY IF EXISTS contabil_atividades_select ON public.contabil_atividades;
CREATE POLICY contabil_atividades_select ON public.contabil_atividades FOR SELECT TO authenticated
USING (
  public.contabil_is_admin(auth.uid())
  OR criado_por = auth.uid()
  OR responsavel_id = auth.uid()
  OR (public.contabil_papel_de(auth.uid()) = 'coordenador' AND setor_id = public.contabil_setor_de(auth.uid()))
);

DROP POLICY IF EXISTS contabil_atividades_insert ON public.contabil_atividades;
CREATE POLICY contabil_atividades_insert ON public.contabil_atividades FOR INSERT TO authenticated
WITH CHECK (
  public.contabil_global(auth.uid())
  OR (
    public.contabil_is_membro(auth.uid())
    AND (
      setor_id = public.contabil_setor_de(auth.uid())
      OR public.contabil_global(responsavel_id)
    )
  )
);

DROP POLICY IF EXISTS contabil_atividades_update ON public.contabil_atividades;
CREATE POLICY contabil_atividades_update ON public.contabil_atividades FOR UPDATE TO authenticated
USING (
  public.contabil_is_admin(auth.uid())
  OR criado_por = auth.uid()
  OR responsavel_id = auth.uid()
  OR (public.contabil_papel_de(auth.uid()) = 'coordenador' AND setor_id = public.contabil_setor_de(auth.uid()))
)
WITH CHECK (
  public.contabil_is_admin(auth.uid())
  OR criado_por = auth.uid()
  OR responsavel_id = auth.uid()
  OR (public.contabil_papel_de(auth.uid()) = 'coordenador' AND setor_id = public.contabil_setor_de(auth.uid()))
);

DROP POLICY IF EXISTS contabil_atividades_delete ON public.contabil_atividades;
CREATE POLICY contabil_atividades_delete ON public.contabil_atividades FOR DELETE TO authenticated
  USING (public.contabil_is_admin(auth.uid()));

-- Ciência
DROP POLICY IF EXISTS contabil_ciencias_select ON public.contabil_ciencias;
CREATE POLICY contabil_ciencias_select ON public.contabil_ciencias FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.contabil_is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contabil_atividades a
    WHERE a.id = contabil_ciencias.atividade_id
      AND (a.criado_por = auth.uid()
           OR (public.contabil_papel_de(auth.uid()) = 'coordenador' AND a.setor_id = public.contabil_setor_de(auth.uid())))
  )
);
DROP POLICY IF EXISTS contabil_ciencias_insert ON public.contabil_ciencias;
CREATE POLICY contabil_ciencias_insert ON public.contabil_ciencias FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------- Tempo real (alerta de nova atividade) ----------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contabil_atividades;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ---------- Dados iniciais ----------
INSERT INTO public.contabil_setores (nome, ordem) VALUES
  ('Contábil', 1), ('Fiscal', 2), ('DP', 3), ('Gerência', 4)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.contabil_categorias (setor_id, nome, ordem)
SELECT s.id, v.nome, v.ordem FROM public.contabil_setores s
JOIN (VALUES
  ('Fiscal', 'Emissão de guias de forma antecipada (DAS, DARF, DAE, etc.)', 1),
  ('Fiscal', 'Reemissão de guias (DAS, DARF, DAE, etc.)', 2),
  ('Fiscal', 'Dúvida sobre Nota Fiscal/CTe', 3),
  ('Fiscal', 'Dúvida sobre Tributação', 4),
  ('Fiscal', 'Dúvida sobre Apuração', 5),
  ('Fiscal', 'Emissão de Nota Fiscal', 6),
  ('Fiscal', 'Emissão de Faturamento – NF', 7),
  ('Fiscal', 'Emissão de Faturamento – Banco', 8),
  ('Fiscal', 'Envio de CND', 9),
  ('Fiscal', 'Emissão de guia de parcelamento', 10),
  ('DP', 'Dúvida/Informação sobre Admissões/Demissões', 1),
  ('DP', 'Dúvida/Informação sobre Folha de pagamento', 2),
  ('DP', 'Dúvida/Informação sobre Férias', 3),
  ('DP', 'Dúvida/Informação sobre Afastamentos (INSS, atestados)', 4),
  ('DP', 'Dúvida/Informação sobre Geração de encargos e Benefícios (FGTS, INSS, VR)', 5),
  ('DP', 'Reemissão de Guias', 6),
  ('DP', 'Emissão de Certidão Negativa (FGTS e trabalhista)', 7),
  ('DP', 'Dúvida/Informação sobre eSocial', 8),
  ('DP', 'Dúvida/Solicitação sobre alteração contratual (salário, função, horário)', 9),
  ('DP', 'Solicitação de relatórios diversos (ficha de registro, declaração de VT)', 10),
  ('DP', 'Dúvida/Informação de assuntos diversos (feriados, licenças, etc)', 11),
  ('Contábil', 'Dúvida IRPF', 1),
  ('Contábil', 'Emissão de relatórios contábeis – Escriturado', 2),
  ('Contábil', 'Emissão de relatórios contábeis – Banco', 3),
  ('Contábil', 'Envio SPED ECF, ECD', 4)
) AS v(setor, nome, ordem) ON v.setor = s.nome
ON CONFLICT (setor_id, nome) DO NOTHING;

INSERT INTO public.contabil_categorias (setor_id, nome, ordem)
SELECT id, 'Outros', 999 FROM public.contabil_setores
ON CONFLICT (setor_id, nome) DO NOTHING;
