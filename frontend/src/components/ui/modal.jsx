import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, size = "default" }) {
  const maxW = size === "wide" ? "max-w-4xl" : "max-w-xl";
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-text/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 max-h-[90vh] w-full ${maxW} overflow-auto rounded-2xl bg-brand-offwhite p-6 shadow-xl`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-xl text-brand-brown">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-brand-text/60 transition-colors hover:bg-brand-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
