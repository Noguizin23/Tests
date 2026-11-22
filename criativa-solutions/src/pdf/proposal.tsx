import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { calcQuote } from "@/domain/quote";
import { addDays, date, money, proposalFileName } from "@/domain/format";
import type { Client, Company, Quote } from "@/domain/types";

/** Everything the client-facing proposal may show. Costs, suppliers, margins and internal notes never enter here. */
export interface ProposalData {
  company: Company;
  client?: Client;
  number: number;
  revision: number;
  draft: boolean;
  issuedAt: string;
  validUntil: string;
  validityDays: number;
  title: string;
  scope: string;
  measures: string;
  installAddress: string;
  notes: string;
  display: Quote["display"];
  deliverables: { name: string; items: string[]; priceCents: number }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  leadTime: string;
  payment: string;
  installConditions: string;
  warranty: string;
  fileName: string;
}

export function proposalData(q: Quote, liveCompany: Company, liveClient?: Client): ProposalData {
  const frozen = q.status === "emitida" && q.snapshot;
  const company = frozen ? q.snapshot!.company : liveCompany;
  const client = frozen ? q.snapshot!.client : liveClient;
  const src = frozen ? q.snapshot!.quote : q;
  const { pricing } = calcQuote(q);
  const issuedAt = q.issuedAt ?? new Date().toISOString();
  return {
    company,
    client,
    number: q.number,
    revision: q.revision,
    draft: !frozen,
    issuedAt,
    validUntil: addDays(issuedAt, src.validityDays),
    validityDays: src.validityDays,
    title: src.title,
    scope: src.scope,
    measures: src.measures,
    installAddress: src.installAddress,
    notes: src.notes,
    display: src.display,
    deliverables: pricing.deliverables.map((d) => ({
      name: d.name,
      priceCents: d.priceCents,
      items: src.lines.filter((l) => (l.deliverable || "Itens") === d.name).map((l) => l.description),
    })),
    subtotalCents: pricing.subtotalCents,
    discountCents: pricing.discountCents,
    totalCents: pricing.totalCents,
    leadTime: src.leadTime,
    payment: src.payment,
    installConditions: src.installConditions,
    warranty: src.warranty,
    fileName: proposalFileName(q.number, q.revision),
  };
}

Font.registerHyphenationCallback((word) => [word]); // no mid-word breaks in pt-BR

const ROXO = "#7F3D9F";
const MAGENTA = "#EF0075";
const TINTA = "#212121";
const SUAVE = "#67606D";
const LINHA = "#E7E2EB";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 9.5, color: TINTA, lineHeight: 1.4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: ROXO },
  logo: { height: 26, width: 150, objectFit: "contain", objectPositionX: 0, marginBottom: 8 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.25, color: ROXO, marginBottom: 2 },
  small: { fontSize: 8, color: SUAVE },
  propBox: { alignItems: "flex-end" },
  propNum: { fontFamily: "Helvetica-Bold", fontSize: 13, lineHeight: 1.3, marginBottom: 2 },
  draft: { marginTop: 4, fontSize: 8, color: MAGENTA, fontFamily: "Helvetica-Bold" },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: ROXO, marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 15, lineHeight: 1.3, marginTop: 16 },
  grid: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, backgroundColor: "#F7F4F9", borderRadius: 4, padding: 8 },
  label: { fontSize: 7.5, color: SUAVE, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  th: { flexDirection: "row", backgroundColor: TINTA, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 6, paddingHorizontal: 8 },
  tr: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINHA },
  colA: { width: 28 },
  colB: { flex: 1, paddingRight: 8 },
  colC: { width: 110, textAlign: "right" },
  itemList: { fontSize: 8, color: SUAVE, marginTop: 2 },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 240 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  total: { flexDirection: "row", justifyContent: "space-between", backgroundColor: ROXO, color: "#FFFFFF", padding: 10, borderRadius: 4, marginTop: 4 },
  totalTxt: { fontFamily: "Helvetica-Bold", fontSize: 14, lineHeight: 1.2 },
  para: { marginBottom: 4 },
  accept: { marginTop: 28, flexDirection: "row", gap: 24 },
  sign: { flex: 1, borderTopWidth: 1, borderTopColor: TINTA, paddingTop: 4, fontSize: 8, color: SUAVE },
  foot: { position: "absolute", bottom: 24, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: SUAVE, borderTopWidth: 1, borderTopColor: LINHA, paddingTop: 6 },
});

const abs = (src: string) => (src.startsWith("data:") || /^https?:/.test(src) ? src : new URL(src, window.location.href).href);

