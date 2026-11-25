import { createFileRoute, redirect } from "@tanstack/react-router";

/** O acesso à IA agora é dado em Pessoas › Acessos (empresa "Grupo"). */
export const Route = createFileRoute("/_authenticated/ia/acesso")({
  beforeLoad: () => { throw redirect({ to: "/pessoas/acessos" }); },
});
