import { useEffect, useMemo, useState } from "react";
import {
  Pencil, Trash2, Filter, X, PackageCheck, Package, History, SearchX, Download, Wallet,
} from "lucide-react";
import { api } from "../lib/api";
import {
  brl, cn, formatDate, marginPct, profitOf, todayISO, recebidoDe, saldoDe, isParcial,
} from "../lib/utils";
import { ReceberModal } from "../components/ReceberModal";
import { EMPRESAS, PAYMENT_METHODS } from "../lib/constants";
import { useToast, useConfirm } from "../lib/feedback";
import { usePersistentState } from "../lib/usePersistentState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
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

const EMPTY_FILTERS = {
  cliente: "",
  produto: "",
  empresa: "Todas",
  pagamento: "Todas",
  tipo: "Todos",
  status: "Todos",
  de: "",
  ate: "",
};

function statusOf(s) {
  if (s.paid) return "PAGO";
  if (s.is_fiado && s.due_date && s.due_date.slice(0, 10) < todayISO()) return "ATRASADO";
  if (isParcial(s)) return "PARCIAL";
  return "PENDENTE";
}

function statusVariant(status) {
  if (status === "ATRASADO") return "danger";
  if (status === "PARCIAL") return "warning";
  if (status === "PENDENTE") return "default";
  return "success";
}

const empresaOf = (s) => s.empresa || s.brand || "";

// Cabeçalho compacto
function Th({ children, right }) {
  return (
    <TableHead
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
        right && "text-right"
      )}
    >
      {children}
    </TableHead>
  );
}

// Célula compacta
function Td({ children, right, className }) {
  return (
    <TableCell className={cn("px-2 py-1 text-xs", right && "text-right", className)}>
      {children}
    </TableCell>
  );
}

const PAGE_SIZE = 50;

