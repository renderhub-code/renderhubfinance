import { useEffect, useState } from "react";

const KEY = "render-os-intro-seen";

/**
 * Abertura com a logo da Render Hub. Toca uma vez por sessão do navegador.
 * Um script no <head> marca `html[data-intro-seen]` antes da pintura, então quem
 * já viu não enxerga nem um frame do overlay. Clique ou tecla pula a animação.
 */
export function IntroSplash() {
  const [state, setState] = useState<"show" | "skip" | "gone">("show");
  const [play, setPlay] = useState(false);

  // Só começa a animar depois da hidratação e com as imagens prontas,
  // para a sequência não reiniciar nem rodar com a logo ainda carregando.
  useEffect(() => {
    if (document.documentElement.hasAttribute("data-intro-seen")) { setState("gone"); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* modo privado */ }
    let cancelled = false;
    const ready = Promise.all(
      ["/brand/rh-arrow.png", "/brand/rh-text-white.png"].map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    );
    const timeout = new Promise((r) => window.setTimeout(r, 900));
    Promise.race([ready, timeout]).then(() => { if (!cancelled) setPlay(true); });
    const skip = () => setState((s) => (s === "show" ? "skip" : s));
    window.addEventListener("keydown", skip, { once: true });
    return () => { cancelled = true; window.removeEventListener("keydown", skip); };
  }, []);

  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => setState((s) => (s === "show" ? "gone" : s)), 3300);
    return () => window.clearTimeout(t);
  }, [play]);

  useEffect(() => {
    if (state !== "skip") return;
    const t = window.setTimeout(() => setState("gone"), 380);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === "gone") return null;

  return (
    <div
      className={`ros-intro fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-[#06070a] ${state === "skip" ? "is-skipping" : ""}`}
      data-play={play ? "" : undefined}
      onClick={() => setState("skip")}
      aria-hidden="true"
    >
      <div className="ros-intro-stage ros-intro-bgl absolute inset-0">
        <div className="ros-grid absolute inset-0 opacity-60" />
        <div className="ros-orb-a absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-[#1a9bd7]/25 blur-[120px]" />
        <div className="ros-orb-b absolute -right-40 bottom-0 h-[480px] w-[480px] rounded-full bg-[#d6145f]/20 blur-[120px]" />
      </div>

      <div className="ros-intro-stage relative flex flex-col items-center">
        <div className="relative grid place-items-center">
          <span className="ros-intro-ring absolute h-48 w-48 rounded-full border border-[#4cc3ff]/50" />
          <span className="ros-intro-ring delay absolute h-48 w-48 rounded-full border border-[#e0337e]/40" />
          <img src="/brand/rh-arrow.png" alt="" className="ros-intro-logo relative h-36 w-auto drop-shadow-[0_0_40px_rgba(76,195,255,.35)]" />
        </div>
        <div className="ros-intro-shine relative mt-6 overflow-hidden">
          <img src="/brand/rh-text-white.png" alt="Render Hub" className="ros-intro-text h-[72px] w-auto" />
        </div>
        <div className="ros-intro-line mt-6 h-[3px] w-40 rounded-full bg-gradient-to-r from-[#1a9bd7] to-[#d6145f]" />
        <div className="ros-intro-tag mt-5 font-mono text-[11px] uppercase tracking-[0.4em] text-white/55">
          render.os · sistema do grupo
        </div>
      </div>
    </div>
  );
}

/** Script que roda antes da pintura: pula a abertura se já foi vista nesta sessão. */
export const INTRO_HEAD_SCRIPT = `try{if(sessionStorage.getItem("${KEY}"))document.documentElement.setAttribute("data-intro-seen","")}catch(e){}`;
