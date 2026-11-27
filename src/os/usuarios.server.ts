import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AcessoRow } from "./recursos";
import { acessosDaSelecao, type SelecaoAcesso } from "./usuarios";

/**
 * Grava a seleção de marcas e módulos de uma pessoa em os_acessos.
 * Recebe o cliente de quem está logado: a regra do banco só deixa administradores gravarem.
 */
export async function aplicarSelecao(db: SupabaseClient<Database>, userId: string, selecao: SelecaoAcesso) {
  const lidos = await db.from("os_acessos").select("empresa,recurso,nivel").eq("user_id", userId);
  if (lidos.error) throw new Error("Não foi possível ler os acessos atuais.");
  const { gravar, remover } = acessosDaSelecao((lidos.data ?? []) as AcessoRow[], selecao);

  const porEmpresa = new Map<string, string[]>();
  for (const r of remover) porEmpresa.set(r.empresa, [...(porEmpresa.get(r.empresa) ?? []), r.recurso]);
  for (const [empresa, recursos] of porEmpresa) {
    const r = await db.from("os_acessos").delete().eq("user_id", userId).eq("empresa", empresa).in("recurso", recursos);
    if (r.error) {
      console.error("[usuarios] remover acessos falhou:", r.error.message);
      throw new Error("Não foi possível salvar os acessos.");
    }
  }
  if (gravar.length) {
    const r = await db.from("os_acessos").upsert(gravar.map((g) => ({ user_id: userId, empresa: g.empresa, recurso: g.recurso, nivel: g.nivel })), { onConflict: "user_id,empresa,recurso" });
    if (r.error) {
      console.error("[usuarios] gravar acessos falhou:", r.error.message);
      throw new Error("Não foi possível salvar os acessos.");
    }
  }
  return { liberadas: gravar.length, retiradas: remover.length };
}
