import type { Cents, Layout, Offer, QuoteLine } from "./types";

const EPS = 1e-9;
const ceil = (x: number) => Math.ceil(x - EPS);

/** Pieces per sheet on a simple grid, testing both orientations. 0 = piece does not fit. */
export function piecesPerSheet(l: Pick<Layout, "pieceW" | "pieceH" | "sheetW" | "sheetH">): number {
  if (l.pieceW <= 0 || l.pieceH <= 0) return 0;
  const a = Math.floor(l.sheetW / l.pieceW + EPS) * Math.floor(l.sheetH / l.pieceH + EPS);
  const b = Math.floor(l.sheetW / l.pieceH + EPS) * Math.floor(l.sheetH / l.pieceW + EPS);
  return Math.max(a, b);
}

export function sheetsByLayout(l: Layout): number | null {
  const fit = piecesPerSheet(l);
  return fit === 0 ? null : ceil(l.count / fit);
}

export interface LineQty {
  consumption: number; // qty incl. waste, in consumption unit
  wasteQty: number;
  purchaseExact: number; // fractional purchase units (rateio)
  purchaseByArea: number; // rounded up
  purchaseByLayout: number | null;
  layoutFits: boolean;
  purchaseQty: number; // used for "compra inteira"
  leftover: number; // consumption units bought but not used
  costCents: Cents | null; // null = pending
  pending: boolean;
}

/** Quantities and cost of one line. Area-based counts are estimates; layout or manual counts take priority. */
export function lineQty(line: QuoteLine): LineQty {
  const per = line.perPurchase > 0 ? line.perPurchase : 1;
  const consumption = line.qty * (1 + line.wasteBp / 10000);
  const purchaseExact = consumption / per;
  const purchaseByArea = ceil(purchaseExact);
  const purchaseByLayout = line.layout ? sheetsByLayout(line.layout) : null;
  const purchaseQty =
    line.manualPurchaseQty != null && line.manualPurchaseQty > 0
      ? line.manualPurchaseQty
      : purchaseByLayout ?? purchaseByArea;
  const pending = line.unitCostCents == null && !line.zeroConfirmed;
  const unit = line.unitCostCents ?? 0;
  const costCents = pending
    ? null
    : line.chargeMode === "compra"
      ? Math.round(purchaseQty * unit)
      : Math.round(purchaseExact * unit);
  return {
    consumption,
    wasteQty: consumption - line.qty,
    purchaseExact,
    purchaseByArea,
    purchaseByLayout,
    layoutFits: !line.layout || purchaseByLayout != null,
    purchaseQty,
    leftover: Math.max(0, purchaseQty * per - consumption),
    costCents,
    pending,
  };
}

export interface OfferCompare {
  offer: Offer;
  purchaseQty: number;
  totalCents: Cents | null;
  perUnitCents: number | null; // per consumption unit, incl. minimum order and freight
}

/** Compare offers by effective cost per consumption unit for a needed quantity. */
export function compareOffers(offers: Offer[], needed: number, perPurchase: number): OfferCompare[] {
  const per = perPurchase > 0 ? perPurchase : 1;
  return offers
    .map((offer) => {
      const purchaseQty = Math.max(ceil(needed / per), offer.minQty ?? 0);
      if (offer.priceCents == null || needed <= 0) return { offer, purchaseQty, totalCents: null, perUnitCents: null };
      const totalCents = purchaseQty * offer.priceCents + (offer.freightCents ?? 0);
      return { offer, purchaseQty, totalCents, perUnitCents: totalCents / needed };
    })
    .sort((a, b) => (a.perUnitCents ?? Infinity) - (b.perUnitCents ?? Infinity));
}
