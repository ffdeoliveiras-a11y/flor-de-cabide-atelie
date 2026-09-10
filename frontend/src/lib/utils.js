import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Formata um número como moeda brasileira (R$)
export function brl(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Converte "2026-06-28" (ou ISO com hora) em "28/06/2026"
export function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

// Lucro (venda - custo) e margem percentual
export function profitOf(cost, sale) {
  return (Number(sale) || 0) - (Number(cost) || 0);
}
export function marginPct(cost, sale) {
  const s = Number(sale) || 0;
  return s > 0 ? (profitOf(cost, sale) / s) * 100 : 0;
}

// Baixa parcial: quanto de uma venda já entrou e quanto ainda falta receber.
// Venda marcada como paga conta inteira como recebida (inclui vendas antigas,
// quitadas antes de existir o registro de pagamentos).
export function recebidoDe(s) {
  const total = Number(s.sale_value) || 0;
  if (s.paid) return total;
  return Math.min(total, Number(s.amount_paid) || 0);
}
export function saldoDe(s) {
  if (s.paid) return 0;
  return Math.max(0, (Number(s.sale_value) || 0) - (Number(s.amount_paid) || 0));
}
export function isParcial(s) {
  return !s.paid && (Number(s.amount_paid) || 0) > 0;
}

// Data de hoje no formato YYYY-MM-DD (horário local)
export function todayISO() {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Data de hoje + N dias, no formato YYYY-MM-DD (horário local)
export function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Saudação conforme o horário: Bom dia / Boa tarde / Boa noite
export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Primeiro nome a partir de um nome completo
export function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "";
}
