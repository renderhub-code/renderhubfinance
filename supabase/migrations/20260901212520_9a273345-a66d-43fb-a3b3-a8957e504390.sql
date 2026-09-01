
-- Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_controller(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_company(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_is_ceo_only(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_controller(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_company(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_ceo_only(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_first_controller()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE has_ctrl boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'controller') INTO has_ctrl;
  IF has_ctrl THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'controller')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_companies (user_id, company_id)
    SELECT auth.uid(), id FROM public.companies
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_controller() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_controller() TO authenticated;

CREATE POLICY "user_roles_controller_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_controller(auth.uid())) WITH CHECK (public.is_controller(auth.uid()));
CREATE POLICY "user_companies_controller_manage" ON public.user_companies FOR ALL TO authenticated
  USING (public.is_controller(auth.uid())) WITH CHECK (public.is_controller(auth.uid()));
CREATE POLICY "companies_controller_manage" ON public.companies FOR ALL TO authenticated
  USING (public.is_controller(auth.uid())) WITH CHECK (public.is_controller(auth.uid()));

-- Simulations
CREATE TABLE public.simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receita','custo','despesa')),
  year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aplicada')),
  notes TEXT,
  applied_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulations_select" ON public.simulations FOR SELECT TO authenticated
  USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY "simulations_insert" ON public.simulations FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company(auth.uid(), company_id)
    AND (public.has_role(auth.uid(),'controller') OR public.has_role(auth.uid(),'financial_manager')));
CREATE POLICY "simulations_update" ON public.simulations FOR UPDATE TO authenticated
  USING (public.user_has_company(auth.uid(), company_id)
    AND (public.has_role(auth.uid(),'controller') OR public.has_role(auth.uid(),'financial_manager')));
CREATE POLICY "simulations_delete" ON public.simulations FOR DELETE TO authenticated
  USING (public.user_has_company(auth.uid(), company_id)
    AND (public.has_role(auth.uid(),'controller') OR public.has_role(auth.uid(),'financial_manager')));

CREATE TRIGGER simulations_updated_at BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.simulation_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_lines TO authenticated;
GRANT ALL ON public.simulation_lines TO service_role;
ALTER TABLE public.simulation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sim_lines_select" ON public.simulation_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id AND public.user_has_company(auth.uid(), s.company_id)));
CREATE POLICY "sim_lines_write" ON public.simulation_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id AND public.user_has_company(auth.uid(), s.company_id)
    AND (public.has_role(auth.uid(),'controller') OR public.has_role(auth.uid(),'financial_manager'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id AND public.user_has_company(auth.uid(), s.company_id)
    AND (public.has_role(auth.uid(),'controller') OR public.has_role(auth.uid(),'financial_manager'))));

CREATE TRIGGER sim_lines_updated_at BEFORE UPDATE ON public.simulation_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX simulation_lines_sim_idx ON public.simulation_lines(simulation_id);

ALTER TABLE public.transactions
  ADD COLUMN source_simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL;
CREATE INDEX transactions_source_sim_idx ON public.transactions(source_simulation_id);

ALTER TABLE public.simulation_lines
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_expected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_realized numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_key uuid NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS simulation_lines_group_key_idx ON public.simulation_lines (group_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies, public.business_units, public.profiles, public.user_roles, public.user_companies, public.account_groups, public.account_subgroups, public.accounts, public.cost_centers, public.transactions, public.simulations, public.simulation_lines TO authenticated;
GRANT ALL ON public.companies, public.business_units, public.profiles, public.user_roles, public.user_companies, public.account_groups, public.account_subgroups, public.accounts, public.cost_centers, public.transactions, public.simulations, public.simulation_lines TO service_role;

GRANT EXECUTE ON FUNCTION public.is_controller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_ceo_only(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_controller() TO authenticated;

CREATE TABLE public.account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_code text NOT NULL,
  source_name text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_mappings TO authenticated;
GRANT ALL ON public.account_mappings TO service_role;

ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY am_select ON public.account_mappings FOR SELECT TO authenticated
  USING (public.user_has_company(auth.uid(), company_id));
CREATE POLICY am_insert ON public.account_mappings FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY am_update ON public.account_mappings FOR UPDATE TO authenticated
  USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));
CREATE POLICY am_delete ON public.account_mappings FOR DELETE TO authenticated
  USING (public.user_has_company(auth.uid(), company_id) AND NOT public.user_is_ceo_only(auth.uid()));

CREATE UNIQUE INDEX account_mappings_company_source_code_key
  ON public.account_mappings (company_id, source_code);
CREATE INDEX account_mappings_account_id_idx ON public.account_mappings (account_id);

CREATE TRIGGER account_mappings_updated_at BEFORE UPDATE ON public.account_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Harden SECURITY DEFINER helpers: only answer about the caller
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_controller(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'controller')
  END
$function$;

CREATE OR REPLACE FUNCTION public.user_is_ceo_only(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ceo_viewer')
         AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('controller','financial_manager'))
  END
$function$;

CREATE OR REPLACE FUNCTION public.user_has_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.is_controller(_user_id)
         OR EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = _user_id AND company_id = _company_id)
  END
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_first_controller() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_controller() TO authenticated;
