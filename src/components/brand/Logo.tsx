import { useId } from "react";
import { cn } from "@/lib/utils";

/** Seta metálica da Render Hub (funciona em fundo claro e escuro). */
export function BrandArrow({ className }: { className?: string }) {
  return <img src="/brand/rh-arrow.png" alt="" aria-hidden="true" draggable={false} className={cn("select-none object-contain", className)} />;
}

/** Logo completa: seta + RENDER HUB. `tone="dark"` = para fundo escuro (texto branco). */
export function BrandLogo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <img
      src={tone === "dark" ? "/brand/renderhub-logo-dark-bg.png" : "/brand/renderhub-mark.png"}
      alt="Render Hub"
      draggable={false}
      className={cn("select-none object-contain", className)}
    />
  );
}

/** Traço do R do render.os (coordenadas de um quadro 32×32). */
const R_PATH = "M9 23V9h8.2a5 5 0 0 1 1.4 9.8L23.5 23";

/**
 * O "R" do render.os: um traço contínuo com o gradiente azul → magenta da Render Hub.
 * `tight` recorta o quadro rente à letra (para alinhar com texto).
 * `draw` liga a animação de desenho do traço (usada na abertura).
 */
export function RenderMark({ className, tight, draw }: { className?: string; tight?: boolean; draw?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={tight ? "7.3 7.3 18 17.4" : "0 0 32 32"}
      className={cn(tight ? "h-[0.72em] w-auto" : "h-7 w-7", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4cc3ff" />
          <stop offset=".5" stopColor="#6f8cff" />
          <stop offset="1" stopColor="#e0337e" />
        </linearGradient>
      </defs>
      <path
        d={R_PATH}
        pathLength={1}
        fill="none"
        stroke={`url(#rg-${id})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={draw ? "ros-r-draw" : undefined}
      />
    </svg>
  );
}

/** Marca do produto: o R com gradiente + "ender.os" — lido como "render.os". */
export function OsWordmark({ tone = "light", className, size = "md" }: { tone?: "light" | "dark"; className?: string; size?: "sm" | "md" | "lg" }) {
  const fs = { sm: "text-[17px]", md: "text-[22px]", lg: "text-3xl" }[size];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap font-display font-semibold leading-none tracking-tight",
        fs,
        tone === "dark" ? "text-white" : "text-foreground",
        className,
      )}
      aria-label="render.os"
    >
      <RenderMark tight className="mr-[0.02em] inline-block align-baseline" />
      <span aria-hidden="true">ender<span className="ros-gradient-text">.os</span></span>
    </span>
  );
}
