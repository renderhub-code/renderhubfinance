import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/os/page";
import {
  Card,
  ColabSelect,
  EmpresaTag,
  Field,
  Nota,
  Pill,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import {
  DIMENSOES,
  NIVEL_9BOX,
  baixarCsv,
  classificacao,
  fmtData,
  nomeEmpresa,
  rdb,
  useAvaliacoes,
  useColaboradores,
  useInvalidateRh,
  useRhCtx,
  type Avaliacao,
  type Colaborador,
} from "@/os/rh/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rh/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações · RH — render.os" }] }),
  component: Avaliacoes,
});

type Tipo = "9box" | "desempenho";
const ano = new Date().getFullYear();
const cicloAtual = (t: Tipo) => {
  const m = new Date().getMonth();
  return t === "9box" ? `${ano} · T${Math.floor(m / 3) + 1}` : `${ano} · S${m < 6 ? 1 : 2}`;
};
const ciclosPossiveis = (t: Tipo) =>
  [ano - 1, ano, ano + 1].flatMap((a) =>
    t === "9box" ? [1, 2, 3, 4].map((q) => `${a} · T${q}`) : [1, 2].map((s) => `${a} · S${s}`),
  );

/** Rótulos dos quadrantes (potencial × desempenho). */
const QUADRANTE: Record<string, string> = {
  "3-1": "Enigma",
  "3-2": "Forte potencial",
  "3-3": "Destaque",
  "2-1": "Questionável",
  "2-2": "Mantenedor",
  "2-3": "Forte desempenho",
  "1-1": "Insuficiente",
  "1-2": "Eficaz",
  "1-3": "Profissional confiável",
};