export function ProposalDoc({ d }: { d: ProposalData }) {
  const c = d.company;
  const num = `${String(d.number).padStart(4, "0")} · revisão ${d.revision}`;
  return (
    <Document title={`Proposta ${num}`} author={c.brand} creator={c.brand}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.head} fixed>
          <View style={{ maxWidth: 300 }}>
            {c.logo ? <Image src={abs(c.logo)} style={s.logo} /> : null}
            <Text style={s.brand}>{c.brand}</Text>
            <Text style={s.small}>{[c.legalName, c.cnpj && `CNPJ ${c.cnpj}`].filter(Boolean).join(" · ")}</Text>
            <Text style={s.small}>{c.address}</Text>
            <Text style={s.small}>{[c.phone, c.email, c.website].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={s.propBox}>
            <Text style={s.small}>PROPOSTA COMERCIAL</Text>
            <Text style={s.propNum}>Nº {num}</Text>
            <Text style={s.small}>Emissão: {date(d.issuedAt)}</Text>
            <Text style={s.small}>Válida até: {date(d.validUntil)} ({d.validityDays} dias)</Text>
            {d.draft ? <Text style={s.draft}>RASCUNHO · NÃO EMITIDA</Text> : null}
          </View>
        </View>

        <Text style={s.title}>{d.title}</Text>

        <Text style={s.h2}>Cliente</Text>
        <View style={s.grid}>
          <View style={s.cell}><Text style={s.label}>Cliente</Text><Text>{d.client?.name ?? "—"}</Text>{d.client?.doc ? <Text style={s.small}>{d.client.doc}</Text> : null}</View>
          <View style={s.cell}><Text style={s.label}>Contato</Text><Text>{[d.client?.contact, d.client?.phone, d.client?.email].filter(Boolean).join(" · ") || "—"}</Text></View>
          <View style={s.cell}><Text style={s.label}>Local de instalação</Text><Text>{d.installAddress || d.client?.address || "—"}</Text></View>
        </View>

        {d.scope ? (<><Text style={s.h2}>Escopo</Text><Text style={s.para}>{d.scope}</Text></>) : null}
        {d.measures ? <Text style={s.small}>Medidas: {d.measures}</Text> : null}

        <Text style={s.h2}>{d.display === "entregaveis" ? "Entregáveis e valores" : "Entregáveis"}</Text>
        <View>
          <View style={s.th} fixed>
            <Text style={s.colA}>#</Text>
            <Text style={s.colB}>Entregável</Text>
            {d.display === "entregaveis" ? <Text style={s.colC}>Valor</Text> : null}
          </View>
          {d.deliverables.map((x, i) => (
            <View key={x.name} style={s.tr} wrap={false}>
              <Text style={s.colA}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={s.colB}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{x.name}</Text>
                <Text style={s.itemList}>{x.items.join(" · ")}</Text>
              </View>
              {d.display === "entregaveis" ? <Text style={s.colC}>{money(x.priceCents)}</Text> : null}
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          {d.discountCents > 0 ? (
            <>
              <View style={s.totRow}><Text>Subtotal</Text><Text>{money(d.subtotalCents)}</Text></View>
              <View style={s.totRow}><Text>Desconto</Text><Text>− {money(d.discountCents)}</Text></View>
            </>
          ) : null}
          <View style={s.total}><Text style={s.totalTxt}>Total</Text><Text style={s.totalTxt}>{money(d.totalCents)}</Text></View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Condições comerciais</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold" }}>Prazo: </Text>{d.leadTime || "a combinar"}</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold" }}>Pagamento: </Text>{d.payment || "a combinar"}</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold" }}>Instalação: </Text>{d.installConditions || "—"}</Text>
          <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold" }}>Garantia: </Text>{d.warranty || "—"}</Text>
          {d.notes ? <Text style={s.para}><Text style={{ fontFamily: "Helvetica-Bold" }}>Observações: </Text>{d.notes}</Text> : null}
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Aceite</Text>
          <Text style={s.small}>Declaro estar de acordo com o escopo, os valores e as condições desta proposta.</Text>
          <View style={s.accept}>
            <Text style={s.sign}>Nome e assinatura do cliente</Text>
            <Text style={s.sign}>Data: ____/____/______</Text>
          </View>
        </View>

        <View style={s.foot} fixed>
          <Text>{c.brand} · Proposta {num}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function proposalBlob(d: ProposalData): Promise<Blob> {
  return pdf(<ProposalDoc d={d} />).toBlob();
}

/** Save through the artifact's downloads capability when present, else a normal browser download. */
export async function downloadProposal(d: ProposalData): Promise<"saved" | "declined"> {
  const blob = await proposalBlob(d);
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  const dl = claude?.use ? ((await claude.use("downloads").catch(() => null)) as { save(r: { filename: string; data: Blob }): Promise<unknown> } | null) : null;
  if (dl) {
    try { await dl.save({ filename: d.fileName, data: blob }); return "saved"; } catch (e) {
      if ((e as { code?: string })?.code === "declined") return "declined";
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: d.fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}
