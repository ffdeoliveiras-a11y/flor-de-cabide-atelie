# -*- coding: utf-8 -*-
"""Importa a aba '📝 VENDAS' da planilha de controle para o SQLite do sistema.
Idempotente: remove importações anteriores (external_id != NULL) antes de inserir.
"""
import openpyxl, sqlite3, datetime, re, os, sys

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flordecabide.db")
XLSX = r"C:\Users\ADM\Desktop\Controle_Vendas_Flor_de_Cabide_2026.xlsx"


def parse_date(v):
    if v is None:
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if not s:
        return None
    toks = [t for t in re.split(r"[^0-9]+", s) if t]
    day = month = year = None
    if len(toks) >= 3:
        day, month, year = toks[0], toks[1], toks[2]
    elif len(toks) == 2:
        a, b = toks
        if len(a) == 4:        # ddmm + yyyy
            day, month, year = a[:2], a[2:], b
        elif len(b) == 6:      # dd + mmyyyy
            day, month, year = a, b[:2], b[2:]
        elif len(b) == 4:      # dd/mm + yyyy faltando -> assume dia/ano
            day, month, year = a, b[:2], b
        else:
            return None
    elif len(toks) == 1 and len(toks[0]) == 8:
        t = toks[0]
        day, month, year = t[:2], t[2:4], t[4:]
    else:
        return None
    try:
        d, m, y = int(day), int(month), int(year)
    except ValueError:
        return None
    if y < 100:
        y += 2000
    if not (1 <= m <= 12 and 1 <= d <= 31 and 2020 <= y <= 2030):
        return None
    try:
        return datetime.date(y, m, d).strftime("%Y-%m-%d")
    except ValueError:
        return None


PAY_MAP = {
    "PIX": "Pix",
    "DINHEIRO": "Dinheiro",
    "CARTÃO CRÉDITO": "Cartão de Crédito",
    "CARTAO CREDITO": "Cartão de Crédito",
    "CARTÃO DE CRÉDITO": "Cartão de Crédito",
    "CARTÃO DÉBITO": "Cartão de Débito",
    "CARTAO DEBITO": "Cartão de Débito",
    "CARTÃO DE DÉBITO": "Cartão de Débito",
    "BOLETO": "Boleto",
    "FIADO": "Fiado",
    "OUTRO": "Outro",
}


def norm_pay(v):
    s = (str(v).strip().upper() if v is not None else "")
    return PAY_MAP.get(s, (str(v).strip() if v else "Outro"))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# ---- ler planilha ----------------------------------------------------------
wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
ws = wb["📝 VENDAS"]
rows = list(ws.iter_rows(values_only=True))
data = rows[3:]

records = []
for r in data:
    _id = r[0]
    if _id is None:
        continue
    cliente = (str(r[6]).strip() if r[6] is not None else "")
    if not cliente:
        continue
    empresa = (str(r[1]).strip() if r[1] is not None else None)
    sale_date = parse_date(r[2]) or parse_date(r[3]) or parse_date(r[4])
    delivery_date = parse_date(r[3])
    payment_date = parse_date(r[4])
    pay = norm_pay(r[5])
    product = (str(r[7]).strip() if r[7] is not None else None)
    category = (str(r[8]).strip() if r[8] is not None else None)
    cost = num(r[9])
    sale = num(r[10])
    status = (str(r[13]).strip().upper() if r[13] is not None else "PENDENTE")
    notes = (str(r[14]).strip() if r[14] is not None else None)
    is_fiado = 1 if pay == "Fiado" else 0
    paid = 1 if status == "PAGO" else 0
    records.append({
        "external_id": int(_id),
        "customer_name": cliente,
        "empresa": empresa,
        "category": category,
        "product": product,
        "cost": cost,
        "sale": sale,
        "pay": pay,
        "is_fiado": is_fiado,
        "sale_date": sale_date,
        "delivery_date": delivery_date,
        "payment_date": payment_date,
        "status": status,
        "notes": notes,
        "paid": paid,
        "paid_at": payment_date if paid else None,
    })

# ---- conectar e garantir colunas ------------------------------------------
con = sqlite3.connect(DB)
cur = con.cursor()


def cols(table):
    return [c[1] for c in cur.execute(f"PRAGMA table_info({table})").fetchall()]


for table, col, ddl in [
    ("sales", "empresa", "empresa TEXT"),
    ("sales", "category", "category TEXT"),
    ("sales", "delivery_date", "delivery_date TEXT"),
    ("sales", "payment_date", "payment_date TEXT"),
    ("sales", "status", "status TEXT"),
    ("sales", "notes", "notes TEXT"),
    ("sales", "external_id", "external_id INTEGER"),
    ("sales", "delivered", "delivered INTEGER NOT NULL DEFAULT 0"),
    ("sales", "is_revista", "is_revista INTEGER NOT NULL DEFAULT 0"),
    ("products", "category", "category TEXT"),
]:
    if col not in cols(table):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")

# ---- remover importações anteriores ---------------------------------------
cur.execute("DELETE FROM sales WHERE external_id IS NOT NULL")

# ---- garantir clientes -----------------------------------------------------
existing = {row[0].lower(): row[1] for row in cur.execute("SELECT name, id FROM customers").fetchall()}
for rec in records:
    key = rec["customer_name"].lower()
    if key not in existing:
        cur.execute("INSERT INTO customers (name) VALUES (?)", (rec["customer_name"],))
        existing[key] = cur.lastrowid
    rec["customer_id"] = existing[key]

# ---- inserir vendas --------------------------------------------------------
sql = """INSERT INTO sales
  (customer_id, customer_name, empresa, brand, category, product, product_id,
   cost_value, sale_value, payment_method, is_fiado, due_date, sale_date,
   delivery_date, payment_date, status, notes, external_id, paid, paid_at, delivered)
  VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1)"""
for rec in records:
    cur.execute(sql, (
        rec["customer_id"], rec["customer_name"], rec["empresa"], rec["empresa"],
        rec["category"], rec["product"], rec["cost"], rec["sale"], rec["pay"],
        rec["is_fiado"], rec["sale_date"], rec["delivery_date"], rec["payment_date"],
        rec["status"], rec["notes"], rec["external_id"], rec["paid"], rec["paid_at"],
    ))

con.commit()

# ---- relatório -------------------------------------------------------------
total = len(records)
fat = sum(r["sale"] for r in records)
custo = sum(r["cost"] for r in records)
lucro = fat - custo
sem_data = sum(1 for r in records if not r["sale_date"])
pagos = sum(1 for r in records if r["paid"])
print(f"Importadas: {total} vendas")
print(f"Faturamento: {fat:.2f} | Custo: {custo:.2f} | Lucro: {lucro:.2f}")
print(f"PAGO: {pagos} | PENDENTE: {total - pagos}")
print(f"Vendas sem data valida: {sem_data}")
print(f"Clientes na base: {cur.execute('SELECT COUNT(*) FROM customers').fetchone()[0]}")
print(f"Total de vendas na base: {cur.execute('SELECT COUNT(*) FROM sales').fetchone()[0]}")
con.close()
