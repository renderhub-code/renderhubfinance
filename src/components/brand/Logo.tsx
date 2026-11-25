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

/** Marca do produto: seta + "render.os". */
export function OsWordmark({ tone = "light", className, size = "md" }: { tone?: "light" | "dark"; className?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: ["h-5", "text-[15px]"], md: ["h-6", "text-lg"], lg: ["h-9", "text-2xl"] }[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandArrow className={cn(s[0], "w-auto")} />
      <span className={cn("font-display font-semibold tracking-tight", s[1], tone === "dark" ? "text-white" : "text-foreground")}>
        render<span className="ros-gradient-text">.os</span>
      </span>
    </span>
  );
}
