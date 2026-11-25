-- ============================================================
-- render.os · RH (Pessoas)
-- Cadastro de colaboradores, remuneração, custos, calendário, avaliações
-- (9 Box e desempenho), ASO, contratos PJ e documentos — por empresa.
-- Permissões em Pessoas › Acessos (abas rh.*). Requer o SQL acessos_por_aba.
-- Pode ser executado mais de uma vez.
-- ============================================================

-- ---------- Tabelas ----------
CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  nome text NOT NULL,
  matricula text,
  email text,
  setor text,
  cargo text,
  vinculo text NOT NULL DEFAULT 'CLT' CHECK (vinculo IN ('CLT', 'Estágio', 'Temporário', 'Aprendiz', 'Sócio', 'Outro')),
  admissao date,
  desligamento date,
  motivo_desligamento text,
  jornada text,
  gestor text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'afastado', 'desligado')),
  obs text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_colab_empresa ON public.rh_colaboradores(empresa);

-- Salário (cada linha 'salario' é o salário a partir da competência), gratificações,
-- adicionais e benefícios mensais pagos pela empresa.
CREATE TABLE IF NOT EXISTS public.rh_remuneracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('salario', 'gratificacao', 'adicional', 'beneficio')),
  descricao text,
  valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  competencia date NOT NULL,
  -- benefício recorrente: até quando vale (vazio = vigente)
  fim date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rh_rem_colab ON public.rh_remuneracao(colaborador_id, competencia DESC);

CREATE TABLE IF NOT EXISTS public.rh_parametros (
  empresa text PRIMARY KEY,
  encargos_pct numeric(5,2) NOT NULL DEFAULT 27,
  provisoes_pct numeric(5,2) NOT NULL DEFAULT 19.44,
  meta_turnover numeric(5,2) NOT NULL DEFAULT 10,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_orcamentos (
  empresa text NOT NULL,
  ano int NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, ano)
);

CREATE TABLE IF NOT EXISTS public.rh_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  competencia date NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('folha', 'encargos', 'beneficios', 'gratificacoes', 'sst', 'treinamento', 'outros')),
  valor numeric(14,2) NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rh_custos ON public.rh_custos(empresa, competencia);

CREATE TABLE IF NOT EXISTS public.rh_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  atividade text NOT NULL,
  dia int NOT NULL CHECK (dia BETWEEN 1 AND 31),
  responsavel text,
  recorrencia text NOT NULL DEFAULT 'Mensal',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('9box', 'desempenho')),
  ciclo text NOT NULL,
  gestor text,
  -- 9 Box: 1 baixo · 2 médio · 3 alto
  desempenho int CHECK (desempenho BETWEEN 1 AND 3),
  potencial int CHECK (potencial BETWEEN 1 AND 3),
  -- Desempenho: notas 1 a 5 por dimensão e média
  notas int[],
  media numeric(3,2),
  fortes text,
  melhorias text,
  resultados text,
  plano text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rh_aval_colab ON public.rh_avaliacoes(colaborador_id);

-- Saúde ocupacional: só data, tipo e aptidão. Sem diagnóstico.
CREATE TABLE IF NOT EXISTS public.rh_asos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('admissional', 'periodico', 'retorno', 'mudanca', 'demissional')),
  data date NOT NULL,
  proxima date,
  resultado text NOT NULL DEFAULT 'apto' CHECK (resultado IN ('apto', 'apto_restricao', 'inapto')),
  obs text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_asos_colab ON public.rh_asos(colaborador_id, data DESC);

CREATE TABLE IF NOT EXISTS public.rh_contratos_pj (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  prestador text NOT NULL,
  cnpj text,
  servico text,
  gestor text,
  inicio date,
  fim date,
  valor_mensal numeric(12,2) NOT NULL DEFAULT 0,
  reajuste text,
  aviso_dias int,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'renovar', 'encerrado')),
  obs text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  colaborador_id uuid REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  vencimento date,
  responsavel text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_dia', 'concluido')),
  obs text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Prévia da folha por colaborador e competência (estimativa gerencial, não é cálculo legal).
