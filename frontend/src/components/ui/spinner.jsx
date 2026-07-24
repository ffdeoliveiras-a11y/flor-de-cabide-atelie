import { cn } from "../../lib/utils";

// Indicador de carregamento simples na cor da marca.
export function Spinner({ className }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-pink/40 border-t-brand-brown",
        className
      )}
      role="status"
      aria-label="Carregando"
    />
  );
}

// Bloco de carregamento centralizado para usar no lugar de conteúdo vazio.
export function Loading({ label = "Carregando…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-brand-text/50">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
