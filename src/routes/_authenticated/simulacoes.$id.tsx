import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulacoes/$id")({
  head: () => ({ meta: [{ title: "Editar simulação — Hub Financial Command" }] }),
  component: SimEditor,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function SimEditor() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/simulacoes">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editor de simulação</h1>
          <p className="text-sm text-muted-foreground">Distribuição mensal por categoria contábil.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linhas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Categoria</TableHead>
                {MONTHS.map((m) => (
                  <TableHead key={m} className="text-right">{m}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">—</TableCell>
                  {MONTHS.map((m) => (
                    <TableCell key={m} className="text-right text-muted-foreground">—</TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
