import { cn } from "../lib/utils";

// Ícone de cabide em SVG inline — cor herda de currentColor
export function HangerIcon({ className }) {
  return (
    <svg
      viewBox="0 0 64 44"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* gancho */}
      <path d="M32 18 V13 a4.5 4.5 0 1 0 -4.5 -4.5" />
      {/* corpo triangular do cabide */}
      <path d="M32 18 L10 34 Q6 37 10 39 H54 Q58 37 54 34 Z" />
    </svg>
  );
}

// Logo completo da marca: ícone (cabide com flor) + "Flor de Cabide"
export function Logo({ size = "lg", className }) {
  const sizes = {
    lg: { icon: "h-16 w-16", title: "text-5xl" },
    md: { icon: "h-11 w-11", title: "text-2xl" },
    sm: { icon: "h-9 w-9", title: "text-xl" },
  };
  const s = sizes[size] || sizes.lg;

  return (
    <div className={cn("flex flex-col items-center text-brand-brown", className)}>
      <img src="/icone.svg" alt="" className={cn(s.icon, "mb-2")} />
      <h1
        className={cn(
          "font-serif font-semibold leading-none tracking-tight",
          s.title
        )}
      >
        Flor de Cabide
      </h1>
    </div>
  );
}

// Separador decorativo ✦ ✦ ✦
export function Sparkles({ className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 text-brand-pink select-none",
        className
      )}
    >
      <span className="h-px w-10 bg-brand-pink/60" />
      <span className="text-sm tracking-[0.5em]">✦ ✦ ✦</span>
      <span className="h-px w-10 bg-brand-pink/60" />
    </div>
  );
}
