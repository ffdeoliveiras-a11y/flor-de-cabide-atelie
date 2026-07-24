import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Pencil, Trash2, X, HandCoins, Lock, Unlock, PackageCheck, BookOpen,
  ShoppingBag, TrendingUp, Truck, Clock, BellRing, AlertTriangle,
  CalendarClock, ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import {
  brl, cn, marginPct, profitOf, todayISO, addDaysISO, greeting, firstName,
} from "../lib/utils";
import { EMPRESAS, PAYMENT_METHODS } from "../lib/constants";
import { useAuth } from "../lib/auth";
import { useToast, useConfirm } from "../lib/feedback";
import { usePersistentState } from "../lib/usePersistentState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty";
import { Loading } from "../components/ui/spinner";
import { CustomerAutocomplete } from "../components/CustomerAutocomplete";
import { ProductAutocomplete } from "../components/ProductAutocomplete";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";

const EMPTY = {
  customer_name: "",
  empresa: "NATURA",
  product: "",
  product_id: null,
  cost_value: "",
  sale_value: "",
  quantity: "1",
  payment_method: "Pix",
  is_fiado: false,
  due_date: "",
  delivered: false,
  is_revista: false,
};

function ToggleBtn({ active, onClick, icon: Icon, labelOff, labelOn, activeClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? activeClass || "border-brand-brown bg-brand-brown text-white"
          : "border-brand-pink bg-white text-brand-text hover:bg-brand-cream"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
          active ? "bg-white/40" : "bg-brand-pink/50"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            active ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      <Icon className="h-4 w-4" />
      {active ? labelOn : labelOff}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-pink/40 bg-white px-4 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cream", accent)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-wide text-brand-text/50">{label}</p>
        <p className={cn("text-lg font-bold", accent)}>{value}</p>
      </div>
    </div>
  );
}

