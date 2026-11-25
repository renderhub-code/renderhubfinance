-- ============================================================
-- render.os · Departamento de IA
-- Entregas (plataformas, automações, painéis, agentes), diário de
-- atualizações, capacitação do time e acesso.
-- Tudo com prefixo ia_; não altera nenhuma tabela existente.
-- Pode ser executado mais de uma vez (idempotente).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.ia_papel AS ENUM ('admin', 'colaborador', 'leitor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Acesso ao módulo ----------
CREATE TABLE IF NOT EXISTS public.ia_acesso (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text,
  papel public.ia_papel NOT NULL DEFAULT 'leitor',
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Entregas do departamento ----------
CREATE TABLE IF NOT EXISTS public.ia_solucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'Automação'
    CHECK (tipo IN ('Plataforma', 'Automação', 'Painel', 'Agente de IA')),
  status text NOT NULL DEFAULT 'Ideia'
    CHECK (status IN ('Produção', 'Em desenvolvimento', 'Ideia', 'Pausada')),
  ganho numeric NOT NULL DEFAULT 0 CHECK (ganho >= 0),
  custo numeric NOT NULL DEFAULT 0 CHECK (custo >= 0),
  horas numeric NOT NULL DEFAULT 0 CHECK (horas >= 0),
  link text,
  responsavel text,
  descricao text,
  -- ids das empresas do grupo (render, union, dompablyto, nortrip, erks, sxpaper)
  empresas text[] NOT NULL DEFAULT '{}',
  previsao date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Diário: o que aconteceu em cada entrega ----------
CREATE TABLE IF NOT EXISTS public.ia_atualizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solucao_id uuid NOT NULL REFERENCES public.ia_solucoes(id) ON DELETE CASCADE,
  texto text NOT NULL,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_atualizacoes_solucao ON public.ia_atualizacoes(solucao_id, criado_em DESC);

-- ---------- Capacitação do time ----------
CREATE TABLE IF NOT EXISTS public.ia_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ia_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ia_progresso (
  pessoa_id uuid NOT NULL REFERENCES public.ia_pessoas(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.ia_modulos(id) ON DELETE CASCADE,
  status smallint NOT NULL DEFAULT 0 CHECK (status BETWEEN 0 AND 2),
  PRIMARY KEY (pessoa_id, modulo_id)
);

-- ---------- Funções de acesso ----------
CREATE OR REPLACE FUNCTION public.ia_pode_ver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ia_acesso WHERE user_id = _uid)
$$;
CREATE OR REPLACE FUNCTION public.ia_pode_editar(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ia_acesso WHERE user_id = _uid AND papel IN ('admin', 'colaborador'))
$$;
CREATE OR REPLACE FUNCTION public.ia_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ia_acesso WHERE user_id = _uid AND papel = 'admin')
$$;
REVOKE ALL ON FUNCTION public.ia_pode_ver(uuid), public.ia_pode_editar(uuid), public.ia_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_pode_ver(uuid), public.ia_pode_editar(uuid), public.ia_is_admin(uuid) TO authenticated, service_role;

-- Primeiro acesso: se o módulo ainda não tem administrador, quem chamar vira admin.
CREATE OR REPLACE FUNCTION public.ia_bootstrap_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.ia_acesso WHERE papel = 'admin') THEN RETURN false; END IF;
  SELECT COALESCE(p.full_name, u.email), u.email INTO v_nome, v_email
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = auth.uid();
  INSERT INTO public.ia_acesso (user_id, nome, email, papel)
  VALUES (auth.uid(), COALESCE(v_nome, ''), v_email, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET papel = 'admin';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ia_bootstrap_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_bootstrap_admin() TO authenticated;

-- Usuários do render.os que o admin do módulo pode liberar.
CREATE OR REPLACE FUNCTION public.ia_usuarios_disponiveis()
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, COALESCE(p.full_name, u.email)::text, u.email::text
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.ia_is_admin(auth.uid())
  ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.ia_usuarios_disponiveis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_usuarios_disponiveis() TO authenticated;

-- atualizado_em automático
CREATE OR REPLACE FUNCTION public.ia_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_ia_solucoes_touch ON public.ia_solucoes;
CREATE TRIGGER trg_ia_solucoes_touch BEFORE UPDATE ON public.ia_solucoes
FOR EACH ROW EXECUTE FUNCTION public.ia_touch();

-- Autor do diário é sempre quem está logado.
CREATE OR REPLACE FUNCTION public.ia_atualizacao_autor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.autor_id := auth.uid();
  SELECT nome INTO NEW.autor_nome FROM public.ia_acesso WHERE user_id = auth.uid();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ia_atualizacao_autor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ia_atualizacao_autor ON public.ia_atualizacoes;
CREATE TRIGGER trg_ia_atualizacao_autor BEFORE INSERT ON public.ia_atualizacoes
FOR EACH ROW EXECUTE FUNCTION public.ia_atualizacao_autor();

-- ---------- Permissões e RLS ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.ia_acesso, public.ia_solucoes, public.ia_atualizacoes,
  public.ia_pessoas, public.ia_modulos, public.ia_progresso
TO authenticated;
GRANT ALL ON
  public.ia_acesso, public.ia_solucoes, public.ia_atualizacoes,
  public.ia_pessoas, public.ia_modulos, public.ia_progresso
TO service_role;

ALTER TABLE public.ia_acesso       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_solucoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_atualizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_pessoas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_modulos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_progresso    ENABLE ROW LEVEL SECURITY;

-- Acesso: cada um vê o seu; admin vê e gerencia todos.
DROP POLICY IF EXISTS ia_acesso_select ON public.ia_acesso;
CREATE POLICY ia_acesso_select ON public.ia_acesso FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.ia_is_admin(auth.uid()));
DROP POLICY IF EXISTS ia_acesso_admin ON public.ia_acesso;
CREATE POLICY ia_acesso_admin ON public.ia_acesso FOR ALL TO authenticated
  USING (public.ia_is_admin(auth.uid())) WITH CHECK (public.ia_is_admin(auth.uid()));

