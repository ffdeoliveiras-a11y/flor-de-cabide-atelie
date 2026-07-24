import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  ReferenceLine,
  LabelList,
} from "recharts";
import {
  TrendingUp, Wallet, Filter, X, BarChart3, CheckCircle2, Clock,
  TrendingDown, Landmark, Percent, PiggyBank, Coins, Layers,
} from "lucide-react";
import { api } from "../lib/api";
import { brl, formatDate, profitOf, todayISO } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyState } from "../components/ui/empty";
import { Loading } from "../components/ui/spinner";
import { usePersistentState } from "../lib/usePersistentState";
import { cn } from "../lib/utils";

const COLORS = ["#6B3F2A", "#C4838A", "#E8B4BC", "#A6705A", "#D9B8A0", "#8C5A3C"];
const COST_COLOR = "#A6705A"; // hue distinto do faturamento (#C4838A), reservado p/ custos

function KpiCard({ icon: Icon, label, value, accent, hint }) {
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

const tip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #E8B4BC",
    background: "#FDFAF7",
    fontSize: 13,
  },
};

const monthStart = todayISO().slice(0, 7) + "-01";
// Último dia do mês — "Mês atual" cobre o mês inteiro (fiados/contas que ainda
// vão vencer neste mês aparecem no A Receber / Custos).
const monthEnd = (() => {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const off = last.getTimezoneOffset();
  return new Date(last.getTime() - off * 60000).toISOString().slice(0, 10);
})();

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-brand-brown text-white shadow-sm" : "text-brand-text/60 hover:bg-brand-cream"
      )}
    >
      {children}
    </button>
  );
}