export default function FechamentoDia() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = usePersistentState("fc_draft_venda", EMPTY);
  const [editingId, setEditingId] = usePersistentState("fc_draft_venda_editid", null);
  const [sales, setSales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [valueUnlocked, setValueUnlocked] = useState(false);
  const customerRef = useRef(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function loadToday() {
    try {
      setSales(await api.get("/sales?date=today"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Dados de apoio para os avisos e para o alerta de cliente com débito
  async function loadContext() {
    try {
      const [all, billsData] = await Promise.all([
        api.get("/sales"),
        api.get("/bills-to-pay"),
      ]);
      setAllSales(all);
      setBills(billsData);
    } catch {
      /* avisos são opcionais — não bloqueiam a tela */
    }
  }

  useEffect(() => {
    loadToday();
    loadContext();
  }, []);

  // ----- Central de Avisos -----
  const avisos = useMemo(() => {
    const today = todayISO();
    const plus7 = addDaysISO(7);
    const receiveDate = (s) => (s.due_date || s.payment_date || "").slice(0, 10);

    const fiadosVencidos = allSales.filter(
      (s) => !s.paid && receiveDate(s) && receiveDate(s) < today
    );
    const fiadosVencidosTotal = fiadosVencidos.reduce(
      (a, s) => a + (Number(s.sale_value) || 0), 0
    );

    const contasVencidas = bills.filter(
      (b) => !b.paid && b.due_date && b.due_date.slice(0, 10) < today
    );
    const contasProximas = bills.filter((b) => {
      if (b.paid || !b.due_date) return false;
      const d = b.due_date.slice(0, 10);
      return d >= today && d <= plus7;
    });
    const contasProximasTotal = contasProximas.reduce(
      (a, b) => a + (Number(b.amount) || 0), 0
    );
    const contasVencidasTotal = contasVencidas.reduce(
      (a, b) => a + (Number(b.amount) || 0), 0
    );

    return {
      fiadosVencidos, fiadosVencidosTotal,
      contasVencidas, contasVencidasTotal,
      contasProximas, contasProximasTotal,
      total:
        (fiadosVencidos.length ? 1 : 0) + (contasVencidas.length ? 1 : 0) +
        (contasProximas.length ? 1 : 0),
    };
  }, [allSales, bills]);

  // ----- Cliente com valores em aberto (alerta antes de vender fiado de novo) -----
  const clienteDebito = useMemo(() => {
    const nome = form.customer_name.trim().toLowerCase();
    if (!nome) return null;
    const pendencias = allSales.filter(
      (s) => !s.paid && (s.customer_name || "").trim().toLowerCase() === nome &&
        s.id !== editingId
    );
    if (!pendencias.length) return null;
    return {
      total: pendencias.reduce((a, s) => a + (Number(s.sale_value) || 0), 0),
      count: pendencias.length,
    };
  }, [allSales, form.customer_name, editingId]);

  // Ativar o Fiado já sugere vencimento em 30 dias (editável)
  function toggleFiado() {
    setForm((f) => ({
      ...f,
      is_fiado: !f.is_fiado,
      due_date: !f.is_fiado && !f.due_date ? addDaysISO(30) : f.due_date,
    }));
  }

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setValueUnlocked(false);
  }

  function startEdit(s) {
    setEditingId(s.id);
    setValueUnlocked(true);
    // cost_value/sale_value gravados são o TOTAL da linha — reconstrói o valor
    // unitário dividindo pela quantidade (padrão 1, então não afeta vendas antigas)
    const qtd = Math.max(1, parseInt(s.quantity, 10) || 1);
    setForm({
      customer_name: s.customer_name || "",
      empresa: s.empresa || s.brand || "Outros",
      product: s.product || "",
      product_id: s.product_id || null,
      cost_value: ((Number(s.cost_value) || 0) / qtd).toFixed(2),
      sale_value: ((Number(s.sale_value) || 0) / qtd).toFixed(2),
      quantity: String(qtd),
      payment_method: PAYMENT_METHODS.includes(s.payment_method) ? s.payment_method : "Pix",
      is_fiado: !!s.is_fiado,
      due_date: s.due_date ? s.due_date.slice(0, 10) : "",
      delivered: !!s.delivered,
      is_revista: !!s.is_revista,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (!form.customer_name.trim()) {
      setError("Informe a cliente.");
      customerRef.current?.focus();
      return;
    }
    if (form.is_fiado && !form.due_date) {
      setError("Vendas no fiado precisam de uma data de vencimento.");
      return;
    }

    // Fiado para quem já deve: pede uma confirmação consciente antes
    if (form.is_fiado && clienteDebito && !editingId) {
      const ok = await confirm({
        title: "Vender no fiado mesmo assim?",
        message: `${firstName(form.customer_name)} já tem ${brl(clienteDebito.total)} em aberto (${clienteDebito.count} ${clienteDebito.count === 1 ? "pendência" : "pendências"}).`,
        confirmText: "Sim, vender no fiado",
        cancelText: "Voltar",
      });
      if (!ok) return;
    }

    // Valor de Custo/Venda no formulário são por UNIDADE — grava o TOTAL da
    // linha (unitário × quantidade); quantity vai separado p/ baixa de estoque.
    const qtd = Math.max(1, parseInt(form.quantity, 10) || 1);
    const body = {
      customer_name: form.customer_name.trim(),
      empresa: form.empresa,
      product: form.product,
      product_id: form.product_id,
      cost_value: (Number(form.cost_value) || 0) * qtd,
      sale_value: (Number(form.sale_value) || 0) * qtd,
      quantity: qtd,
      payment_method: form.payment_method,
      is_fiado: form.is_fiado,
      due_date: form.is_fiado ? form.due_date : null,
      sale_date: todayISO(),
      delivered: form.delivered,
      is_revista: form.is_revista,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/sales/${editingId}`, body);
        toast.success("Venda atualizada!");
      } else {
        await api.post("/sales", body);
        toast.success(`Venda de ${firstName(body.customer_name)} registrada! 🌸`);
      }
      resetForm();
      await loadToday();
      loadContext();
      customerRef.current?.focus();
    } catch (err) {
      setError(err.message);
      toast.error("Não foi possível salvar a venda.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    const ok = await confirm({
      title: "Excluir esta venda?",
      message: "Se for um item do estoque (e não Pedido Revista), a unidade volta para o estoque.",
      confirmText: "Sim, excluir",
      danger: true,
    });
    if (!ok) return;
    await api.del(`/sales/${id}`);
    if (editingId === id) resetForm();
    await loadToday();
    loadContext();
    toast.info("Venda excluída.");
  }

  async function marcarEntregue(id) {
    await api.patch(`/sales/${id}/entrega`);
    await loadToday();
    loadContext();
    toast.success("Pedido marcado como entregue! 📦");
  }

  const totalDia = sales.reduce((acc, s) => acc + Number(s.sale_value || 0), 0);
  const lucroDia = sales.reduce((acc, s) => acc + profitOf(s.cost_value, s.sale_value), 0);
  const aEntregar = sales.filter((s) => !s.delivered).length;
  // Valor em R$ (não contagem) — ao lado de "Faturamento", número solto confunde
  const aReceberValor = sales
    .filter((s) => !s.paid)
    .reduce((a, s) => a + (Number(s.sale_value) || 0), 0);

  const qtdForm = Math.max(1, parseInt(form.quantity, 10) || 1);
  const lucroUnit = profitOf(form.cost_value, form.sale_value);
  const lucro = lucroUnit * qtdForm; // total da linha (unitário × quantidade)
  const margem = marginPct(form.cost_value, form.sale_value); // é uma razão, não muda com qtd
  const fromStock = !!form.product_id;
  const valueLocked = fromStock && !valueUnlocked;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">
          {greeting()}, {firstName(user?.name)}! 🌸
        </h2>
        <p className="text-sm text-brand-text/60">
          Registre suas vendas de hoje. Use{" "}
          <kbd className="rounded bg-brand-cream px-1.5 py-0.5 text-xs">Tab</kbd> para navegar e{" "}
          <kbd className="rounded bg-brand-cream px-1.5 py-0.5 text-xs">Enter</kbd> para salvar.
        </p>
      </div>

      {/* Resumo rápido de hoje */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={ShoppingBag} label="Vendas hoje" value={sales.length} accent="text-brand-brown" />
        <MiniStat icon={TrendingUp} label="Faturamento" value={brl(totalDia)} accent="text-brand-brown" />
        <MiniStat icon={Truck} label="A entregar" value={aEntregar} accent={aEntregar > 0 ? "text-amber-600" : "text-emerald-600"} />
        <MiniStat icon={Clock} label="A receber (hoje)" value={brl(aReceberValor)} accent={aReceberValor > 0 ? "text-amber-600" : "text-emerald-600"} />
      </div>

      {/* Central de Avisos — só aparece quando há algo pedindo atenção */}
      {avisos.total > 0 && (
        <Card className="border-amber-200/70">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
            <BellRing className="h-4 w-4 text-amber-500" />
            <CardTitle>Precisa da sua atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {avisos.fiadosVencidos.length > 0 && (
              <Link
                to="/financeiro"
                className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-2.5 transition-colors hover:bg-red-100"
              >
                <span className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>
                      {avisos.fiadosVencidos.length}{" "}
                      {avisos.fiadosVencidos.length === 1 ? "fiado vencido" : "fiados vencidos"}
                    </strong>{" "}
                    — {brl(avisos.fiadosVencidosTotal)} para cobrar
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-red-400" />
              </Link>
            )}
            {avisos.contasVencidas.length > 0 && (
              <Link
                to="/financeiro"
                className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-2.5 transition-colors hover:bg-red-100"
              >
                <span className="flex items-center gap-2 text-sm text-red-700">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>
                      {avisos.contasVencidas.length}{" "}
                      {avisos.contasVencidas.length === 1 ? "conta atrasada" : "contas atrasadas"}
                    </strong>{" "}
                    — {brl(avisos.contasVencidasTotal)} para pagar
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-red-400" />
              </Link>
            )}
            {avisos.contasProximas.length > 0 && (
              <Link
                to="/financeiro"
                className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2.5 transition-colors hover:bg-amber-100"
              >
                <span className="flex items-center gap-2 text-sm text-amber-700">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>
                      {avisos.contasProximas.length}{" "}
                      {avisos.contasProximas.length === 1 ? "conta vence" : "contas vencem"}
                    </strong>{" "}
                    nos próximos 7 dias — {brl(avisos.contasProximasTotal)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-amber-400" />
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formulário */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{editingId ? `Editando venda #${editingId}` : "Registrar venda"}</CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <CustomerAutocomplete
                  ref={customerRef}
                  value={form.customer_name}
                  onChange={(v) => set("customer_name", v)}
                  placeholder="Nome da cliente"
                  autoFocus
                />
                {clienteDebito && (
                  <p className="flex items-center gap-1 text-xs font-medium text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Esta cliente tem {brl(clienteDebito.total)} em aberto (
                    {clienteDebito.count}{" "}
                    {clienteDebito.count === 1 ? "pendência" : "pendências"})
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Produto / Estoque</Label>
                <ProductAutocomplete
                  value={form.product}
                  onChange={(v) => setForm((f) => ({ ...f, product: v, product_id: null }))}
                  onSelect={(p) => {
                    setValueUnlocked(false);
                    setForm((f) => ({
                      ...f,
                      product: p.name,
                      product_id: p.id,
                      empresa: p.brand || f.empresa,
                      cost_value: String(p.cost_value ?? ""),
                      sale_value: String(p.sale_value ?? ""),
                    }));
                  }}
                  placeholder="Buscar no estoque ou digitar"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={form.empresa} onChange={(e) => set("empresa", e.target.value)}>
                  {EMPRESAS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number" step="1" min="1"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{qtdForm > 1 ? "Custo unitário (R$)" : "Valor de Custo (R$)"}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.cost_value}
                  onChange={(e) => set("cost_value", e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>
                    {fromStock
                      ? "Valor Sugerido (R$)"
                      : qtdForm > 1
                        ? "Valor unitário de Venda (R$)"
                        : "Valor de Venda (R$)"}
                  </span>
                  {fromStock && (
                    <button
                      type="button"
                      onClick={() => setValueUnlocked((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-brand-pinkDark hover:text-brand-brown"
                    >
                      {valueLocked ? (<><Lock className="h-3 w-3" /> editar</>) : (<><Unlock className="h-3 w-3" /> travar</>)}
                    </button>
                  )}
                </Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.sale_value}
                  onChange={(e) => set("sale_value", e.target.value)}
                  readOnly={valueLocked}
                  placeholder="0,00"
                  className={cn(valueLocked && "bg-brand-cream/70 text-brand-text/70")}
                />
              </div>

              <div className="flex items-stretch">
                <div className="flex w-full flex-col justify-center rounded-xl border border-brand-pink/50 bg-gradient-to-br from-brand-cream to-brand-offwhite px-4 py-2">
                  <span className="text-xs text-brand-text/60">
                    {qtdForm > 1 ? `Lucro total (${qtdForm} un.)` : "Lucro desta venda"}
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-xl font-bold", lucro >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {brl(lucro)}
                    </span>
                    <Badge variant={lucro >= 0 ? "success" : "danger"}>{margem.toFixed(0)}%</Badge>
                  </div>
                  {qtdForm > 1 && (
                    <span className="mt-0.5 text-[11px] text-brand-text/50">
                      Total da venda: {brl((Number(form.sale_value) || 0) * qtdForm)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Botões opt-in */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ToggleBtn
                active={form.is_fiado}
                onClick={toggleFiado}
                icon={HandCoins}
                labelOff="Marcar como Fiado"
                labelOn="Venda no Fiado (a prazo)"
              />
              <ToggleBtn
                active={form.delivered}
                onClick={() => set("delivered", !form.delivered)}
                icon={PackageCheck}
                labelOff="Marcar como Entregue"
                labelOn="Entregue"
                activeClass="border-emerald-600 bg-emerald-600 text-white"
              />
              <ToggleBtn
                active={form.is_revista}
                onClick={() => set("is_revista", !form.is_revista)}
                icon={BookOpen}
                labelOff="Pedido Revista"
                labelOn="Pedido Revista (não baixa estoque)"
                activeClass="border-brand-pinkDark bg-brand-pinkDark text-white"
              />
            </div>

            {form.is_fiado && (
              <div className="mt-3 space-y-1.5">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                  className="w-48"
                />
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : editingId ? "Salvar alterações (Enter)" : "Salvar venda (Enter)"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>Limpar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Vendas de hoje */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Vendas de hoje</CardTitle>
          {sales.length > 0 && (
            <span className="text-sm text-brand-text/60">
              {sales.length} {sales.length === 1 ? "venda" : "vendas"} ·{" "}
              <strong className="text-brand-brown">{brl(totalDia)}</strong> · lucro{" "}
              <strong className="text-emerald-600">{brl(lucroDia)}</strong>
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : sales.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhuma venda hoje ainda"
              hint="Preencha o formulário acima com a cliente e o produto, depois aperte Enter. Sua primeira venda do dia aparece aqui."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.customer_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {s.product || "—"}
                          {s.quantity > 1 && (
                            <span className="ml-1 text-xs text-brand-text/50">×{s.quantity}</span>
                          )}
                        </span>
                        {s.is_revista ? (
                          <span className="text-[10px] font-medium text-brand-pinkDark">📖 Revista</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{s.empresa || s.brand || "—"}</TableCell>
                    <TableCell>
                      {s.is_fiado ? (
                        <Badge variant={s.paid ? "success" : "danger"}>
                          Fiado {s.paid ? "· pago" : "· em aberto"}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">{s.payment_method}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-brand-brown">{brl(s.sale_value)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {brl(profitOf(s.cost_value, s.sale_value))}
                    </TableCell>
                    <TableCell>
                      {s.delivered ? (
                        <Badge variant="success">Entregue</Badge>
                      ) : (
                        <button
                          onClick={() => marcarEntregue(s.id)}
                          className="rounded-lg border border-brand-pink/50 px-2 py-0.5 text-xs text-brand-text/60 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          Marcar Entregue
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(s)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => remove(s.id)}
                          className="text-red-500 hover:bg-red-50"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