export default function Historico() {
  const toast = useToast();
  const confirm = useConfirm();
  const [sales, setSales] = useState([]);
  const [filters, setFilters] = usePersistentState("fc_hist_filtros", EMPTY_FILTERS);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Paginação simples: mostra 50 e vai carregando mais (totais sempre do conjunto todo)
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Venda aberta na janela "Receber" (pagamento total ou parcial)
  const [receber, setReceber] = useState(null);

  function setF(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
    setLimit(PAGE_SIZE); // mudou o filtro → volta para a primeira "página"
  }

  async function load() {
    try {
      setSales(await api.get("/sales"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const empresaOptions = useMemo(
    () => Array.from(new Set([...EMPRESAS, ...sales.map(empresaOf).filter(Boolean)])),
    [sales]
  );
  const paymentOptions = useMemo(
    () => Array.from(new Set([...PAYMENT_METHODS, ...sales.map((s) => s.payment_method).filter(Boolean)])),
    [sales]
  );

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const f = filters;
      if (f.cliente && !(s.customer_name || "").toLowerCase().includes(f.cliente.toLowerCase()))
        return false;
      if (f.produto && !(s.product || "").toLowerCase().includes(f.produto.toLowerCase()))
        return false;
      if (f.empresa !== "Todas" && empresaOf(s) !== f.empresa) return false;
      if (f.pagamento !== "Todas" && s.payment_method !== f.pagamento) return false;
      if (f.tipo === "Fiado" && s.is_fiado !== 1) return false;
      if (f.tipo === "À vista" && s.is_fiado !== 0) return false;
      if (f.status !== "Todos" && statusOf(s) !== f.status) return false;
      const d = (s.sale_date || "").slice(0, 10);
      if (f.de && d < f.de) return false;
      if (f.ate && d > f.ate) return false;
      return true;
    });
  }, [sales, filters]);

  const totals = useMemo(() => {
    const faturamento = filtered.reduce((a, s) => a + (Number(s.sale_value) || 0), 0);
    const lucro = filtered.reduce((a, s) => a + profitOf(s.cost_value, s.sale_value), 0);
    const aReceber = filtered.reduce((a, s) => a + saldoDe(s), 0);
    return { faturamento, lucro, aReceber, margem: faturamento > 0 ? (lucro / faturamento) * 100 : 0 };
  }, [filtered]);

  function openEdit(s) {
    setEditing(s);
    setEditForm({
      customer_name: s.customer_name || "",
      empresa: empresaOf(s) || "Outros",
      product: s.product || "",
      cost_value: String(s.cost_value ?? ""),
      sale_value: String(s.sale_value ?? ""),
      quantity: String(s.quantity || 1),
      payment_method: PAYMENT_METHODS.includes(s.payment_method) ? s.payment_method : "Pix",
      status: s.paid ? "PAGO" : "PENDENTE",
      is_fiado: !!s.is_fiado,
      due_date: s.due_date ? s.due_date.slice(0, 10) : "",
      sale_date: s.sale_date ? s.sale_date.slice(0, 10) : todayISO(),
      delivery_date: s.delivery_date ? s.delivery_date.slice(0, 10) : "",
      payment_date: s.payment_date ? s.payment_date.slice(0, 10) : "",
      notes: s.notes || "",
      delivered: !!s.delivered,
      is_revista: !!s.is_revista,
    });
  }

  function setE(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editForm.is_fiado && !editForm.due_date) {
      setError("Fiado precisa de data de vencimento.");
      return;
    }
    await api.patch(`/sales/${editing.id}`, {
      ...editForm,
      due_date: editForm.is_fiado ? editForm.due_date : null,
    });
    setEditing(null);
    setEditForm(null);
    await load();
    toast.success("Venda atualizada!");
  }

  async function remove(id, nome) {
    const ok = await confirm({
      title: "Excluir esta venda?",
      message: `A venda de ${nome || "esta cliente"} será removida. Se for um item do estoque (e não Pedido Revista), a unidade volta ao estoque.`,
      confirmText: "Sim, excluir",
      danger: true,
    });
    if (!ok) return;
    await api.del(`/sales/${id}`);
    await load();
    toast.info("Venda excluída.");
  }

  async function marcarEntregue(id) {
    await api.patch(`/sales/${id}/entrega`);
    await load();
    toast.success("Pedido marcado como entregue! 📦");
  }

  // Exporta as vendas filtradas em CSV que o Excel brasileiro abre direto
  // (BOM UTF-8 + ponto e vírgula + vírgula decimal).
  function exportCSV() {
    const num = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");
    const txt = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Data", "Cliente", "Produto", "Quantidade", "Empresa", "Pagamento", "Tipo",
      "Custo", "Venda", "Lucro", "Recebido", "Falta receber", "Status", "Entregue",
      "Vencimento", "Observações",
    ];
    const rows = filtered.map((s) => [
      formatDate(s.sale_date),
      txt(s.customer_name),
      txt(s.product),
      s.quantity || 1,
      txt(empresaOf(s)),
      txt(s.payment_method),
      s.is_fiado ? "Fiado" : "À vista",
      num(s.cost_value),
      num(s.sale_value),
      num(profitOf(s.cost_value, s.sale_value)),
      num(recebidoDe(s)),
      num(saldoDe(s)),
      statusOf(s),
      s.delivered ? "Sim" : "Não",
      s.due_date ? formatDate(s.due_date) : "",
      txt(s.notes),
    ]);
    const csv =
      "\uFEFF" + [header, ...rows].map((r) => r.join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vendas-flor-de-cabide-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${filtered.length} vendas exportadas! Abra no Excel. 📊`);
  }

  const activeFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const editLucro = editForm ? profitOf(editForm.cost_value, editForm.sale_value) : 0;
  const editMargem = editForm ? marginPct(editForm.cost_value, editForm.sale_value) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">Histórico de Vendas</h2>
        <p className="text-sm text-brand-text/60">
          Todas as vendas registradas, com filtros por qualquer campo.
        </p>
      </div>

      {/* Filtros — linha única compacta */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-2">
            <Filter className="h-4 w-4 text-brand-brown mb-1.5 shrink-0" />

            <div className="space-y-0.5 min-w-[120px]">
              <Label className="text-[10px]">Cliente</Label>
              <Input className="h-7 text-xs px-2" value={filters.cliente} onChange={(e) => setF("cliente", e.target.value)} placeholder="nome…" />
            </div>
            <div className="space-y-0.5 min-w-[120px]">
              <Label className="text-[10px]">Produto</Label>
              <Input className="h-7 text-xs px-2" value={filters.produto} onChange={(e) => setF("produto", e.target.value)} placeholder="produto…" />
            </div>
            <div className="space-y-0.5 min-w-[130px]">
              <Label className="text-[10px]">Empresa</Label>
              <Select className="h-7 text-xs py-0" value={filters.empresa} onChange={(e) => setF("empresa", e.target.value)}>
                <option>Todas</option>
                {empresaOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div className="space-y-0.5 min-w-[130px]">
              <Label className="text-[10px]">Pagamento</Label>
              <Select className="h-7 text-xs py-0" value={filters.pagamento} onChange={(e) => setF("pagamento", e.target.value)}>
                <option>Todas</option>
                {paymentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div className="space-y-0.5 min-w-[100px]">
              <Label className="text-[10px]">Tipo</Label>
              <Select className="h-7 text-xs py-0" value={filters.tipo} onChange={(e) => setF("tipo", e.target.value)}>
                <option>Todos</option>
                <option>À vista</option>
                <option>Fiado</option>
              </Select>
            </div>
            <div className="space-y-0.5 min-w-[100px]">
              <Label className="text-[10px]">Status</Label>
              <Select className="h-7 text-xs py-0" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
                <option>Todos</option>
                <option>PAGO</option>
                <option>PENDENTE</option>
                <option>PARCIAL</option>
                <option>ATRASADO</option>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">De</Label>
              <Input type="date" className="h-7 text-xs px-2 w-36" value={filters.de} onChange={(e) => setF("de", e.target.value)} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Até</Label>
              <Input type="date" className="h-7 text-xs px-2 w-36" value={filters.ate} onChange={(e) => setF("ate", e.target.value)} />
            </div>
            {activeFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs mb-0.5" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Totais + tabela */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <CardTitle className="text-base">
            {filtered.length} {filtered.length === 1 ? "venda" : "vendas"}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-brand-text/60">
              Faturamento <strong className="text-brand-brown">{brl(totals.faturamento)}</strong>
            </span>
            <span className="text-brand-text/60">
              Lucro <strong className="text-emerald-600">{brl(totals.lucro)}</strong>
            </span>
            {totals.aReceber > 0 && (
              <span className="text-brand-text/60">
                Falta receber <strong className="text-amber-600">{brl(totals.aReceber)}</strong>
              </span>
            )}
            <span className="text-brand-text/60">
              Margem <strong className="text-brand-brown">{totals.margem.toFixed(1)}%</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              title="Baixar as vendas filtradas em planilha (Excel)"
            >
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            activeFilters ? (
              <EmptyState
                icon={SearchX}
                title="Nenhuma venda com esses filtros"
                hint="Tente ajustar ou limpar os filtros para ver mais resultados."
                action={
                  <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                    <X className="h-4 w-4" /> Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="Ainda não há vendas registradas"
                hint="Assim que você registrar vendas na aba Nova Venda, todo o histórico aparece aqui — com filtros por cliente, produto, empresa, período e mais."
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <Th>Data</Th>
                    <Th>Cliente</Th>
                    <Th>Produto</Th>
                    <Th>Empresa</Th>
                    <Th>Pagamento</Th>
                    <Th right>Venda</Th>
                    <Th right>Lucro</Th>
                    <Th>Status</Th>
                    <Th>Entrega</Th>
                    <Th right>Ações</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, limit).map((s) => {
                    const status = statusOf(s);
                    return (
                      <TableRow key={s.id} className="hover:bg-brand-cream/30">
                        <Td className="whitespace-nowrap text-brand-text/60">
                          {formatDate(s.sale_date).slice(0, 5)}
                        </Td>
                        <Td className="font-medium max-w-[130px] truncate">{s.customer_name}</Td>
                        <Td className="max-w-[140px]">
                          <div className="truncate">
                            {s.product || "—"}
                            {s.quantity > 1 && (
                              <span className="ml-1 text-brand-text/50">×{s.quantity}</span>
                            )}
                          </div>
                          {s.is_revista ? <div className="text-[9px] text-brand-pinkDark">📖 Revista</div> : null}
                        </Td>
                        <Td className="whitespace-nowrap">{empresaOf(s) || "—"}</Td>
                        <Td>
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                            {s.is_fiado ? `Fiado` : s.payment_method}
                          </Badge>
                        </Td>
                        <Td right className="font-semibold text-brand-brown whitespace-nowrap">
                          {brl(s.sale_value)}
                          {isParcial(s) && (
                            <div className="text-[10px] font-normal text-amber-700">
                              falta {brl(saldoDe(s))}
                            </div>
                          )}
                        </Td>
                        <Td right className="text-emerald-600 whitespace-nowrap">
                          {brl(profitOf(s.cost_value, s.sale_value))}
                        </Td>
                        <Td>
                          <Badge variant={statusVariant(status)} className="text-[10px] px-1.5 py-0">
                            {status}
                          </Badge>
                        </Td>
                        <Td>
                          {s.delivered ? (
                            <span title="Entregue" className="inline-flex items-center gap-1 text-emerald-600">
                              <PackageCheck className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <button
                              onClick={() => marcarEntregue(s.id)}
                              title="Marcar como entregue"
                              className="inline-flex items-center gap-0.5 text-[10px] text-brand-text/50 border border-brand-pink/40 rounded px-1.5 py-0.5 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                            >
                              <Package className="h-3 w-3" /> Entregar
                            </button>
                          )}
                        </Td>
                        <Td right>
                          <div className="flex justify-end gap-0.5">
                            {!s.paid && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => setReceber(s)}
                                title="Receber pagamento (total ou parcial)"
                              >
                                <Wallet className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(s)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:bg-red-50"
                              onClick={() => remove(s.id, s.customer_name)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > limit && (
                <div className="flex justify-center border-t border-brand-pink/30 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  >
                    Mostrar mais {Math.min(PAGE_SIZE, filtered.length - limit)} (
                    {filtered.length - limit} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receber pagamento (total ou parcial) */}
      <ReceberModal sale={receber} onClose={() => setReceber(null)} onChanged={load} />

      {/* Modal de edição */}
      <Modal
        open={!!editing}
        onClose={() => {
          setEditing(null);
          setEditForm(null);
        }}
        title={editing ? `Editar venda #${editing.id}` : ""}
      >
        {editForm && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data da venda</Label>
                <Input type="date" value={editForm.sale_date} onChange={(e) => setE("sale_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Input value={editForm.customer_name} onChange={(e) => setE("customer_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={editForm.empresa} onChange={(e) => setE("empresa", e.target.value)}>
                  {empresaOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Produto</Label>
                <Input value={editForm.product} onChange={(e) => setE("product", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Custo total (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.cost_value} onChange={(e) => setE("cost_value", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Venda total (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.sale_value} onChange={(e) => setE("sale_value", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" step="1" min="1" value={editForm.quantity} onChange={(e) => setE("quantity", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select value={editForm.payment_method} onChange={(e) => setE("payment_method", e.target.value)}>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onChange={(e) => setE("status", e.target.value)}>
                  <option value="PAGO">PAGO</option>
                  <option value="PENDENTE">PENDENTE</option>
                </Select>
                {editing && isParcial(editing) && editForm.status !== "PAGO" && (
                  <p className="text-[11px] text-amber-700">
                    Já pagou {brl(editing.amount_paid)} — fica PARCIAL enquanto faltar valor.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Data de entrega</Label>
                <Input type="date" value={editForm.delivery_date} onChange={(e) => setE("delivery_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de pagamento</Label>
                <Input type="date" value={editForm.payment_date} onChange={(e) => setE("payment_date", e.target.value)} />
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setE("is_fiado", !editForm.is_fiado)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
                    editForm.is_fiado
                      ? "border-brand-brown bg-brand-brown text-white"
                      : "border-brand-pink bg-white text-brand-text hover:bg-brand-cream"
                  )}
                >
                  {editForm.is_fiado ? "Fiado ativo" : "Marcar Fiado"}
                </button>
                <button
                  type="button"
                  onClick={() => setE("delivered", !editForm.delivered)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
                    editForm.delivered
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-brand-pink bg-white text-brand-text hover:bg-brand-cream"
                  )}
                >
                  <PackageCheck className="h-3.5 w-3.5" />
                  {editForm.delivered ? "Entregue" : "Marcar Entregue"}
                </button>
              </div>
              {editForm.is_fiado && (
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="date" value={editForm.due_date} onChange={(e) => setE("due_date", e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Input value={editForm.notes} onChange={(e) => setE("notes", e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-brand-cream/70 px-4 py-2">
              <span className="text-sm text-brand-text/60">Lucro</span>
              <span className="flex items-center gap-2">
                <strong className={editLucro >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {brl(editLucro)}
                </strong>
                <Badge variant={editLucro >= 0 ? "success" : "danger"}>
                  {editMargem.toFixed(0)}%
                </Badge>
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
              >
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
