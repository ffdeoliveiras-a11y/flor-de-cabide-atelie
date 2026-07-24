import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

// Select nativo estilizado (confiável para listas fixas de opções)
const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full appearance-none rounded-xl border border-brand-pink bg-white px-3 pr-9 py-2 text-sm text-brand-text shadow-sm transition-colors focus-visible:outline-none focus-visible:border-brand-brown focus-visible:ring-2 focus-visible:ring-brand-brown/40 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-brown/60" />
  </div>
));
Select.displayName = "Select";

export { Select };
