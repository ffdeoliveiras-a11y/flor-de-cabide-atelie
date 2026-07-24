import { createContext, useContext, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

// ============================================================================
//  Sistema de feedback: Avisos (toasts) + Confirmação bonita
//  Substitui o silêncio das ações e o window.confirm() nativo do navegador.
// ============================================================================

const FeedbackContext = createContext(null);

const TOAST_STYLES = {
  success: { icon: CheckCircle2, ring: "border-emerald-200", bar: "bg-emerald-500", iconColor: "text-emerald-600" },
  error: { icon: AlertCircle, ring: "border-red-200", bar: "bg-red-500", iconColor: "text-red-600" },
  info: { icon: Info, ring: "border-brand-pink", bar: "bg-brand-pinkDark", iconColor: "text-brand-pinkDark" },
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, type }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  // Confirmação baseada em promessa: const ok = await confirm({...})
  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfirmState({
        title: opts.title || "Tem certeza?",
        message: opts.message || "",
        confirmText: opts.confirmText || "Confirmar",
        cancelText: opts.cancelText || "Cancelar",
        danger: opts.danger || false,
      });
    });
  }, []);

  function closeConfirm(result) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setConfirmState(null);
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Pilha de avisos — topo centralizado, visível em qualquer tela */}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => {
            const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
            const Icon = s.icon;
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl border ${s.ring} bg-white px-4 py-3 shadow-lg animate-toast-in`}
              >
                <span className={`mt-0.5 shrink-0 ${s.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="flex-1 text-sm font-medium text-brand-text">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-md p-0.5 text-brand-text/40 transition-colors hover:bg-brand-cream hover:text-brand-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {/* Diálogo de confirmação */}
      {confirmState &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-brand-text/40 backdrop-blur-sm"
              onClick={() => closeConfirm(false)}
            />
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-brand-offwhite p-6 shadow-xl animate-pop-in">
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 rounded-full p-2 ${
                    confirmState.danger ? "bg-red-100 text-red-600" : "bg-brand-cream text-brand-brown"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h3 className="font-serif text-lg text-brand-brown">{confirmState.title}</h3>
                  {confirmState.message && (
                    <p className="mt-1 text-sm text-brand-text/70">{confirmState.message}</p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => closeConfirm(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-brand-text/70 transition-colors hover:bg-brand-cream"
                >
                  {confirmState.cancelText}
                </button>
                <button
                  onClick={() => closeConfirm(true)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
                    confirmState.danger
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-brand-brown hover:bg-brand-brownDark"
                  }`}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  return useContext(FeedbackContext).toast;
}

export function useConfirm() {
  return useContext(FeedbackContext).confirm;
}
