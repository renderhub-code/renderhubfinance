
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('controller', 'financial_manager', 'ceo_viewer');
CREATE TYPE public.account_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.transaction_status AS ENUM ('previsto', 'realizado', 'cancelado', 'atrasado');
CREATE TYPE public.dre_section AS ENUM (
  'receita_bruta', 'deducoes', 'custos',
  'despesas_operacionais', 'despesas_administrativas', 'despesas_comerciais',
  'receitas_financeiras', 'despesas_financeiras',
  'investimentos', 'nao_operacional'
);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);
GRANT SELECT ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES + ROLES
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  default_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
GRANT SELECT ON public.user_companies TO authenticated;
GRANT ALL ON public.user_companies TO service_role;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_controller(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'controller') $$;

CREATE OR REPLACE FUNCTION public.user_has_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_controller(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = _user_id AND company_id = _company_id)
$$;

CREATE OR REPLACE FUNCTION public.user_is_ceo_only(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ceo_viewer')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('controller','financial_manager'))
$$;

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
CREATE TABLE public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  dre_section public.dre_section NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_groups TO authenticated;
GRANT ALL ON public.account_groups TO service_role;
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.account_subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.account_groups(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_subgroups TO authenticated;
GRANT ALL ON public.account_subgroups TO service_role;
ALTER TABLE public.account_subgroups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subgroup_id uuid NOT NULL REFERENCES public.account_subgroups(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  settled_date date,
  type public.account_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'previsto',
  amount_expected numeric(14,2) NOT NULL DEFAULT 0,
  amount_realized numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  payment_method text,
  attachment_path text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX transactions_company_date_idx ON public.transactions (company_id, entry_date);
CREATE INDEX transactions_company_due_idx ON public.transactions (company_id, due_date);
CREATE INDEX transactions_account_idx ON public.transactions (account_id);

-- Update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
-- profiles: user reads/updates own
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_controller_read" ON public.profiles FOR SELECT TO authenticated USING (public.is_controller(auth.uid()));

-- user_roles: user reads own; controller reads all
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_controller(auth.uid()));

-- user_companies
CREATE POLICY "user_companies_self_select" ON public.user_companies FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_controller(auth.uid()));

-- companies: users see their linked companies; controllers see all
CREATE POLICY "companies_visible" ON public.companies FOR SELECT TO authenticated
  USING (public.is_controller(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_companies uc WHERE uc.user_id = auth.uid() AND uc.company_id = companies.id));

-- business_units: same
CREATE POLICY "business_units_visible" ON public.business_units FOR SELECT TO authenticated
  USING (public.user_has_company(auth.uid(), company_id));

-- account_groups
CREATE POLICY "ag_select" ON public.account_groups FOR SELECT TO authenticated USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "ag_write" ON public.account_groups FOR INSERT TO authenticated WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "ag_update" ON public.account_groups FOR UPDATE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "ag_delete" ON public.account_groups FOR DELETE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

-- account_subgroups
CREATE POLICY "asg_select" ON public.account_subgroups FOR SELECT TO authenticated USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "asg_write" ON public.account_subgroups FOR INSERT TO authenticated WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "asg_update" ON public.account_subgroups FOR UPDATE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "asg_delete" ON public.account_subgroups FOR DELETE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

-- accounts
CREATE POLICY "acc_select" ON public.accounts FOR SELECT TO authenticated USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "acc_write" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "acc_update" ON public.accounts FOR UPDATE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "acc_delete" ON public.accounts FOR DELETE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

-- cost_centers
CREATE POLICY "cc_select" ON public.cost_centers FOR SELECT TO authenticated USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "cc_write" ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "cc_update" ON public.cost_centers FOR UPDATE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "cc_delete" ON public.cost_centers FOR DELETE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

-- transactions
CREATE POLICY "tx_select" ON public.transactions FOR SELECT TO authenticated USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY "tx_delete" ON public.transactions FOR DELETE TO authenticated USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

-- ============================================================
-- SEED: COMPANIES + BUSINESS UNITS
-- ============================================================
INSERT INTO public.companies (name, slug) VALUES
  ('Union Contadores', 'union-contadores'),
  ('Render Comex', 'render-comex'),
  ('ERKS', 'erks'),
  ('Dom Pablyto', 'dom-pablyto'),
  ('Use Noronha', 'use-noronha'),
  ('A&F', 'a-e-f');

-- Business Units
INSERT INTO public.business_units (company_id, name, slug)
SELECT id, 'Principal', 'principal' FROM public.companies WHERE slug IN ('union-contadores','render-comex','dom-pablyto','use-noronha','a-e-f');

INSERT INTO public.business_units (company_id, name, slug)
SELECT id, 'ERKS Moda Feminina', 'moda-feminina' FROM public.companies WHERE slug = 'erks';
INSERT INTO public.business_units (company_id, name, slug)
SELECT id, 'SX High Paper', 'sx-high-paper' FROM public.companies WHERE slug = 'erks';

-- ============================================================
-- SEED: PLANO DE CONTAS PADRÃO BRASILEIRO (para cada empresa)
-- ============================================================
DO $seed$
DECLARE
  c RECORD;
  g_receita uuid; g_deducoes uuid; g_custos uuid;
  g_desp_op uuid; g_desp_adm uuid; g_desp_com uuid;
  g_desp_fin uuid; g_rec_fin uuid; g_invest uuid; g_nao_op uuid;
  sg uuid;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    -- GROUPS
    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '1', 'Receitas', 'entrada', 'receita_bruta', 10) RETURNING id INTO g_receita;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '2', 'Deduções da Receita', 'saida', 'deducoes', 20) RETURNING id INTO g_deducoes;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '3', 'Custos', 'saida', 'custos', 30) RETURNING id INTO g_custos;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '4', 'Despesas Operacionais', 'saida', 'despesas_operacionais', 40) RETURNING id INTO g_desp_op;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '5', 'Despesas Administrativas', 'saida', 'despesas_administrativas', 50) RETURNING id INTO g_desp_adm;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '6', 'Despesas Comerciais', 'saida', 'despesas_comerciais', 60) RETURNING id INTO g_desp_com;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '7', 'Receitas Financeiras', 'entrada', 'receitas_financeiras', 70) RETURNING id INTO g_rec_fin;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '8', 'Despesas Financeiras', 'saida', 'despesas_financeiras', 80) RETURNING id INTO g_desp_fin;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '9', 'Investimentos', 'saida', 'investimentos', 90) RETURNING id INTO g_invest;

    INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order)
    VALUES (c.id, '0', 'Movimentações Não Operacionais', 'entrada', 'nao_operacional', 100) RETURNING id INTO g_nao_op;

    -- 1. RECEITAS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_receita, '1.1', 'Receita de Serviços', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '1.1.001', 'Prestação de Serviços', 'entrada', 10),
      (c.id, sg, '1.1.002', 'Consultoria', 'entrada', 20);

    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_receita, '1.2', 'Receita de Produtos', 20) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '1.2.001', 'Venda de Produtos', 'entrada', 10),
      (c.id, sg, '1.2.002', 'Venda de Mercadorias', 'entrada', 20);

    -- 2. DEDUCOES
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_deducoes, '2.1', 'Impostos sobre Vendas', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '2.1.001', 'Simples Nacional', 'saida', 10),
      (c.id, sg, '2.1.002', 'ICMS', 'saida', 20),
      (c.id, sg, '2.1.003', 'ISS', 'saida', 30),
      (c.id, sg, '2.1.004', 'PIS/COFINS', 'saida', 40),
      (c.id, sg, '2.1.005', 'Devoluções e Cancelamentos', 'saida', 50);

    -- 3. CUSTOS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_custos, '3.1', 'Custos Diretos', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '3.1.001', 'Matéria-Prima / Mercadoria', 'saida', 10),
      (c.id, sg, '3.1.002', 'Mão de Obra Direta', 'saida', 20),
      (c.id, sg, '3.1.003', 'Frete sobre Compras', 'saida', 30);

    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_custos, '3.2', 'Custos Variáveis', 20) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '3.2.001', 'Comissões sobre Vendas', 'saida', 10),
      (c.id, sg, '3.2.002', 'Embalagens', 'saida', 20);

    -- 4. DESPESAS OPERACIONAIS (Pessoal)
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_desp_op, '4.1', 'Despesas com Pessoal', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '4.1.001', 'Salários', 'saida', 10),
      (c.id, sg, '4.1.002', 'Pró-labore', 'saida', 20),
      (c.id, sg, '4.1.003', 'Encargos Sociais (INSS/FGTS)', 'saida', 30),
      (c.id, sg, '4.1.004', 'Benefícios (VT/VR/Plano de Saúde)', 'saida', 40),
      (c.id, sg, '4.1.005', 'Férias e 13º', 'saida', 50);

    -- 5. DESPESAS ADMINISTRATIVAS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_desp_adm, '5.1', 'Estrutura', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '5.1.001', 'Aluguel', 'saida', 10),
      (c.id, sg, '5.1.002', 'Condomínio', 'saida', 20),
      (c.id, sg, '5.1.003', 'Energia Elétrica', 'saida', 30),
      (c.id, sg, '5.1.004', 'Água', 'saida', 40),
      (c.id, sg, '5.1.005', 'Internet e Telefonia', 'saida', 50),
      (c.id, sg, '5.1.006', 'Material de Escritório', 'saida', 60),
      (c.id, sg, '5.1.007', 'Limpeza e Conservação', 'saida', 70);

    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_desp_adm, '5.2', 'Serviços de Terceiros', 20) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '5.2.001', 'Honorários Contábeis', 'saida', 10),
      (c.id, sg, '5.2.002', 'Honorários Advocatícios', 'saida', 20),
      (c.id, sg, '5.2.003', 'Consultorias', 'saida', 30),
      (c.id, sg, '5.2.004', 'TI e Software (SaaS)', 'saida', 40);

    -- 6. DESPESAS COMERCIAIS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_desp_com, '6.1', 'Marketing e Vendas', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '6.1.001', 'Publicidade Digital', 'saida', 10),
      (c.id, sg, '6.1.002', 'Marketing e Eventos', 'saida', 20),
      (c.id, sg, '6.1.003', 'Viagens e Representação', 'saida', 30);

    -- 7. RECEITAS FINANCEIRAS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_rec_fin, '7.1', 'Receitas Financeiras', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '7.1.001', 'Rendimentos de Aplicações', 'entrada', 10),
      (c.id, sg, '7.1.002', 'Juros Recebidos', 'entrada', 20),
      (c.id, sg, '7.1.003', 'Descontos Obtidos', 'entrada', 30);

    -- 8. DESPESAS FINANCEIRAS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_desp_fin, '8.1', 'Despesas Financeiras', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '8.1.001', 'Juros Pagos', 'saida', 10),
      (c.id, sg, '8.1.002', 'Tarifas Bancárias', 'saida', 20),
      (c.id, sg, '8.1.003', 'IOF', 'saida', 30),
      (c.id, sg, '8.1.004', 'Taxas de Cartão / Antecipação', 'saida', 40);

    -- 9. INVESTIMENTOS
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_invest, '9.1', 'Ativos', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '9.1.001', 'Aquisição de Equipamentos', 'saida', 10),
      (c.id, sg, '9.1.002', 'Móveis e Instalações', 'saida', 20),
      (c.id, sg, '9.1.003', 'Software e Licenças', 'saida', 30);

    -- 0. NÃO OPERACIONAL
    INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order)
    VALUES (c.id, g_nao_op, '0.1', 'Movimentações Não Operacionais', 10) RETURNING id INTO sg;
    INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order) VALUES
      (c.id, sg, '0.1.001', 'Aportes de Sócios', 'entrada', 10),
      (c.id, sg, '0.1.002', 'Distribuição de Lucros', 'saida', 20),
      (c.id, sg, '0.1.003', 'Empréstimos Recebidos', 'entrada', 30),
      (c.id, sg, '0.1.004', 'Pagamento de Empréstimos', 'saida', 40);
  END LOOP;
END
$seed$;
