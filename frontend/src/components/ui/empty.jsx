import { cn } from "../../lib/utils";

// Estado vazio acolhedor: ícone + título + dica + (opcional) ação.
// Usado quando uma lista está sem dados, para orientar o próximo passo.
export function EmptyState({ icon: Icon, title, hint, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cream text-brand-pinkDark">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="font-serif text-lg text-brand-brown">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-brand-text/55">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
