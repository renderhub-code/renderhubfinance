import { useEffect, useRef, useState } from "react";
import { RenderMark } from "@/components/brand/Logo";

const KEY = "render-os-intro-seen";

/**
 * Abertura do render.os. Toca uma vez por sessão do navegador:
 *  1. o R com gradiente se desenha no centro e brilha;
 *  2. o R desliza para a esquerda e "ender.os" se revela ao lado → "render.os";
 *  3. linha em gradiente + "Grupo Render Hub", e a tela some.
 * Um script no <head> marca `html[data-intro-seen]` antes da pintura, então quem
 * já viu não enxerga nem um frame do overlay. Clique ou tecla pula a animação.
 */
export function IntroSplash() {
  const [state, setState] = useState<"show" | "skip" | "gone">("show");
  const [play, setPlay] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Só começa depois da hidratação e com a fonte pronta: o deslocamento do R
  // depende da largura real de "ender.os".
  useEffect(() => {
    if (document.documentElement.hasAttribute("data-intro-seen")) { setState("gone"); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* modo privado */ }
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    const timeout = new Promise((r) => window.setTimeout(r, 1200));
    Promise.race([fonts, timeout]).then(() => {
      if (cancelled) return;
      const w = wordRef.current?.getBoundingClientRect().width ?? 0;
      rowRef.current?.style.setProperty("--shift", `${w / 2}px`);
      setPlay(true);
    });
    const skip = () => setState((s) => (s === "show" ? "skip" : s));
    window.addEventListener("keydown", skip, { once: true });
    return () => { cancelled = true; window.removeEventListener("keydown", skip); };
  }, []);

  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => setState((s) => (s === "show" ? "gone" : s)), 3750);
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
        <div
          ref={rowRef}
          className="ros-intro-row whitespace-nowrap font-display text-[64px] font-semibold leading-none tracking-tight text-white sm:text-[96px]"
        >
          <span className="relative inline-block align-baseline">
            <span className="ros-intro-ring h-24 w-24 rounded-full border border-[#4cc3ff]/60 sm:h-32 sm:w-32" />
            <span className="ros-intro-ring delay h-24 w-24 rounded-full border border-[#e0337e]/50 sm:h-32 sm:w-32" />
            <RenderMark tight draw className="ros-intro-r relative block" />
          </span>
          <span ref={wordRef} className="ros-intro-word inline-block align-baseline">
            ender<span className="ros-gradient-text">.os</span>
          </span>
        </div>
        <div className="ros-intro-line mt-8 h-[3px] w-44 rounded-full bg-gradient-to-r from-[#1a9bd7] to-[#d6145f]" />
        <div className="ros-intro-tag mt-5 font-mono text-[11px] uppercase tracking-[0.4em] text-white/55">
          Grupo Render Hub
        </div>
      </div>
    </div>
  );
}

/** Script que roda antes da pintura: pula a abertura se já foi vista nesta sessão. */
export const INTRO_HEAD_SCRIPT = `try{if(sessionStorage.getItem("${KEY}"))document.documentElement.setAttribute("data-intro-seen","")}catch(e){}`;
