CREATE OR REPLACE FUNCTION public.contabil_agenda_horario_valida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND EXISTS (SELECT 1 FROM public.contabil_agenda_reservas r WHERE r.horario_id = OLD.id AND r.situacao = 'confirmada') THEN
    RAISE EXCEPTION 'Este horário tem uma reunião marcada. Cancele a reunião antes de alterar.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  PERFORM 1 FROM public.contabil_agendas WHERE id = NEW.agenda_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.contabil_agenda_horarios h WHERE h.agenda_id = NEW.agenda_id AND h.id <> NEW.id AND h.inicio < NEW.fim + interval '30 minutes' AND h.fim + interval '30 minutes' > NEW.inicio) THEN
    RAISE EXCEPTION 'Mantenha 30 minutos de intervalo dos outros horários.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.contabil_agenda_reserva_intervalo_valida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.contabil_agenda_horarios%ROWTYPE;
BEGIN
  IF NEW.situacao <> 'confirmada' THEN RETURN NEW; END IF;
  SELECT * INTO h FROM public.contabil_agenda_horarios WHERE id = NEW.horario_id;
  PERFORM 1 FROM public.contabil_agendas WHERE id = h.agenda_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.contabil_agenda_reservas r
    JOIN public.contabil_agenda_horarios outro ON outro.id = r.horario_id
    WHERE r.situacao = 'confirmada' AND r.id <> NEW.id AND outro.agenda_id = h.agenda_id
      AND outro.inicio < h.fim + interval '30 minutes' AND outro.fim + interval '30 minutes' > h.inicio
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Este horário não mantém 30 minutos de intervalo de outra reunião.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.contabil_agenda_reserva_intervalo_valida() FROM public, anon, authenticated;
CREATE TRIGGER contabil_agenda_reserva_intervalo_valida BEFORE INSERT OR UPDATE ON public.contabil_agenda_reservas FOR EACH ROW EXECUTE FUNCTION public.contabil_agenda_reserva_intervalo_valida();

CREATE OR REPLACE FUNCTION public.contabil_agenda_publica(_codigo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nome', COALESCE(NULLIF(m.nome, ''), 'Union Contadores'),
    'presencial', true,
    'horarios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'inicio', h.inicio, 'fim', h.fim,
        'livre', NOT EXISTS (
          SELECT 1 FROM public.contabil_agenda_reservas r
          JOIN public.contabil_agenda_horarios outro ON outro.id = r.horario_id
          WHERE r.situacao = 'confirmada' AND outro.agenda_id = h.agenda_id
            AND outro.inicio < h.fim + interval '30 minutes' AND outro.fim + interval '30 minutes' > h.inicio
        )
      ) ORDER BY h.inicio)
      FROM public.contabil_agenda_horarios h
      WHERE h.agenda_id = a.id AND h.inicio > now() AND h.inicio < now() + interval '120 days'
    ), '[]'::jsonb)
  )
  FROM public.contabil_agendas a LEFT JOIN public.contabil_membros m ON m.user_id = a.dono_id
  WHERE a.codigo = _codigo AND a.ativa
$$;
REVOKE EXECUTE ON FUNCTION public.contabil_agenda_publica(text) FROM public;
GRANT EXECUTE ON FUNCTION public.contabil_agenda_publica(text) TO anon, authenticated, service_role;