-- Dados: quem tem acesso lê; admin e colaborador escrevem.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ia_solucoes', 'ia_pessoas', 'ia_modulos', 'ia_progresso'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated USING (public.ia_pode_ver(auth.uid()))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_write ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated USING (public.ia_pode_editar(auth.uid())) WITH CHECK (public.ia_pode_editar(auth.uid()))', t);
  END LOOP;
END $$;

-- Diário: quem tem acesso lê; quem edita escreve; apagar só o próprio registro ou admin.
DROP POLICY IF EXISTS ia_atualizacoes_select ON public.ia_atualizacoes;
CREATE POLICY ia_atualizacoes_select ON public.ia_atualizacoes FOR SELECT TO authenticated
  USING (public.ia_pode_ver(auth.uid()));
DROP POLICY IF EXISTS ia_atualizacoes_insert ON public.ia_atualizacoes;
CREATE POLICY ia_atualizacoes_insert ON public.ia_atualizacoes FOR INSERT TO authenticated
  WITH CHECK (public.ia_pode_editar(auth.uid()));
DROP POLICY IF EXISTS ia_atualizacoes_delete ON public.ia_atualizacoes;
CREATE POLICY ia_atualizacoes_delete ON public.ia_atualizacoes FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.ia_is_admin(auth.uid()));

-- ---------- Dados iniciais ----------
-- Trilha de capacitação (a mesma da Central de IA).
INSERT INTO public.ia_modulos (id, titulo, ordem) VALUES
  ('1a000000-0000-4000-8000-0000000000b1', 'Fundamentos de IA', 1),
  ('1a000000-0000-4000-8000-0000000000b2', 'Engenharia de prompt', 2),
  ('1a000000-0000-4000-8000-0000000000b3', 'Automação com agentes', 3),
  ('1a000000-0000-4000-8000-0000000000b4', 'Dados e privacidade', 4),
  ('1a000000-0000-4000-8000-0000000000b5', 'Medição de resultado', 5)
ON CONFLICT (id) DO NOTHING;

-- Entregas que o departamento já tem hoje. Ganho, custo e horas ficam zerados para você preencher.
INSERT INTO public.ia_solucoes (id, titulo, tipo, status, empresas, descricao) VALUES
  ('1a000000-0000-4000-8000-0000000000c1', 'render.os — plataforma do grupo', 'Plataforma', 'Em desenvolvimento',
   '{render,union,dompablyto,nortrip,erks,sxpaper}',
   'Sistema único do Grupo Render Hub: financeiro, contábil, IA e próximos módulos em um só login.'),
  ('1a000000-0000-4000-8000-0000000000c2', 'Contábil › Tarefas (Union)', 'Plataforma', 'Em desenvolvimento',
   '{union}',
   'Atividades da Union Contadores por setor, com prazos, ciência e alerta de nova atividade. Migrado do Hub Contábil para o render.os.'),
  ('1a000000-0000-4000-8000-0000000000c3', 'Integração Bling → Financeiro', 'Automação', 'Produção',
   '{nortrip}',
   'Importação diária de dados do Bling para o financeiro da Nortrip.'),
  ('1a000000-0000-4000-8000-0000000000c4', 'Central de IA (este módulo)', 'Painel', 'Em desenvolvimento',
   '{render,union,dompablyto,nortrip,erks,sxpaper}',
   'Controle do que o departamento de IA está entregando: ganho, custo, horas, status e capacitação.')
ON CONFLICT (id) DO NOTHING;
