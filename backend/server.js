// ============================================================================
//  Flor de Cabide Ateliê — API REST
//  Node.js + Express + SQLite (node:sqlite) — roda em http://localhost:3001
// ============================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { PDFParse } = require("pdf-parse");
const { parseNFe, parseNFeOCR } = require("./nfe");
const { ocrPdf } = require("./ocr");

const app = express();
// Uma porta só: serve o app (frontend compilado) + a API juntos.
const PORT = process.env.PORT || 5173;
// Em produção, defina JWT_SECRET como variável de ambiente. Localmente, mantém
// o valor padrão para não quebrar o uso atual.
const JWT_SECRET = process.env.JWT_SECRET || "flor-de-cabide-atelie-secret-key";

app.use(cors());
// limite maior p/ receber o PDF da nota fiscal em base64
app.use(express.json({ limit: "20mb" }));

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
const CURRENT_MONTH = "strftime('%Y-%m', 'now', 'localtime')";
const TODAY = "date('now', 'localtime')";

function localDateISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

// ---------------------------------------------------------------------------
//  AUTH
// ---------------------------------------------------------------------------
app.post("/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado" });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, password_hash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "E-mail ou senha incorretos" });

  res.json({ token: sign(user), user: publicUser(user) });
});

// ---------------------------------------------------------------------------
//  CUSTOMERS  (com busca por nome para autocomplete)
// ---------------------------------------------------------------------------
app.get("/customers", authRequired, (req, res) => {
  const q = (req.query.q || "").trim();
  const rows = q
    ? db
        .prepare("SELECT * FROM customers WHERE name LIKE ? ORDER BY name LIMIT 10")
        .all(`%${q}%`)
    : db.prepare("SELECT * FROM customers ORDER BY name").all();
  res.json(rows);
});

app.post("/customers", authRequired, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !name.trim())
    return res.status(400).json({ error: "Nome da cliente é obrigatório" });
  res.status(201).json(resolveCustomer(name, phone));
});

function resolveCustomer(name, phone) {
  const clean = (name || "").trim();
  if (!clean) return null;
  let customer = db
    .prepare("SELECT * FROM customers WHERE name = ? COLLATE NOCASE")
    .get(clean);
  if (!customer) {
    const info = db
      .prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
      .run(clean, phone || null);
    customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid);
  }
  return customer;
}

// ---------------------------------------------------------------------------
//  PRODUCTS  (estoque)
// ---------------------------------------------------------------------------
app.get("/products", authRequired, (req, res) => {
  const q = (req.query.q || "").trim();
  const rows = q
    ? db
        .prepare("SELECT * FROM products WHERE name LIKE ? ORDER BY name LIMIT 15")
        .all(`%${q}%`)
    : db.prepare("SELECT * FROM products ORDER BY name").all();
  res.json(rows);
});

