import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-brand-pink bg-white px-3 py-2 text-sm text-brand-text shadow-sm transition-colors placeholder:text-brand-text/40 focus-visible:outline-none focus-visible:border-brand-brown focus-visible:ring-2 focus-visible:ring-brand-brown/40 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
