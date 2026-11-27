CREATE TABLE public.contabil_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_id uuid NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  endereco text,
  link_video text,
  ativa boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.contabil_agendas TO authenticated;
GRANT ALL ON public.contabil_agendas TO service_role;
ALTER TABLE public.contabil_agendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe do Contabil ve agendas" ON public.contabil_agendas FOR SELECT TO authenticated
  USING ((select public.contabil_tem_acesso((select auth.uid()))));
CREATE POLICY "Dono e admin editam agenda" ON public.contabil_agendas FOR UPDATE TO authenticated
  USING (dono_id = (select auth.uid()) OR (select public.contabil_is_admin((select auth.uid()))))
  WITH CHECK (dono_id = (select auth.uid()) OR (select public.contabil_is_admin((select auth.uid()))));

CREATE TABLE public.contabil_agenda_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.contabil_agendas(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contabil_agenda_horarios_periodo CHECK (fim > inicio),
  CONSTRAINT contabil_agenda_horarios_unico UNIQUE (agenda_id, inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabil_agenda_horarios TO authenticated;
GRANT ALL ON public.contabil_agenda_horarios TO service_role;
ALTER TABLE public.contabil_agenda_horarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.contabil_agenda_pode_editar(_agenda uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contabil_agendas a WHERE a.id = _agenda AND a.dono_id = auth.uid())
      OR public.contabil_is_admin(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.contabil_agenda_pode_editar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.contabil_agenda_pode_editar(uuid) TO authenticated, service_role;

CREATE POLICY "Equipe do Contabil ve horarios" ON public.contabil_agenda_horarios FOR SELECT TO authenticated
  USING ((select public.contabil_tem_acesso((select auth.uid()))));
CREATE POLICY "Dono e admin abrem horarios" ON public.contabil_agenda_horarios FOR INSERT TO authenticated
  WITH CHECK (public.contabil_agenda_pode_editar(agenda_id));
CREATE POLICY "Dono e admin editam horarios" ON public.contabil_agenda_horarios FOR UPDATE TO authenticated
  USING (public.contabil_agenda_pode_editar(agenda_id)) WITH CHECK (public.contabil_agenda_pode_editar(agenda_id));
CREATE POLICY "Dono e admin removem horarios" ON public.contabil_agenda_horarios FOR DELETE TO authenticated
  USING (public.contabil_agenda_pode_editar(agenda_id));

CREATE TABLE public.contabil_agenda_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id uuid NOT NULL REFERENCES public.contabil_agenda_horarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  empresa text,
  email text NOT NULL,
  telefone text,
  assunto text,
  modalidade text NOT NULL CHECK (modalidade IN ('online','presencial')),
  situacao text NOT NULL DEFAULT 'confirmada' CHECK (situacao IN ('confirmada','cancelada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  cancelado_em timestamptz
);
CREATE INDEX contabil_agenda_reservas_horario_idx ON public.contabil_agenda_reservas (horario_id);
CREATE UNIQUE INDEX contabil_agenda_reservas_uma_por_horario ON public.contabil_agenda_reservas (horario_id) WHERE situacao = 'confirmada';
GRANT SELECT, UPDATE ON public.contabil_agenda_reservas TO authenticated;
GRANT ALL ON public.contabil_agenda_reservas TO service_role;
ALTER TABLE public.contabil_agenda_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe do Contabil ve reservas" ON public.contabil_agenda_reservas FOR SELECT TO authenticated
  USING ((select public.contabil_tem_acesso((select auth.uid()))));
CREATE POLICY "Dono e admin cancelam reservas" ON public.contabil_agenda_reservas FOR UPDATE TO authenticated
  USING (public.contabil_agenda_pode_editar((SELECT h.agenda_id FROM public.contabil_agenda_horarios h WHERE h.id = horario_id)))
  WITH CHECK (public.contabil_agenda_pode_editar((SELECT h.agenda_id FROM public.contabil_agenda_horarios h WHERE h.id = horario_id)));

-- Horários não se sobrepõem e não mudam enquanto houver reunião confirmada.
CREATE OR REPLACE FUNCTION public.contabil_agenda_horario_valida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND EXISTS (
    SELECT 1 FROM public.contabil_agenda_reservas r WHERE r.horario_id = OLD.id AND r.situacao = 'confirmada'
  ) THEN
    RAISE EXCEPTION 'Este horário tem uma reunião marcada. Cancele a reunião antes de alterar.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (
    SELECT 1 FROM public.contabil_agenda_horarios h
    WHERE h.agenda_id = NEW.agenda_id AND h.id <> NEW.id AND h.inicio < NEW.fim AND h.fim > NEW.inicio
  ) THEN
    RAISE EXCEPTION 'Já existe um horário aberto nesse período.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contabil_agenda_horario_valida BEFORE INSERT OR UPDATE OR DELETE ON public.contabil_agenda_horarios
  FOR EACH ROW EXECUTE FUNCTION public.contabil_agenda_horario_valida();

CREATE OR REPLACE FUNCTION public.contabil_agenda_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
CREATE TRIGGER contabil_agenda_touch BEFORE UPDATE ON public.contabil_agendas
  FOR EACH ROW EXECUTE FUNCTION public.contabil_agenda_touch();

-- Link público: só horários futuros e se estão livres; nenhum dado de cliente.
CREATE OR REPLACE FUNCTION public.contabil_agenda_publica(_codigo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nome', COALESCE(NULLIF(m.nome, ''), 'Union Contadores'),
    'presencial', a.endereco IS NOT NULL AND btrim(a.endereco) <> '',
    'horarios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'inicio', h.inicio, 'fim', h.fim,
        'livre', NOT EXISTS (SELECT 1 FROM public.contabil_agenda_reservas r WHERE r.horario_id = h.id AND r.situacao = 'confirmada')
      ) ORDER BY h.inicio)
      FROM public.contabil_agenda_horarios h
      WHERE h.agenda_id = a.id AND h.inicio > now() AND h.inicio < now() + interval '120 days'
    ), '[]'::jsonb)
  )
  FROM public.contabil_agendas a
  LEFT JOIN public.contabil_membros m ON m.user_id = a.dono_id
  WHERE a.codigo = _codigo AND a.ativa