CREATE TABLE IF NOT EXISTS public.rh_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  bruto numeric(12,2) NOT NULL DEFAULT 0,
  gratificacao numeric(12,2) NOT NULL DEFAULT 0,
  inss_pct numeric(5,2) NOT NULL DEFAULT 0,
  irrf numeric(12,2) NOT NULL DEFAULT 0,
  vt numeric(12,2) NOT NULL DEFAULT 0,
  va numeric(12,2) NOT NULL DEFAULT 0,
  outros_descontos numeric(12,2) NOT NULL DEFAULT 0,
  beneficios numeric(12,2) NOT NULL DEFAULT 0,
  encargos_pct numeric(5,2) NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);

-- ---------- Funções ----------
-- Maior nível da pessoa logada entre várias abas do RH de uma empresa.
CREATE OR REPLACE FUNCTION public.rh_nivel(_empresa text, _recursos text[])
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(max(public.os_nivel(auth.uid(), _empresa, r)), 0) FROM unnest(_recursos) r
$$;
CREATE OR REPLACE FUNCTION public.rh_empresa_do_colaborador(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa FROM public.rh_colaboradores WHERE id = _id
$$;
REVOKE ALL ON FUNCTION public.rh_nivel(text, text[]), public.rh_empresa_do_colaborador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_nivel(text, text[]), public.rh_empresa_do_colaborador(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rh_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_rh_colab_touch ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colab_touch BEFORE UPDATE ON public.rh_colaboradores FOR EACH ROW EXECUTE FUNCTION public.rh_touch();

CREATE OR REPLACE FUNCTION public.rh_autor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.autor_id := auth.uid(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_rh_rem_autor ON public.rh_remuneracao;
CREATE TRIGGER trg_rh_rem_autor BEFORE INSERT ON public.rh_remuneracao FOR EACH ROW EXECUTE FUNCTION public.rh_autor();
DROP TRIGGER IF EXISTS trg_rh_custos_autor ON public.rh_custos;
CREATE TRIGGER trg_rh_custos_autor BEFORE INSERT ON public.rh_custos FOR EACH ROW EXECUTE FUNCTION public.rh_autor();
DROP TRIGGER IF EXISTS trg_rh_aval_autor ON public.rh_avaliacoes;
CREATE TRIGGER trg_rh_aval_autor BEFORE INSERT ON public.rh_avaliacoes FOR EACH ROW EXECUTE FUNCTION public.rh_autor();

-- Alertas do painel (contagens), para quem vê o Painel do RH, sem abrir dados de saúde.
CREATE OR REPLACE FUNCTION public.rh_alertas(_empresas text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH emp AS (
    SELECT e FROM unnest(_empresas) e WHERE public.os_nivel(auth.uid(), e, 'rh.painel') >= 1
  ), ultimo_aso AS (
    SELECT DISTINCT ON (a.colaborador_id) a.colaborador_id, a.proxima
    FROM public.rh_asos a JOIN public.rh_colaboradores c ON c.id = a.colaborador_id
    WHERE c.empresa IN (SELECT e FROM emp) AND c.status <> 'desligado'
    ORDER BY a.colaborador_id, a.data DESC
  )
  SELECT jsonb_build_object(
    'aso_vencidos', (SELECT count(*) FROM ultimo_aso WHERE proxima < current_date),
    'aso_30', (SELECT count(*) FROM ultimo_aso WHERE proxima BETWEEN current_date AND current_date + 30),
    'sem_aso', (SELECT count(*) FROM public.rh_colaboradores c WHERE c.empresa IN (SELECT e FROM emp) AND c.status <> 'desligado'
                AND NOT EXISTS (SELECT 1 FROM public.rh_asos a WHERE a.colaborador_id = c.id)),
    'pj_ativos', (SELECT count(*) FROM public.rh_contratos_pj WHERE empresa IN (SELECT e FROM emp) AND status <> 'encerrado'),
    'pj_valor', (SELECT COALESCE(sum(valor_mensal), 0) FROM public.rh_contratos_pj WHERE empresa IN (SELECT e FROM emp) AND status <> 'encerrado'),
    'pj_30', (SELECT count(*) FROM public.rh_contratos_pj WHERE empresa IN (SELECT e FROM emp) AND status <> 'encerrado' AND fim BETWEEN current_date AND current_date + 30),
    'pj_60', (SELECT count(*) FROM public.rh_contratos_pj WHERE empresa IN (SELECT e FROM emp) AND status <> 'encerrado' AND fim BETWEEN current_date AND current_date + 60),
    'docs_pendentes', (SELECT count(*) FROM public.rh_documentos WHERE empresa IN (SELECT e FROM emp) AND status = 'pendente'),
    'docs_30', (SELECT count(*) FROM public.rh_documentos WHERE empresa IN (SELECT e FROM emp) AND status <> 'concluido' AND vencimento <= current_date + 30)
  )
$$;
REVOKE ALL ON FUNCTION public.rh_alertas(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_alertas(text[]) TO authenticated;

-- ---------- Permissões e RLS ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_colaboradores, public.rh_remuneracao, public.rh_parametros,
  public.rh_orcamentos, public.rh_custos, public.rh_calendario, public.rh_avaliacoes, public.rh_asos,
  public.rh_contratos_pj, public.rh_documentos, public.rh_folha TO authenticated;
GRANT ALL ON public.rh_colaboradores, public.rh_remuneracao, public.rh_parametros,
  public.rh_orcamentos, public.rh_custos, public.rh_calendario, public.rh_avaliacoes, public.rh_asos,
  public.rh_contratos_pj, public.rh_documentos, public.rh_folha TO service_role;

DO $$
DECLARE
  -- tabela, expressão da empresa, abas que leem, aba que edita
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('rh_colaboradores', 'empresa',
       ARRAY['rh.colaboradores','rh.painel','rh.remuneracao','rh.avaliacoes','rh.aso','rh.documentos'], 'rh.colaboradores'),
    ('rh_remuneracao', 'public.rh_empresa_do_colaborador(colaborador_id)', ARRAY['rh.remuneracao','rh.painel'], 'rh.remuneracao'),
    ('rh_parametros', 'empresa', ARRAY['rh.remuneracao','rh.painel'], 'rh.remuneracao'),
    ('rh_orcamentos', 'empresa', ARRAY['rh.remuneracao','rh.painel'], 'rh.remuneracao'),
    ('rh_custos', 'empresa', ARRAY['rh.remuneracao','rh.painel'], 'rh.remuneracao'),
    ('rh_folha', 'public.rh_empresa_do_colaborador(colaborador_id)', ARRAY['rh.remuneracao'], 'rh.remuneracao'),
    ('rh_calendario', 'empresa', ARRAY['rh.calendario','rh.painel'], 'rh.calendario'),
    ('rh_avaliacoes', 'public.rh_empresa_do_colaborador(colaborador_id)', ARRAY['rh.avaliacoes'], 'rh.avaliacoes'),
    ('rh_asos', 'public.rh_empresa_do_colaborador(colaborador_id)', ARRAY['rh.aso'], 'rh.aso'),
    ('rh_contratos_pj', 'empresa', ARRAY['rh.pj'], 'rh.pj'),
    ('rh_documentos', 'empresa', ARRAY['rh.documentos'], 'rh.documentos')
  ) v(tabela, emp, ler, editar) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabela || '_ver', t.tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabela || '_editar', t.tabela);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.rh_nivel(%s, %L::text[]) >= 1)',
      t.tabela || '_ver', t.tabela, t.emp, t.ler);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.rh_nivel(%s, ARRAY[%L]) = 2) WITH CHECK (public.rh_nivel(%s, ARRAY[%L]) = 2)',
      t.tabela || '_editar', t.tabela, t.emp, t.editar, t.emp, t.editar);
  END LOOP;
END $$;

-- Documentos ligados a um colaborador precisam ser da mesma empresa dele.
CREATE OR REPLACE FUNCTION public.rh_documento_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.colaborador_id IS NOT NULL THEN
    NEW.empresa := public.rh_empresa_do_colaborador(NEW.colaborador_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rh_documento_empresa ON public.rh_documentos;
CREATE TRIGGER trg_rh_documento_empresa BEFORE INSERT OR UPDATE ON public.rh_documentos
FOR EACH ROW EXECUTE FUNCTION public.rh_documento_empresa();
