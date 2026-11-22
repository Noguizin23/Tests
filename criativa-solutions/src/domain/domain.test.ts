import { describe, expect, it } from "vitest";
import { allocate, priceFromMargin, priceQuote } from "./pricing";
import { compareOffers, lineQty, piecesPerSheet } from "./quantities";
import { contactActions, waLink } from "./contacts";
import { parseOffersCsv } from "./csv";
import { parseMoney, proposalFileName } from "./format";
import { calcQuote, emissionBlockers, issue, refreshCosts, revise } from "./quote";
import type { Company, Offer, Quote, QuoteLine, Supplier } from "./types";

const line = (p: Partial<QuoteLine>): QuoteLine => ({
  id: p.id ?? Math.random().toString(36),
  deliverable: "Fachada",
  description: "item",
  category: "material",
  unit: "un",
  qty: 1,
  wasteBp: 0,
  perPurchase: 1,
  unitCostCents: 10000,
  chargeMode: "rateado",
  ...p,
});

describe("margem", () => {
  it("custo 100 com margem 40% vende 166,67", () => expect(priceFromMargin(10000, 4000)).toBe(16667));
  it("rejeita margem de 100%", () => expect(() => priceFromMargin(100, 10000)).toThrow());

  it("margem por item substitui a geral", () => {
    const r = priceQuote({
      mode: "item", marginBp: 4000, targetMarginBp: 0, discountBp: 0, feeBp: 0,
      lines: [
        { id: "a", deliverable: "X", costCents: 10000, marginBp: 5000 },
        { id: "b", deliverable: "X", costCents: 10000 },
      ],
    });
    expect(r.lines[0].priceCents).toBe(20000);
    expect(r.lines[1].priceCents).toBe(16667);
    expect(r.subtotalCents).toBe(36667);
    expect(r.grossMarginBp).toBe(Math.round(((36667 - 20000) * 10000) / 36667));
  });

  it("meta do projeto preserva linha com margem específica e distribui o resto por custo", () => {
    const r = priceQuote({
      mode: "meta", marginBp: 4000, targetMarginBp: 4000, discountBp: 0, feeBp: 0,
      lines: [
        { id: "a", deliverable: "X", costCents: 10000, marginBp: 5000 },
        { id: "b", deliverable: "X", costCents: 10000 },
        { id: "c", deliverable: "Y", costCents: 20000 },
      ],
    });
    const target = priceFromMargin(40000, 4000); // 66667
    expect(r.lines[0].priceCents).toBe(20000);
    expect(r.lines[1].priceCents + r.lines[2].priceCents).toBe(target - 20000);
    expect([r.lines[1].priceCents, r.lines[2].priceCents]).toEqual([15556, 31111]); // 46667 split 1:2, leftover cent by largest remainder
    expect(r.subtotalCents).toBe(target);
    expect(r.meta?.feasible).toBe(true);
  });

  it("meta inviável mostra divergência", () => {
    const r = priceQuote({
      mode: "meta", marginBp: 0, targetMarginBp: 1000, discountBp: 0, feeBp: 0,
      lines: [
        { id: "a", deliverable: "X", costCents: 10000, marginBp: 9000 },
        { id: "b", deliverable: "X", costCents: 10000 },
      ],
    });
    expect(r.meta?.feasible).toBe(false);
    expect(r.meta?.divergenceCents).toBeGreaterThan(0);
  });

  it("arredondamento determinístico: total é a soma dos preços exibidos", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(101, [3, 3, 3]).reduce((a, b) => a + b)).toBe(101);
    const r = priceQuote({
      mode: "item", marginBp: 3333, targetMarginBp: 0, discountBp: 0, feeBp: 0,
      lines: [1, 2, 3].map((i) => ({ id: String(i), deliverable: `D${i % 2}`, costCents: 3333 })),
    });
    expect(r.subtotalCents).toBe(r.deliverables.reduce((a, d) => a + d.priceCents, 0));
  });

  it("desconto e taxa recalculam a margem efetiva", () => {
    const r = priceQuote({
      mode: "item", marginBp: 4000, targetMarginBp: 0, discountBp: 1000, feeBp: 600,
      lines: [{ id: "a", deliverable: "X", costCents: 10000 }],
    });
    expect(r.subtotalCents).toBe(16667);
    expect(r.discountCents).toBe(1667);
    expect(r.totalCents).toBe(15000);
    expect(r.feeCents).toBe(900);
    expect(r.profitCents).toBe(4100);
    expect(r.effectiveMarginBp).toBe(2733);
  });
});

