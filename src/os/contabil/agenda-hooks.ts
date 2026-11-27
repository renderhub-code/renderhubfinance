import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Agenda, Horario, Reserva } from "./agenda";

export function useAgendas() {
  return useQuery({
    queryKey: ["contabil", "agenda", "agendas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contabil_agendas").select("id,dono_id,codigo,endereco,link_video,ativa").order("criado_em");
      if (error) throw error;
      return (data ?? []) as Agenda[];
    },
  });
}

export function useHorarios(agendaId: string | undefined) {
  return useQuery({
    queryKey: ["contabil", "agenda", "horarios", agendaId],
    enabled: !!agendaId,
    queryFn: async () => {
      const todos: Horario[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase.from("contabil_agenda_horarios").select("id,agenda_id,inicio,fim")
          .eq("agenda_id", agendaId!).order("inicio").range(de, de + 999);
        if (error) throw error;
        todos.push(...((data ?? []) as Horario[]));
        if ((data ?? []).length < 1000) break;
      }
      return todos;
    },
  });
}

export function useReservas(agendaId: string | undefined) {
  return useQuery({
    queryKey: ["contabil", "agenda", "reservas", agendaId],
    enabled: !!agendaId,
    queryFn: async () => {
      const todas: Reserva[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase.from("contabil_agenda_reservas")
          .select("id,horario_id,nome,empresa,email,telefone,assunto,modalidade,situacao,criado_em,contabil_agenda_horarios!inner(agenda_id)")
          .eq("contabil_agenda_horarios.agenda_id", agendaId!).order("criado_em").range(de, de + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as unknown as Reserva[]));
        if ((data ?? []).length < 1000) break;
      }
      return todas;
    },
  });
}
