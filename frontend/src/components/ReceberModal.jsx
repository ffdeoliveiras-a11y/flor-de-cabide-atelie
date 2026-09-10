import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { brl, formatDate, todayISO, firstName, recebidoDe, saldoDe } from "../lib/utils";
import { useToast, useConfirm } from "../lib/feedback";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Receber pagamento de uma venda — total ou PARCIAL (cliente que paga "picado":
// venda de 100, paga 50 hoje e 50 depois). Mostra quanto já pagou, quanto falta
// e a lista de pagamentos, com opção de desfazer um lançamento errado.
export function ReceberModal({ sale, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [atual, setAtual] = useState(sale);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [pagamentos, setPagamentos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function loadPagamentos(id) {
    api.get(`/sales/${id}/pagamentos`).then(setPagamentos).catch(() => setPagamentos([]));
  }

  useEffect(() => {
    setAtual(sale);
    setValor("");
    setData(todayISO());
    setError("");
    setPagamentos([]);
    if (sale) loadPagamentos(sale.id);
  }, [sale]);

  const total = Number(atual?.sale_value) || 0;
  const pago = atual ? recebidoDe(atual) : 0;
  const falta = atual ? round2(saldoDe(atual)) : 0;
  const v = round2(valor);
  const restante = round2(falta - v);

  async function registrar(e) {
    e.preventDefault();
    setError("");
    if (!(v > 0)) return setError("Informe quanto a cliente pagou agora.");
    if (v > falta) return setError(`O valor é maior do que falta pagar (${brl(falta)}).`);
    setSaving(true);
    try {
      const upd = await api.patch(`/sales/${atual.id}/baixa`, { amount: v, date: data });
      onChanged?.();
      if (upd.paid) {
        toast.success(`${firstName(upd.customer_name)} quitou tudo! 🎉`);
        onClose();
      } else {
        toast.success(`Recebido ${brl(v)} — ainda falta ${brl(saldoDe(upd))}.`);
        setAtual(upd);
        setValor("");
        loadPagamentos(upd.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function desfazer(p) {
    const ok = await confirm({
      title: "Desfazer este pagamento?",
      message: `O pagamento de ${brl(p.amount)} (${formatDate(p.paid_at)}) será removido e o valor volta a ficar em aberto.`,
      confirmText: "Sim, desfazer",
      danger: true,
    });
    if (!ok) return;
    try {
      const upd = await api.del(`/sales/${atual.id}/pagamentos/${p.id}`);
      setAtual(upd);
      loadPagamentos(upd.id);
      onChanged?.();
      toast.info("Pagamento desfeito.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={atual ? `Receber — ${firstName(atual.customer_name)}` : ""}
    >
      {atual && (
        <div className="space-y-4">
          <p className="-mt-3 text-sm text-brand-text/60">
            {atual.product || "Venda"}
            {atual.quantity > 1 && ` ×${atual.quantity}`} · vendido em {formatDate(atual.sale_date)}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-brand-cream p-2.5">
              <p className="text-[11px] text-brand-text/60">Total</p>
              <p className="text-sm font-bold text-brand-brown sm:text-base">{brl(total)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="text-[11px] text-emerald-700/70">Já pagou</p>
              <p className="text-sm font-bold text-emerald-700 sm:text-base">{brl(pago)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5">
              <p className="text-[11px] text-amber-700/70">Falta</p>
              <p className="text-sm font-bold text-amber-700 sm:text-base">{brl(falta)}</p>
            </div>
          </div>

          {falta > 0 ? (
            <form onSubmit={registrar} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Valor recebido agora (R$)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    max={falta}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Ex.: 50,00"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data do pagamento</Label>
                  <Input
                    type="date"
                    value={data}
                    max={todayISO()}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {falta >= 0.02 && (
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() => setValor((Math.floor((falta / 2) * 100) / 100).toFixed(2))}
                  >
                    Metade ({brl(Math.floor((falta / 2) * 100) / 100)})
                  </Button>
                )}
                <Button type="button" variant="soft" size="sm" onClick={() => setValor(falta.toFixed(2))}>
                  Tudo ({brl(falta)})
                </Button>
              </div>

              {v > 0 && v <= falta && (
                <p
                  className={
                    restante > 0
                      ? "rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
                      : "rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  }
                >
                  {restante > 0 ? (
                    <>
                      Depois deste pagamento ainda vai faltar <strong>{brl(restante)}</strong>.
                    </>
                  ) : (
                    <>
                      Com este pagamento a venda fica <strong>quitada</strong> ✅
                    </>
                  )}
                </p>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
                <Button type="submit" variant="success" disabled={saving}>
                  {saving ? "Salvando…" : "Registrar pagamento"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Venda quitada ✅
            </p>
          )}

          {pagamentos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/70">
                Pagamentos recebidos
              </p>
              <ul className="divide-y divide-brand-pink/30 rounded-xl border border-brand-pink/40">
                {pagamentos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-brand-text/70">{formatDate(p.paid_at)}</span>
                    <span className="flex items-center gap-2">
                      <strong className="text-emerald-700">{brl(p.amount)}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                        title="Desfazer este pagamento"
                        onClick={() => desfazer(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
