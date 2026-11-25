import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TechBackground } from "@/components/brand/TechBackground";
import { HubOrbit } from "@/components/brand/HubOrbit";
import { OsWordmark } from "@/components/brand/Logo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AtivarContaUnion } from "@/components/contabil/AtivarContaUnion";
import { aberturaAoVoltar, tocarAbertura } from "@/components/brand/IntroSplash";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — render.os" },
      { name: "description", content: "Acesse o render.os, o sistema do Grupo Render Hub." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Entrar — render.os" },
      { property: "og:description", content: "Acesse o render.os, o sistema do Grupo Render Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ativandoUnion, setAtivandoUnion] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("ativar") === "union") {
      setAtivandoUnion(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function afterAuth() {
    // Bootstrap first controller if there isn't one yet
    try { await supabase.rpc("bootstrap_first_controller"); } catch {}
    tocarAbertura();
    navigate({ to: "/inicio", replace: true });
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    await afterAuth();
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: String(fd.get("full_name") || "") },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada!");
    await afterAuth();
  }

  async function handleGoogle() {
    setLoading(true);
    aberturaAoVoltar();
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(String(result.error)); setLoading(false); return; }
    if (result.redirected) return;
    await afterAuth();
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden bg-[#06070a] text-white lg:flex lg:flex-col">
        <TechBackground />
        <div className="relative z-10 p-10">
          <Link to="/"><OsWordmark tone="dark" /></Link>
        </div>
        <div className="relative z-10 mx-auto my-auto w-full max-w-[440px] px-10">
          <HubOrbit compact />
        </div>
        <div className="relative z-10 p-10">
          <p className="font-display text-2xl font-semibold leading-snug tracking-tight">
            Uma marca. Seis operações.<br /><span className="ros-gradient-text">Um só sistema.</span>
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">Grupo Render Hub · Recife — PE</p>
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm ros-page-enter">
          <div className="mb-8 lg:hidden"><OsWordmark /></div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Bem-vindo ao render.os</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Entre para acessar as empresas do grupo.</p>
          <div className="mt-8">
          {ativandoUnion ? <AtivarContaUnion onDone={afterAuth} onCancel={() => { window.history.replaceState(null, "", "/auth"); setAtivandoUnion(false); }} /> : <>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="l-email">E-mail</Label>
                  <Input id="l-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="l-pass">Senha</Label>
                  <Input id="l-pass" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="h-10 w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="s-name">Nome completo</Label>
                  <Input id="s-name" name="full_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-email">E-mail</Label>
                  <Input id="s-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-pass">Senha</Label>
                  <Input id="s-pass" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </div>
                <Button type="submit" className="h-10 w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
          </div>
          <Button variant="outline" className="h-10 w-full" onClick={handleGoogle} disabled={loading}>
            Continuar com Google
          </Button>
          <Button variant="link" className="mt-3 w-full" onClick={() => setAtivandoUnion(true)}>Ativar conta Union</Button>
          <p className="text-xs text-muted-foreground text-center mt-6">
            O primeiro usuário se torna Controller com acesso a todas as empresas.
          </p>
          </>}
          </div>
        </div>
      </main>
    </div>
  );
}