function Avaliacoes() {
  const ctx = useRhCtx("rh.avaliacoes");
  const colabs = useColaboradores(ctx.empresas);
  const lista = colabs.data ?? [];
  const aval = useAvaliacoes(lista, lista.length > 0);
  const [novo, setNovo] = useState<Tipo | null>(null);
  const porId = new Map(lista.map((c) => [c.id, c]));
  const todas = aval.data ?? [];

  return (
    <RhGate
      ver={ctx.ver}
      loading={ctx.loading || colabs.isLoading}
      erro={colabs.error ?? aval.error}
    >
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Avaliações"
          description="9 Box a cada trimestre e avaliação de desempenho a cada semestre, para orientar conversas de desenvolvimento."
        />
        <Tabs defaultValue="9box">
          <TabsList className="mb-6">
            <TabsTrigger value="9box">9 Box · trimestral</TabsTrigger>
            <TabsTrigger value="desempenho">Desempenho · semestral</TabsTrigger>
          </TabsList>
          <TabsContent value="9box">
            <NineBox
              avals={todas.filter((a) => a.tipo === "9box")}
              porId={porId}
              grupo={ctx.grupo}
              edita={ctx.edita}
              onNovo={() => setNovo("9box")}
            />
          </TabsContent>
          <TabsContent value="desempenho">
            <Desempenho
              avals={todas.filter((a) => a.tipo === "desempenho")}
              porId={porId}
              grupo={ctx.grupo}
              edita={ctx.edita}
              onNovo={() => setNovo("desempenho")}
            />
          </TabsContent>
        </Tabs>
        {novo && (
          <AvaliacaoDialog
            tipo={novo}
            colabs={lista.filter((c) => c.status !== "desligado" && ctx.edita(c.empresa))}
            onClose={() => setNovo(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

interface ListaProps {
  avals: Avaliacao[];
  porId: Map<string, Colaborador>;
  grupo: boolean;
  edita: (e?: string) => boolean;
  onNovo: () => void;
}

function useExcluir() {
  const invalidate = useInvalidateRh();
  return async (a: Avaliacao, nome: string) => {
    if (!confirm(`Excluir a avaliação de ${nome} (${a.ciclo})?`)) return;
    const { error } = await rdb.from("rh_avaliacoes").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  };
}

function CicloSelect({
  value,
  onChange,
  ciclos,
}: {
  value: string;
  onChange: (v: string) => void;
  ciclos: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os ciclos</SelectItem>
        {ciclos.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NineBox({ avals, porId, grupo, edita, onNovo }: ListaProps) {
  const excluir = useExcluir();
  const ciclos = [...new Set(avals.map((a) => a.ciclo))].sort().reverse();
  const [ciclo, setCiclo] = useState<string>(() => ciclos[0] ?? "todos");
  const filtradas = avals.filter((a) => ciclo === "todos" || a.ciclo === ciclo);
  // Na matriz, a avaliação mais recente de cada pessoa no filtro.
  const ultimas = useMemo(() => {
    const m = new Map<string, Avaliacao>();
    for (const a of filtradas) if (!m.has(a.colaborador_id)) m.set(a.colaborador_id, a);
    return [...m.values()];
  }, [filtradas]);
  const nome = (id: string) => porId.get(id)?.nome ?? "—";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CicloSelect
          value={ciclos.includes(ciclo) || ciclo === "todos" ? ciclo : "todos"}
          onChange={setCiclo}
          ciclos={ciclos}
        />
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtradas.length}
            onClick={() =>
              baixarCsv(
                "avaliacoes_9box.csv",
                [
                  "Empresa",
                  "Colaborador",
                  "Gestor",
                  "Área",
                  "Ciclo",
                  "Desempenho",
                  "Potencial",
                  "Pontos fortes",
                  "Pontos de melhoria",
                  "Plano de ação",
                ],
                filtradas.map((a) => {
                  const c = porId.get(a.colaborador_id);
                  return [
                    nomeEmpresa(c?.empresa ?? ""),
                    c?.nome,
                    a.gestor,
                    c?.setor,
                    a.ciclo,
                    NIVEL_9BOX[a.desempenho!],
                    NIVEL_9BOX[a.potencial!],
                    a.fortes,
                    a.melhorias,
                    a.plano,
                  ];
                }),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          {edita() && (
            <Button size="sm" onClick={onNovo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Registrar 9 Box
            </Button>
          )}
        </div>
      </div>
      <Card
        title="Matriz 9 Box"
        sub="Potencial ↑ · Desempenho →. Cada quadrante mostra quem está nele (última avaliação no filtro)."
        className="mb-6"
      >
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
          {[3, 2, 1].map((p) => (
            <div key={p} className="contents">
              <div className="flex items-center pr-1 text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                Potencial {NIVEL_9BOX[p]!.toLowerCase()}
              </div>
              {[1, 2, 3].map((d) => {
                const aqui = ultimas.filter((a) => a.potencial === p && a.desempenho === d);
                const forte = p + d >= 5;
                const fraco = p + d <= 3;
                return (
                  <div
                    key={d}
                    className={cn(
                      "min-h-28 rounded-lg border p-3",
                      forte ? "bg-emerald-50/60" : fraco ? "bg-red-50/50" : "bg-muted/30",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">{QUADRANTE[`${p}-${d}`]}</span>
                      <span className="text-lg font-semibold tabular-nums">{aqui.length}</span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {aqui.slice(0, 6).map((a) => (
                        <li key={a.id} className="truncate">
                          {nome(a.colaborador_id)}
                        </li>
                      ))}
                      {aqui.length > 6 && <li>+{aqui.length - 6}</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
          <div />
          {[1, 2, 3].map((d) => (
            <div key={d} className="text-center text-[11px] text-muted-foreground">
              Desempenho {NIVEL_9BOX[d]!.toLowerCase()}
            </div>
          ))}
        </div>
      </Card>
      <h2 className="mb-3 text-sm font-semibold">Histórico</h2>
      <Tabela
        colSpan={8}
        vazio={!filtradas.length && "Nenhuma avaliação registrada."}
        cab={
          <tr>
            <th>Colaborador</th>
            {grupo && <th>Empresa</th>}
            <th>Gestor</th>
            <th>Ciclo</th>
            <th>Desempenho</th>
            <th>Potencial</th>
            <th>Plano de ação</th>
            <th className="w-12" />
          </tr>
        }
      >
        {filtradas.map((a) => {
          const c = porId.get(a.colaborador_id);
          return (
            <tr key={a.id} className="align-top">
              <td>
                <div className="font-medium">{c?.nome}</div>
                <div className="text-xs text-muted-foreground">{c?.setor}</div>
              </td>
              {grupo && <td>{c && <EmpresaTag id={c.empresa} />}</td>}
              <td>{a.gestor || "—"}</td>
              <td className="whitespace-nowrap">{a.ciclo}</td>
              <td>{NIVEL_9BOX[a.desempenho!]}</td>
              <td>{NIVEL_9BOX[a.potencial!]}</td>
              <td className="max-w-md text-xs text-muted-foreground">{a.plano || "—"}</td>
              <td className="text-right">
                {c && edita(c.empresa) && (
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                    onClick={() => void excluir(a, c.nome)}
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
        A 9 Box acontece a cada três meses e orienta conversas de desenvolvimento e melhoria
        contínua. A classificação apoia a discussão; não é uma decisão automática sobre a pessoa.
      </Nota>
    </>
  );
}

function Desempenho({ avals, porId, grupo, edita, onNovo }: ListaProps) {
  const excluir = useExcluir();
  const ciclos = [...new Set(avals.map((a) => a.ciclo))].sort().reverse();
  const [ciclo, setCiclo] = useState<string>(() => ciclos[0] ?? "todos");
  const filtradas = avals.filter((a) => ciclo === "todos" || a.ciclo === ciclo);
  const media = filtradas.length
    ? filtradas.reduce((s, a) => s + Number(a.media ?? 0), 0) / filtradas.length
    : 0;
  const porDim = DIMENSOES.map((d, i) => ({
    d,
    v: filtradas.length
      ? filtradas.reduce((s, a) => s + (a.notas?.[i] ?? 0), 0) / filtradas.length
      : 0,
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CicloSelect
          value={ciclos.includes(ciclo) || ciclo === "todos" ? ciclo : "todos"}
          onChange={setCiclo}
          ciclos={ciclos}
        />
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtradas.length}
            onClick={() =>
              baixarCsv(
                "avaliacoes_desempenho.csv",
                [
                  "Empresa",
                  "Colaborador",
                  "Gestor",
                  "Área",
                  "Período",
                  "Média",
                  "Classificação",
                  ...DIMENSOES,
                  "Resultados",
                  "Pontos fortes e melhorias",
                  "Plano",
                ],
                filtradas.map((a) => {
                  const c = porId.get(a.colaborador_id);
                  return [
                    nomeEmpresa(c?.empresa ?? ""),
                    c?.nome,
                    a.gestor,
                    c?.setor,
                    a.ciclo,
                    Number(a.media).toFixed(2).replace(".", ","),
                    classificacao(Number(a.media)),
                    ...(a.notas ?? []),
                    a.resultados,
                    a.fortes,
                    a.plano,
                  ];
                }),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          {edita() && (
            <Button size="sm" onClick={onNovo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Registrar avaliação
            </Button>
          )}
        </div>
      </div>
      {filtradas.length > 0 && (
        <Card
          title="Média por dimensão"
          sub={`Média geral ${media.toFixed(1).replace(".", ",")} / 5 · ${filtradas.length} avaliação(ões)`}
          className="mb-6"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porDim.map(({ d, v }) => (
              <div key={d}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{d}</span>
                  <span className="font-semibold tabular-nums">
                    {v.toFixed(1).replace(".", ",")}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-brand-blue"
                    style={{ width: `${(v / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Tabela
        colSpan={8}
        vazio={!filtradas.length && "Nenhuma avaliação registrada."}
        cab={
          <tr>
            <th>Colaborador</th>
            {grupo && <th>Empresa</th>}
            <th>Gestor</th>
            <th>Período</th>
            <th>Média</th>
            <th>Classificação</th>
            <th>Plano de desenvolvimento</th>
            <th className="w-12" />
          </tr>
        }
      >
        {filtradas.map((a) => {
          const c = porId.get(a.colaborador_id);
          const m = Number(a.media ?? 0);
          return (
            <tr key={a.id} className="align-top">
              <td>
                <div className="font-medium">{c?.nome}</div>
                <div className="text-xs text-muted-foreground">{fmtData(a.criado_em)}</div>
              </td>
              {grupo && <td>{c && <EmpresaTag id={c.empresa} />}</td>}
              <td>{a.gestor || "—"}</td>
              <td className="whitespace-nowrap">{a.ciclo}</td>
              <td className="font-semibold tabular-nums">{m.toFixed(1).replace(".", ",")} / 5</td>
              <td>
                <Pill tone={m >= 3.5 ? "good" : m >= 2.5 ? "info" : "warn"}>
                  {classificacao(m)}
                </Pill>
              </td>
              <td className="max-w-md text-xs text-muted-foreground">{a.plano || "—"}</td>
              <td className="text-right">
                {c && edita(c.empresa) && (
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                    onClick={() => void excluir(a, c.nome)}
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
        A avaliação de desempenho acontece a cada seis meses e complementa a 9 Box. Notas de 1
        (muito abaixo) a 5 (excelente); a média define a classificação: 4,5+ destaque, 3,5+ acima do
        esperado, 2,5+ dentro do esperado.
      </Nota>
    </>
  );
}

const NOTAS = [
  "1 · Muito abaixo",
  "2 · Abaixo",
  "3 · Dentro do esperado",
  "4 · Acima",
  "5 · Excelente",
];

function AvaliacaoDialog({
  tipo,
  colabs,
  onClose,
}: {
  tipo: Tipo;
  colabs: Colaborador[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Avaliacao>>({
    tipo,
    ciclo: cicloAtual(tipo),
    desempenho: 2,
    potencial: 2,
    notas: [3, 3, 3, 3, 3, 3],
  });
  const notas = f.notas ?? [];
  const media = notas.reduce((a, b) => a + b, 0) / (notas.length || 1);
  const txt =
    (k: keyof Avaliacao) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function salvar() {
    if (!f.colaborador_id) {
      toast.error("Escolha o colaborador.");
      return;
    }
    const row: Record<string, unknown> =
      tipo === "9box"
        ? {
            colaborador_id: f.colaborador_id,
            tipo,
            ciclo: f.ciclo,
            gestor: f.gestor || null,
            desempenho: f.desempenho,
            potencial: f.potencial,
            fortes: f.fortes || null,
            melhorias: f.melhorias || null,
            plano: f.plano || null,
          }
        : {
            colaborador_id: f.colaborador_id,
            tipo,
            ciclo: f.ciclo,
            gestor: f.gestor || null,
            notas,
            media: Math.round(media * 100) / 100,
            resultados: f.resultados || null,
            fortes: f.fortes || null,
            plano: f.plano || null,
          };
    const { error } = await rdb.from("rh_avaliacoes").insert(row);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Avaliação registrada.");
    void invalidate();
    onClose();
  }
  const nivelSel = (k: "desempenho" | "potencial") => (
    <Select value={String(f[k])} onValueChange={(v) => setF({ ...f, [k]: Number(v) })}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[1, 2, 3].map((n) => (
          <SelectItem key={n} value={String(n)}>
            {NIVEL_9BOX[n]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {tipo === "9box" ? "Registrar avaliação 9 Box" : "Registrar avaliação de desempenho"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colaborador" full>
            <ColabSelect
              value={f.colaborador_id}
              onChange={(id) => setF({ ...f, colaborador_id: id })}
              colabs={colabs}
            />
          </Field>
          <Field label="Gestor avaliador">
            <Input value={f.gestor ?? ""} onChange={txt("gestor")} />
          </Field>
          <Field label={tipo === "9box" ? "Trimestre" : "Semestre"}>
            <Select value={f.ciclo} onValueChange={(v) => setF({ ...f, ciclo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ciclosPossiveis(tipo).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {tipo === "9box" ? (
            <>
              <Field label="Desempenho atual">{nivelSel("desempenho")}</Field>
              <Field label="Potencial de desenvolvimento">{nivelSel("potencial")}</Field>
              <Field label="Pontos fortes observados" full>
                <Textarea rows={2} value={f.fortes ?? ""} onChange={txt("fortes")} />
              </Field>
              <Field label="Pontos de melhoria / dificuldades" full>
                <Textarea rows={2} value={f.melhorias ?? ""} onChange={txt("melhorias")} />
              </Field>
            </>
          ) : (
            <>
              {DIMENSOES.map((d, i) => (
                <Field key={d} label={`${d} (1 a 5)`}>
                  <Select
                    value={String(notas[i] ?? 3)}
                    onValueChange={(v) => {
                      const n = [...notas];
                      n[i] = Number(v);
                      setF({ ...f, notas: n });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTAS.map((l, j) => (
                        <SelectItem key={l} value={String(j + 1)}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm sm:col-span-2">
                <span>
                  Média <b className="tabular-nums">{media.toFixed(1).replace(".", ",")} / 5</b>
                </span>
                <Pill tone="info">{classificacao(media)}</Pill>
              </div>
              <Field label="Principais resultados e contribuições" full>
                <Textarea rows={2} value={f.resultados ?? ""} onChange={txt("resultados")} />
              </Field>
              <Field label="Pontos fortes e oportunidades de melhoria" full>
                <Textarea rows={2} value={f.fortes ?? ""} onChange={txt("fortes")} />
              </Field>
            </>
          )}
          <Field
            label={
              tipo === "9box"
                ? "Plano de ação e acompanhamento"
                : "Plano de desenvolvimento / metas do próximo ciclo"
            }
            full
          >
            <Textarea rows={2} value={f.plano ?? ""} onChange={txt("plano")} />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()}>Salvar avaliação</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
