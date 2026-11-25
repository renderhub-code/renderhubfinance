import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/os/page";
import {
  ColabSelect,
  EmpresaTag,
  Field,
  Kpi,
  Nota,
  Pill,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import {
  RESULTADO_ASO,
  TIPO_ASO,
  diasAte,
  fmtData,
  rdb,
  ultimoAso,
  useAsos,
  useColaboradores,
  useInvalidateRh,
  useRhCtx,
  type Aso,
  type Colaborador,
  type ResultadoAso,
  type TipoAso,
} from "@/os/rh/data";

export const Route = createFileRoute("/_authenticated/rh/aso")({
  head: () => ({ meta: [{ title: "Saúde ocupacional · RH — render.os" }] }),
  component: AsoPage,
});

function situacao(a: Aso | undefined): {
  l: string;
  tone: "good" | "warn" | "bad" | "neutral";
  ordem: number;
} {
  if (!a) return { l: "Sem ASO", tone: "bad", ordem: 0 };
  if (!a.proxima) return { l: "Sem próxima data", tone: "neutral", ordem: 3 };
  const d = diasAte(a.proxima);
  if (d < 0) return { l: `Vencido há ${-d} dia(s)`, tone: "bad", ordem: 1 };
  if (d <= 30) return { l: `Vence em ${d} dia(s)`, tone: "warn", ordem: 2 };
  if (d <= 60) return { l: `Vence em ${d} dias`, tone: "neutral", ordem: 4 };
  return { l: "Válido", tone: "good", ordem: 5 };
}

/** Próximo periódico sugerido: 12 meses (ajustar conforme PCMSO). */
function somaMeses(data: string, meses: number) {
  const d = new Date(data + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function AsoPage() {
  const ctx = useRhCtx("rh.aso");
  const colabs = useColaboradores(ctx.empresas);
  const lista = colabs.data ?? [];
  const asosQ = useAsos(lista, lista.length > 0);
  const asos = asosQ.data ?? [];
  const invalidate = useInvalidateRh();
  const [novo, setNovo] = useState<Partial<Aso> | null>(null);
  const ultimo = ultimoAso(asos);
  const ativos = lista.filter((c) => c.status !== "desligado");
  const linhas = ativos
    .map((c) => ({ c, a: ultimo.get(c.id), s: situacao(ultimo.get(c.id)) }))
    .sort((x, y) => x.s.ordem - y.s.ordem || x.c.nome.localeCompare(y.c.nome));
  const porId = new Map(lista.map((c) => [c.id, c]));

  const tri = new Date();
  tri.setMonth(tri.getMonth() - 3);
  const triISO = tri.toISOString().slice(0, 10);
  const validos = linhas.filter((l) => l.s.ordem >= 3).length;
  const vencem30 = linhas.filter((l) => l.s.tone === "warn").length;
  const vencidos = linhas.filter((l) => l.s.tone === "bad").length;
  const trimestre = asos.filter((a) => a.data >= triISO).length;

  async function excluir(a: Aso) {
    if (
      !confirm(`Excluir o registro de ASO ${TIPO_ASO[a.tipo].toLowerCase()} de ${fmtData(a.data)}?`)
    )
      return;
    const { error } = await rdb.from("rh_asos").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }

  return (
    <RhGate
      ver={ctx.ver}
      loading={ctx.loading || colabs.isLoading}
      erro={colabs.error ?? asosQ.error}
    >
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Saúde ocupacional e ASO"
          description="Vencimentos, exames previstos e aptidão. Sem diagnósticos."
          actions={
            ctx.edita() && (
              <Button size="sm" onClick={() => setNovo({ tipo: "periodico", resultado: "apto" })}>
                <Plus className="mr-1.5 h-4 w-4" />
                Registrar ASO
              </Button>
            )
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="ASOs válidos" value={validos} tone="good" />
          <Kpi label="Vencem em 30 dias" value={vencem30} tone={vencem30 ? "warn" : undefined} />
          <Kpi label="Vencidos / sem ASO" value={vencidos} tone={vencidos ? "bad" : undefined} />
          <Kpi label="Exames no trimestre" value={trimestre} sub="Registros dos últimos 3 meses" />
        </div>
        <Tabela
          colSpan={8}
          vazio={!linhas.length && "Nenhum colaborador ativo."}
          cab={
            <tr>
              <th>Colaborador</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Setor</th>
              <th>Último ASO</th>
              <th>Data</th>
              <th>Próxima previsão</th>
              <th>Situação</th>
              <th />
            </tr>
          }
        >
          {linhas.map(({ c, a, s }) => (
            <tr key={c.id}>
              <td className="font-medium">{c.nome}</td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={c.empresa} />
                </td>
              )}
              <td>{c.setor || "—"}</td>
              <td>
                {a ? (
                  <>
                    {TIPO_ASO[a.tipo]}
                    {a.resultado !== "apto" && (
                      <span className="ml-1.5">
                        <Pill tone="warn">{RESULTADO_ASO[a.resultado]}</Pill>
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="tabular-nums">{fmtData(a?.data ?? null)}</td>
              <td className="tabular-nums">{fmtData(a?.proxima ?? null)}</td>
              <td>
                <Pill tone={s.tone}>{s.l}</Pill>
              </td>
              <td className="text-right">
                {ctx.edita(c.empresa) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setNovo({
                        colaborador_id: c.id,
                        tipo: a ? "periodico" : "admissional",
                        resultado: "apto",
                      })
                    }
                  >
                    {s.ordem <= 2 ? "Regularizar" : "Registrar"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>

        <h2 className="mb-3 mt-8 text-sm font-semibold">Histórico de registros</h2>
        <Tabela
          colSpan={7}
          vazio={!asos.length && "Nenhum ASO registrado."}
          cab={
            <tr>
              <th>Data</th>
              <th>Colaborador</th>
              <th>Tipo</th>
              <th>Aptidão</th>
              <th>Próxima</th>
              <th>Observação</th>
              <th className="w-12" />
            </tr>
          }
        >
          {asos.map((a) => {
            const c = porId.get(a.colaborador_id);
            return (
              <tr key={a.id}>
                <td className="tabular-nums">{fmtData(a.data)}</td>
                <td>{c?.nome}</td>
                <td>{TIPO_ASO[a.tipo]}</td>
                <td>{RESULTADO_ASO[a.resultado]}</td>
                <td className="tabular-nums">{fmtData(a.proxima)}</td>
                <td className="text-xs text-muted-foreground">{a.obs || "—"}</td>
                <td className="text-right">
                  {c && ctx.edita(c.empresa) && (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                      onClick={() => void excluir(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabela>
        <Nota>
          Periodicidade e exames seguem o PCMSO e o médico responsável. Dado de saúde é restrito: só
          quem tem a aba ASO vê esta tela; o painel mostra apenas contagens. Não registre
          diagnósticos, CID ou laudos aqui.
        </Nota>
        {novo && (
          <AsoDialog
            value={novo}
            colabs={ativos.filter((c) => ctx.edita(c.empresa))}
            onClose={() => setNovo(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

function AsoDialog({
  value,
  colabs,
  onClose,
}: {
  value: Partial<Aso>;
  colabs: Colaborador[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Aso>>(value);
  const setData = (data: string) =>
    setF({
      ...f,
      data,
      proxima:
        f.tipo === "demissional"
          ? null
          : f.proxima && f.data
            ? f.proxima
            : data
              ? somaMeses(data, 12)
              : null,
    });
  async function salvar() {
    if (!f.colaborador_id || !f.tipo || !f.data) {
      toast.error("Preencha colaborador, tipo e data.");
      return;
    }
    const { error } = await rdb.from("rh_asos").insert({
      colaborador_id: f.colaborador_id,
      tipo: f.tipo,
      data: f.data,
      proxima: f.proxima || null,
      resultado: f.resultado ?? "apto",
      obs: f.obs || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("ASO registrado.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar ASO</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colaborador" full>
            <ColabSelect
              value={f.colaborador_id}
              onChange={(id) => setF({ ...f, colaborador_id: id })}
              colabs={colabs}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={f.tipo}
              onValueChange={(v) =>
                setF({
                  ...f,
                  tipo: v as TipoAso,
                  ...(v === "demissional" ? { proxima: null } : {}),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_ASO).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aptidão">
            <Select
              value={f.resultado}
              onValueChange={(v) => setF({ ...f, resultado: v as ResultadoAso })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESULTADO_ASO).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data do exame">
            <Input type="date" value={f.data ?? ""} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Próxima previsão" hint="Sugestão: 12 meses. Ajuste conforme o PCMSO.">
            <Input
              type="date"
              value={f.proxima ?? ""}
              onChange={(e) => setF({ ...f, proxima: e.target.value || null })}
            />
          </Field>
          <Field label="Observação (sem diagnóstico)" full>
            <Input
              value={f.obs ?? ""}
              onChange={(e) => setF({ ...f, obs: e.target.value })}
              placeholder="Clínica, protocolo…"
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
