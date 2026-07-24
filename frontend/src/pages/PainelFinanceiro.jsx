import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { brl, formatDate, todayISO, firstName } from "../lib/utils";
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PartyPopper,
  Filter,
  X,
  ArrowLeftRight,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "../lib/feedback";
import { usePersistentState } from "../lib/usePersistentState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { EmptyState } from "../components/ui/empty";
import { Loading } from "../components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

function SummaryCard({ icon: Icon, label, value, accent, hint }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-brand-text/60">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-brand-text/50">{hint}</p>}
        </div>
        <span className="rounded-xl bg-brand-cream p-2.5 text-brand-brown">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

const monthStart = todayISO().slice(0, 7) + "-01";
// Último dia do mês atual — o "Mês atual" cobre o mês INTEIRO, para que fiados
// e contas que vencem depois de hoje ainda apareçam no A Receber / A Pagar.
const monthEnd = (() => {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const off = last.getTimezoneOffset();
  return new Date(last.getTime() - off * 60000).toISOString().slice(0, 10);
})();
const EMPTY_BILL = { supplier: "", amount: "", due_date: "" };

export default function PainelFinanceiro() {
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billForm, setBillForm] = usePersistentState("fc_draft_conta", EMPTY_BILL);
  const [error, setError] = useState("");

  // Editar conta a pagar existente
  const [editingBill, setEditingBill] = useState(null);
  const [editBillForm, setEditBillForm] = useState(null);

  // Filtro de período (pelas datas das vendas / vencimento das contas)
  // Chaves novas (v2): o padrão mudou de "até hoje" para "até o fim do mês".
  const [dateFrom, setDateFrom] = usePersistentState("fc_fin_de2", monthStart);
  const [dateTo, setDateTo] = usePersistentState("fc_fin_ate2", monthEnd);

  // Lista "A Pagar": por padrão só o que ainda falta pagar, sem misturar com
  // o que já foi pago (as pagas ficam escondidas, mas dá pra reexibir).
  const [verPagas, setVerPagas] = usePersistentState("fc_fin_ver_pagas", false);

  async function loadAll() {
    try {
      const [salesData, billsData] = await Promise.all([
        api.get("/sales"),
        api.get("/bills-to-pay"),
      ]);
      setSales(salesData);
      setBills(billsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const today = todayISO();
  const isOverdue = (due) => due && due.slice(0, 10) < today;

  const isAllTime = !dateFrom && !dateTo;
  const hasCustomRange = dateFrom !== monthStart || dateTo !== monthEnd;

  function setMesAtual() {
    setDateFrom(monthStart);
    setDateTo(monthEnd);
  }
  function setTudo() {
    setDateFrom("");
    setDateTo("");
  }

  // Vendas dentro do período escolhido
  const periodSales = useMemo(() => {
    return sales.filter((s) => {
      const d = (s.sale_date || "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  // Contas a pagar dentro do período (pelo vencimento; sem vencimento = sempre conta)
  const periodBills = useMemo(() => {
    return bills.filter((b) => {
      const d = (b.due_date || "").slice(0, 10);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [bills, dateFrom, dateTo]);

  // Data em que o dinheiro deve entrar: vencimento do fiado, senão data de
  // pagamento prevista, senão a própria data da venda (à vista sem prazo).
  function expectedReceiveDate(s) {
    return s.due_date || s.payment_date || s.sale_date;
  }

  // "A receber" é filtrado pela data em que o dinheiro deve entrar — não pela
  // data da venda. Assim, ao filtrar "julho", aparecem os fiados que vencem em
  // julho, mesmo que a venda tenha sido feita em junho.
  const periodReceivables = useMemo(() => {
    return sales.filter((s) => {
      if (s.paid) return false;
      const d = (expectedReceiveDate(s) || "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  // Indicadores do período
  const kpis = useMemo(() => {
    let faturamento = 0,
      recebido = 0;
    for (const s of periodSales) {
      const v = Number(s.sale_value) || 0;
      faturamento += v;
      if (s.paid) recebido += v;
    }
    let pendente = 0,
      emAtraso = 0;
    for (const s of periodReceivables) {
      const v = Number(s.sale_value) || 0;
      pendente += v;
      if (isOverdue(expectedReceiveDate(s))) emAtraso += v;
    }
    return { faturamento, recebido, pendente, emAtraso };
  }, [periodSales, periodReceivables]);

  // Totalizadores — a pagar
  const billsKpis = useMemo(() => {
    let aPagar = 0,
      pago = 0,
      atrasado = 0,
      countAberto = 0;
    for (const b of periodBills) {
      const v = Number(b.amount) || 0;
      if (b.paid) pago += v;
      else {
        aPagar += v;
        countAberto++;
        if (isOverdue(b.due_date)) atrasado += v;
      }
    }
    return { aPagar, pago, atrasado, countAberto };
  }, [periodBills]);

  // Lista da tabela "A Pagar": só as em aberto por padrão (ordenadas por
  // vencimento); com "Mostrar pagas" ligado, entra tudo.
  const billsVisiveis = useMemo(() => {
    const list = verPagas ? bills : bills.filter((b) => !b.paid);
    return [...list].sort((a, b) => {
      const da = (a.due_date || "").slice(0, 10);
      const db_ = (b.due_date || "").slice(0, 10);
      return da < db_ ? -1 : da > db_ ? 1 : 0;
    });
  }, [bills, verPagas]);

  // Balanço: total a receber (já recebido + pendente) x total a pagar
  const totalAReceber = kpis.recebido + kpis.pendente;
  const saldoProjetado = totalAReceber - billsKpis.aPagar;
  const somaBalanco = totalAReceber + billsKpis.aPagar;
  const receberPct = somaBalanco > 0 ? (totalAReceber / somaBalanco) * 100 : 50;

  // Lista de pagamentos pendentes (atrasados primeiro), pela data de recebimento
  const pendentes = useMemo(() => {
    return [...periodReceivables].sort((a, b) => {
      const va = (expectedReceiveDate(a) || "").slice(0, 10);
      const vb = (expectedReceiveDate(b) || "").slice(0, 10);
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
  }, [periodReceivables]);

  async function darBaixa(id, nome) {
    await api.patch(`/sales/${id}/baixa`);
    await loadAll();
    toast.success(`Pagamento de ${firstName(nome)} recebido! 💰`);
  }

  async function marcarPago(id) {
    await api.patch(`/bills-to-pay/${id}`, { paid: true });
    await loadAll();
    toast.success("Conta marcada como paga!");
  }

  async function addBill(e) {
    e.preventDefault();
    if (!billForm.supplier.trim()) return;
    await api.post("/bills-to-pay", billForm);
    setBillForm(EMPTY_BILL);
    await loadAll();
    toast.success("Conta a pagar cadastrada!");
  }

  function openEditBill(b) {
    setEditingBill(b);
    setEditBillForm({
      supplier: b.supplier || "",
      amount: String(b.amount ?? ""),
      due_date: b.due_date ? b.due_date.slice(0, 10) : "",
    });
  }

  function closeEditBill() {
    setEditingBill(null);
    setEditBillForm(null);
  }

  async function saveEditBill(e) {
    e.preventDefault();
    if (!editBillForm.supplier.trim()) return;
    await api.patch(`/bills-to-pay/${editingBill.id}`, editBillForm);
    closeEditBill();
    await loadAll();
    toast.success("Conta atualizada!");
  }

  const periodoLabel = isAllTime
    ? "todo o período"
    : `${formatDate(dateFrom || sales.at(-1)?.sale_date)} a ${formatDate(dateTo || today)}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">Financeiro</h2>
        <p className="text-sm text-brand-text/60">
          Quem ainda vai te pagar e o que você precisa pagar.
        </p>
      </div>

      {/* Filtro de período */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="mb-1.5 h-4 w-4 shrink-0 text-brand-brown" />
            <div className="space-y-0.5">
              <Label className="text-[11px]">De</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <Button
              variant={!hasCustomRange && !isAllTime ? "default" : "outline"}
              size="sm"
              onClick={setMesAtual}
              className="mb-0.5"
            >
              Mês atual
            </Button>
            <Button
              variant={isAllTime ? "default" : "outline"}
              size="sm"
              onClick={setTudo}
              className="mb-0.5"
            >
              Ver tudo
            </Button>
            <span className="mb-2 text-sm text-brand-text/50">
              Mostrando <strong className="text-brand-text/70">{periodoLabel}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards do período: Faturamento / Recebido / Pendente / Em atraso */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={TrendingUp}
          label="Faturamento"
          value={brl(kpis.faturamento)}
          accent="text-brand-brown"
          hint="Total vendido no período"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Recebido"
          value={brl(kpis.recebido)}
          accent="text-emerald-600"
          hint={`${kpis.faturamento > 0 ? Math.round((kpis.recebido / kpis.faturamento) * 100) : 0}% do faturamento`}
        />
        <SummaryCard
          icon={Clock}
          label="A Receber"
          value={brl(kpis.pendente)}
          accent={kpis.pendente > 0 ? "text-amber-600" : "text-emerald-600"}
          hint={
            kpis.emAtraso > 0
              ? `${brl(kpis.emAtraso)} em atraso`
              : "previsto p/ este período"
          }
        />
        <SummaryCard
          icon={AlertTriangle}
          label="A Pagar"
          value={brl(billsKpis.aPagar)}
          accent={billsKpis.aPagar > 0 ? "text-red-600" : "text-emerald-600"}
          hint={
            billsKpis.atrasado > 0
              ? `${brl(billsKpis.atrasado)} em atraso`
              : "suas contas do período"
          }
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Balanço: Total Recebido/A Receber x Total a Pagar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-brand-brown" /> Balanço do Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700/70">Recebido</p>
              <p className="text-xl font-bold text-emerald-700">{brl(kpis.recebido)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700/70">A Receber</p>
              <p className="text-xl font-bold text-amber-700">{brl(kpis.pendente)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700/70">A Pagar</p>
              <p className="text-xl font-bold text-red-700">{brl(billsKpis.aPagar)}</p>
            </div>
          </div>

          {/* barra comparativa */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-brand-text/50">
              <span>Recebido + A Receber</span>
              <span>A Pagar</span>
            </div>
            <div className="flex h-7 w-full overflow-hidden rounded-full bg-brand-pink/15">
              <div
                className="flex items-center justify-end bg-emerald-500 pr-2 text-[11px] font-medium text-white transition-all"
                style={{ width: `${receberPct}%` }}
              >
                {receberPct > 18 && brl(totalAReceber)}
              </div>
              <div
                className="flex items-center justify-start bg-red-400 pl-2 text-[11px] font-medium text-white transition-all"
                style={{ width: `${100 - receberPct}%` }}
              >
                {100 - receberPct > 18 && brl(billsKpis.aPagar)}
              </div>
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 ${
              saldoProjetado >= 0 ? "bg-emerald-50" : "bg-red-50"
            }`}
          >
            <span className="text-sm text-brand-text/70">
              Saldo projetado (a receber − a pagar)
            </span>
            <strong className={saldoProjetado >= 0 ? "text-emerald-700" : "text-red-700"}>
              {brl(saldoProjetado)}
            </strong>
          </div>
        </CardContent>
      </Card>

      {/* Pagamentos Pendentes */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Pagamentos Pendentes — quem ainda vai te pagar</CardTitle>
            <p className="mt-0.5 text-xs text-brand-text/50">
              Filtrado pela data prevista de recebimento (vencimento), não pela data da venda.
            </p>
          </div>
          {pendentes.length > 0 && (
            <span className="text-sm text-brand-text/60">
              {pendentes.length} {pendentes.length === 1 ? "pendência" : "pendências"} ·{" "}
              <strong className="text-amber-600">{brl(kpis.pendente)}</strong>
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : pendentes.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="Tudo recebido! 🎉"
              hint="Nenhum pagamento pendente no período. Quando uma venda no fiado ou pendente aparecer aqui, clique em “Recebi” quando a cliente pagar."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((s) => {
                  const venc = s.due_date || s.payment_date;
                  return (
                    <TableRow key={s.id} className={isOverdue(venc) ? "bg-red-50/40" : ""}>
                      <TableCell className="font-medium">{s.customer_name}</TableCell>
                      <TableCell>{s.product || "—"}</TableCell>
                      <TableCell>{s.empresa || s.brand || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{brl(s.sale_value)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(venc)}</TableCell>
                      <TableCell>
                        {isOverdue(venc) ? (
                          <Badge variant="danger">Atrasado</Badge>
                        ) : venc && venc.slice(0, 10) === today ? (
                          <Badge variant="default">Vence hoje</Badge>
                        ) : s.is_fiado ? (
                          <Badge variant="success">No prazo</Badge>
                        ) : (
                          <Badge variant="default">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => darBaixa(s.id, s.customer_name)}
                          title="Marcar como recebido"
                        >
                          Recebi 💰
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contas a Pagar (Boletos) */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>A Pagar — suas contas e boletos</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {bills.length > 0 && (
              <span className="text-sm text-brand-text/60">
                {billsKpis.countAberto} em aberto ·{" "}
                <strong className="text-red-600">{brl(billsKpis.aPagar)}</strong>
                {billsKpis.pago > 0 && (
                  <>
                    {" "}
                    · pago <strong className="text-emerald-600">{brl(billsKpis.pago)}</strong>
                  </>
                )}
              </span>
            )}
            {bills.some((b) => b.paid) && (
              <Button variant="ghost" size="sm" onClick={() => setVerPagas((v) => !v)}>
                {verPagas ? (
                  <>
                    <EyeOff className="h-4 w-4" /> Ocultar pagas
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> Mostrar pagas
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Form para adicionar boleto */}
          <form
            onSubmit={addBill}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_160px_auto]"
          >
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={billForm.supplier}
                onChange={(e) => setBillForm((b) => ({ ...b, supplier: e.target.value }))}
                placeholder="Ex.: Natura"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={billForm.amount}
                onChange={(e) => setBillForm((b) => ({ ...b, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={billForm.due_date}
                onChange={(e) => setBillForm((b) => ({ ...b, due_date: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </div>
          </form>

          {bills.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma conta a pagar"
              hint="Cadastre acima seus boletos e contas (fornecedor, valor e vencimento) para não perder nenhum prazo."
            />
          ) : billsVisiveis.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="Tudo pago! 🎉"
              hint="Nenhuma conta em aberto no momento."
              action={
                <Button variant="outline" size="sm" onClick={() => setVerPagas(true)}>
                  <Eye className="h-4 w-4" /> Ver contas já pagas
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billsVisiveis.map((b) => (
                  <TableRow key={b.id} className={!b.paid && isOverdue(b.due_date) ? "bg-red-50/40" : ""}>
                    <TableCell className="font-medium">{b.supplier}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(b.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(b.due_date)}</TableCell>
                    <TableCell>
                      {b.paid ? (
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Pago
                        </Badge>
                      ) : isOverdue(b.due_date) ? (
                        <Badge variant="danger">Atrasado</Badge>
                      ) : (
                        <Badge variant="neutral">Em aberto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditBill(b)}
                          title="Editar conta"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!b.paid && (
                          <Button size="sm" variant="success" onClick={() => marcarPago(b.id)}>
                            Marcar como Pago
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de edição de conta a pagar */}
      <Modal
        open={!!editingBill}
        onClose={closeEditBill}
        title={editingBill ? `Editar conta — ${editingBill.supplier}` : ""}
      >
        {editBillForm && (
          <form onSubmit={saveEditBill} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={editBillForm.supplier}
                onChange={(e) =>
                  setEditBillForm((f) => ({ ...f, supplier: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editBillForm.amount}
                  onChange={(e) =>
                    setEditBillForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={editBillForm.due_date}
                  onChange={(e) =>
                    setEditBillForm((f) => ({ ...f, due_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeEditBill}>
                Cancelar
              </Button>
              <Button type="submit">Salvar alterações</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
