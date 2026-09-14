import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountMapping } from "@/lib/queries";

interface ParsedRow {
  source_code: string;
  source_name: string | null;
  exists: boolean;
}

interface Props {
  companyId: string;
  mappings: AccountMapping[];
  disabled?: boolean;
}

const HEADER_HINTS = ["codigo", "código", "conta", "categoria", "classificacao", "classificação", "cod"];

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isHeaderRow(code: string, name: string): boolean {
  const c = code.toLowerCase();
  const n = name.toLowerCase();
  const looksLikeCode = /\d/.test(code);
  if (looksLikeCode) return false;
  return HEADER_HINTS.some((h) => c.includes(h) || n.includes(h)) || (!looksLikeCode && c.length > 0);
}

export function ImportarPlanoContas({ companyId, mappings, disabled }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [fileName, setFileName] = useState("");

  const existingCodes = new Set(mappings.map((m) => m.source_code));

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

      const seen = new Set<string>();
      const parsed: ParsedRow[] = [];
      let discarded = 0;

      for (const raw of matrix) {
        const code = normalize(raw?.[0]);
        const name = normalize(raw?.[1]);
        if (!code) {
          discarded++;
          continue;
        }
        if (isHeaderRow(code, name)) {
          discarded++;
          continue;
        }
        if (seen.has(code)) {
          discarded++;
          continue;
        }
        seen.add(code);
        parsed.push({
          source_code: code,
          source_name: name || null,
          exists: existingCodes.has(code),
        });
      }

      if (parsed.length === 0) {
        toast.error("Nenhuma categoria analítica encontrada na primeira coluna do arquivo.");
        return;
      }

      setFileName(file.name);
      setRows(parsed);
      setSkipped(discarded);
      setUpdateExisting(false);
      setOpen(true);
    } catch {
      toast.error("Não foi possível ler o arquivo. Verifique se é um Excel ou CSV válido.");
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const news = rows.filter((r) => !r.exists);
      const dupes = rows.filter((r) => r.exists);

      if (news.length > 0) {
        const { error } = await supabase.from("account_mappings").insert(
          news.map((r) => ({
            company_id: companyId,
            source_code: r.source_code,
            source_name: r.source_name,
            account_id: null,
          })),
        );
        if (error) throw error;
      }

      let updated = 0;
      if (updateExisting) {
        for (const r of dupes) {
          const { error } = await supabase
            .from("account_mappings")
            .update({ source_name: r.source_name })
            .eq("company_id", companyId)
            .eq("source_code", r.source_code);
          if (error) throw error;
          updated++;
        }
      }

      return { created: news.length, updated, ignored: updateExisting ? 0 : dupes.length };
    },
    onSuccess: ({ created, updated, ignored }) => {
      queryClient.invalidateQueries({ queryKey: ["account_mappings", companyId] });
      toast.success(
        `${created} criada(s), ${updated} atualizada(s), ${ignored} ignorada(s).`,
      );
      setOpen(false);
      setRows([]);
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message ?? "Não foi possível importar as categorias."),
  });

  const newCount = rows.filter((r) => !r.exists).length;
  const dupeCount = rows.length - newCount;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 size-4" /> Importar Excel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar categorias analíticas</DialogTitle>
            <DialogDescription>
              {fileName} — {newCount} nova(s), {dupeCount} já existente(s), {skipped}{" "}
              linha(s) descartada(s).
            </DialogDescription>
          </DialogHeader>

          {dupeCount > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={updateExisting}
                onCheckedChange={(v) => setUpdateExisting(v === true)}
              />
              Atualizar a descrição das correspondências já existentes
            </label>
          )}

          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Código de origem</TableHead>
                  <TableHead>Descrição de origem</TableHead>
                  <TableHead className="w-32">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source_code}>
                    <TableCell className="font-mono text-xs">{r.source_code}</TableCell>
                    <TableCell>{r.source_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.exists ? (updateExisting ? "Atualizar" : "Ignorar") : "Criar"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || (newCount === 0 && !updateExisting)}
            >
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
