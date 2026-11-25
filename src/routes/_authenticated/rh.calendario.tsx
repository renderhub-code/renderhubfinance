import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import {
  Card,
  EmpresaSelect,
  EmpresaTag,
  Field,
  NumInput,
  Pill,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import { rdb, useCalendario, useInvalidateRh, useRhCtx, type Atividade } from "@/os/rh/data";
import type { CompanyId } from "@/os/companies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rh/calendario")({
  head: () => ({ meta: [{ title: "Calendário · RH — render.os" }] }),
  component: Calendario,
});

const PADRAO = [
  { atividade: "Revisar vencimentos de contratos PJ e ASOs", dia: 5, responsavel: "RH" },
  {
    atividade: "Enviar ASOs realizados / documentos ocupacionais ao controle",
    dia: 10,
    responsavel: "RH",
  },
  {
    atividade: "Enviar boletos de alimentação, refeição e gasolina ao Financeiro",
    dia: 24,
    responsavel: "RH",
  },
  {
    atividade: "Conferir benefícios e movimentações (admissões/desligamentos)",
    dia: 25,
    responsavel: "RH",
  },
  {
    atividade: "Conferir ponto, escalas e horas extras para fechamento",
    dia: 28,
    responsavel: "RH + Lideranças",
  },
];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Calendario() {
  const ctx = useRhCtx("rh.calendario");
  const cal = useCalendario(ctx.empresas);
  const invalidate = useInvalidateRh();
  const hoje = new Date();
  const [mes, setMes] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`,
  );
  const [editando, setEditando] = useState<Partial<Atividade> | null>(null);
  const tarefas = cal.data ?? [];
  const [y, m] = mes.split("-").map(Number) as [number, number];
  const diasNoMes = new Date(y, m, 0).getDate();
  const primeiro = new Date(y, m - 1, 1).getDay();
  const doMes = tarefas
    .filter((t) => t.ativo)
    .map((t) => ({ ...t, diaReal: Math.min(t.dia, diasNoMes) }))
    .sort((a, b) => a.diaReal - b.diaReal);
  const marcados = new Set(doMes.map((t) => t.diaReal));
  const ehHoje = (d: number) =>
    y === hoje.getFullYear() && m === hoje.getMonth() + 1 && d === hoje.getDate();
  const semPadrao = ctx.editaveis.filter((e) => !tarefas.some((t) => t.empresa === e));

  async function incluirPadrao() {
    const rows = semPadrao.flatMap((empresa) =>
      PADRAO.map((p) => ({ ...p, empresa, recorrencia: "Mensal" })),
    );
    const { error } = await rdb.from("rh_calendario").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Atividades padrão incluídas.");
    void invalidate();
  }
  async function excluir(t: Atividade) {
    if (!confirm(`Excluir "${t.atividade}"?`)) return;
    const { error } = await rdb.from("rh_calendario").delete().eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }
  async function alternar(t: Atividade, ativo: boolean) {
    const { error } = await rdb.from("rh_calendario").update({ ativo }).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }

  const nomeMes = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || cal.isLoading} erro={cal.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Calendário de atividades do RH"
          description="Compromissos recorrentes, prazos e entregas ao Financeiro mês a mês."
          actions={
            <>
              {semPadrao.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => void incluirPadrao()}>
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  Incluir atividades padrão
                </Button>
              )}
              {ctx.edita() && (
                <Button
                  size="sm"
                  onClick={() =>
                    setEditando({
                      empresa: ctx.editaveis[0],
                      recorrencia: "Mensal",
                      responsavel: "RH",
                      ativo: true,
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova atividade
                </Button>
              )}
            </>
          }
        />
        <div className="mb-6 flex items-end gap-3">
          <Field label="Mês de referência">
            <Input
              type="month"
              className="w-44"
              value={mes}
              onChange={(e) => e.target.value && setMes(e.target.value)}
            />
          </Field>
        </div>
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card title={`Atividades de ${nomeMes}`}>
            {doMes.length ? (
              <ul className="divide-y">
                {doMes.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-blue/10 text-sm font-semibold tabular-nums text-brand-blue">
                        {String(t.diaReal).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="text-sm font-medium leading-snug">{t.atividade}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          Responsável: {t.responsavel || "RH"}
                          {ctx.grupo && <EmpresaTag id={t.empresa} />}
                        </div>
                      </div>
                    </div>
                    <Pill>{t.recorrencia}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma atividade ativa.{" "}
                {semPadrao.length > 0 && "Use “Incluir atividades padrão” para começar."}
              </p>
            )}
          </Card>
          <Card title="Calendário visual" sub="Dias com compromissos aparecem destacados.">
            <div className="grid grid-cols-7 gap-1 text-center">
              {SEMANA.map((d) => (
                <div key={d} className="py-1 text-[10px] text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: primeiro }, (_, i) => (
                <div key={`v${i}`} />
              ))}
              {Array.from({ length: diasNoMes }, (_, i) => {
                const d = i + 1;
                const tem = marcados.has(d);
                return (
                  <div
                    key={d}
                    title={
                      tem
                        ? doMes
                            .filter((t) => t.diaReal === d)
                            .map((t) => t.atividade)
                            .join("\n")
                        : undefined
                    }
                    className={cn(
                      "rounded-md border py-2 text-xs tabular-nums",
                      tem
                        ? "border-brand-blue bg-brand-blue/10 font-semibold text-brand-blue"
                        : "text-muted-foreground",
                      ehHoje(d) && "ring-2 ring-amber-400",
                    )}
                  >
                    {d}
                    {tem && <div className="text-[8px] leading-none">●</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <h2 className="mb-3 text-sm font-semibold">Atividades recorrentes cadastradas</h2>
        <Tabela
          colSpan={6}
          vazio={!tarefas.length && "Nenhuma atividade cadastrada."}
          cab={
            <tr>
              <th>Atividade</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Prazo</th>
              <th>Responsável</th>
              <th>Recorrência</th>
              <th>Ativa</th>
              <th className="w-20" />
            </tr>
          }
        >
          {tarefas.map((t) => (
            <tr key={t.id} className={cn(!t.ativo && "opacity-50")}>
              <td className="font-medium">{t.atividade}</td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={t.empresa} />
                </td>
              )}
              <td className="tabular-nums">Dia {t.dia}</td>
              <td>{t.responsavel || "—"}</td>
              <td>{t.recorrencia}</td>
              <td>
                <Switch
                  checked={t.ativo}
                  disabled={!ctx.edita(t.empresa)}
                  onCheckedChange={(v) => void alternar(t, v)}
                />
              </td>
              <td className="whitespace-nowrap text-right">
                {ctx.edita(t.empresa) && (
                  <>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                      onClick={() => setEditando(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                      onClick={() => void excluir(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
        {editando && (
          <AtividadeDialog
            value={editando}
            empresas={ctx.editaveis}
            onClose={() => setEditando(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

function AtividadeDialog({
  value,
  empresas,
  onClose,
}: {
  value: Partial<Atividade>;
  empresas: CompanyId[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Atividade>>(value);
  async function salvar() {
    if (!f.empresa || !f.atividade?.trim() || !f.dia || f.dia < 1 || f.dia > 31) {
      toast.error("Informe a atividade e um dia entre 1 e 31.");
      return;
    }
    const row = {
      empresa: f.empresa,
      atividade: f.atividade.trim(),
      dia: f.dia,
      responsavel: f.responsavel || null,
      recorrencia: f.recorrencia ?? "Mensal",
      ativo: f.ativo ?? true,
    };
    const { error } = value.id
      ? await rdb.from("rh_calendario").update(row).eq("id", value.id)
      : await rdb.from("rh_calendario").insert(row);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar atividade" : "Nova atividade"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.length > 1 && !value.id && (
            <Field label="Empresa" full>
              <EmpresaSelect
                value={f.empresa}
                onChange={(e) => setF({ ...f, empresa: e })}
                empresas={empresas}
              />
            </Field>
          )}
          <Field label="Atividade" full>
            <Input
              value={f.atividade ?? ""}
              onChange={(e) => setF({ ...f, atividade: e.target.value })}
            />
          </Field>
          <Field label="Dia do mês" hint="Em meses mais curtos, vale o último dia.">
            <NumInput
              step="1"
              min={1}
              max={31}
              value={f.dia}
              onChange={(v) => setF({ ...f, dia: v })}
            />
          </Field>
          <Field label="Responsável">
            <Input
              value={f.responsavel ?? ""}
              onChange={(e) => setF({ ...f, responsavel: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