app.post("/products", authRequired, (req, res) => {
  const { name, brand, category, cost_value, sale_value, quantity } = req.body || {};
  if (!name || !name.trim())
    return res.status(400).json({ error: "Nome do produto é obrigatório" });

  const info = db
    .prepare(
      `INSERT INTO products (name, brand, category, cost_value, sale_value, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      brand || null,
      category || null,
      Number(cost_value) || 0,
      Number(sale_value) || 0,
      parseInt(quantity, 10) || 0
    );
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid));
});

app.patch("/products/:id", authRequired, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Produto não encontrado" });

  const { name, brand, category, cost_value, sale_value, quantity } = req.body || {};
  db.prepare(
    `UPDATE products SET name = ?, brand = ?, category = ?, cost_value = ?, sale_value = ?, quantity = ? WHERE id = ?`
  ).run(
    name !== undefined ? name.trim() : existing.name,
    brand !== undefined ? brand : existing.brand,
    category !== undefined ? category : existing.category,
    cost_value !== undefined ? Number(cost_value) || 0 : existing.cost_value,
    sale_value !== undefined ? Number(sale_value) || 0 : existing.sale_value,
    quantity !== undefined ? parseInt(quantity, 10) || 0 : existing.quantity,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id));
});

app.delete("/products/:id", authRequired, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
//  NFe — ler nota fiscal (PDF) e pré-visualizar produtos para o estoque
// ---------------------------------------------------------------------------
// Recebe { pdf_base64 } e devolve os itens lidos (sem gravar nada ainda).
app.post("/products/parse-nfe", authRequired, async (req, res) => {
  try {
    const { pdf_base64 } = req.body || {};
    if (!pdf_base64) return res.status(400).json({ error: "Envie o PDF da nota." });

    const base64 = pdf_base64.includes(",") ? pdf_base64.split(",")[1] : pdf_base64;
    const buffer = Buffer.from(base64, "base64");

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    // Nota escaneada / foto: PDF sem texto extraível → tenta OCR
    const meaningful = (result.text || "")
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
      .trim();
    if (meaningful.length < 80) {
      try {
        const ocrText = await ocrPdf(buffer);
        const parsedOcr = parseNFeOCR(ocrText);
        if (parsedOcr.items.length) {
          return res.json({ ...parsedOcr, ocr: true });
        }
      } catch (err) {
        console.error("OCR:", err.message);
      }
      return res.status(422).json({
        error:
          "Não consegui ler esta nota escaneada. Tente escanear com mais luz e a folha reta (ou envie o PDF digital da DANFE, se tiver).",
      });
    }

    const parsed = parseNFe(result.text);
    if (!parsed.items.length)
      return res.status(422).json({
        error:
          "Não consegui ler os produtos desta nota. Confira se é o PDF da DANFE (nota fiscal).",
      });

    res.json(parsed);
  } catch (err) {
    console.error("parse-nfe:", err.message);
    res.status(500).json({ error: "Não foi possível ler o PDF da nota." });
  }
});

// Importa de fato os itens confirmados para o estoque.
// Cada item: { code, name, brand/empresa, cost_value, sale_value, quantity }
// Casa por código (se houver) ou por nome: se já existe, SOMA a quantidade.
app.post("/products/import", authRequired, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Nenhum item para importar." });

  let created = 0;
  let updated = 0;

  const findByCode = db.prepare("SELECT * FROM products WHERE code = ? LIMIT 1");
  const findByName = db.prepare("SELECT * FROM products WHERE name = ? COLLATE NOCASE LIMIT 1");
  const insert = db.prepare(
    `INSERT INTO products (name, brand, category, code, cost_value, sale_value, quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE products SET quantity = quantity + ?, cost_value = ?, sale_value = ?,
       brand = ?, code = COALESCE(code, ?) WHERE id = ?`
  );

  db.exec("BEGIN");
  try {
    for (const it of items) {
      const name = (it.name || "").trim();
      if (!name) continue;
      const brand = it.brand || it.empresa || null;
      const code = it.code ? String(it.code) : null;
      const cost = Number(it.cost_value ?? it.cost) || 0;
      const sale = Number(it.sale_value ?? it.sale) || 0;
      const qty = parseInt(it.quantity, 10) || 0;

      let existing = code ? findByCode.get(code) : null;
      if (!existing) existing = findByName.get(name);

      if (existing) {
        update.run(qty, cost, sale, brand, code, existing.id);
        updated++;
      } else {
        insert.run(name, brand, it.category || null, code, cost, sale, qty);
        created++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("import:", err.message);
    return res.status(500).json({ error: "Falha ao importar os itens." });
  }

  res.json({ ok: true, created, updated });
});

// ---------------------------------------------------------------------------
//  SALES
// ---------------------------------------------------------------------------
// GET /sales                 -> todas as vendas
// GET /sales?date=today      -> vendas de hoje
// GET /sales?date=YYYY-MM-DD -> vendas de um dia específico
app.get("/sales", authRequired, (req, res) => {
  const { date } = req.query;
  let rows;
  if (date === "today") {
    rows = db.prepare(`SELECT * FROM sales WHERE sale_date = ${TODAY} ORDER BY id DESC`).all();
  } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    rows = db.prepare("SELECT * FROM sales WHERE sale_date = ? ORDER BY id DESC").all(date);
  } else {
    rows = db.prepare("SELECT * FROM sales ORDER BY id DESC").all();
  }
  res.json(rows);
});

app.post("/sales", authRequired, (req, res) => {
  const {
    customer_name,
    empresa,
    brand,
    category,
    product,
    product_id,
    cost_value,
    sale_value,
    payment_method,
    is_fiado,
    due_date,
    sale_date,
    delivery_date,
    payment_date,
    status,
    notes,
    delivered,
    is_revista,
    quantity,
  } = req.body || {};

  if (!customer_name || !payment_method)
    return res.status(400).json({ error: "Cliente e forma de pagamento são obrigatórios" });

  const customer = resolveCustomer(customer_name);
  const fiado = is_fiado ? 1 : 0;
  const revista = is_revista ? 1 : 0;
  const saleDate = sale_date || localDateISO();
  const empresaVal = empresa || brand || null;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  // Status define o recebimento; sem status, deriva do fiado.
  const finalStatus = status || (fiado ? "PENDENTE" : "PAGO");
  const paid = String(finalStatus).toUpperCase() === "PAGO" ? 1 : 0;

  const info = db
    .prepare(
      `INSERT INTO sales
        (customer_id, customer_name, empresa, brand, category, product, product_id,
         cost_value, sale_value, payment_method, is_fiado, due_date, sale_date,
         delivery_date, payment_date, status, notes, paid, delivered, is_revista, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      customer ? customer.id : null,
      customer ? customer.name : customer_name.trim(),
      empresaVal,
      empresaVal,
      category || null,
      product || null,
      product_id || null,
      Number(cost_value) || 0,
      Number(sale_value) || 0,
      payment_method,
      fiado,
      fiado ? due_date || null : null,
      saleDate,
      delivery_date || null,
      payment_date || null,
      finalStatus,
      notes || null,
      paid,
      delivered ? 1 : 0,
      revista,
      qty
    );

  // Baixa no estoque apenas se produto do cadastro e não for Pedido Revista
  if (product_id && !revista) {
    db.prepare("UPDATE products SET quantity = MAX(0, quantity - ?) WHERE id = ?").run(qty, product_id);
  }

  res.status(201).json(db.prepare("SELECT * FROM sales WHERE id = ?").get(info.lastInsertRowid));
});

// Editar uma venda já cadastrada
app.patch("/sales/:id", authRequired, (req, res) => {
  const existing = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Venda não encontrada" });

  const {
    customer_name,
    empresa,
    brand,
    category,
    product,
    product_id,
    cost_value,
    sale_value,
    payment_method,
    is_fiado,
    due_date,
    sale_date,
    delivery_date,
    payment_date,
    status,
    notes,
    delivered,
    is_revista,
    quantity,
  } = req.body || {};

  const customer = customer_name ? resolveCustomer(customer_name) : null;
  const fiado = is_fiado ? 1 : 0;
  // Status explícito tem prioridade; senão à vista=PAGO e fiado preserva a baixa.
  let finalStatus, paid;
  if (status) {
    finalStatus = status;
    paid = String(status).toUpperCase() === "PAGO" ? 1 : 0;
  } else if (!fiado) {
    finalStatus = "PAGO";
    paid = 1;
  } else {
    paid = existing.paid;
    finalStatus = paid ? "PAGO" : "PENDENTE";
  }
  const empresaVal =
    empresa !== undefined ? empresa : brand !== undefined ? brand : existing.empresa;

  db.prepare(
    `UPDATE sales SET
       customer_id = ?, customer_name = ?, empresa = ?, brand = ?, category = ?,
       product = ?, product_id = ?, cost_value = ?, sale_value = ?, payment_method = ?,
       is_fiado = ?, due_date = ?, sale_date = ?, delivery_date = ?, payment_date = ?,
       status = ?, notes = ?, paid = ?, delivered = ?, is_revista = ?, quantity = ?
     WHERE id = ?`
  ).run(
    customer ? customer.id : existing.customer_id,
    customer ? customer.name : existing.customer_name,
    empresaVal,
    empresaVal,
    category !== undefined ? category : existing.category,
    product !== undefined ? product : existing.product,
    product_id !== undefined ? product_id || null : existing.product_id,
    cost_value !== undefined ? Number(cost_value) || 0 : existing.cost_value,
    sale_value !== undefined ? Number(sale_value) || 0 : existing.sale_value,
    payment_method || existing.payment_method,
    fiado,
    fiado ? due_date || null : null,
    sale_date || existing.sale_date,
    delivery_date !== undefined ? delivery_date || null : existing.delivery_date,
    payment_date !== undefined ? payment_date || null : existing.payment_date,
    finalStatus,
    notes !== undefined ? notes : existing.notes,
    paid,
    delivered !== undefined ? (delivered ? 1 : 0) : existing.delivered,
    is_revista !== undefined ? (is_revista ? 1 : 0) : existing.is_revista,
    quantity !== undefined ? Math.max(1, parseInt(quantity, 10) || 1) : existing.quantity,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id));
});

// Excluir uma venda — devolve ao estoque só se não for Pedido Revista
app.delete("/sales/:id", authRequired, (req, res) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id);
  if (!sale) return res.json({ ok: true });

  if (sale.product_id && !sale.is_revista) {
    const qty = Math.max(1, sale.quantity || 1);
    db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(qty, sale.product_id);
  }
  db.prepare("DELETE FROM sales WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Marcar entrega do pedido
app.patch("/sales/:id/entrega", authRequired, (req, res) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id);
  if (!sale) return res.status(404).json({ error: "Venda não encontrada" });
  db.prepare("UPDATE sales SET delivered = 1 WHERE id = ?").run(req.params.id);
  res.json(db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id));
});

