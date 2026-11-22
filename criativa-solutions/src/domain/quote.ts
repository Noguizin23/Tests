import { lineQty, type LineQty } from "./quantities";
import { priceQuote, type PricingResult } from "./pricing";
import type { Client, Company, Offer, Quote, QuoteLine, Snapshot } from "./types";

export interface QuoteCalc {
  qty: Record<string, LineQty>;
  pricing: PricingResult;
}

/** Quantities + prices for a quote. Issued quotes return their frozen snapshot. */
export function calcQuote(q: Quote): QuoteCalc {
  if (q.status === "emitida" && q.snapshot) return { qty: q.snapshot.lineCosts, pricing: q.snapshot.pricing };
  const qty: Record<string, LineQty> = {};
  for (const l of q.lines) qty[l.id] = lineQty(l);
  const pricing = priceQuote({
    mode: q.pricingMode,
    marginBp: q.marginBp,
    targetMarginBp: q.targetMarginBp,
    discountBp: q.discountBp,
    feeBp: q.feeBp,
    lines: q.lines.map((l) => ({ id: l.id, deliverable: l.deliverable, costCents: qty[l.id].costCents, marginBp: l.marginBp })),
  });
  return { qty, pricing };
}

/** Reasons that block emission. Drafts may be saved with any of these. */
export function emissionBlockers(q: Quote, calc: QuoteCalc): string[] {
  const out: string[] = [];
  if (!q.clientId) out.push("Selecione o cliente.");
  if (q.lines.length === 0) out.push("Adicione ao menos um item.");
  const pending = q.lines.filter((l) => calc.qty[l.id]?.pending);
  if (pending.length)
    out.push(`${pending.length} item(ns) sem custo: informe o custo ou confirme custo zero (${pending.map((l) => l.description).join(", ")}).`);
  const noFit = q.lines.filter((l) => !calc.qty[l.id]?.layoutFits);
  if (noFit.length) out.push(`Peça maior que a chapa no plano de corte: ${noFit.map((l) => l.description).join(", ")}.`);
  if (calc.pricing.meta && !calc.pricing.meta.feasible) out.push("Meta de margem inviável: ajuste as margens específicas ou a meta.");
  if (calc.pricing.totalCents <= 0) out.push("Total da proposta deve ser maior que zero.");
  return out;
}

export function issue(q: Quote, company: Company, client: Client | undefined, now = new Date().toISOString()): Quote {
  const calc = calcQuote({ ...q, status: "rascunho" });
  const blockers = emissionBlockers(q, calc);
  if (blockers.length) throw new Error(blockers.join(" "));
  const { snapshot: _old, ...plain } = q;
  void _old;
  const frozen: Quote = { ...plain, status: "emitida", issuedAt: now, updatedAt: now };
  const snapshot: Snapshot = structuredClone({ company, client, quote: frozen, pricing: calc.pricing, lineCosts: calc.qty });
  return { ...frozen, snapshot };
}

/** New draft revision of the same proposal number. */
export function revise(q: Quote, nextRevision: number, id: string, now = new Date().toISOString()): Quote {
  const { snapshot: _s, issuedAt: _i, ...rest } = structuredClone(q);
  void _s; void _i;
  return { ...rest, id, revision: nextRevision, status: "rascunho", createdAt: now, updatedAt: now };
}

/** Copy of a quote under a new proposal number. */
export function duplicate(q: Quote, number: number, id: string, now = new Date().toISOString()): Quote {
  return { ...revise(q, 0, id, now), number, title: `${q.title} (cópia)` };
}

/** Explicit refresh of draft costs from the current catalog offers. Returns changed line ids. */
export function refreshCosts(q: Quote, offers: Offer[]): { quote: Quote; changed: string[] } {
  if (q.status !== "rascunho") return { quote: q, changed: [] };
  const byId = new Map(offers.map((o) => [o.id, o]));
  const changed: string[] = [];
  const lines: QuoteLine[] = q.lines.map((l) => {
    const o = l.offerId ? byId.get(l.offerId) : undefined;
    if (!o || o.priceCents === l.unitCostCents) return l;
    changed.push(l.id);
    return { ...l, unitCostCents: o.priceCents };
  });
  return { quote: { ...q, lines }, changed };
}
