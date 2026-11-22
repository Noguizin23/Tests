import { useMemo, useState } from "react";
import { ExternalLink, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/data/store";
import { CSV_HEADER, parseOffersCsv, type CsvRow } from "@/domain/csv";
import { date, money, uid, unitLabel } from "@/domain/format";
import { GROUPS, UNITS, type CatalogItem, type Offer, type Unit } from "@/domain/types";
import { Empty, Field, MoneyInput, NumInput, PageHead } from "./common";

const UNIT_KEYS = Object.keys(UNITS) as Unit[];

export default function Catalog() {
  return (
    <>
      <PageHead title="Catálogo" desc="Famílias de materiais e serviços, variantes e ofertas dos fornecedores, com fonte e data." />
      <Tabs defaultValue="itens">
        <TabsList className="h-10"><TabsTrigger value="itens" className="px-4">Materiais e serviços</TabsTrigger><TabsTrigger value="ofertas" className="px-4">Ofertas</TabsTrigger></TabsList>
        <TabsContent value="itens" className="mt-5"><Items /></TabsContent>
        <TabsContent value="ofertas" className="mt-5"><Offers /></TabsContent>
      </Tabs>
    </>
  );
}

function Items() {
  const st = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CatalogItem | null>(null);
  const k = q.toLowerCase();
  const list = st.items.filter((i) => !k || `${i.family} ${i.variant ?? ""} ${i.group} ${i.sku ?? ""}`.toLowerCase().includes(k));
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="busca-item" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar família, variante ou SKU" className="pl-9 h-10" /></div>
        <Button onClick={() => setEdit({ id: uid(), group: "Chapas rígidas", family: "", kind: "material", purchaseUnit: "un", consumptionUnit: "un", perPurchase: 1 })}><Plus /> Nova família ou variante</Button>
      </div>
      {GROUPS.map((g) => {
        const rows = list.filter((i) => i.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="rounded-3xl border bg-card overflow-hidden">
            <h2 className="px-5 py-3 border-b bg-muted/40 font-bold">{g} <span className="text-muted-foreground font-normal text-sm">· {rows.length}</span></h2>
            <div className="divide-y">
              {rows.map((i) => {
                const n = st.offers.filter((o) => o.itemId === i.id);
                const priced = n.filter((o) => o.priceCents != null).length;
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold">{i.family}{i.variant ? <span className="text-muted-foreground font-normal"> · {i.variant}</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{i.kind === "servico" ? "Serviço" : "Material"} · compra por {unitLabel(i.purchaseUnit)} · consumo em {unitLabel(i.consumptionUnit)}{i.perPurchase !== 1 ? ` · ${i.perPurchase.toLocaleString("pt-BR")} ${unitLabel(i.consumptionUnit)} por ${unitLabel(i.purchaseUnit)}` : ""}{i.sku ? ` · SKU ${i.sku}` : ""}</p>
                    </div>
                    {i.demo ? <Badge variant="outline" className="border-magenta text-magenta">fictício</Badge> : null}
                    <Badge variant="secondary">{n.length ? `${n.length} oferta(s) · ${priced} com preço` : "só família"}</Badge>
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${i.family}`} onClick={() => setEdit(i)}><Pencil /></Button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {edit ? <ItemDialog it={edit} onClose={() => setEdit(null)} /> : null}
    </div>
  );
}

function ItemDialog({ it, onClose }: { it: CatalogItem; onClose: () => void }) {
  const st = useStore();
  const [f, setF] = useState<CatalogItem>(it);
  const s = (k: keyof CatalogItem) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value || undefined });
  const save = async () => {
    if (!f.family.trim()) { toast.error("Informe a família."); return; }
    await st.put("items", { ...f, family: f.family.trim() });
    toast.success("Item salvo.");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{it.family ? "Editar item" : "Nova família ou variante"}</DialogTitle><DialogDescription>Preencha só o que for conhecido. Família sem variante é válida.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Grupo" htmlFor="i-grupo">
            <Select value={f.group} onValueChange={(v) => setF({ ...f, group: v as CatalogItem["group"] })}><SelectTrigger id="i-grupo" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Tipo" htmlFor="i-tipo">
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as CatalogItem["kind"] })}><SelectTrigger id="i-tipo" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="material">Material</SelectItem><SelectItem value="servico">Serviço</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Família" htmlFor="i-fam"><Input id="i-fam" value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })} className="h-10" placeholder="Ex.: ACM" /></Field>
          <Field label="Variante" htmlFor="i-var"><Input id="i-var" value={f.variant ?? ""} onChange={s("variant")} className="h-10" placeholder="Ex.: 3 mm branco brilho" /></Field>
          <Field label="SKU" htmlFor="i-sku"><Input id="i-sku" value={f.sku ?? ""} onChange={s("sku")} className="h-10" /></Field>
          <Field label="Dimensões" htmlFor="i-dim"><Input id="i-dim" value={f.dims ?? ""} onChange={s("dims")} className="h-10" placeholder="1220 × 5000 mm" /></Field>
          <Field label="Espessura" htmlFor="i-esp"><Input id="i-esp" value={f.thickness ?? ""} onChange={s("thickness")} className="h-10" /></Field>
          <Field label="Cor" htmlFor="i-cor"><Input id="i-cor" value={f.color ?? ""} onChange={s("color")} className="h-10" /></Field>
          <Field label="Acabamento" htmlFor="i-acab"><Input id="i-acab" value={f.finish ?? ""} onChange={s("finish")} className="h-10" /></Field>
          <Field label="Unidade de compra" htmlFor="i-uc"><Select value={f.purchaseUnit} onValueChange={(v) => setF({ ...f, purchaseUnit: v as Unit })}><SelectTrigger id="i-uc" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent>{UNIT_KEYS.map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Unidade de consumo" htmlFor="i-uco"><Select value={f.consumptionUnit} onValueChange={(v) => setF({ ...f, consumptionUnit: v as Unit })}><SelectTrigger id="i-uco" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent>{UNIT_KEYS.map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent></Select></Field>
          <Field label={`${unitLabel(f.consumptionUnit)} por ${unitLabel(f.purchaseUnit)}`} htmlFor="i-per" hint="Chapa 1,22 × 2,44 m = 2,9768 m² · barra de 6 m = 6 ml"><NumInput id="i-per" value={f.perPurchase} onChange={(v) => setF({ ...f, perPurchase: v && v > 0 ? v : 1 })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chapa largura (mm)" htmlFor="i-sw"><NumInput id="i-sw" value={f.sheetW ?? null} allowEmpty onChange={(v) => setF({ ...f, sheetW: v ?? undefined })} /></Field>
            <Field label="Chapa altura (mm)" htmlFor="i-sh"><NumInput id="i-sh" value={f.sheetH ?? null} allowEmpty onChange={(v) => setF({ ...f, sheetH: v ?? undefined })} /></Field>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Offers() {
  const st = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Offer | null>(null);
  const [imp, setImp] = useState(false);
  const sup = (id: string) => st.suppliers.find((s) => s.id === id)?.name ?? id;
  const k = q.toLowerCase();
  const list = st.offers.filter((o) => !k || `${o.product} ${o.spec ?? ""} ${sup(o.supplierId)}`.toLowerCase().includes(k));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="busca-oferta" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto ou fornecedor" className="pl-9 h-10" /></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImp(true)}><FileUp /> Importar CSV</Button>
          <Button onClick={() => setEdit({ id: uid(), supplierId: st.suppliers[0]?.id ?? "", product: "", unit: "un", priceCents: null, currency: "BRL", leadTime: "a confirmar", stock: "a confirmar", consultedAt: new Date().toISOString().slice(0, 10) })}><Plus /> Nova oferta</Button>
        </div>
      </div>
      {list.length === 0 ? <Empty title="Nenhuma oferta encontrada" /> : (
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Produto ou serviço</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Mín.</TableHead><TableHead>Prazo</TableHead><TableHead>Estoque</TableHead><TableHead>Fonte</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="max-w-[300px]"><p className="font-semibold">{o.product}</p><p className="text-xs text-muted-foreground">{o.spec}</p>{o.demo ? <Badge variant="outline" className="border-magenta text-magenta mt-1">fictício</Badge> : null}{o.note ? <p className="text-xs text-aviso mt-1">{o.note}</p> : null}</TableCell>
                  <TableCell className="text-sm">{sup(o.supplierId)}</TableCell>
                  <TableCell className="text-right tabular whitespace-nowrap">{o.priceCents == null ? <span className="text-muted-foreground">sob cotação</span> : <>{money(o.priceCents)}<span className="text-xs text-muted-foreground"> /{unitLabel(o.unit)}</span></>}</TableCell>
                  <TableCell className="tabular text-sm">{o.minQty ?? "—"}</TableCell>
                  <TableCell className="text-sm">{o.leadTime}</TableCell>
                  <TableCell className="text-sm">{o.stock}</TableCell>
                  <TableCell className="text-xs">{o.sourceUrl ? <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">fonte <ExternalLink className="size-3" /></a> : "—"}<p className="text-muted-foreground">{date(o.consultedAt)}</p></TableCell>
                  <TableCell className="whitespace-nowrap"><Button variant="ghost" size="icon-sm" aria-label="Editar oferta" onClick={() => setEdit(o)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="Excluir oferta" onClick={async () => { await st.del("offers", o.id); toast.success("Oferta excluída. Propostas emitidas não mudam."); }}><Trash2 /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {edit ? <OfferDialog o={edit} onClose={() => setEdit(null)} /> : null}
      <ImportCsv open={imp} onOpenChange={setImp} />
    </div>
  );
}

export function OfferDialog({ o, onClose }: { o: Offer; onClose: () => void }) {
  const st = useStore();
  const [f, setF] = useState<Offer>(o);
  const s = (k: keyof Offer) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.product.trim() || !f.supplierId) { toast.error("Informe fornecedor e produto."); return; }
    if (f.sourceUrl && !/^https?:\/\//.test(f.sourceUrl)) { toast.error("A URL da fonte deve começar com http:// ou https://"); return; }
    await st.put("offers", { ...f, product: f.product.trim(), leadTime: f.leadTime || "a confirmar", stock: f.stock || "a confirmar" });
    toast.success("Oferta salva. Rascunhos só mudam se você atualizar os custos.");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{o.product ? "Editar oferta" : "Nova oferta"}</DialogTitle><DialogDescription>Deixe o preço vazio quando for “sob cotação”.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Fornecedor" htmlFor="o-sup"><Select value={f.supplierId} onValueChange={(v) => setF({ ...f, supplierId: v })}><SelectTrigger id="o-sup" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent>{st.suppliers.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Família do catálogo" htmlFor="o-item"><Select value={f.itemId ?? "nenhum"} onValueChange={(v) => setF({ ...f, itemId: v === "nenhum" ? undefined : v })}><SelectTrigger id="o-item" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem vínculo</SelectItem>{st.items.map((i) => <SelectItem key={i.id} value={i.id}>{i.family}{i.variant ? ` · ${i.variant}` : ""}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Produto ou serviço" htmlFor="o-prod" className="sm:col-span-2"><Input id="o-prod" value={f.product} onChange={s("product")} className="h-10" /></Field>
          <Field label="Especificação" htmlFor="o-spec" className="sm:col-span-2"><Input id="o-spec" value={f.spec ?? ""} onChange={s("spec")} className="h-10" /></Field>
          <Field label="Unidade comercial" htmlFor="o-un"><Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v as Unit })}><SelectTrigger id="o-un" className="w-full h-10"><SelectValue /></SelectTrigger><SelectContent>{UNIT_KEYS.map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Preço (BRL)" htmlFor="o-preco"><MoneyInput id="o-preco" value={f.priceCents} placeholder="sob cotação" onChange={(v) => setF({ ...f, priceCents: v })} /></Field>
          <Field label="Quantidade mínima" htmlFor="o-min"><NumInput id="o-min" value={f.minQty ?? null} allowEmpty onChange={(v) => setF({ ...f, minQty: v ?? undefined })} /></Field>
          <Field label="Frete informado" htmlFor="o-frete"><MoneyInput id="o-frete" value={f.freightCents ?? null} placeholder="—" onChange={(v) => setF({ ...f, freightCents: v ?? undefined })} /></Field>
          <Field label="Prazo" htmlFor="o-prazo"><Input id="o-prazo" value={f.leadTime} onChange={s("leadTime")} className="h-10" /></Field>
          <Field label="Estoque" htmlFor="o-est"><Input id="o-est" value={f.stock} onChange={s("stock")} className="h-10" /></Field>
          <Field label="Retirada ou entrega" htmlFor="o-ent"><Input id="o-ent" value={f.delivery ?? ""} onChange={s("delivery")} className="h-10" /></Field>
          <Field label="Data da consulta" htmlFor="o-data"><Input id="o-data" type="date" value={(f.consultedAt ?? "").slice(0, 10)} onChange={s("consultedAt")} className="h-10" /></Field>
          <Field label="URL da fonte" htmlFor="o-url" className="sm:col-span-2"><Input id="o-url" value={f.sourceUrl ?? ""} onChange={s("sourceUrl")} className="h-10" placeholder="https://" /></Field>
          <Field label="Observação" htmlFor="o-nota" className="sm:col-span-2"><Input id="o-nota" value={f.note ?? ""} onChange={s("note")} className="h-10" /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsv({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const st = useStore();
  const [text, setText] = useState("");
  const rows: CsvRow[] = useMemo(() => (text.trim() ? parseOffersCsv(text, st.suppliers) : []), [text, st.suppliers]);
  const ok = rows.filter((r) => r.offer);
  const importar = async () => {
    for (const r of ok) await st.put("offers", r.offer!);
    toast.success(`${ok.length} oferta(s) importada(s).${rows.length - ok.length ? ` ${rows.length - ok.length} linha(s) com erro ficaram de fora.` : ""}`);
    setText("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar ofertas por CSV</DialogTitle><DialogDescription>Separador ponto e vírgula ou vírgula. O fornecedor precisa estar cadastrado com o mesmo nome. Preço vazio vira “sob cotação”.</DialogDescription></DialogHeader>
        <code className="block text-xs bg-muted rounded-xl p-3 overflow-x-auto whitespace-pre">{CSV_HEADER}{"\n"}ViaFlex BR;ACM 3 mm branco;1220 × 5000 mm;chapa;;1;a confirmar;a confirmar;retirada;;https://viaflexbr.com/rio-de-janeiro/;22/11/2026</code>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex"><input type="file" accept=".csv,text/csv,text/plain" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label>
          <span className="text-xs text-muted-foreground">ou cole o conteúdo abaixo</span>
        </div>
        <Textarea id="csv-texto" value={text} onChange={(e) => setText(e.target.value)} rows={5} className="font-mono text-xs" placeholder={CSV_HEADER} />
        {rows.length ? (
          <div className="rounded-2xl border overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Fornecedor</TableHead><TableHead>Produto</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.line} className={r.errors.length ? "bg-magenta/5" : ""}>
                    <TableCell className="tabular">{r.line}</TableCell>
                    <TableCell>{r.raw.fornecedor}</TableCell>
                    <TableCell>{r.raw.produto}</TableCell>
                    <TableCell>{r.raw.unidade}</TableCell>
                    <TableCell className="text-right tabular">{r.offer ? money(r.offer.priceCents) : r.raw.preco}</TableCell>
                    <TableCell className="text-sm">{r.errors.length ? <span className="text-magenta">{r.errors.join("; ")}</span> : <span className="text-ok font-semibold">válida</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!ok.length} onClick={importar}>Importar {ok.length} oferta(s) válida(s)</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
