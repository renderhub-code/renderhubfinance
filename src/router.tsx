import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Dados recém-buscados valem 30s: trocar de aba mostra o cache na hora
  // e só busca de novo em segundo plano quando passar desse tempo.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Ao passar o mouse num link do menu, já baixa o código da página.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
