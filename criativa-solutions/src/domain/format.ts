import type { Unit } from "./types";
import { UNITS } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = (d: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });

export const money = (cents: number | null | undefined) => (cents == null ? "sob cotação" : brl.format(cents / 100));
export const pct = (bp: number) => `${num(2).format(bp / 100)}%`;
export const qty = (n: number, d = 3) => num(d).format(n);
export const unitLabel = (u: Unit) => UNITS[u] ?? u;
export const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

/** Parses "1.234,56", "1234.56", "R$ 12,9" → cents. Returns null for empty, NaN for invalid. */
export function parseMoney(s: string | undefined | null): number | null {
  const t = (s ?? "").replace(/R\$|\s/g, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Math.round(parseFloat(normalized) * 100);
}

/** "40" or "40,5" (percent) → basis points; NaN when invalid. */
export function parsePct(s: string): number {
  const t = s.replace("%", "").trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}

/** pt-BR decimal input → number; NaN when invalid. */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\./g, (m, i, all) => (all.includes(",") ? "" : m)).replace(",", ".");
  return t === "" ? NaN : Number(t);
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "").slice(0, 16);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || name.slice(0, 2).toUpperCase();

export const proposalFileName = (number: number, revision: number) =>
  `proposta-${String(number).padStart(4, "0")}-r${revision}.pdf`;
