import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Wifi, Home } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./ui/modal";
import { Loading } from "./ui/spinner";

// Modal "Acessar pelo celular": mostra o QR code do endereço do sistema na
// rede Wi-Fi de casa + passo a passo para virar "aplicativo" na tela inicial.
export function CelularModal({ open, onClose }) {
  const [info, setInfo] = useState(null); // { url, ip, port }
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    api
      .get("/api/lan-address")
      .then(async (data) => {
        setInfo(data);
        if (data.url) {
          const dataUrl = await QRCode.toDataURL(data.url, {
            width: 240,
            margin: 1,
            color: { dark: "#6B3F2A", light: "#FDFAF7" },
          });
          setQr(dataUrl);
        }
      })
      .catch((err) => setError(err.message));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Acessar pelo celular 📱">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !info ? (
        <Loading label="Descobrindo o endereço na sua rede…" />
      ) : !info.url ? (
        <p className="text-sm text-brand-text/70">
          Não encontrei o endereço do computador na rede. Verifique se o PC está
          conectado no Wi-Fi.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            {qr && (
              <img
                src={qr}
                alt="QR code para abrir no celular"
                className="rounded-2xl border border-brand-pink/50 shadow-sm"
              />
            )}
            <p className="rounded-xl bg-brand-cream px-4 py-2 font-mono text-sm font-semibold text-brand-brown">
              {info.url}
            </p>
          </div>

          <ol className="space-y-3 text-sm text-brand-text/80">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-brown">
                <Wifi className="h-4 w-4" />
              </span>
              <span>
                Conecte o celular no <strong>mesmo Wi-Fi</strong> deste computador.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-brown">
                <Smartphone className="h-4 w-4" />
              </span>
              <span>
                Aponte a <strong>câmera do celular</strong> para o código acima e toque no
                link que aparecer.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-brown">
                <Home className="h-4 w-4" />
              </span>
              <span>
                Para virar um <strong>aplicativo</strong>: no navegador do celular, abra o
                menu (⋮ ou compartilhar) e toque em{" "}
                <strong>"Adicionar à tela inicial"</strong>.
              </span>
            </li>
          </ol>

          <p className="rounded-xl bg-brand-cream/60 px-4 py-2.5 text-xs text-brand-text/60">
            💡 O computador precisa estar <strong>ligado</strong> para o celular acessar. Se
            um dia parar de funcionar, abra esta janela de novo — o endereço pode mudar.
          </p>
        </div>
      )}
    </Modal>
  );
}