export default function Dashboard() {
  const [sales, setSales] = useState([]);
  const [bills, setBills] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = usePersistentState("fc_dash_de2", monthStart);
  const [dateTo, setDateTo] = usePersistentState("fc_dash_ate2", monthEnd);
  const [tab, setTab] = usePersistentState("fc_dash_tab", "geral");

  useEffect(() => {
    Promise.all([
      api.get("/sales").then(setSales).catch(() => {}),
      api.get("/bills-to-pay").then(setBills).catch(() => {}),
      api.get("/products").then(setProducts).catch(() => {}),
      api.get("/sales/summary").then(setSummary).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // "Quanto sobra" — situação atual (não muda com o filtro de data):
  // Recebido + Estoque (valor investido) − A Pagar (em aberto)
  // Caixa = Recebido: o mesmo número mostrado em Recebido no resto do sistema
  // (sem descontar contas pagas, para não haver dois valores diferentes para
  // "o que já entrou"). "A Receber" (vendas ainda não pagas/fiado) NÃO entra
  // nessa conta — esse dinheiro só vira caixa quando a cliente efetivamente pagar.
  const patrimonio = useMemo(() => {
    const recebido = sales
      .filter((s) => s.paid)
      .reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const aReceber = sales
      .filter((s) => !s.paid)
      .reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const caixa = recebido; // Caixa = Recebido
    const estoqueValor = products.reduce(
      (a, p) => a + (Number(p.cost_value) || 0) * (Number(p.quantity) || 0),
      0
    );
    const estoqueValorVenda = products.reduce(
      (a, p) => a + (Number(p.sale_value) || 0) * (Number(p.quantity) || 0),
      0
    );
    const aPagarAberto = bills
      .filter((b) => !b.paid)
      .reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const saldo = caixa + estoqueValor - aPagarAberto;
    const aReceberMaisEstoque = aReceber + estoqueValorVenda;
    return { caixa, aReceber, estoqueValor, estoqueValorVenda, aPagarAberto, saldo, aReceberMaisEstoque };
  }, [sales, bills, products]);

  // Monta os degraus do gráfico em cascata (waterfall)
  const waterfall = useMemo(() => {
    const steps = [];
    let running = 0;
    function addStep(name, delta, color) {
      const from = running;
      const to = running + delta;
      steps.push({ name, base: Math.min(from, to), height: Math.abs(to - from) || 0.01, actual: delta, color });
      running = to;
    }
    addStep("Recebido", patrimonio.caixa, patrimonio.caixa >= 0 ? "#6B3F2A" : "#DC2626");
    addStep("+ Estoque", patrimonio.estoqueValor, "#059669");
    addStep("− A Pagar", -patrimonio.aPagarAberto, "#DC2626");
    steps.push({
      name: "= Saldo",
      base: Math.min(0, running),
      height: Math.abs(running) || 0.01,
      actual: running,
      color: running >= 0 ? "#6B3F2A" : "#DC2626",
    });
    return steps;
  }, [patrimonio]);

  const hasDateFilter = dateFrom !== monthStart || dateTo !== monthEnd;

  function clearFilter() {
    setDateFrom(monthStart);
    setDateTo(monthEnd);
  }

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const d = (s.sale_date || "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  // Contas a pagar dentro do período (pelo vencimento; sem vencimento = sempre conta)
  const billsFiltered = useMemo(() => {
    return bills.filter((b) => {
      const d = (b.due_date || "").slice(0, 10);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [bills, dateFrom, dateTo]);

  // Data em que o dinheiro deve entrar: vencimento do fiado, senão data de
  // pagamento prevista, senão a própria data da venda. Mesmo critério usado
  // no Financeiro, para os dois "A Receber" baterem sempre.
  function expectedReceiveDate(s) {
    return s.due_date || s.payment_date || s.sale_date;
  }

  // "A receber" pela data prevista de recebimento — não pela data da venda —
  // igual ao Financeiro (aqui usa TODAS as vendas, não só `filtered`, porque
  // uma venda de outro mês pode vencer dentro do período selecionado).
  const periodReceivables = useMemo(() => {
    return sales.filter((s) => {
      if (s.paid) return false;
      const d = (expectedReceiveDate(s) || "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const data = useMemo(() => {
    const byDayMap = {};
    filtered.forEach((s) => {
      const d = (s.sale_date || "").slice(0, 10);
      if (!d) return;
      if (!byDayMap[d]) byDayMap[d] = { date: d, faturamento: 0, lucro: 0 };
      byDayMap[d].faturamento += Number(s.sale_value) || 0;
      byDayMap[d].lucro += profitOf(s.cost_value, s.sale_value);
    });
    const byDay = Object.values(byDayMap)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => ({ ...d, label: formatDate(d.date).slice(0, 5), custo: d.faturamento - d.lucro }));

    const agg = (keyFn, valueFn = (s) => Number(s.sale_value) || 0) => {
      const m = {};
      filtered.forEach((s) => {
        const k = keyFn(s) || "Outros";
        m[k] = (m[k] || 0) + valueFn(s);
      });
      return Object.entries(m)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const totalFat = filtered.reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const totalLucro = filtered.reduce((a, s) => a + profitOf(s.cost_value, s.sale_value), 0);
    const totalCusto = filtered.reduce((a, s) => a + (Number(s.cost_value) || 0), 0);
    const recebido = filtered
      .filter((s) => s.paid)
      .reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const pendente = periodReceivables.reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const ticket = filtered.length > 0 ? totalFat / filtered.length : 0;

    // Só as NÃO pagas — senão soma boleto já pago junto com o que ainda falta
    // pagar, inflando o número (bug relatado: mostrava pago+aberto como se
    // fosse só "em aberto").
    const totalBoletos = billsFiltered
      .filter((b) => !b.paid)
      .reduce((a, b) => a + (Number(b.amount) || 0), 0);
    // Nota: NÃO somamos custo dos produtos + contas a pagar. O custo do produto
    // vendido e o boleto da compra costumam ser a MESMA dívida (a compra na
    // Natura/Boticário vira custo do produto E vira conta a pagar) — somar os
    // dois duplicaria o valor. São mostrados lado a lado, não somados.
    const margemPct = totalFat > 0 ? (totalLucro / totalFat) * 100 : 0;

    return {
      byDay,
      byPayment: agg((s) => (s.is_fiado ? "Fiado" : s.payment_method)),
      byEmpresa: agg((s) => s.empresa || s.brand),
      byEmpresaCusto: agg((s) => s.empresa || s.brand, (s) => Number(s.cost_value) || 0),
      topCustomers: agg((s) => s.customer_name).slice(0, 6),
      totalFat,
      totalLucro,
      totalCusto,
      totalBoletos,
      margemPct,
      recebido,
      pendente,
      ticket,
    };
  }, [filtered, billsFiltered, periodReceivables]);

  const pctRecebido = data.totalFat > 0 ? (data.recebido / data.totalFat) * 100 : 0;
  // Proporção só entre Recebido e A Receber (não usa Faturamento, já que agora
  // "A Receber" é filtrado pela data de vencimento, não pela data da venda).
  const recebidoPendenteTotal = data.recebido + data.pendente;
  const recebidoBarPct =
    recebidoPendenteTotal > 0 ? (data.recebido / recebidoPendenteTotal) * 100 : 0;

  const hasData = filtered.length > 0;
  const hasCostData = filtered.length > 0 || billsFiltered.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">Dashboard</h2>
        <p className="text-sm text-brand-text/60">
          Visão geral do negócio · {summary?.month || "mês atual"}
        </p>
      </div>

      {/* Quanto sobra — foto da situação atual, independe do filtro de data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand-brown" /> Quanto sobra
          </CardTitle>
          <CardDescription>
            Recebido + Estoque (valor investido) − A Pagar (em aberto) · situação de hoje, não
            muda com o filtro de data abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : (
            <>
              {/* Destaque: A Receber fica separado, não é caixa ainda */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Recebido: <strong>{brl(patrimonio.caixa)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                  <Clock className="h-3.5 w-3.5" />
                  A Receber (ainda não é caixa): <strong>{brl(patrimonio.aReceber)}</strong>
                </span>
              </div>
              <p className="mb-3 text-xs text-brand-text/50">
                O gráfico abaixo usa só o que você já recebeu. O valor "a receber" acima é
                separado — só entra quando a cliente pagar (aí sim vira caixa).
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfall} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3D2B1F" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} width={70} tickFormatter={(v) => brl(v)} />
                    <ReferenceLine y={0} stroke="#3D2B1F55" />
                    <Tooltip
                      {...tip}
                      formatter={(_v, _n, props) => [brl(props.payload.actual), "Valor"]}
                    />
                    <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                    <Bar dataKey="height" stackId="wf" radius={[4, 4, 4, 4]} maxBarSize={70}>
                      {waterfall.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                      <LabelList
                        dataKey="actual"
                        position="top"
                        formatter={(v) => brl(v)}
                        style={{ fontSize: 11, fill: "#3D2B1F", fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div
                className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 ${
                  patrimonio.saldo >= 0 ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <span className="text-sm text-brand-text/70">
                  Somando o que você já recebeu e o valor investido em estoque, e descontando o
                  que você ainda deve pagar, sobram:
                </span>
                <strong className={patrimonio.saldo >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {brl(patrimonio.saldo)}
                </strong>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* A Receber + Valor do Estoque pelo potencial de venda — foto de hoje */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-brown" /> A Receber + Valor do Estoque pelo
            Potencial de Venda
          </CardTitle>
          <CardDescription>
            Se você recebesse todo o fiado em aberto e vendesse tudo que tem no estoque pelo
            preço de venda, entraria:
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs text-amber-700/70">A Receber</p>
                  <p className="text-xl font-bold text-amber-700">{brl(patrimonio.aReceber)}</p>
                </div>
                <div className="rounded-xl bg-brand-cream p-4">
                  <p className="text-xs text-brand-brown/70">Valor do Estoque pelo Potencial de Venda</p>
                  <p className="text-xl font-bold text-brand-brown">
                    {brl(patrimonio.estoqueValorVenda)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-700/70">Total potencial</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {brl(patrimonio.aReceberMaisEstoque)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-brand-text/50">
                É uma visão otimista: o estoque aqui vale pelo preço de venda (não pelo custo), e
                depende de você conseguir vender e receber tudo.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Abas */}
      <div className="inline-flex gap-1 rounded-2xl border border-brand-pink/40 bg-brand-offwhite p-1">
        <TabBtn active={tab === "geral"} onClick={() => setTab("geral")}>
          Visão Geral
        </TabBtn>
        <TabBtn active={tab === "custos"} onClick={() => setTab("custos")}>
          Custos
        </TabBtn>
      </div>

      {/* Filtro de data */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <Filter className="h-4 w-4 text-brand-brown mt-auto mb-2" />
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            {hasDateFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilter} className="mb-0.5">
                <X className="h-4 w-4" /> Mês atual
              </Button>
            )}
            <span className="text-sm text-brand-text/50 mb-2">
              {filtered.length} vendas no período
            </span>
          </div>
        </CardContent>
      </Card>

      {tab === "geral" ? (
        <>
          {/* KPIs do período filtrado — visão Faturamento / Recebido / Pendente */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              label="Faturamento"
              value={brl(data.totalFat)}
              accent="text-brand-brown"
              hint="Total vendido no período"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Recebido"
              value={brl(data.recebido)}
              accent="text-emerald-600"
              hint={`${pctRecebido.toFixed(0)}% do faturamento`}
            />
            <KpiCard
              icon={Clock}
              label="A Receber"
              value={brl(data.pendente)}
              accent={data.pendente > 0 ? "text-amber-600" : "text-emerald-600"}
              hint="previsto p/ este período"
            />
            <KpiCard
              icon={Wallet}
              label="Lucro bruto"
              value={brl(data.totalLucro)}
              accent="text-brand-brown"
              hint="Venda − custo"
            />
          </div>

          {loading ? (
            <Card>
              <CardContent>
                <Loading label="Montando seus gráficos…" />
              </CardContent>
            </Card>
          ) : !hasData ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={BarChart3}
                  title="Nenhuma venda no período"
                  hint="Ajuste as datas acima ou volte para o mês atual. Os gráficos aparecem assim que houver vendas no período escolhido."
                  action={
                    hasDateFilter ? (
                      <Button variant="outline" size="sm" onClick={clearFilter}>
                        <X className="h-4 w-4" /> Voltar ao mês atual
                      </Button>
                    ) : null
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Recebido vs Pendente — barra visual */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Recebido vs A Receber</CardTitle>
                  <CardDescription>
                    "A Receber" pela data prevista de recebimento (vencimento), igual ao
                    Financeiro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex h-6 w-full overflow-hidden rounded-full bg-brand-pink/20">
                    <div
                      className="flex items-center justify-end bg-emerald-500 transition-all"
                      style={{ width: `${recebidoBarPct}%` }}
                      title={`Recebido ${brl(data.recebido)}`}
                    />
                    <div
                      className="flex-1 bg-amber-400 transition-all"
                      title={`A Receber ${brl(data.pendente)}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
                      Recebido <strong className="text-emerald-600">{brl(data.recebido)}</strong>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
                      A Receber <strong className="text-amber-600">{brl(data.pendente)}</strong>
                    </span>
                    <span className="flex items-center gap-2 text-brand-text/60">
                      Faturamento <strong className="text-brand-brown">{brl(data.totalFat)}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Faturamento e lucro por dia */}
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento e Lucro por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.byDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#3D2B1F" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} width={70} tickFormatter={(v) => brl(v)} />
                        <Tooltip {...tip} formatter={(v, n) => [brl(v), n]} />
                        <Legend />
                        <Bar dataKey="faturamento" name="Faturamento" fill="#6B3F2A" radius={[6, 6, 0, 0]} maxBarSize={42} />
                        <Line dataKey="lucro" name="Lucro" stroke="#C4838A" strokeWidth={3} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Por forma de pagamento */}
                <Card>
                  <CardHeader>
                    <CardTitle>Por forma de pagamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.byPayment}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            label={(e) => e.name}
                          >
                            {data.byPayment.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip {...tip} formatter={(v) => brl(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Por empresa */}
                <Card>
                  <CardHeader>
                    <CardTitle>Por empresa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byEmpresa} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#3D2B1F" }} interval={0} angle={-15} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} width={70} tickFormatter={(v) => brl(v)} />
                          <Tooltip {...tip} formatter={(v) => brl(v)} />
                          <Bar dataKey="value" name="Faturamento" fill="#C4838A" radius={[6, 6, 0, 0]} maxBarSize={70} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top clientes */}
              <Card>
                <CardHeader>
                  <CardTitle>Top clientes por faturamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.topCustomers}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "#3D2B1F" }} tickFormatter={(v) => brl(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#3D2B1F" }} width={120} />
                        <Tooltip {...tip} formatter={(v) => brl(v)} />
                        <Bar dataKey="value" name="Faturamento" fill="#6B3F2A" radius={[0, 6, 6, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          {/* KPIs de custos — Custo dos produtos e Contas a pagar são mostrados
              lado a lado, SEM somar: a compra na Natura/Boticário vira custo do
              produto vendido E vira conta a pagar — são a mesma dívida vista por
              dois ângulos diferentes (resultado x caixa), não duas dívidas. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={TrendingDown}
              label="Custo dos produtos vendidos"
              value={brl(data.totalCusto)}
              accent="text-brand-brown"
              hint="Quanto custou o que você vendeu (resultado)"
            />
            <KpiCard
              icon={Landmark}
              label="Contas a pagar"
              value={brl(data.totalBoletos)}
              accent="text-brand-brown"
              hint="O que sai do bolso no período (caixa)"
            />
            <KpiCard
              icon={Wallet}
              label="Lucro bruto"
              value={brl(data.totalLucro)}
              accent="text-emerald-600"
              hint="Faturamento − custo dos produtos"
            />
            <KpiCard
              icon={Percent}
              label="Margem"
              value={`${data.margemPct.toFixed(0)}%`}
              accent="text-emerald-600"
              hint="Lucro sobre o faturamento"
            />
          </div>
          <p className="-mt-2 text-xs text-brand-text/45">
            💡 "Custo dos produtos" e "Contas a pagar" não se somam: geralmente são a
            mesma compra vista de dois jeitos — o custo que já foi pro produto vendido, e
            a fatura que ainda vai sair do seu bolso.
          </p>

          {loading ? (
            <Card>
              <CardContent>
                <Loading label="Montando seus gráficos…" />
              </CardContent>
            </Card>
          ) : !hasCostData ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={PiggyBank}
                  title="Nenhum custo no período"
                  hint="Ajuste as datas acima. Assim que houver vendas ou contas a pagar no período, os custos aparecem aqui."
                  action={
                    hasDateFilter ? (
                      <Button variant="outline" size="sm" onClick={clearFilter}>
                        <X className="h-4 w-4" /> Voltar ao mês atual
                      </Button>
                    ) : null
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Custo vs Faturamento por dia */}
              <Card>
                <CardHeader>
                  <CardTitle>Custo x Faturamento por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.byDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#3D2B1F" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} width={70} tickFormatter={(v) => brl(v)} />
                        <Tooltip {...tip} formatter={(v, n) => [brl(v), n]} />
                        <Legend />
                        <Bar dataKey="custo" name="Custo" fill={COST_COLOR} radius={[6, 6, 0, 0]} maxBarSize={42} />
                        <Line dataKey="faturamento" name="Faturamento" stroke="#6B3F2A" strokeWidth={3} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Custo por empresa */}
              <Card>
                <CardHeader>
                  <CardTitle>Custo por empresa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byEmpresaCusto} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8B4BC55" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#3D2B1F" }} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} width={70} tickFormatter={(v) => brl(v)} />
                        <Tooltip {...tip} formatter={(v) => brl(v)} />
                        <Bar dataKey="value" name="Custo" fill={COST_COLOR} radius={[6, 6, 0, 0]} maxBarSize={70} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
