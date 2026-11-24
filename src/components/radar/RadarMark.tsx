import { cn } from "@/lib/utils";

export function RadarMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-card radar-grid", className)}>
      <span className="absolute inset-0 animate-sweep rounded-full radar-sweep" aria-hidden />
      <span className="relative size-2 rounded-full bg-primary" aria-hidden />
      <span className="absolute size-2 animate-ping-slow rounded-full bg-primary/70" aria-hidden />
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <RadarMark />
      <span className="font-display text-lg font-extrabold leading-none tracking-tight">
        Radar <span className="text-primary">de Ofertas</span>
      </span>
    </span>
  );
}
