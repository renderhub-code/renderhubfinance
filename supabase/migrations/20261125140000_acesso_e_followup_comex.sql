-- ============================================================
-- render.os · Correção de acesso + Follow-up da Render Comex
-- 1) Conta nova deixa de virar controller automaticamente.
-- 2) Follow-up ao vivo (cs_*): equipe atualiza as POs e o cliente
--    acompanha pelo portal, vendo só os próprios processos.
-- Pode ser executado mais de uma vez (idempotente).
-- ============================================================

-- ---------- 1) Cadastro sem acesso automático ao financeiro ----------
-- Antes: toda conta nova ganhava 'controller' global (vê o financeiro de todas
-- as empresas). Agora a conta nasce só com o perfil; o acesso é dado por um
-- controller em Pessoas › Acessos. Quem já tem acesso continua com ele.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------- 2) Follow-up da Render Comex ----------
DO $$ BEGIN
  CREATE TYPE public.cs_papel AS ENUM ('admin', 'equipe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cs_etapa AS ENUM ('pedido', 'producao', 'embarque', 'transito', 'porto', 'desembaraco', 'entregue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Equipe interna que atualiza o follow-up.
CREATE TABLE IF NOT EXISTS public.cs_equipe (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text,
  papel public.cs_papel NOT NULL DEFAULT 'equipe',
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Clientes da Render Comex (empresa = id do grupo; começa por 'render').
CREATE TABLE IF NOT EXISTS public.cs_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa text NOT NULL DEFAULT 'render',
  comercial_responsavel text,
  cs_responsavel text,
  -- e-mails do cliente que podem entrar no portal
  emails text[] NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Processos (POs) acompanhados.
CREATE TABLE IF NOT EXISTS public.cs_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.cs_clientes(id) ON DELETE CASCADE,
  po text NOT NULL,
  invoice text,
  mercadoria text NOT NULL,
  container text,
  data_embarque date,
  chegada_prevista date,
  etapa public.cs_etapa NOT NULL DEFAULT 'pedido',
  status_texto text,
  pendencia text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_processos_cliente ON public.cs_processos(cliente_id);

-- Feed de atualizações que o cliente vê.
CREATE TABLE IF NOT EXISTS public.cs_atualizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.cs_processos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.cs_clientes(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  autor text,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_atualizacoes_cliente ON public.cs_atualizacoes(cliente_id, criado_em DESC);

-- ---------- Funções de acesso ----------
CREATE OR REPLACE FUNCTION public.cs_is_equipe(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cs_equipe WHERE user_id = _uid)
$$;
CREATE OR REPLACE FUNCTION public.cs_is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cs_equipe WHERE user_id = _uid AND papel = 'admin')
$$;
-- O cliente entra no portal pelo e-mail cadastrado em cs_clientes.emails.
CREATE OR REPLACE FUNCTION public.cs_is_cliente(_uid uuid, _cliente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cs_clientes c JOIN auth.users u ON u.id = _uid
    WHERE c.id = _cliente_id
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = ANY (SELECT lower(x) FROM unnest(c.emails) x)
  )
$$;
REVOKE ALL ON FUNCTION public.cs_is_equipe(uuid), public.cs_is_admin(uuid), public.cs_is_cliente(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_is_equipe(uuid), public.cs_is_admin(uuid), public.cs_is_cliente(uuid, uuid) TO authenticated, service_role;

-- Primeiro acesso: se o follow-up ainda não tem admin, quem chamar vira admin.
-- Só vale para quem já é da casa (controller do financeiro), nunca para cliente.
CREATE OR REPLACE FUNCTION public.cs_bootstrap_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.cs_equipe WHERE papel = 'admin') THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'controller') THEN RETURN false; END IF;
  SELECT COALESCE(p.full_name, u.email), u.email INTO v_nome, v_email
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = auth.uid();
  INSERT INTO public.cs_equipe (user_id, nome, email, papel)
  VALUES (auth.uid(), COALESCE(v_nome, ''), v_email, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET papel = 'admin';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cs_bootstrap_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_bootstrap_admin() TO authenticated;

-- Usuários do render.os que o admin do follow-up pode colocar na equipe.
CREATE OR REPLACE FUNCTION public.cs_usuarios_disponiveis()
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, COALESCE(p.full_name, u.email)::text, u.email::text
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.cs_is_admin(auth.uid())
  ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.cs_usuarios_disponiveis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_usuarios_disponiveis() TO authenticated;

-- Para onde mandar quem acabou de entrar: equipe interna ou portal do cliente.
CREATE OR REPLACE FUNCTION public.render_os_perfil()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_interno boolean := false;
  v_tem boolean;
  v_cliente boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('interno', false, 'cliente', false); END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid)
      OR EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = v_uid)
      OR EXISTS (SELECT 1 FROM public.cs_equipe WHERE user_id = v_uid)
    INTO v_interno;
  IF NOT v_interno AND to_regclass('public.contabil_membros') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.contabil_membros WHERE user_id = $1 AND ativo)' INTO v_tem USING v_uid;
    v_interno := v_tem;
  END IF;
  IF NOT v_interno AND to_regclass('public.ia_acesso') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.ia_acesso WHERE user_id = $1)' INTO v_tem USING v_uid;
    v_interno := v_tem;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.cs_clientes c WHERE public.cs_is_cliente(v_uid, c.id)) INTO v_cliente;
  RETURN jsonb_build_object('interno', v_interno, 'cliente', v_cliente);
