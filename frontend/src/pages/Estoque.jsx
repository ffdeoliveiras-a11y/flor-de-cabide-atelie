import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil, Trash2, PackagePlus, X, Boxes, FileUp, FileText,
  Layers, Wallet, TrendingUp, Search, Filter,
} from "lucide-react";
import { api } from "../lib/api";
import { brl, cn } from "../lib/utils";
import { EMPRESAS } from "../lib/constants";
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
import { Loading, Spinner } from "../components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const EMPTY = {
  name: "",
  brand: "NATURA",
  cost_value: "",
  sale_value: "",
  quantity: "",
};

// situacao agora é uma lista (seleção múltipla): [] = todas
const EMPTY_FILTERS = { busca: "", empresa: "Todas", situacao: [] };
const SITUACOES = ["Sem estoque", "Baixo", "Normal"];

function StatCard({ icon: Icon, label, value, accent, hint }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-brand-text/60">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${accent || "text-brand-brown"}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-brand-text/50">{hint}</p>}
        </div>
        <span className="rounded-xl bg-brand-cream p-2.5 text-brand-brown">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function Estoque() {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [form, setForm] = usePersistentState("fc_draft_produto", EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Importação de Nota Fiscal (NFe)
  const fileRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [nfe, setNfe] = useState(null); // { empresa, supplier, numero }
  const [preview, setPreview] = useState([]); // itens editáveis
  const [importing, setImporting] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleNfeFile(e) {
    const file = e.target.files?.[0];
    if (file) await readNfe(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function readNfe(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie o PDF da nota fiscal (DANFE).");
      return;
    }
    setParsing(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await api.post("/products/parse-nfe", { pdf_base64: base64 });
      setNfe({
        empresa: data.empresa,
        supplier: data.supplier,
        numero: data.numero,
        ocr: !!data.ocr,
      });
      setPreview(
        data.items.map((it) => ({
          include: !it.isBonus, // bonificação (catálogo/guia) desmarcada por padrão
          code: it.code,
          name: it.name,
          brand: it.empresa || data.empresa || "Outros",
          cost_value: String(it.cost),
          sale_value: String(it.sale),
          quantity: String(it.quantity),
          isBonus: it.isBonus,
        }))
      );
      if (data.ocr) {
        toast.info(`Nota escaneada lida! ${data.items.length} itens — confira os valores.`);
      } else {
        toast.success(`Nota lida! ${data.items.length} itens encontrados.`);
      }
    } catch (err) {
      toast.error(err.message || "Não consegui ler esta nota.");
    } finally {
      setParsing(false);
    }
  }

  function setPv(idx, field, value) {
    setPreview((list) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function closePreview() {
    setNfe(null);
    setPreview([]);
  }

  async function confirmImport() {
    const items = preview
      .filter((it) => it.include && it.name.trim())
      .map((it) => ({
        code: it.code,
        name: it.name.trim(),
        brand: it.brand,
        cost_value: it.cost_value,
        sale_value: it.sale_value,
        quantity: it.quantity,
      }));
    if (!items.length) {
      toast.error("Marque ao menos um item para importar.");
      return;
    }
    setImporting(true);
    try {
      const res = await api.post("/products/import", { items });
      const msg = [
        res.created ? `${res.created} novo(s)` : "",
        res.updated ? `${res.updated} atualizado(s)` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(`Estoque atualizado! ${msg} 📦`);
      closePreview();
      await load();
    } catch (err) {
      toast.error(err.message || "Falha ao importar.");
    } finally {
      setImporting(false);
    }
  }

  const previewSelected = preview.filter((it) => it.include).length;

  // Filtros da lista: busca por nome, empresa e situação do estoque (múltipla)
  // Chave nova (v2): situacao mudou de texto único para lista de seleção.
  const [filters, setFilters] = usePersistentState("fc_estoque_filtros_v2", EMPTY_FILTERS);
  function setF(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }
  function toggleSituacao(value) {
    setFilters((f) => ({
      ...f,
      situacao: f.situacao.includes(value)
        ? f.situacao.filter((s) => s !== value)
        : [...f.situacao, value],
    }));
  }
  const activeFilters =
    filters.busca.trim() !== "" || filters.empresa !== "Todas" || filters.situacao.length > 0;

  const empresaOptions = useMemo(
    () => Array.from(new Set([...EMPRESAS, ...products.map((p) => p.brand).filter(Boolean)])),
    [products]
  );

  function situacaoOf(q) {
    if (q <= 0) return "Sem estoque";
    if (q <= 3) return "Baixo";
    return "Normal";
  }

  const visiveis = useMemo(() => {
    const q = filters.busca.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !(p.name || "").toLowerCase().includes(q)) return false;
      if (filters.empresa !== "Todas" && (p.brand || "Outros") !== filters.empresa) return false;
      if (
        filters.situacao.length > 0 &&
        !filters.situacao.includes(situacaoOf(Number(p.quantity) || 0))
      )
        return false;
      return true;
    });
  }, [products, filters]);

  async function load() {
    try {
      setProducts(await api.get("/products"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand || "Outros",
      cost_value: String(p.cost_value ?? ""),
      sale_value: String(p.sale_value ?? ""),
      quantity: String(p.quantity ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    try {
      if (editingId) {
        await api.patch(`/products/${editingId}`, form);
        toast.success("Produto atualizado!");
      } else {
        await api.post("/products", form);
        toast.success(`"${form.name.trim()}" adicionado ao estoque! 📦`);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
      toast.error("Não foi possível salvar o produto.");
    }
  }

  async function remove(id, name) {
    const ok = await confirm({
      title: "Excluir produto?",
      message: `"${name}" será removido do estoque. Esta ação não pode ser desfeita.`,
      confirmText: "Sim, excluir",
      danger: true,
    });
    if (!ok) return;
    await api.del(`/products/${id}`);
    if (editingId === id) cancelEdit();
    await load();
    toast.info("Produto excluído.");
  }

  function stockBadge(q) {
    if (q <= 0) return <Badge variant="danger">Sem estoque</Badge>;
    if (q <= 3) return <Badge variant="default">Baixo · {q}</Badge>;
    return <Badge variant="success">{q} un.</Badge>;
  }

  // Resumo do estoque — soma dos produtos FILTRADOS (visiveis), não do total
  // cadastrado. Sem filtro ativo, visiveis === products, então os números
  // continuam batendo com o estoque inteiro.
  const resumo = useMemo(() => {
    let unidades = 0,
      valorCusto = 0,
      valorVenda = 0,
      semEstoque = 0,
      baixoEstoque = 0;
    for (const p of visiveis) {
      const q = Number(p.quantity) || 0;
      unidades += q;
      valorCusto += q * (Number(p.cost_value) || 0);
      valorVenda += q * (Number(p.sale_value) || 0);
      if (q <= 0) semEstoque++;
      else if (q <= 3) baixoEstoque++;
    }
    return {
      itens: visiveis.length,
      unidades,
      valorCusto,
      valorVenda,
      lucroPotencial: valorVenda - valorCusto,
      semEstoque,
      baixoEstoque,
    };
  }, [visiveis]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-brand-brown">Estoque</h2>
        <p className="text-sm text-brand-text/60">
          Cadastre seus produtos para selecioná-los rapidamente na hora da venda.
        </p>
      </div>

      {/* Resumo do estoque */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Boxes}
            label="Itens cadastrados"
            value={resumo.itens}
            hint={`${resumo.unidades} unidades no total`}
          />
          <StatCard
            icon={Layers}
            label="Unidades em estoque"
            value={resumo.unidades}
            accent="text-brand-brown"
            hint={
              resumo.semEstoque > 0 || resumo.baixoEstoque > 0
                ? `${resumo.semEstoque} sem estoque · ${resumo.baixoEstoque} baixo`
                : "estoque saudável"
            }
          />
          <StatCard
            icon={Wallet}
            label="Valor investido"
            value={brl(resumo.valorCusto)}
            accent="text-brand-brown"
            hint="Custo total parado em estoque"
          />
          <StatCard
            icon={TrendingUp}
            label="Valor do Estoque pelo Potencial de Venda"
            value={brl(resumo.valorVenda)}
            accent="text-emerald-600"
            hint={`Lucro potencial ${brl(resumo.lucroPotencial)}`}
          />
        </div>
      )}

      {/* Importar Nota Fiscal */}
      <Card>
        <CardContent className="p-5">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleNfeFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-pink/60 bg-brand-cream/30 px-6 py-7 text-center transition-colors hover:border-brand-brown hover:bg-brand-cream/60 disabled:opacity-60"
          >
            {parsing ? (
              <>
                <Spinner className="h-7 w-7" />
                <span className="text-sm font-medium text-brand-text">
                  Lendo a nota fiscal… (nota escaneada pode levar até 1 minuto)
                </span>
              </>
            ) : (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-brown text-white">
                  <FileUp className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-brand-brown">
                  Importar Nota Fiscal (PDF)
                </span>
                <span className="max-w-md text-xs text-brand-text/55">
                  Envie o PDF da DANFE (O Boticário, Natura/Avon, Eudora…). Funciona até com
                  nota <strong>escaneada</strong> (CamScanner) — nesse caso a leitura demora
                  ~1 minuto e você confere os valores antes de salvar.
                </span>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* Formulário de cadastro / edição */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {editingId ? "Editar produto" : "Cadastrar produto"}
          </CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4" /> Cancelar edição
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Produto</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex.: Perfume Essencial"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={form.brand} onChange={(e) => set("brand", e.target.value)}>
                  {EMPRESAS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost_value}
                  onChange={(e) => set("cost_value", e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sale_value}
                  onChange={(e) => set("sale_value", e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Qtd. em estoque</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-5">
              <Button type="submit">
                <PackagePlus className="h-4 w-4" />
                {editingId ? "Salvar alterações" : "Adicionar ao estoque"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filtros */}
      {products.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-3">
              <Filter className="mb-1.5 h-4 w-4 shrink-0 text-brand-brown" />
              <div className="relative space-y-0.5">
                <Label className="text-[11px]">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/40" />
                  <Input
                    value={filters.busca}
                    onChange={(e) => setF("busca", e.target.value)}
                    placeholder="Nome do produto…"
                    className="h-9 w-52 pl-8"
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Empresa</Label>
                <Select
                  className="h-9"
                  value={filters.empresa}
                  onChange={(e) => setF("empresa", e.target.value)}
                >
                  <option>Todas</option>
                  {empresaOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Situação (várias)</Label>
                <div className="flex h-9 items-center gap-1">
                  {SITUACOES.map((s) => {
                    const active = filters.situacao.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSituacao(s)}
                        aria-pressed={active}
                        className={cn(
                          "h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                          active
                            ? "border-brand-brown bg-brand-brown text-white"
                            : "border-brand-pink/50 bg-white text-brand-text/70 hover:bg-brand-cream"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              {activeFilters && (
                <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <X className="h-4 w-4" /> Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista do estoque */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Produtos cadastrados</CardTitle>
          <span className="text-sm text-brand-text/60">
            {activeFilters
              ? `${visiveis.length} de ${products.length} itens`
              : `${products.length} ${products.length === 1 ? "item" : "itens"}`}{" "}
            · {resumo.unidades} un. ·{" "}
            <strong className="text-brand-brown">{brl(resumo.valorCusto)}</strong> investidos
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : products.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Seu estoque está vazio"
              hint="Cadastre seus produtos acima (nome, empresa e valores). Depois é só buscá-los na hora da venda — o sistema preenche tudo e baixa o estoque sozinho."
            />
          ) : visiveis.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum produto com esses filtros"
              hint="Tente ajustar a busca, a empresa ou a situação do estoque."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <X className="h-4 w-4" /> Limpar filtros
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.brand || "—"}</TableCell>
                    <TableCell className="text-right text-brand-text/60">
                      {brl(p.cost_value)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-brand-brown">
                      {brl(p.sale_value)}
                    </TableCell>
                    <TableCell>{stockBadge(p.quantity)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(p.id, p.name)}
                          className="text-red-500 hover:bg-red-50"
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

      {/* Pré-visualização da Nota Fiscal */}
      <Modal
        open={!!nfe}
        onClose={closePreview}
        size="wide"
        title="Conferir produtos da nota fiscal"
      >
        {nfe && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-brand-text/70">
              <FileText className="h-4 w-4 text-brand-brown" />
              {nfe.numero && <span>Nota <strong>nº {nfe.numero}</strong></span>}
              {nfe.supplier && <span>· {nfe.supplier}</span>}
              <Badge variant="default">{nfe.empresa}</Badge>
            </div>

            {nfe.ocr && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                📷 <strong>Nota escaneada, lida por OCR.</strong> Os nomes e códigos vêm
                bem, mas o escaneamento costuma errar números —{" "}
                <strong>confira quantidade, custo e venda de cada item</strong> antes de
                adicionar. Valores em R$ 0,00 = não consegui ler, preencha você.
              </div>
            )}
            <p className="text-xs text-brand-text/55">
              Confira e ajuste se precisar. <strong>Custo</strong> = o que você paga ·{" "}
              <strong>Venda</strong> = preço de catálogo ao cliente. Itens de bonificação
              (catálogo, guia, refil) vêm desmarcados — marque se quiser controlá-los.
            </p>

            <div className="overflow-x-auto rounded-xl border border-brand-pink/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-cream/60 text-left text-[11px] uppercase tracking-wide text-brand-text/60">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-2 py-2">Produto</th>
                    <th className="px-2 py-2">Empresa</th>
                    <th className="px-2 py-2 text-right">Custo</th>
                    <th className="px-2 py-2 text-right">Venda</th>
                    <th className="px-2 py-2 text-center">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((it, i) => (
                    <tr
                      key={i}
                      className={`border-t border-brand-pink/30 ${it.include ? "" : "opacity-50"}`}
                    >
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={it.include}
                          onChange={(e) => setPv(i, "include", e.target.checked)}
                          className="h-4 w-4 accent-brand-brown"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={it.name}
                          onChange={(e) => setPv(i, "name", e.target.value)}
                          className="w-full min-w-[180px] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-brand-pink/50 focus:border-brand-brown focus:bg-white focus:outline-none"
                        />
                        {it.isBonus && (
                          <span className="ml-1 text-[10px] text-brand-pinkDark">bonificação</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={it.brand}
                          onChange={(e) => setPv(i, "brand", e.target.value)}
                          className="rounded-md border border-brand-pink/50 bg-white px-1.5 py-1 text-xs"
                        >
                          {EMPRESAS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.cost_value}
                          onChange={(e) => setPv(i, "cost_value", e.target.value)}
                          className="w-20 rounded-md border border-brand-pink/50 bg-white px-1.5 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.sale_value}
                          onChange={(e) => setPv(i, "sale_value", e.target.value)}
                          className="w-20 rounded-md border border-brand-pink/50 bg-white px-1.5 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={it.quantity}
                          onChange={(e) => setPv(i, "quantity", e.target.value)}
                          className="w-14 rounded-md border border-brand-pink/50 bg-white px-1.5 py-1 text-center text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-sm text-brand-text/60">
                {previewSelected} de {preview.length} itens selecionados
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closePreview} disabled={importing}>
                  Cancelar
                </Button>
                <Button onClick={confirmImport} disabled={importing || previewSelected === 0}>
                  {importing ? "Adicionando…" : `Adicionar ${previewSelected} ao estoque`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
