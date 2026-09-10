// Banco de dados SQLite embutido — usa o módulo nativo `node:sqlite`
// que já vem dentro do Node.js (zero instalação, zero compilação).
// O arquivo flordecabide.db é criado automaticamente na primeira execução.
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(path.join(__dirname, "flordecabide.db"));
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    phone      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    brand      TEXT,
    category   TEXT,
    cost_value REAL    NOT NULL DEFAULT 0,
    sale_value REAL    NOT NULL DEFAULT 0,
    quantity   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER REFERENCES customers(id),
    customer_name  TEXT    NOT NULL,
    empresa        TEXT,
    brand          TEXT,
    category       TEXT,
    product        TEXT,
    product_id     INTEGER REFERENCES products(id),
    cost_value     REAL    NOT NULL DEFAULT 0,
    sale_value     REAL    NOT NULL DEFAULT 0,
    payment_method TEXT    NOT NULL,
    is_fiado       INTEGER NOT NULL DEFAULT 0,
    due_date       TEXT,
    sale_date      TEXT,
    delivery_date  TEXT,
    payment_date   TEXT,
    status         TEXT,
    notes          TEXT,
    external_id    INTEGER,
    paid           INTEGER NOT NULL DEFAULT 0,
    paid_at        TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS bills_to_pay (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier   TEXT    NOT NULL,
    amount     REAL    NOT NULL DEFAULT 0,
    due_date   TEXT,
    paid       INTEGER NOT NULL DEFAULT 0,
    paid_at    TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// ---------------------------------------------------------------------------
//  Migrações leves para bancos já existentes (adiciona colunas novas)
// ---------------------------------------------------------------------------
function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}
function ensureColumn(table, col, ddl) {
  if (!columns(table).includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("sales", "product_id", "product_id INTEGER");
ensureColumn("sales", "is_fiado", "is_fiado INTEGER NOT NULL DEFAULT 0");
ensureColumn("sales", "sale_date", "sale_date TEXT");
// Campos vindos da planilha de controle de vendas
ensureColumn("sales", "empresa", "empresa TEXT");
ensureColumn("sales", "category", "category TEXT");
ensureColumn("sales", "delivery_date", "delivery_date TEXT");
ensureColumn("sales", "payment_date", "payment_date TEXT");
ensureColumn("sales", "status", "status TEXT");
ensureColumn("sales", "notes", "notes TEXT");
ensureColumn("sales", "external_id", "external_id INTEGER");
ensureColumn("products", "category", "category TEXT");
// Código do produto na nota fiscal (para casar itens ao importar NFe)
ensureColumn("products", "code", "code TEXT");
// Campos de entrega e tipo de pedido
ensureColumn("sales", "delivered", "delivered INTEGER NOT NULL DEFAULT 0");
ensureColumn("sales", "is_revista", "is_revista INTEGER NOT NULL DEFAULT 0");
// Quantidade de unidades da venda (cost_value/sale_value guardam o TOTAL da
// linha, não o valor unitário — quantity é só p/ baixa de estoque e exibição)
ensureColumn("sales", "quantity", "quantity INTEGER NOT NULL DEFAULT 1");
// Baixa parcial: soma do que a cliente já pagou (cache de sale_payments)
ensureColumn("sales", "amount_paid", "amount_paid REAL NOT NULL DEFAULT 0");

// Pagamentos recebidos por venda (cliente que paga "picado": 50 + 50)
db.exec(`
  CREATE TABLE IF NOT EXISTS sale_payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id    INTEGER NOT NULL REFERENCES sales(id),
    amount     REAL    NOT NULL DEFAULT 0,
    paid_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
`);

// Backfill: data da venda a partir do created_at e flag de fiado legado
db.exec("UPDATE sales SET sale_date = date(created_at) WHERE sale_date IS NULL");
db.exec("UPDATE sales SET is_fiado = 1 WHERE payment_method = 'Fiado' AND is_fiado = 0");
// Empresa a partir da marca antiga; status a partir do pago
db.exec("UPDATE sales SET empresa = brand WHERE empresa IS NULL");
db.exec("UPDATE sales SET status = 'PAGO' WHERE status IS NULL AND paid = 1");
db.exec("UPDATE sales SET status = 'PENDENTE' WHERE status IS NULL AND paid = 0");

module.exports = db;
