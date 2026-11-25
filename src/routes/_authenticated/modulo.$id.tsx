import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { getModule } from "@/os/modules";

export const Route = createFileRoute("/_authenticated/modulo/$id")({
  loader: ({ params }) => {
    const mod = getModule(params.id);
    if (!mod) throw notFound();
    return { id: mod.id };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${getModule(loaderData?.id ?? "")?.label ?? "Módulo"} — render.os` }] }),
  component: ModuloEmBreve,
});

function ModuloEmBreve() {
  const { id } = Route.useLoaderData();
  const mod = getModule(id)!;
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border bg-muted/40">
          <mod.icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">{mod.label}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{mod.description}</p>
        <div className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <Hammer className="h-3.5 w-3.5" /> Módulo em construção
        </div>
        <div className="mt-6">
          <Link to="/inicio" className="text-sm font-medium text-primary hover:underline">Voltar ao início</Link>
        </div>
      </div>
    </div>
  );
}