// Dar baixa no fiado (marca como recebido)
app.patch("/sales/:id/baixa", authRequired, (req, res) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id);
  if (!sale) return res.status(404).json({ error: "Venda não encontrada" });

  db.prepare(
    `UPDATE sales SET paid = 1, status = 'PAGO', paid_at = datetime('now','localtime') WHERE id = ?`
  ).run(req.params.id);
  res.json(db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id));
});

// Resumo financeiro do mês atual
app.get("/sales/summary", authRequired, (req, res) => {
  const grossRow = db
    .prepare(
      `SELECT COALESCE(SUM(sale_value), 0) AS total
         FROM sales
        WHERE strftime('%Y-%m', sale_date) = ${CURRENT_MONTH}`
    )
    .get();

  // Lucro das vendas recebidas no mês (status PAGO)
  const profitRow = db
    .prepare(
      `SELECT COALESCE(SUM(sale_value - cost_value), 0) AS total
         FROM sales
        WHERE strftime('%Y-%m', sale_date) = ${CURRENT_MONTH}
          AND paid = 1`
    )
    .get();

  const billsPaidRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM bills_to_pay
        WHERE paid = 1
          AND strftime('%Y-%m', COALESCE(paid_at, created_at)) = ${CURRENT_MONTH}`
    )
    .get();

  // Inadimplência — fiados vencidos e ainda não pagos
  const defaultRow = db
    .prepare(
      `SELECT COALESCE(SUM(sale_value), 0) AS total
         FROM sales
        WHERE is_fiado = 1
          AND paid = 0
          AND due_date IS NOT NULL
          AND date(due_date) < ${TODAY}`
    )
    .get();

  // Margem média histórica (lucro / faturamento)
  const marginRow = db
    .prepare(
      `SELECT COALESCE(SUM(sale_value), 0) AS revenue,
              COALESCE(SUM(sale_value - cost_value), 0) AS profit
         FROM sales
        WHERE sale_value > 0`
    )
    .get();

  const avgMargin = marginRow.revenue > 0 ? marginRow.profit / marginRow.revenue : 0;

  res.json({
    gross_revenue: grossRow.total,
    net_profit: profitRow.total - billsPaidRow.total,
    bills_paid: billsPaidRow.total,
    default_amount: defaultRow.total,
    avg_margin: avgMargin,
    month: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  });
});

// ---------------------------------------------------------------------------
//  BILLS TO PAY
// ---------------------------------------------------------------------------
app.get("/bills-to-pay", authRequired, (req, res) => {
  res.json(db.prepare("SELECT * FROM bills_to_pay ORDER BY paid ASC, due_date ASC").all());
});

app.post("/bills-to-pay", authRequired, (req, res) => {
  const { supplier, amount, due_date } = req.body || {};
  if (!supplier || !supplier.trim())
    return res.status(400).json({ error: "Fornecedor é obrigatório" });

  const info = db
    .prepare("INSERT INTO bills_to_pay (supplier, amount, due_date) VALUES (?, ?, ?)")
    .run(supplier.trim(), Number(amount) || 0, due_date || null);
  res
    .status(201)
    .json(db.prepare("SELECT * FROM bills_to_pay WHERE id = ?").get(info.lastInsertRowid));
});

// Edita qualquer campo da conta (fornecedor/valor/vencimento) e/ou o status de
// pago. Passar só { paid: true } continua funcionando (usado pelo botão
// "Marcar como Pago"); passar supplier/amount/due_date edita a conta.
app.patch("/bills-to-pay/:id", authRequired, (req, res) => {
  const bill = db.prepare("SELECT * FROM bills_to_pay WHERE id = ?").get(req.params.id);
  if (!bill) return res.status(404).json({ error: "Boleto não encontrado" });

  const { supplier, amount, due_date, paid } = req.body || {};
  const nextPaid = paid !== undefined ? (paid ? 1 : 0) : bill.paid;
  const nextSupplier =
    supplier !== undefined ? String(supplier).trim() || bill.supplier : bill.supplier;
  const nextAmount = amount !== undefined ? Number(amount) || 0 : bill.amount;
  const nextDueDate = due_date !== undefined ? due_date || null : bill.due_date;

  db.prepare(
    `UPDATE bills_to_pay
        SET supplier = ?, amount = ?, due_date = ?, paid = ?,
            paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, datetime('now','localtime')) ELSE NULL END
      WHERE id = ?`
  ).run(nextSupplier, nextAmount, nextDueDate, nextPaid, nextPaid, req.params.id);

  res.json(db.prepare("SELECT * FROM bills_to_pay WHERE id = ?").get(req.params.id));
});

// ---------------------------------------------------------------------------
//  Servir o app já compilado (frontend/dist) na mesma porta da API
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "Flor de Cabide" })
);

// Endereço do sistema na rede local (para acessar pelo celular via QR code)
app.get("/api/lan-address", authRequired, (_req, res) => {
  const nets = os.networkInterfaces();
  let ip = null;
  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) {
        if (!ip || /wi-?fi/i.test(name)) ip = net.address; // prefere Wi-Fi
      }
    }
  }
  res.json({ ip, port: PORT, url: ip ? `http://${ip}:${PORT}` : null });
});

const DIST = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(DIST));
// Qualquer rota que não seja da API devolve o app (SPA / React Router)
app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));

// ---------------------------------------------------------------------------
//  Backup automático do banco — uma cópia por dia em backend/backups,
//  mantendo as últimas 14. Roda ao iniciar e a cada 24h.
// ---------------------------------------------------------------------------
const BACKUP_DIR = path.join(__dirname, "backups");
function backupDatabase() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `flordecabide-${stamp}.db`);
    fs.copyFileSync(path.join(__dirname, "flordecabide.db"), dest);
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("flordecabide-") && f.endsWith(".db"))
      .sort();
    while (files.length > 14) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    console.log(`✦ Backup do banco salvo: ${dest}`);
  } catch (err) {
    console.error("Backup falhou:", err.message);
  }
}
backupDatabase();
setInterval(backupDatabase, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`✦ Flor de Cabide rodando em http://localhost:${PORT}`);
});
