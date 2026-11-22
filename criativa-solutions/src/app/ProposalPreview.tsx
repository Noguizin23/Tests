import { date, money } from "@/domain/format";
import type { ProposalData } from "@/pdf/proposal";

/** On-screen A4 preview built from the same ProposalData the PDF uses. */
export function ProposalPreview({ d }: { d: ProposalData }) {
  const c = d.company;
  const num = `${String(d.number).padStart(4, "0")} · revisão ${d.revision}`;
  return (
    <div className="rounded-3xl bg-muted p-3 md:p-6 overflow-x-auto">
      <article aria-label="Prévia da proposta" className="mx-auto bg-white text-[#212121] shadow-xl w-full max-w-[794px] aspect-[210/297] min-h-fit p-[6%] text-[13px] leading-relaxed relative" style={{ aspectRatio: "auto", minHeight: 1000 }}>
        <header className="flex justify-between gap-6 pb-4 border-b-2 border-primary">
          <div className="min-w-0">
            {c.logo ? <img src={c.logo} alt={c.brand} className="h-8 w-auto mb-2" /> : null}
            <p className="font-heading text-xl font-extrabold text-primary">{c.brand}</p>
            <p className="text-xs text-muted-foreground">{[c.legalName, c.cnpj && `CNPJ ${c.cnpj}`].filter(Boolean).join(" · ")}</p>
            <p className="text-xs text-muted-foreground">{c.address}</p>
            <p className="text-xs text-muted-foreground">{[c.phone, c.email, c.website].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-muted-foreground">PROPOSTA COMERCIAL</p>
            <p className="font-bold text-base tabular">Nº {num}</p>
            <p className="text-xs text-muted-foreground tabular">Emissão {date(d.issuedAt)}</p>
            <p className="text-xs text-muted-foreground tabular">Válida até {date(d.validUntil)}</p>
            {d.draft ? <p className="text-[11px] font-bold text-magenta mt-1">RASCUNHO · NÃO EMITIDA</p> : null}
          </div>
        </header>
        <h2 className="font-heading text-xl font-extrabold mt-5">{d.title}</h2>
        <h3 className="text-primary font-bold uppercase text-xs tracking-wider mt-5 mb-2">Cliente</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <Cell l="Cliente" v={d.client?.name ?? "—"} />
          <Cell l="Contato" v={[d.client?.contact, d.client?.phone, d.client?.email].filter(Boolean).join(" · ") || "—"} />
          <Cell l="Local de instalação" v={d.installAddress || d.client?.address || "—"} />
        </div>
        {d.scope ? (<><h3 className="text-primary font-bold uppercase text-xs tracking-wider mt-5 mb-2">Escopo</h3><p>{d.scope}</p></>) : null}
        {d.measures ? <p className="text-xs text-muted-foreground mt-1">Medidas: {d.measures}</p> : null}
        <h3 className="text-primary font-bold uppercase text-xs tracking-wider mt-5 mb-2">{d.display === "entregaveis" ? "Entregáveis e valores" : "Entregáveis"}</h3>
        <table className="w-full text-left">
          <thead><tr className="bg-[#212121] text-white text-xs"><th className="p-2 w-10">#</th><th className="p-2">Entregável</th>{d.display === "entregaveis" ? <th className="p-2 text-right">Valor</th> : null}</tr></thead>
          <tbody>
            {d.deliverables.map((x, i) => (
              <tr key={x.name} className="border-b align-top">
                <td className="p-2 tabular">{String(i + 1).padStart(2, "0")}</td>
                <td className="p-2"><b>{x.name}</b><p className="text-xs text-muted-foreground">{x.items.join(" · ")}</p></td>
                {d.display === "entregaveis" ? <td className="p-2 text-right tabular whitespace-nowrap">{money(x.priceCents)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-[280px] tabular">
          {d.discountCents ? (<><p className="flex justify-between"><span>Subtotal</span><span>{money(d.subtotalCents)}</span></p><p className="flex justify-between"><span>Desconto</span><span>− {money(d.discountCents)}</span></p></>) : null}
          <p className="flex justify-between bg-primary text-white rounded-md px-3 py-2 mt-1 font-bold text-lg"><span>Total</span><span>{money(d.totalCents)}</span></p>
        </div>
        <h3 className="text-primary font-bold uppercase text-xs tracking-wider mt-5 mb-2">Condições comerciais</h3>
        <p><b>Prazo:</b> {d.leadTime || "a combinar"}</p>
        <p><b>Pagamento:</b> {d.payment || "a combinar"}</p>
        <p><b>Instalação:</b> {d.installConditions || "—"}</p>
        <p><b>Garantia:</b> {d.warranty || "—"}</p>
        {d.notes ? <p><b>Observações:</b> {d.notes}</p> : null}
        <h3 className="text-primary font-bold uppercase text-xs tracking-wider mt-5 mb-2">Aceite</h3>
        <p className="text-xs text-muted-foreground">Declaro estar de acordo com o escopo, os valores e as condições desta proposta.</p>
        <div className="grid grid-cols-2 gap-6 mt-10 text-xs text-muted-foreground"><p className="border-t border-[#212121] pt-1">Nome e assinatura do cliente</p><p className="border-t border-[#212121] pt-1">Data: ____/____/______</p></div>
      </article>
    </div>
  );
}

function Cell({ l, v }: { l: string; v: string }) {
  return <div className="rounded bg-[#F7F4F9] p-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</p><p>{v}</p></div>;
}