END $$;
REVOKE ALL ON FUNCTION public.render_os_perfil() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.render_os_perfil() TO authenticated;

-- Autor do feed e data de atualização automáticos.
CREATE OR REPLACE FUNCTION public.cs_atualizacao_autor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.autor_id := auth.uid();
  IF NEW.autor IS NULL OR NEW.autor = '' THEN
    SELECT nome INTO NEW.autor FROM public.cs_equipe WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cs_atualizacao_autor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_cs_atualizacao_autor ON public.cs_atualizacoes;
CREATE TRIGGER trg_cs_atualizacao_autor BEFORE INSERT ON public.cs_atualizacoes
FOR EACH ROW EXECUTE FUNCTION public.cs_atualizacao_autor();

CREATE OR REPLACE FUNCTION public.cs_processo_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_cs_processo_touch ON public.cs_processos;
CREATE TRIGGER trg_cs_processo_touch BEFORE UPDATE ON public.cs_processos
FOR EACH ROW EXECUTE FUNCTION public.cs_processo_touch();

-- ---------- Permissões e RLS ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.cs_equipe, public.cs_clientes, public.cs_processos, public.cs_atualizacoes
TO authenticated;
GRANT ALL ON
  public.cs_equipe, public.cs_clientes, public.cs_processos, public.cs_atualizacoes
TO service_role;

ALTER TABLE public.cs_equipe       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_processos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_atualizacoes ENABLE ROW LEVEL SECURITY;

-- Equipe: cada um vê o seu registro; equipe vê a equipe; admin gerencia.
DROP POLICY IF EXISTS cs_equipe_select ON public.cs_equipe;
CREATE POLICY cs_equipe_select ON public.cs_equipe FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cs_is_equipe(auth.uid()));
DROP POLICY IF EXISTS cs_equipe_admin ON public.cs_equipe;
CREATE POLICY cs_equipe_admin ON public.cs_equipe FOR ALL TO authenticated
  USING (public.cs_is_admin(auth.uid())) WITH CHECK (public.cs_is_admin(auth.uid()));

-- Clientes: equipe faz tudo; cliente lê o próprio cadastro.
DROP POLICY IF EXISTS cs_clientes_equipe ON public.cs_clientes;
CREATE POLICY cs_clientes_equipe ON public.cs_clientes FOR ALL TO authenticated
  USING (public.cs_is_equipe(auth.uid())) WITH CHECK (public.cs_is_equipe(auth.uid()));
DROP POLICY IF EXISTS cs_clientes_portal ON public.cs_clientes;
CREATE POLICY cs_clientes_portal ON public.cs_clientes FOR SELECT TO authenticated
  USING (public.cs_is_cliente(auth.uid(), id));

-- Processos: equipe faz tudo; cliente só lê os seus.
DROP POLICY IF EXISTS cs_processos_equipe ON public.cs_processos;
CREATE POLICY cs_processos_equipe ON public.cs_processos FOR ALL TO authenticated
  USING (public.cs_is_equipe(auth.uid())) WITH CHECK (public.cs_is_equipe(auth.uid()));
