import { GROUP_COMPANIES } from "@/os/companies";
import { cn } from "@/lib/utils";

/**
 * "Um hub, seis operações": a seta da Render Hub no centro e as seis empresas
 * orbitando, ligadas ao núcleo por linhas com pulsos de dados.
 */
export function HubOrbit({ className, compact }: { className?: string; compact?: boolean }) {
  const n = GROUP_COMPANIES.length;
  const R = 41; // raio em % do container
  const nodes = GROUP_COMPANIES.map((c, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { c, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  });
  const DURATION = "90s";

  return (
    <div className={cn("relative aspect-square w-full", className)}>
      {/* anéis */}
      <div className="absolute inset-[9%] rounded-full border border-white/[0.07]" />
      <div className="absolute inset-[24%] rounded-full border border-dashed border-white/10" style={{ animation: `ros-spin-rev 60s linear infinite` }} />
      <div className="absolute inset-[36%] rounded-full bg-[radial-gradient(circle,rgba(76,195,255,.18),transparent_70%)]" />

      {/* camada que gira: linhas + empresas */}
      <div className="absolute inset-0" style={{ animation: `ros-spin ${DURATION} linear infinite` }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4cc3ff" />
              <stop offset="1" stopColor="#e0337e" />
            </linearGradient>
          </defs>
          {nodes.map(({ c, x, y }, i) => (
            <g key={c.id}>
              <line x1="50" y1="50" x2={x} y2={y} stroke="rgba(255,255,255,.08)" strokeWidth=".25" />
              <line
                x1="50" y1="50" x2={x} y2={y}
                stroke="url(#orbit-line)" strokeWidth=".55" strokeLinecap="round"
                strokeDasharray="3 240"
                style={{ animation: `ros-dash ${3 + (i % 3)}s linear ${i * 0.6}s infinite` }}
              />
            </g>
          ))}
        </svg>
        {nodes.map(({ c, x, y }) => (
          <div key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <div style={{ animation: `ros-spin-rev ${DURATION} linear infinite` }}>
              <div className={cn(
                "flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-md",
                compact ? "px-1.5 py-1.5" : "px-2.5 py-2",
              )}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold text-white" style={{ backgroundColor: c.color }}>
                  {c.initials}
                </span>
                {!compact && (
                  <span className="pr-1 leading-tight">
                    <span className="block whitespace-nowrap text-[12px] font-medium text-white">{c.name}</span>
                    <span className="block whitespace-nowrap text-[10px] text-white/45">{c.sector}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* núcleo */}
      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center">
        <span className="absolute h-24 w-24 rounded-full border border-[#4cc3ff]/40" style={{ animation: "ros-ping 3s cubic-bezier(0,0,.2,1) infinite" }} />
        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-[#0b0d12]/80 shadow-[0_0_60px_rgba(76,195,255,.25)] backdrop-blur" style={{ animation: "ros-float 6s ease-in-out infinite" }}>
          <img src="/brand/rh-arrow.png" alt="Render Hub" className="h-11 w-auto" />
        </div>
      </div>
    </div>
  );
}
