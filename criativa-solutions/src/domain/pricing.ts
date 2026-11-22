import type { Bp, Cents } from "./types";

export const MAX_MARGIN_BP = 9999; // margin must stay below 100%

export function validMargin(bp: number): boolean {
  return Number.isFinite(bp) && bp >= 0 && bp <= MAX_MARGIN_BP;
}

/** Margin = (price − cost) ÷ price, so price = cost ÷ (1 − margin). */
export function priceFromMargin(cost: Cents, marginBp: Bp): Cents {
  if (!validMargin(marginBp)) throw new RangeError("Margem deve ficar entre 0% e menos de 100%.");
  return Math.round((cost * 10000) / (10000 - marginBp));
}

export function marginOf(cost: Cents, price: Cents): Bp {
  return price > 0 ? Math.round(((price - cost) * 10000) / price) : 0;
}

/** Split `total` cents proportionally to `weights` with the largest-remainder method (ties: earlier index). */
export function allocate(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const ws = sum > 0 ? sum : weights.length;
  const T = BigInt(total);
  const W = w.map((x) => BigInt(Math.round(x)));
  const S = BigInt(Math.round(ws));
  const base = W.map((x) => (T * x) / S);
  const rem = W.map((x, i) => ({ i, r: (T * x) % S }));
  let left = Number(T - base.reduce((a, b) => a + b, 0n));
  rem.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  const out = base.map(Number);
  for (let k = 0; left > 0; k = (k + 1) % out.length, left--) out[rem[k].i] += 1;
  return out;
}

export interface PricingLineIn {
  id: string;
  deliverable: string;
  costCents: Cents | null; // null = pending (counts as 0, flagged)
  marginBp?: Bp | null;
}

export interface PricingInput {
  mode: "item" | "meta";
  marginBp: Bp; // general margin (item mode)
  targetMarginBp: Bp; // project target (meta mode)
  discountBp: Bp;
  feeBp: Bp; // commercial fees/taxes over the final price
  lines: PricingLineIn[];
}

export interface PricedLine {
  id: string;
  deliverable: string;
  costCents: Cents;
  priceCents: Cents;
  marginBp: Bp;
  locked: boolean; // has its own margin
  pending: boolean;
}

export interface PricingResult {
  lines: PricedLine[];
  deliverables: { name: string; costCents: Cents; priceCents: Cents }[];
  costCents: Cents;
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  feeCents: Cents;
  profitCents: Cents;
  grossMarginBp: Bp; // before discount and fees
  effectiveMarginBp: Bp; // after discount and fees
  pendingCount: number;
  meta?: { targetCents: Cents; achievedCents: Cents; divergenceCents: Cents; feasible: boolean; message?: string };
}

/** Single source of truth for prices: used by the editor, the review and the PDF. */
export function priceQuote(input: PricingInput): PricingResult {
  if (!validMargin(input.marginBp) || !validMargin(input.targetMarginBp))
    throw new RangeError("Margem deve ficar entre 0% e menos de 100%.");
  if (!(input.discountBp >= 0 && input.discountBp <= 10000) || !(input.feeBp >= 0 && input.feeBp < 10000))
    throw new RangeError("Desconto e taxas devem ficar entre 0% e 100%.");

  const base = input.lines.map((l) => ({
    id: l.id,
    deliverable: l.deliverable || "Itens",
    costCents: l.costCents ?? 0,
    pending: l.costCents == null,
    own: l.marginBp != null && l.marginBp !== undefined ? l.marginBp : null,
  }));
  for (const b of base) if (b.own != null && !validMargin(b.own)) throw new RangeError("Margem da linha fora da faixa.");

  const costCents = base.reduce((a, b) => a + b.costCents, 0);
  let prices: Cents[];
  let meta: PricingResult["meta"];

  if (input.mode === "item") {
    prices = base.map((b) => priceFromMargin(b.costCents, b.own ?? input.marginBp));
  } else {
    const targetCents = priceFromMargin(costCents, input.targetMarginBp);
    prices = base.map((b) => (b.own != null ? priceFromMargin(b.costCents, b.own) : 0));
    const lockedSum = prices.reduce((a, p, i) => a + (base[i].own != null ? p : 0), 0);
    const freeIdx = base.map((b, i) => (b.own == null ? i : -1)).filter((i) => i >= 0);
    const freeCost = freeIdx.reduce((a, i) => a + base[i].costCents, 0);
    const remaining = targetCents - lockedSum;
    let feasible = true;
    let message: string | undefined;
    if (freeIdx.length === 0) {
      feasible = lockedSum === targetCents;
      if (!feasible) message = "Todas as linhas têm margem própria; a meta não pode ser distribuída.";
    } else if (remaining < freeCost) {
      feasible = false;
      message = "As margens específicas consomem a meta: as demais linhas ficariam abaixo do custo. Reduza as margens específicas ou aumente a meta.";
      freeIdx.forEach((i) => (prices[i] = base[i].costCents));
    } else {
      const parts = allocate(remaining, freeIdx.map((i) => base[i].costCents));
      freeIdx.forEach((i, k) => (prices[i] = parts[k]));
    }
    const achievedCents = prices.reduce((a, b) => a + b, 0);
    meta = { targetCents, achievedCents, divergenceCents: achievedCents - targetCents, feasible, message };
  }

  const lines: PricedLine[] = base.map((b, i) => ({
    id: b.id,
    deliverable: b.deliverable,
    costCents: b.costCents,
    priceCents: prices[i],
    marginBp: marginOf(b.costCents, prices[i]),
    locked: b.own != null,
    pending: b.pending,
  }));

  const map = new Map<string, { name: string; costCents: Cents; priceCents: Cents }>();
  for (const l of lines) {
    const d = map.get(l.deliverable) ?? { name: l.deliverable, costCents: 0, priceCents: 0 };
    d.costCents += l.costCents;
    d.priceCents += l.priceCents;
    map.set(l.deliverable, d);
  }
  const deliverables = [...map.values()];
  // Total is the sum of displayed deliverable prices, so the PDF always adds up.
  const subtotalCents = deliverables.reduce((a, d) => a + d.priceCents, 0);
  const discountCents = Math.round((subtotalCents * input.discountBp) / 10000);
  const totalCents = subtotalCents - discountCents;
  const feeCents = Math.round((totalCents * input.feeBp) / 10000);
  const profitCents = totalCents - feeCents - costCents;

  return {
    lines,
    deliverables,
    costCents,
    subtotalCents,
    discountCents,
    totalCents,
    feeCents,
    profitCents,
    grossMarginBp: marginOf(costCents, subtotalCents),
    effectiveMarginBp: totalCents > 0 ? Math.round((profitCents * 10000) / totalCents) : 0,
    pendingCount: lines.filter((l) => l.pending).length,
    meta,
  };
}