DROP POLICY IF EXISTS cs_processos_portal ON public.cs_processos;
CREATE POLICY cs_processos_portal ON public.cs_processos FOR SELECT TO authenticated
  USING (public.cs_is_cliente(auth.uid(), cliente_id));

-- Feed: equipe faz tudo; cliente só lê o seu.
DROP POLICY IF EXISTS cs_atualizacoes_equipe ON public.cs_atualizacoes;
CREATE POLICY cs_atualizacoes_equipe ON public.cs_atualizacoes FOR ALL TO authenticated
  USING (public.cs_is_equipe(auth.uid())) WITH CHECK (public.cs_is_equipe(auth.uid()));
DROP POLICY IF EXISTS cs_atualizacoes_portal ON public.cs_atualizacoes;
CREATE POLICY cs_atualizacoes_portal ON public.cs_atualizacoes FOR SELECT TO authenticated
  USING (public.cs_is_cliente(auth.uid(), cliente_id));

-- ---------- Tempo real ----------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_processos;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_atualizacoes;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ---------- Dados iniciais (só se ainda não houver clientes) ----------
DO $$
DECLARE c uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cs_clientes) THEN RETURN; END IF;
  INSERT INTO public.cs_clientes (nome, empresa) VALUES ('Espaço Têxtil', 'render') RETURNING id INTO c;
  INSERT INTO public.cs_processos (cliente_id, po, invoice, mercadoria, container, data_embarque, chegada_prevista, etapa, status_texto, pendencia) VALUES
  (c,'1210','KT3716','Tecido Helanca','MSMU5909550','2026-09-02','2026-10-27','desembaraco','Navio operando no Porto de Suape. Numerário enviado e recebido. DUIMP registrada.','Fechamento de câmbio — saldo final USD 27.018,00'),
  (c,'1209','KT3715','Tecido Suede Liso','HAMU1766715','2026-09-15','2026-10-29','porto','Carga com chegada antecipada para 29/10. Aguardando presença de carga para iniciar o desembaraço.','Pagamento do saldo final da invoice — USD 35.581,20'),
  (c,'1214','KT3734','Tecido Suede Estampado','CAJU5968844','2026-09-22','2026-12-17','transito','Em trânsito para Suape. Documentação recebida e aprovada.',NULL),
  (c,'1215','KT3735','Tecido Suede Estampado','UACU6025765','2026-09-22','2026-12-17','transito','Em trânsito para Suape. Documentação recebida e aprovada.',NULL),
  (c,'1211','KT3717','Tecido Helanca','MEDU7496657','2026-10-10','2026-12-18','transito','Em trânsito para Suape. Documentação recebida, em processo de conferência.',NULL),
  (c,'1212','KT3718','Tecido Helanca','TCLU6682950','2026-10-29','2026-12-20','embarque','Embarcou no Porto de Ningbo a bordo do navio São Paulo Express; chegada em Suape a bordo do NC Bravo.','Aguardando draft da documentação');
  INSERT INTO public.cs_atualizacoes (processo_id, cliente_id, mensagem, autor)
  SELECT id, c, status_texto, 'Render Comex' FROM public.cs_processos WHERE cliente_id = c AND status_texto IS NOT NULL;
END $$;

-- ---------- Acessos (Pessoas › Acessos) ----------
-- Lista todo mundo do render.os com seus papéis no financeiro, só para controllers.
CREATE OR REPLACE FUNCTION public.acessos_usuarios()
RETURNS TABLE (id uuid, nome text, email text, criado_em timestamptz, ultimo_acesso timestamptz, papeis jsonb, empresas uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, COALESCE(p.full_name, u.email)::text, u.email::text, u.created_at, u.last_sign_in_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'role', r.role, 'company_id', r.company_id))
              FROM public.user_roles r WHERE r.user_id = u.id), '[]'::jsonb),
    COALESCE((SELECT array_agg(uc.company_id) FROM public.user_companies uc WHERE uc.user_id = u.id), '{}')
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.is_controller(auth.uid())
  ORDER BY u.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.acessos_usuarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acessos_usuarios() TO authenticated;
