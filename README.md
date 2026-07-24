# Flor de Cabide Ateliê — Sistema de Gestão

Sistema web completo (monorepo) para gestão de vendas, fiado e finanças do ateliê.

## Stack
- **Backend:** Node.js + Express + **SQLite embutido** (`node:sqlite`, nativo do Node 24 — zero instalação de banco)
- **Frontend:** React (Vite) + Tailwind CSS + componentes no estilo shadcn/ui
- **Paleta da marca** aplicada em todo o sistema (marrom #6B3F2A, rosa #E8B4BC, creme #F5F0EB...)

## Como rodar

### Opção rápida (Windows)
```powershell
./start.ps1
```
Sobe backend + frontend e abre o Chrome automaticamente.

### Manual
```powershell
# Terminal 1 — backend (http://localhost:3001)
cd backend
node server.js

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

A primeira execução do backend cria o arquivo `backend/flordecabide.db` automaticamente.

### Importar a planilha de controle
A estrutura do sistema foi adaptada à planilha `Controle_Vendas_Flor_de_Cabide_2026.xlsx`
(campos EMPRESA, CATEGORIA, DATA ENTREGA, DATA PAGAMENTO, STATUS, OBSERVAÇÕES).
Para (re)importar a aba **📝 VENDAS**:
```powershell
# pare o backend, rode o import e suba de novo
python backend/import_planilha.py
```
O import é idempotente (remove a importação anterior antes de inserir) e faz parse tolerante
de datas digitadas com erro. Clientes novos são criados automaticamente.

## Telas
1. **Login** — identidade visual da marca, cadastro/login, sessão persistente (localStorage).
2. **Fechamento do Dia** — vendas **somente de hoje**, Tab para navegar e Enter para salvar, autocomplete de clientes, **busca de produto no estoque** (preenche marca/custo/venda), **"Valor Sugerido"** travado quando vem do estoque (botão destrava p/ editar), **quadro de Lucro (R$ e %) ao vivo**, **botão opt-in "Fiado"** e edição/exclusão da venda.
3. **Histórico** — todas as vendas com **filtros por qualquer campo** (cliente, produto, marca, pagamento, tipo, status, período, faixa de valor), totais (faturamento/lucro/margem) e **editar/excluir** (modal) qualquer venda.
4. **Estoque** — cadastro de produtos (nome, marca, custo, venda, quantidade), edição e exclusão; a venda baixa o estoque e a exclusão devolve a unidade.
5. **Dashboard** — KPIs + gráficos (faturamento e lucro por dia, por forma de pagamento, por marca, top clientes) com recharts.
6. **Painel Financeiro** — cards do mês, Contas a Receber (Fiado) com "Dar Baixa", Contas a Pagar (Boletos) com cadastro e "Marcar como Pago".
7. **Calculadora de Margem** — **margem arrastável de 0 a 100%** (slider) + atalhos 30/50/70/100%, meta de lucro do mês e barra de progresso.

## API (porta 3001)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` · `/auth/login` | Cadastro / login |
| GET·POST | `/sales` | Listar (`?date=today` ou `?date=YYYY-MM-DD`) / criar vendas |
| PATCH·DELETE | `/sales/:id` | Editar / excluir venda |
| PATCH | `/sales/:id/baixa` | Dar baixa no fiado |
| GET | `/sales/summary` | Resumo financeiro do mês |
| GET·POST·PATCH·DELETE | `/products` | Estoque (busca `?q=`, criar, editar, excluir) |
| GET·POST | `/customers` | Listar/buscar (`?q=`) / criar clientes |
| GET·POST·PATCH | `/bills-to-pay` | Boletos / marcar como pago |