describe("quantidades", () => {
  it("converte barra de 6 m para metro linear", () => {
    const q = lineQty(line({ unit: "ml", qty: 14, perPurchase: 6, unitCostCents: 9000, wasteBp: 0 }));
    expect(q.purchaseByArea).toBe(3);
    expect(q.costCents).toBe(21000); // rateado: 14/6 × 90
  });

  it("chapa: área com perda, plano de corte e compra inteira", () => {
    const sheet = 1.22 * 5; // m²
    const l = line({
      unit: "m2", qty: 7.2, wasteBp: 1500, perPurchase: sheet, unitCostCents: 120000, chargeMode: "compra",
      layout: { pieceW: 1200, pieceH: 3000, count: 2, sheetW: 1220, sheetH: 5000 },
    });
    const q = lineQty(l);
    expect(q.purchaseByArea).toBe(2); // 8,28 m² / 6,1
    expect(q.purchaseByLayout).toBe(2); // 1 peça por chapa
    expect(q.costCents).toBe(240000);
    const manual = lineQty({ ...l, manualPurchaseQty: 3 });
    expect(manual.purchaseQty).toBe(3);
    expect(lineQty({ ...l, chargeMode: "rateado" }).costCents).toBe(Math.round((8.28 / sheet) * 120000));
  });

  it("orientação da peça conta no plano de corte", () => {
    expect(piecesPerSheet({ pieceW: 2400, pieceH: 600, sheetW: 1220, sheetH: 2440 })).toBe(2);
    expect(lineQty(line({ layout: { pieceW: 3000, pieceH: 3000, count: 1, sheetW: 1220, sheetH: 2440 } })).layoutFits).toBe(false);
  });

  it("compara ofertas com pedido mínimo e frete", () => {
    const o = (id: string, price: number | null, minQty?: number, freight?: number): Offer => ({
      id, supplierId: "s", product: id, unit: "barra", priceCents: price, currency: "BRL", minQty, freightCents: freight, leadTime: "", stock: "",
    });
    const r = compareOffers([o("a", 8000, 10), o("b", 9000, undefined, 3000), o("c", null)], 12, 6);
    expect(r.map((x) => x.offer.id)).toEqual(["b", "a", "c"]); // b: (2×90+30)/12=17,5 ; a: 10×80/12=66,7
  });
});

describe("custos pendentes, emissão e revisões", () => {
  const company = { brand: "Criativa Solutions" } as Company;
  const base: Quote = {
    id: "q1", number: 7, revision: 0, status: "rascunho", createdAt: "2026-11-22T00:00:00Z", updatedAt: "",
    clientId: "c1", title: "T", installAddress: "", environment: "externo", measures: "", scope: "", notes: "",
    internalNotes: "", photos: [], pricingMode: "item", marginBp: 4000, targetMarginBp: 4000, discountBp: 0, feeBp: 0,
    validityDays: 15, leadTime: "", payment: "", installConditions: "", warranty: "", display: "entregaveis",
    lines: [line({ id: "l1", offerId: "o1", unitCostCents: 10000 }), line({ id: "l2", unitCostCents: null })],
  };

  it("bloqueia emissão com custo pendente e libera com custo zero confirmado", () => {
    expect(emissionBlockers(base, calcQuote(base)).join()).toMatch(/sem custo/);
    const ok = { ...base, lines: [base.lines[0], { ...base.lines[1], zeroConfirmed: true }] };
    expect(emissionBlockers(ok, calcQuote(ok))).toEqual([]);
  });

  it("proposta emitida preserva preços quando o catálogo muda", () => {
    const ok = { ...base, lines: [base.lines[0]] };
    const issued = issue(ok, company, undefined);
    const before = calcQuote(issued).pricing.totalCents;
    const offers = [{ id: "o1", priceCents: 99999 } as Offer];
    expect(refreshCosts(issued, offers).changed).toEqual([]);
    expect(calcQuote(issued).pricing.totalCents).toBe(before);
    const draft = revise(issued, 1, "q2");
    const refreshed = refreshCosts(draft, offers);
    expect(refreshed.changed).toEqual(["l1"]);
    expect(calcQuote(refreshed.quote).pricing.totalCents).toBeGreaterThan(before);
    expect(calcQuote(issued).pricing.totalCents).toBe(before);
  });

  it("nome do arquivo", () => expect(proposalFileName(7, 1)).toBe("proposta-0007-r1.pdf"));
});

describe("contatos e CSV", () => {
  const sup = { id: "s1", name: "ViaFlex BR", whatsapp: "21972247727", phones: ["(21) 2084-1303"], emails: [], neighborhood: "Ramos" } as unknown as Supplier;
  it("gera link direto do WhatsApp", () => expect(waLink("(21) 97224-7727")).toBe("https://wa.me/5521972247727"));
  it("mostra só canais publicados, WhatsApp primeiro", () =>
    expect(contactActions(sup).map((a) => a.kind)).toEqual(["whatsapp", "ligar"]));
  it("sem WhatsApp, Ligar é a ação principal", () =>
    expect(contactActions({ ...sup, whatsapp: undefined })[0].kind).toBe("ligar"));
  it("valida CSV linha a linha", () => {
    const rows = parseOffersCsv(
      "fornecedor;produto;unidade;preco;data_consulta\nViaFlex BR;ACM 3mm;chapa;1.234,50;22/11/2026\nViaFlex BR;Lona;rolo;;\nX;Y;caixa;abc;2026",
      [sup],
    );
    expect(rows[0].offer?.priceCents).toBe(123450);
    expect(rows[1].offer?.priceCents).toBeNull();
    expect(rows[2].errors.length).toBe(4);
  });
  it("lê moeda brasileira", () => expect(parseMoney("R$ 1.000,00")).toBe(100000));
});
