import { useMemo, useState } from "react";
import { ExternalLink, ImageUp, Plus, Search, ShieldAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/data/store";
import { date, money, uid, unitLabel } from "@/domain/format";
import { KIND_LABEL, type Offer, type QuoteLine, type Supplier, type SupplierKind } from "@/domain/types";
import { ContactButtons, ContactText, Empty, Field, PageHead, SupplierLogo } from "./common";
import { fileToDataUrl } from "./ops";
import { OfferDialog } from "./Catalog";
import { go } from "./route";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Suppliers() {
  const st = useStore();
  const [q, setQ] = useState("");
  const [bairro, setBairro] = useState("todos");
  const [open, setOpen] = useState<Supplier | null>(null);
  const [edit, setEdit] = useState<Supplier | null>(null);
  const bairros = [...new Set(st.suppliers.map((s) => s.neighborhood).filter((b) => b && b !== "—"))].sort();
  const list = useMemo(() => {
    const k = norm(q);
    return st.suppliers
      .filter((s) => bairro === "todos" || s.neighborhood === bairro)
      .filter((s) => {
        if (!k) return true;
        const offers = st.offers.filter((o) => o.supplierId === s.id).map((o) => `${o.product} ${o.spec ?? ""}`).join(" ");
        return norm(`${s.name} ${s.neighborhood} ${s.categories.join(" ")} ${offers}`).includes(k);
      })
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(!!a.demo) - Number(!!b.demo) || a.name.localeCompare(b.name));
  }, [st.suppliers, st.offers, q, bairro]);

  return (
    <>
      <PageHead title="Fornecedores" desc="Contatos comerciais com fonte e data. Os contatos ficam só na área interna do app.">
        <Button size="lg" onClick={() => setEdit({ id: uid(), name: "", kinds: [], neighborhood: "", phones: [], emails: [], categories: [], verification: "Cadastro manual.", sources: [] })}><Plus /> Novo fornecedor</Button>
      </PageHead>
      <div className="flex flex-wrap gap-2 mb-8">
        <div className="relative flex-1 min-w-[220px] max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="busca-forn" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, material ou bairro" className="pl-9 h-10" /></div>
        <div className="flex flex-wrap gap-1.5">
          {["todos", ...bairros].map((b) => (
            <Button key={b} size="sm" variant={bairro === b ? "default" : "outline"} onClick={() => setBairro(b)} className="h-10 rounded-full px-3">{b === "todos" ? "Todos os bairros" : b}</Button>
          ))}
        </div>
      </div>
      {list.length === 0 ? <Empty title="Nenhum fornecedor encontrado" /> : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <article key={s.id} className={`rounded-3xl border bg-card p-6 grid gap-5 content-start animate-in fade-in slide-in-from-bottom-2 ${s.featured ? "border-magenta ring-4 ring-magenta/10" : ""}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "both" }}>
              <header className="flex gap-3 items-start">
                <SupplierLogo s={s} />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setOpen(s)} className="text-left font-heading text-lg font-bold leading-tight hover:text-primary">{s.name}</button>
                  <p className="text-sm text-muted-foreground">{s.neighborhood}{s.kinds.length ? ` · ${s.kinds.map((k) => KIND_LABEL[k]).join(", ")}` : ""}</p>
                  {s.featured ? <Badge className="bg-magenta text-white mt-1"><Star className="size-3" />{s.featured}</Badge> : null}
                  {s.demo ? <Badge variant="outline" className="border-magenta text-magenta mt-1">fictício</Badge> : null}
                </div>
              </header>
              {s.categories.length ? <div className="flex flex-wrap gap-1.5">{s.categories.slice(0, 3).map((c) => <span key={c} className="text-xs rounded-lg bg-muted px-2 py-1">{c}</span>)}{s.categories.length > 3 ? <span className="text-xs text-muted-foreground px-1 py-1">+{s.categories.length - 3}</span> : null}</div> : <p className="text-xs text-muted-foreground">Categorias a confirmar.</p>}
              <ContactText s={s} />
              <ContactButtons s={s} />
              <button type="button" onClick={() => setOpen(s)} className="text-left text-sm font-semibold text-primary hover:underline w-fit">Materiais e cotações →</button>
            </article>
          ))}
        </div>
      )}
      <SupplierSheet s={open ? st.suppliers.find((x) => x.id === open.id) ?? open : null} onClose={() => setOpen(null)} onEdit={(s) => { setOpen(null); setEdit(s); }} />
      {edit ? <SupplierDialog s={edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function SupplierSheet({ s, onClose, onEdit }: { s: Supplier | null; onClose: () => void; onEdit: (s: Supplier) => void }) {
  const st = useStore();
  const [offerEdit, setOfferEdit] = useState<Offer | null>(null);
  const openQ = st.quotes.find((q) => q.id === st.openQuoteId);
  const offers = s ? st.offers.filter((o) => o.supplierId === s.id) : [];
  const addToQuote = async (o: Offer) => {
    if (!openQ) { toast.error("Abra um orçamento em rascunho primeiro."); return; }
    if (openQ.status !== "rascunho") { toast.error("O orçamento aberto já foi emitido. Crie uma revisão."); return; }
    const item = st.items.find((i) => i.id === o.itemId);
    const line: QuoteLine = {
      id: uid(), deliverable: openQ.lines[0]?.deliverable ?? "Itens", description: o.product + (o.spec ? ` (${o.spec})` : ""),
      category: item?.kind === "servico" || o.unit === "servico" ? "terceirizacao" : "material",
      itemId: o.itemId, offerId: o.id, supplierId: o.supplierId,
      unit: item?.consumptionUnit ?? o.unit, purchaseUnit: o.unit, perPurchase: item?.perPurchase ?? 1,
      qty: 1, wasteBp: 0, unitCostCents: o.priceCents, chargeMode: o.unit === "chapa" ? "compra" : "rateado",
    };
    await st.put("quotes", { ...openQ, lines: [...openQ.lines, line], updatedAt: new Date().toISOString() });
    toast.success(`Adicionado à proposta ${String(openQ.number).padStart(4, "0")}.`, { action: { label: "Abrir", onClick: () => go("app-orcamento") } });
  };
  const setLogo = async (file?: File) => {
    if (!s || !file) return;
    try {
      const url = await fileToDataUrl(file, 320);
      await st.put("suppliers", { ...s, logo: url, logoSource: `Atualizado manualmente em ${date(new Date().toISOString())}` });
      toast.success("Logotipo atualizado.");
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {s ? (
          <>
            <SheetHeader>
              <div className="flex gap-3 items-center"><SupplierLogo s={s} size={64} /><div><SheetTitle className="text-xl">{s.name}</SheetTitle><SheetDescription>{[s.address, s.neighborhood, s.city].filter(Boolean).join(" · ")}</SheetDescription></div></div>
            </SheetHeader>
            <div className="px-4 pb-8 grid gap-5">
              <ContactButtons s={s} />
              <ContactText s={s} />
              {s.hours ? <p className="text-sm"><b>Horário:</b> {s.hours}</p> : null}
              <section className="grid gap-2">
                <h3 className="font-bold">Materiais e serviços</h3>
                {s.categories.length ? <div className="flex flex-wrap gap-1.5">{s.categories.map((c) => <span key={c} className="text-xs rounded-lg bg-muted px-2 py-1">{c}</span>)}</div> : <p className="text-sm text-muted-foreground">A confirmar.</p>}
              </section>
              <section className="grid gap-2">
                <div className="flex items-center justify-between"><h3 className="font-bold">Cotações cadastradas</h3><Button size="sm" variant="outline" onClick={() => setOfferEdit({ id: uid(), supplierId: s.id, product: "", unit: "un", priceCents: null, currency: "BRL", leadTime: "a confirmar", stock: "a confirmar", consultedAt: new Date().toISOString().slice(0, 10) })}><Plus /> Cotação</Button></div>
                {openQ ? <p className="text-xs text-muted-foreground">Orçamento aberto: {String(openQ.number).padStart(4, "0")}·r{openQ.revision} {openQ.title}</p> : <p className="text-xs text-muted-foreground">Abra um orçamento para adicionar ofertas a ele.</p>}
                {offers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma oferta cadastrada.</p> : offers.map((o) => (
                  <div key={o.id} className="rounded-2xl border p-3 grid gap-2">
                    <div className="flex justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{o.product}</p><p className="text-xs text-muted-foreground">{o.spec}</p></div><p className="tabular font-bold whitespace-nowrap">{money(o.priceCents)}{o.priceCents != null ? <span className="text-xs text-muted-foreground font-normal"> /{unitLabel(o.unit)}</span> : null}</p></div>
                    <p className="text-xs text-muted-foreground">Prazo {o.leadTime} · estoque {o.stock}{o.minQty ? ` · mínimo ${o.minQty}` : ""}{o.consultedAt ? ` · consulta ${date(o.consultedAt)}` : ""}</p>
                    {o.note ? <p className="text-xs text-aviso">{o.note}</p> : null}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" disabled={!openQ || openQ.status !== "rascunho"} onClick={() => addToQuote(o)}><Plus /> Adicionar ao orçamento aberto</Button>
                      <Button size="sm" variant="ghost" onClick={() => setOfferEdit(o)}>Editar</Button>
                      {o.sourceUrl ? <Button size="sm" variant="ghost" asChild><a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte <ExternalLink /></a></Button> : null}
                    </div>
                  </div>
                ))}
              </section>
              <section className="rounded-2xl bg-muted p-4 grid gap-2 text-sm">
                <p className="font-bold flex items-center gap-2"><ShieldAlert className="size-4" />Verificação</p>
                <p>{s.verification}</p>
                {s.sources.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" className="text-primary break-all text-xs">{x.url} · {date(x.consultedAt)}{x.note ? ` · ${x.note}` : ""}</a>)}
                <p className="text-xs text-muted-foreground">Logotipo: {s.logo ? s.logoSource ?? "fonte não registrada" : "pendente (mostrando iniciais)"}</p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 h-8 text-sm cursor-pointer hover:border-primary"><ImageUp className="size-4" />Atualizar logotipo<input type="file" accept="image/*" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0])} /></label>
                  <Button size="sm" variant="outline" onClick={() => onEdit(s)}>Editar dados</Button>
                </div>
              </section>
            </div>
            {offerEdit ? <OfferDialog o={offerEdit} onClose={() => setOfferEdit(null)} /> : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SupplierDialog({ s, onClose }: { s: Supplier; onClose: () => void }) {
  const st = useStore();
  const [f, setF] = useState({ ...s, phonesT: s.phones.join(", "), emailsT: s.emails.join(", "), catsT: s.categories.join(", ") });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const toggleKind = (k: SupplierKind) => setF({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] });
  const save = async () => {
    if (!f.name.trim()) { toast.error("Informe o nome."); return; }
    const split = (t: string) => t.split(",").map((x) => x.trim()).filter(Boolean);
    const digits = (t: string) => t.replace(/\D/g, "");
    if (f.whatsapp && !/^\d{10,13}$/.test(digits(f.whatsapp))) { toast.error("WhatsApp deve ter DDD e número."); return; }
    const { phonesT, emailsT, catsT, ...rest } = f;
    await st.put("suppliers", { ...rest, name: f.name.trim(), whatsapp: f.whatsapp ? digits(f.whatsapp) : undefined, phones: split(phonesT).map(digits), emails: split(emailsT), categories: split(catsT) });
    toast.success("Fornecedor salvo.");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{s.name ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle><DialogDescription>Registre só dados comerciais verificados e a fonte.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" htmlFor="s-nome"><Input id="s-nome" value={f.name} onChange={set("name")} className="h-10" /></Field>
          <Field label="Bairro" htmlFor="s-bairro"><Input id="s-bairro" value={f.neighborhood} onChange={set("neighborhood")} className="h-10" /></Field>
          <Field label="Endereço" htmlFor="s-end"><Input id="s-end" value={f.address ?? ""} onChange={set("address")} className="h-10" /></Field>
          <Field label="Cidade e CEP" htmlFor="s-cid"><Input id="s-cid" value={f.city ?? ""} onChange={set("city")} className="h-10" /></Field>
          <Field label="WhatsApp (com DDD)" htmlFor="s-wa"><Input id="s-wa" inputMode="tel" value={f.whatsapp ?? ""} onChange={set("whatsapp")} className="h-10" /></Field>
          <Field label="Telefones (separe por vírgula)" htmlFor="s-tel"><Input id="s-tel" inputMode="tel" value={f.phonesT} onChange={set("phonesT")} className="h-10" /></Field>
          <Field label="E-mails" htmlFor="s-mail"><Input id="s-mail" value={f.emailsT} onChange={set("emailsT")} className="h-10" /></Field>
          <Field label="Site" htmlFor="s-site"><Input id="s-site" value={f.website ?? ""} onChange={set("website")} className="h-10" placeholder="https://" /></Field>
          <Field label="Logotipo (URL)" htmlFor="s-logo"><Input id="s-logo" value={f.logo ?? ""} onChange={set("logo")} className="h-10" /></Field>
          <Field label="Fonte do logotipo" htmlFor="s-logofonte"><Input id="s-logofonte" value={f.logoSource ?? ""} onChange={set("logoSource")} className="h-10" /></Field>
          <Field label="Categorias (separe por vírgula)" htmlFor="s-cat" className="sm:col-span-2"><Input id="s-cat" value={f.catsT} onChange={set("catsT")} className="h-10" /></Field>
          <Field label="Tipo" className="sm:col-span-2"><div className="flex flex-wrap gap-2">{(Object.keys(KIND_LABEL) as SupplierKind[]).map((k) => <Button key={k} type="button" size="sm" variant={f.kinds.includes(k) ? "default" : "outline"} onClick={() => toggleKind(k)}>{KIND_LABEL[k]}</Button>)}</div></Field>
          <Field label="Destaque" htmlFor="s-dest"><Input id="s-dest" value={f.featured ?? ""} onChange={set("featured")} className="h-10" placeholder="Ex.: Fornecedor principal de acrílico" /></Field>
          <Field label="Verificação" htmlFor="s-ver" className="sm:col-span-2"><Textarea id="s-ver" value={f.verification} onChange={set("verification")} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
