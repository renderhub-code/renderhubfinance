import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cdb, dataBR } from "@/os/contabil/db";
import { PrioridadePill } from "./ui";

interface Pendente { id: string; atividade: string; prioridade: number; prazo: string | null; setor: string | null }

/** Bipe curto via WebAudio, sem arquivo de som. */
function bipe() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    [0, 0.28].forEach((o) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t + o);
      g.gain.setValueAtTime(0.0001, t + o);
      g.gain.exponentialRampToValueAtTime(0.25, t + o + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.22);
      osc.connect(g).connect(ctx.destination);
      osc.start(t + o);
      osc.stop(t + o + 0.24);
    });
    window.setTimeout(() => ctx.close().catch(() => undefined), 1200);
  } catch { /* navegador bloqueou o som; o aviso aparece mesmo assim */ }
}

/**
 * Aviso de nova atividade do Contábil, em qualquer tela do render.os.
 * Quando alguém cria uma atividade para você: som, título da aba piscando,
 * notificação do sistema (se a aba estiver em segundo plano) e um pop-up
 * que só sai com "Estou ciente".
 */
export function NovaAtividadeAlerta() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [fila, setFila] = useState<Pendente[]>([]);
  const [saving, setSaving] = useState(false);
  const vistos = useRef(new Set<string>());

  // Só membros ativos do Contábil recebem o aviso (sem bootstrap de admin aqui).
  const { data: ehMembro } = useQuery({
    queryKey: ["contabil", "alerta-membro", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_membros").select("ativo").eq("user_id", user!.id).maybeSingle();
      return !error && !!(data as { ativo: boolean } | null)?.ativo;
    },
    staleTime: 5 * 60_000,
  });

  const buscar = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: ciencias }, { data, error }] = await Promise.all([
      cdb.from("contabil_ciencias").select("atividade_id").eq("user_id", user.id),
      cdb.from("contabil_atividades")
        .select("id, atividade, prioridade, prazo, criado_por, status, contabil_setores(nome)")
        .eq("responsavel_id", user.id)
        .neq("status", "concluido")
        .order("criado_em", { ascending: true }),
    ]);
    if (error || !data) return;
    const cientes = new Set(((ciencias ?? []) as { atividade_id: string }[]).map((c) => c.atividade_id));
    const pend = (data as unknown as { id: string; atividade: string; prioridade: number; prazo: string | null; criado_por: string | null; contabil_setores: { nome: string } | null }[])
      .filter((r) => !cientes.has(r.id) && r.criado_por !== user.id)
      .map<Pendente>((r) => ({ id: r.id, atividade: r.atividade, prioridade: r.prioridade, prazo: r.prazo, setor: r.contabil_setores?.nome ?? null }));
    setFila((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const junta = [...prev, ...pend.filter((p) => !ids.has(p.id))];
      const novo = junta.some((p) => !vistos.current.has(p.id));
      junta.forEach((p) => vistos.current.add(p.id));
      if (novo && junta.length) bipe();
      return junta;
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !ehMembro) return;
    void buscar();
    const ch = supabase
      .channel(`contabil-alerta-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contabil_atividades", filter: `responsavel_id=eq.${user.id}` }, () => {
        void buscar();
        qc.invalidateQueries({ queryKey: ["contabil", "atividades"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, ehMembro, buscar, qc]);

  // Título da aba piscando enquanto houver pendências.
  useEffect(() => {
    if (!fila.length) return;
    const original = document.title;
    const alerta = `🔔 (${fila.length}) Nova atividade!`;
    let on = false;
    const flash = () => { on = !on; document.title = on ? alerta : original; };
    flash();
    const t = window.setInterval(flash, 1000);
    return () => { window.clearInterval(t); document.title = original; };
  }, [fila.length]);

  // Notificação do sistema quando a aba está em segundo plano.
  useEffect(() => {
    if (!fila.length || typeof Notification === "undefined") return;
    const notificar = () => {
      if (Notification.permission !== "granted" || !document.hidden) return;
      const n = new Notification("Nova atividade para você", { body: fila[0]?.atividade.slice(0, 120), tag: "contabil-nova-atividade" });
      n.onclick = () => { window.focus(); n.close(); };
    };
    if (Notification.permission === "default") Notification.requestPermission().then(notificar).catch(() => undefined);
    else notificar();
  }, [fila]);

  const atual = fila[0];

  async function ciente() {
    if (!atual || !user?.id) return;
    setSaving(true);
    const { error } = await cdb.from("contabil_ciencias").insert({ atividade_id: atual.id, user_id: user.id });
    setSaving(false);
    if (error && error.code !== "23505") return;
    setFila((f) => f.slice(1));
    qc.invalidateQueries({ queryKey: ["contabil", "ciencias"] });
  }

  if (!atual) return null;

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="max-w-lg [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <BellRing className="relative h-4 w-4" />
            </span>
            Nova atividade para você
          </DialogTitle>
          <DialogDescription className="text-xs">
            Contábil · confirme que está ciente para continuar.{fila.length > 1 ? ` (${fila.length} pendentes)` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm font-medium">{atual.atividade}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {atual.setor && <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">{atual.setor}</span>}
            <PrioridadePill p={atual.prioridade} long />
            <span>Prazo: {dataBR(atual.prazo) ?? "sem prazo"}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={ciente} disabled={saving}>{saving ? "Registrando…" : "Estou ciente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
