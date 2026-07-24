import { useEffect, useMemo, useState } from "react";
import {
  Target, TrendingUp, CalendarClock, Rocket, Flag, ShoppingBag,
} from "lucide-react";
import { api } from "../lib/api";
import { brl, profitOf, todayISO } from "../lib/utils";
import { usePersistentState } from "../lib/usePersistentState";
import { Gauge } from "../components/Gauge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const MARGINS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const META_PADRAO = "2000"; // meta fixa de lucro do mês

function Insight({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-brand-pink/40 bg-white p-4">
      <div className="flex items-center gap-2 text-brand-text/55">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${accent || "text-brand-brown"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-text/55">{hint}</p>}
    </div>
  );
}

export default function Calculadora() {
  const [cost, setCost] = usePersistentState("fc_calc_cost", "");
  const [slider, setSlider] = usePersistentState("fc_calc_slider", 50);
  const [goal, setGoal] = usePersistentState("fc_calc_goal", META_PADRAO);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    api.get("/sales").then(setSales).catch(() => {});
  }, []);

  const costNum = Number(cost) || 0;
  const sliderPrice = costNum * (1 + slider / 100);
  const sliderProfit = sliderPrice - costNum;

  // ----- Meta de lucro do mês -----
  const meta = Number(goal) || 0;

  const m = useMemo(() => {
    const monthPrefix = todayISO().slice(0, 7);
    const mes = sales.filter((s) => (s.sale_date || "").startsWith(monthPrefix));
    const lucroMes = mes.reduce((a, s) => a + profitOf(s.cost_value, s.sale_value), 0);
    const faturamentoMes = mes.reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const numVendas = mes.length;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysLeft = Math.max(0, daysInMonth - dayOfMonth + 1);

    const pct = meta > 0 ? (lucroMes / meta) * 100 : 0;
    const expectedPct = (dayOfMonth / daysInMonth) * 100; // onde deveria estar hoje
    const expectedValue = (meta * dayOfMonth) / daysInMonth;
    const restante = Math.max(0, meta - lucroMes);
    const perDay = daysLeft > 0 ? restante / daysLeft : 0;
    const projecao = dayOfMonth > 0 ? (lucroMes / dayOfMonth) * daysInMonth : 0;
    const lucroPorVenda = numVendas > 0 ? lucroMes / numVendas : 0;
    const vendasNecessarias = lucroPorVenda > 0 ? Math.ceil(restante / lucroPorVenda) : null;

    const batida = lucroMes >= meta && meta > 0;
    const noRitmo = lucroMes >= expectedValue;
    const color = batida
      ? "#059669"
      : noRitmo
        ? "#059669"
        : lucroMes >= expectedValue * 0.7
          ? "#D97706"
          : "#DC2626";

    return {
      lucroMes, faturamentoMes, numVendas, daysLeft, dayOfMonth, daysInMonth,
      pct, expectedPct, restante, perDay, projecao, lucroPorVenda,
      vendasNecessarias, batida, noRitmo, color,
    };
  }, [sales, meta]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">Calculadora & Meta</h2>
        <p className="text-sm text-brand-text/60">
          Encontre o preço de venda ideal e acompanhe sua meta de lucro do mês.
        </p>
      </div>

      {/* Linha principal: calculadora (2/3) + velocímetro da meta (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calculadora */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preço de venda sugerido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Esquerda: custo + margem arrastável */}
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Custo do produto (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    className="h-12 text-lg font-semibold"
                  />
                  <p className="text-xs text-brand-text/50">Quanto você pagou neste produto.</p>
                </div>

                <div className="rounded-2xl border border-brand-pink/50 bg-gradient-to-br from-brand-cream to-brand-offwhite p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-pinkDark">
                    Margem (arraste)
                  </p>
                  <p className="font-serif text-5xl leading-tight text-brand-brown">{slider}%</p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={slider}
                    onChange={(e) => setSlider(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-brand-pink/40 accent-brand-brown"
                    style={{
                      background: `linear-gradient(to right, #6B3F2A 0%, #6B3F2A ${slider}%, rgba(232,180,188,0.4) ${slider}%, rgba(232,180,188,0.4) 100%)`,
                    }}
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-brand-text/50">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </div>

              {/* Direita: painel de resultado em destaque */}
              <div className="flex flex-col justify-center rounded-2xl bg-brand-brown p-6 text-white shadow-sm">
                <p className="text-sm text-white/70">Preço de venda sugerido</p>
                <p className="font-serif text-5xl font-bold leading-tight">{brl(sliderPrice)}</p>
                <p className="mt-2 text-lg text-emerald-200">Lucro {brl(sliderProfit)}</p>
                <div className="mt-5 space-y-1.5 border-t border-white/20 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Custo</span>
                    <span className="font-medium">{brl(costNum)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Margem aplicada</span>
                    <span className="font-medium">{slider}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Atalhos de margem — 10% em 10% */}
            <div>
              <p className="mb-2 text-sm text-brand-text/60">Atalhos rápidos</p>
              <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">
                {MARGINS.map((mm) => {
                  const price = costNum * (1 + mm);
                  const profit = price - costNum;
                  const pct = Math.round(mm * 100);
                  return (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => setSlider(pct)}
                      className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                        slider === pct
                          ? "border-brand-brown bg-brand-brown/10"
                          : "border-brand-pink/50 bg-brand-offwhite hover:bg-brand-cream"
                      }`}
                    >
                      <div className="font-serif text-xl font-semibold text-brand-brown">{pct}%</div>
                      <div className="mt-1 text-sm font-bold text-brand-text">{brl(price)}</div>
                      <div className="text-[11px] text-emerald-600">+{brl(profit)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Velocímetro da meta */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-brown" /> Meta de lucro do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Gauge pct={m.pct} expectedPct={m.expectedPct} color={m.color} />

            <div className="-mt-2 text-center">
              <p className="font-serif text-4xl font-bold" style={{ color: m.color }}>
                {brl(m.lucroMes)}
              </p>
              <p className="text-sm text-brand-text/60">
                {m.pct.toFixed(0)}% da meta de{" "}
                <strong className="text-brand-brown">{brl(meta)}</strong>
              </p>
              <p className="mt-1 text-xs text-brand-text/45">
                ▏o traço mostra onde você deveria estar hoje
              </p>
            </div>

            {/* Meta editável (fixa em R$ 2.000 por padrão) */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-brand-cream/60 px-3 py-2">
              <Label className="text-xs text-brand-text/60">Meta (R$)</Label>
              <Input
                type="number"
                step="100"
                min="0"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="h-9 w-28 text-right font-semibold"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-brand-brown" /> Insights da meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {m.batida ? (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
              🎉 <strong>Meta batida!</strong> Você já lucrou {brl(m.lucroMes)} este mês —{" "}
              {brl(m.lucroMes - meta)} acima da meta. Continue assim!
            </div>
          ) : (
            <div
              className={`mb-4 rounded-xl px-4 py-3 ${
                m.noRitmo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {m.noRitmo ? "✅ Você está no ritmo certo para bater a meta!" : "⚡ Acelere um pouco para alcançar a meta."}{" "}
              Faltam <strong>{brl(m.restante)}</strong> de lucro.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Insight
              icon={Flag}
              label="Falta para a meta"
              value={brl(m.restante)}
              hint={m.batida ? "meta alcançada 🎉" : `de ${brl(meta)}`}
              accent={m.batida ? "text-emerald-600" : "text-brand-brown"}
            />
            <Insight
              icon={CalendarClock}
              label="Ritmo necessário"
              value={`${brl(m.perDay)}/dia`}
              hint={`nos ${m.daysLeft} dias restantes`}
            />
            <Insight
              icon={TrendingUp}
              label="Projeção do mês"
              value={brl(m.projecao)}
              hint={m.projecao >= meta ? "no caminho da meta ✓" : "abaixo da meta"}
              accent={m.projecao >= meta ? "text-emerald-600" : "text-amber-600"}
            />
            <Insight
              icon={ShoppingBag}
              label="Vendas necessárias"
              value={m.vendasNecessarias != null ? `≈ ${m.vendasNecessarias}` : "—"}
              hint={
                m.vendasNecessarias != null
                  ? `lucro médio ${brl(m.lucroPorVenda)}/venda`
                  : "registre vendas p/ estimar"
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
