import { cn } from "@/lib/utils";

/** Fundo escuro com grade animada e brilhos azul/magenta da marca. */
export function TechBackground({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="ros-grid absolute inset-0" />
      <div className="ros-orb-a absolute -left-32 top-[-10%] h-[560px] w-[560px] rounded-full bg-[#1a9bd7]/20 blur-[130px]" />
      <div className="ros-orb-b absolute -right-40 top-[30%] h-[520px] w-[520px] rounded-full bg-[#d6145f]/15 blur-[130px]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#06070a]" />
    </div>
  );
}
