import { money, pct, qty as fq, unitLabel } from "./format";
import type { QuoteCalc } from "./quote";
import type { CatalogItem, Quote, Supplier } from "./types";

export interface Tip {
  level: "critico" | "aviso" | "dica";
  text: string;
  supplierId?: string;
}

const has = (q: Quote, items: Map<string, CatalogItem>, re: RegExp) =>
  q.lines.some((l) => re.test(l.description) || (l.itemId ? re.test(items.get(l.itemId)?.family ?? "") : false));

/** Rule-based assistant shown while the proposal is built. Pure: same quote → same tips. */
export function quoteTips(q: Quote, calc: QuoteCalc, items: CatalogItem[], suppliers: Supplier[]): Tip[] {
  const tips: Tip[] = [];
  const it = new Map(items.map((i) => [i.id, i]));
  const p = calc.pricing;

  if (!q.clientId) tips.push({ level: "aviso", text: "Selecione ou cadastre o cliente para poder emitir." });
  const pending = q.lines.filter((l) => calc.qty[l.id]?.pending);
  if (pending.length)
    tips.push({ level: "critico", text: `${pending.length} item(ns) sem custo. Cote com o fornecedor ou confirme custo zero antes de emitir.` });
  if (p.meta && !p.meta.feasible) tips.push({ level: "critico", text: p.meta.message ?? "Meta inviável." });

  for (const l of q.lines) {
    const c = calc.qty[l.id];
    if (!c) continue;
    if (!c.layoutFits) tips.push({ level: "critico", text: `“${l.description}”: a peça não cabe na chapa informada. Revise o plano de corte.` });
    if (l.chargeMode === "rateado" && c.purchaseQty > 0 && c.leftover > 0 && c.leftover / (c.purchaseQty * (l.perPurchase || 1)) > 0.4 && l.perPurchase > 1)
      tips.push({
        level: "dica",
        text: `“${l.description}”: sobra ${fq(c.leftover, 2)} ${unitLabel(l.unit)} da ${l.purchaseUnit ? unitLabel(l.purchaseUnit) : "compra"}. Se não houver reaproveitamento, cobre a compra inteira.`,
      });
    if (l.marginBp != null && l.marginBp < 1500)
      tips.push({ level: "aviso", text: `“${l.description}” está com margem específica de ${pct(l.marginBp)}.` });
  }

  if (p.totalCents > 0 && p.effectiveMarginBp < 2000)
    tips.push({ level: "aviso", text: `Margem efetiva após desconto e taxas: ${pct(p.effectiveMarginBp)}. Revise preço ou desconto.` });
  if (q.discountBp >= 1000)
    tips.push({ level: "aviso", text: `Desconto de ${pct(q.discountBp)} reduz o resultado em ${money(p.discountCents)}.` });

  const led = has(q, it, /led|neon/i);
  if (led && !has(q, it, /fonte/i)) tips.push({ level: "aviso", text: "Há LED sem fonte de alimentação. Adicione a fonte compatível com a potência total." });
  if (led && q.environment === "externo")
    tips.push({ level: "dica", text: "Ambiente externo com LED: use módulos e fonte com grau de proteção adequado (IP65 ou superior / fonte blindada)." });
  if (has(q, it, /acm/i) && !has(q, it, /metalon|estrutura|perfil|tubo/i))
    tips.push({ level: "dica", text: "Fachada em ACM normalmente leva estrutura (metalon ou perfil) e fixação. Confira se faltam itens." });
  if (q.environment === "externo" && !has(q, it, /silicone|selante|veda/i) && q.lines.length > 0)
    tips.push({ level: "dica", text: "Peça externa: considere vedação (silicone ou selante PU) e fixadores resistentes à corrosão." });
  if (q.installAddress && !q.lines.some((l) => /instala/i.test(l.description) || /instala/i.test(l.deliverable)))
    tips.push({ level: "aviso", text: "Há endereço de instalação, mas nenhum item de instalação ou deslocamento." });
  if (/altura|andaime|plataforma/i.test(`${q.measures} ${q.scope}`) && !has(q, it, /andaime|plataforma/i))
    tips.push({ level: "dica", text: "O escopo cita altura: avalie andaime ou plataforma elevatória." });

  if (has(q, it, /acr[ií]lico/i)) {
    const main = suppliers.find((s) => /principal/i.test(s.featured ?? "") && s.categories.some((c) => /acr[ií]lico/i.test(c)));
    if (main) tips.push({ level: "dica", text: `Acrílico: fornecedor principal é ${main.name}. Peça a cotação antes de emitir.`, supplierId: main.id });
  }
  if (!q.payment.trim()) tips.push({ level: "aviso", text: "Defina a condição de pagamento." });
  if (!q.leadTime.trim()) tips.push({ level: "aviso", text: "Defina o prazo de execução." });
  return tips;
}
