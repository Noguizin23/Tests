import Papa from "papaparse";
import { parseMoney, parseNum, uid } from "./format";
import type { Offer, Supplier, Unit } from "./types";
import { UNITS } from "./types";

export const CSV_HEADER =
  "fornecedor;produto;especificacao;unidade;preco;qtd_minima;prazo;estoque;entrega;frete;url_fonte;data_consulta";

export interface CsvRow {
  line: number;
  raw: Record<string, string>;
  offer?: Offer;
  errors: string[];
}

const unitByText = new Map<string, Unit>(
  Object.entries(UNITS).flatMap(([k, v]) => [
    [k.toLowerCase(), k as Unit],
    [v.toLowerCase(), k as Unit],
  ]),
);
unitByText.set("m2", "m2").set("metro", "ml").set("un", "un").set("und", "un");

function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [d, mo, y] = s.includes("/") ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const iso = `${y}-${mo}-${d}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Parse and validate supplier offers from CSV (comma or semicolon). Nothing is saved here. */
export function parseOffersCsv(text: string, suppliers: Supplier[]): CsvRow[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const byName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s]));
  return res.data.map((raw, i) => {
    const errors: string[] = [];
    const get = (k: string) => (raw[k] ?? "").trim();
    const sup = byName.get(get("fornecedor").toLowerCase());
    if (!get("fornecedor")) errors.push("fornecedor vazio");
    else if (!sup) errors.push(`fornecedor "${get("fornecedor")}" não cadastrado`);
    if (!get("produto")) errors.push("produto vazio");
    const unit = unitByText.get(get("unidade").toLowerCase());
    if (!unit) errors.push(`unidade "${get("unidade")}" inválida`);
    const price = parseMoney(get("preco"));
    if (Number.isNaN(price)) errors.push(`preço "${get("preco")}" inválido`);
    else if (price != null && price < 0) errors.push("preço negativo");
    const freight = parseMoney(get("frete"));
    if (Number.isNaN(freight)) errors.push(`frete "${get("frete")}" inválido`);
    const minQ = get("qtd_minima") ? parseNum(get("qtd_minima")) : undefined;
    if (minQ !== undefined && !(minQ >= 0)) errors.push("quantidade mínima inválida");
    const url = get("url_fonte");
    if (url && !/^https?:\/\//.test(url)) errors.push("url_fonte deve começar com http(s)://");
    const consulted = get("data_consulta") ? parseDate(get("data_consulta")) : null;
    if (get("data_consulta") && !consulted) errors.push("data_consulta deve ser dd/mm/aaaa");
    const offer: Offer | undefined = errors.length
      ? undefined
      : {
          id: uid(),
          supplierId: sup!.id,
          product: get("produto"),
          spec: get("especificacao") || undefined,
          unit: unit!,
          priceCents: price as number | null,
          currency: "BRL",
          minQty: minQ,
          leadTime: get("prazo") || "a confirmar",
          stock: get("estoque") || "a confirmar",
          delivery: get("entrega") || undefined,
          freightCents: (freight as number | null) ?? undefined,
          sourceUrl: url || undefined,
          consultedAt: consulted ?? undefined,
        };
    return { line: i + 2, raw, offer, errors };
  });
}