$$;

CREATE OR REPLACE FUNCTION public.contabil_agenda_reservar(
  _codigo text, _horario uuid, _nome text, _empresa text, _email text, _telefone text, _assunto text, _modalidade text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.contabil_agendas%ROWTYPE;
  h public.contabil_agenda_horarios%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.contabil_agendas WHERE codigo = _codigo AND ativa;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'agenda'); END IF;
  SELECT * INTO h FROM public.contabil_agenda_horarios WHERE id = _horario AND agenda_id = a.id AND inicio > now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'indisponivel'); END IF;
  IF _modalidade NOT IN ('online','presencial')
     OR length(btrim(COALESCE(_nome, ''))) NOT BETWEEN 2 AND 120
     OR length(btrim(COALESCE(_email, ''))) NOT BETWEEN 5 AND 255 OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR length(COALESCE(_empresa, '')) > 160 OR length(COALESCE(_telefone, '')) > 40 OR length(COALESCE(_assunto, '')) > 1000
  THEN RETURN jsonb_build_object('ok', false, 'motivo', 'dados'); END IF;
  BEGIN
    INSERT INTO public.contabil_agenda_reservas (horario_id, nome, empresa, email, telefone, assunto, modalidade)
    VALUES (h.id, btrim(_nome), NULLIF(btrim(COALESCE(_empresa, '')), ''), lower(btrim(_email)),
            NULLIF(btrim(COALESCE(_telefone, '')), ''), NULLIF(btrim(COALESCE(_assunto, '')), ''), _modalidade);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ocupado');
  END;
  RETURN jsonb_build_object('ok', true, 'inicio', h.inicio, 'fim', h.fim, 'modalidade', _modalidade,
    'local', CASE WHEN _modalidade = 'online' THEN a.link_video ELSE a.endereco END);
END $$;

REVOKE EXECUTE ON FUNCTION public.contabil_agenda_publica(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.contabil_agenda_reservar(text, uuid, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.contabil_agenda_publica(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contabil_agenda_reservar(text, uuid, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- Agenda inicial: Caio Oliveira.
INSERT INTO public.contabil_agendas (dono_id, codigo)
SELECT user_id, 'caio-oliveira' FROM public.contabil_membros WHERE email = 'caio.oliveira@renderhub.com.br';

-- A nova aba aparece para a equipe atual do Contábil (ver); dono e administradores editam pela regra da agenda.
INSERT INTO public.os_acessos (user_id, empresa, recurso, nivel)
SELECT m.user_id, 'union', 'con.agenda',
       CASE WHEN m.papel = 'admin' OR m.email = 'caio.oliveira@renderhub.com.br' THEN 2 ELSE 1 END
FROM public.contabil_membros m WHERE m.ativo
ON CONFLICT DO NOTHING;