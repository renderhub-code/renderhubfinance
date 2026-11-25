import { createFileRoute, redirect } from "@tanstack/react-router";

/** A equipe do follow-up agora é liberada em Pessoas › Acessos (empresa Render Comex). */
export const Route = createFileRoute("/_authenticated/comex/equipe")({
  beforeLoad: () => { throw redirect({ to: "/pessoas/acessos" }); },
});
