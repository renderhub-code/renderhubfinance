import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Hub Financial Command" },
      { name: "description", content: "Registro de lançamentos financeiros do hub." },
    ],
  }),
  component: LancamentosPage,
});

const COLUMNS = [
  "Data do Documento",
  "Nº do Documento",
  "Data do Pagamento",
  "Valor Pago",
  "Histórico",
  "Conta Financeira",
  "Banco",
  "Conta",
];

function LancamentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
        <p className="text-sm text-muted-foreground">
          Registro de documentos e pagamentos conforme princípio da competência e caixa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c} className={c === "Valor Pago" ? "text-right whitespace-nowrap" : "whitespace-nowrap"}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((c) => (
                    <TableCell
                      key={c}
                      className={
                        (c === "Valor Pago" ? "text-right " : "") + "text-muted-foreground whitespace-nowrap"
                      }
                    >
                      —
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
