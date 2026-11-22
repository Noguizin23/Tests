import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Bot, CheckCircle2, Download, FileCheck2, GitBranch, Info, Layers, Lightbulb, MessageCircle, Phone, Plus, RefreshCw, Search, Settings2, Sparkles, Trash2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyOrDefault, useStore } from "@/data/store";
import { calcQuote, emissionBlockers, issue, refreshCosts, revise, type QuoteCalc } from "@/domain/quote";
import { compareOffers, lineQty } from "@/domain/quantities";
import { priceFromMargin } from "@/domain/pricing";
import { quoteTips, type Tip } from "@/domain/tips";
import { money, pct, qty as fq, unitLabel, uid, date, addDays } from "@/domain/format";
import { waLink, telLink } from "@/domain/contacts";
import { CATEGORY_LABEL, UNITS, type CatalogItem, type LineCategory, type Quote, type QuoteLine, type Unit } from "@/domain/types";
import { proposalData, downloadProposal } from "@/pdf/proposal";
import { ContactButtons, Empty, Field, MoneyInput, NumInput, PageHead, PctInput, SupplierLogo } from "./common";
import { copyLines, fileToDataUrl, nextRevision } from "./ops";
import { NewQuote } from "./Dashboard";
import { ProposalPreview } from "./ProposalPreview";
import { cn } from "@/lib/utils";

const UNIT_KEYS = Object.keys(UNITS) as Unit[];

export default function QuoteEditor() {
  const st = useStore();
  const [novo, setNovo] = useState(false);
  const q = st.quotes.find((x) => x.id === st.openQuoteId);
  if (!q) {
    const recent = [...st.quotes].filter((x) => x.status === "rascunho").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
    return (
      <>
        <PageHead title="Orçamento aberto" desc="Nenhum orçamento está aberto agora." />
        <Empty title="Abra um rascunho ou crie um novo">
          <div className="grid gap-2 w-full max-w-md">
            {recent.map((r) => (
              <Button key={r.id} variant="outline" className="justify-start h-auto py-2 text-left whitespace-normal" onClick={() => st.setOpenQuoteId(r.id)}>
                <span className="tabular font-bold mr-2">{String(r.number).padStart(4, "0")}·r{r.revision}</span>{r.title}
              </Button>
            ))}
            <Button onClick={() => setNovo(true)}><Plus /> Novo orçamento</Button>
          </div>
        </Empty>
        <NewQuote open={novo} onOpenChange={setNovo} onCreated={(n) => st.setOpenQuoteId(n.id)} />
      </>
    );
  }
  return <Editor key={q.id} q={q} />;
}

function safeCalc(q: Quote): { calc: QuoteCalc | null; err: string | null } {
  try { return { calc: calcQuote(q), err: null }; } catch (e) { return { calc: null, err: (e as Error).message }; }
}

function Editor({ q }: { q: Quote }) {
  const st = useStore();
  const ro = q.status === "emitida";
  const [tab, setTab] = useState("projeto");
  const [resumo, setResumo] = useState(false);
  const { calc, err } = useMemo(() => safeCalc(q), [q]);
  const update = (patch: Partial<Quote>) => {
    if (ro) return;
    return st.put("quotes", { ...q, ...patch, updatedAt: new Date().toISOString() }).catch(() => {});
  };
  const setLine = (id: string, patch: Partial<QuoteLine>) => update({ lines: q.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const tips = calc ? quoteTips(q, calc, st.items, st.suppliers) : [];
  const client = st.clients.find((c) => c.id === q.clientId);

  const newRevision = async () => {
    const n = revise(q, nextRevision(st.quotes, q.number), uid());
    await st.put("quotes", n);
    st.setOpenQuoteId(n.id);
    toast.success(`Revisão r${n.revision} criada como rascunho.`);
  };

  const summary = calc ? <Summary q={q} calc={calc} tips={tips} onTab={setTab} onRevision={newRevision} /> : null;

  return (
    <div className="pb-24 lg:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground tabular">
            Proposta {String(q.number).padStart(4, "0")} · revisão {q.revision} · {client?.name ?? "sem cliente"}
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mt-2 break-words max-w-3xl">{q.title}</h1>
        </div>
        <div className="flex gap-2 items-center">
          {q.demo ? <Badge variant="outline" className="border-magenta text-magenta">Valores fictícios</Badge> : null}
          {ro ? <Badge className="bg-ok text-white">Emitida em {date(q.issuedAt)}</Badge> : <Badge variant="secondary">Rascunho · salvo</Badge>}
        </div>
      </div>

      {ro ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok/30 bg-ok/5 p-4 text-sm">
          <span className="flex items-center gap-2"><FileCheck2 className="size-4 text-ok" />Proposta emitida: custos, quantidades, margens e condições estão congelados.</span>
          <Button size="sm" onClick={newRevision}><GitBranch /> Criar revisão para alterar</Button>
        </div>
      ) : null}
      {err ? <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{err}</div> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="h-11 w-max">
              <TabsTrigger value="projeto" className="px-3">1 · Cliente e projeto</TabsTrigger>
              <TabsTrigger value="itens" className="px-3">2 · Materiais e serviços</TabsTrigger>
              <TabsTrigger value="margens" className="px-3">3 · Margens</TabsTrigger>
              <TabsTrigger value="revisao" className="px-3">4 · Revisão</TabsTrigger>
              <TabsTrigger value="pdf" className="px-3">5 · PDF</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="projeto" className="mt-8"><ProjectTab q={q} ro={ro} update={update} /></TabsContent>
          <TabsContent value="itens" className="mt-8">{calc ? <ItemsTab q={q} calc={calc} ro={ro} update={update} setLine={setLine} /> : null}</TabsContent>
          <TabsContent value="margens" className="mt-8">{calc ? <MarginsTab q={q} calc={calc} ro={ro} update={update} setLine={setLine} /> : null}</TabsContent>
          <TabsContent value="revisao" className="mt-8">{calc ? <ReviewTab q={q} calc={calc} ro={ro} setLine={setLine} /> : null}</TabsContent>
          <TabsContent value="pdf" className="mt-8"><PdfTab q={q} ro={ro} update={update} /></TabsContent>
        </Tabs>
        <aside className="hidden lg:block sticky top-6">{summary}</aside>
      </div>

      {/* Mobile: total and actions always reachable */}
      {calc ? (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Total · margem {pct(calc.pricing.effectiveMarginBp)}</p>
            <p className="font-heading text-xl font-extrabold tabular">{money(calc.pricing.totalCents)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResumo(true)}>Resumo{tips.length ? <Badge className="ml-1 bg-magenta text-white px-1.5">{tips.length}</Badge> : null}</Button>
            <Button onClick={() => setTab("pdf")}><Download /> PDF</Button>
          </div>
        </div>
      ) : null}
      <Sheet open={resumo} onOpenChange={setResumo}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle>Resumo e assistente</SheetTitle></SheetHeader>
          <div className="px-4 pb-6">{summary}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───────────── Summary + assistant ───────────── */

function Summary({ q, calc, tips, onTab, onRevision }: { q: Quote; calc: QuoteCalc; tips: Tip[]; onTab: (t: string) => void; onRevision: () => void }) {
  const p = calc.pricing;
  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-foreground text-background p-5 grid gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-white/60">Total da proposta</p>
        <p data-total className="font-heading text-4xl font-extrabold tabular leading-none">{money(p.totalCents)}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm tabular pt-3 border-t border-white/15">
          <dt className="text-white/60">Custo</dt><dd className="text-right">{money(p.costCents)}</dd>
          <dt className="text-white/60">Preço de venda</dt><dd className="text-right">{money(p.subtotalCents)}</dd>
          {p.discountCents ? (<><dt className="text-white/60">Desconto</dt><dd className="text-right">− {money(p.discountCents)}</dd></>) : null}
          {p.feeCents ? (<><dt className="text-white/60">Taxas comerciais</dt><dd className="text-right">− {money(p.feeCents)}</dd></>) : null}
          <dt className="text-white/60">Resultado</dt><dd className={cn("text-right font-bold", p.profitCents < 0 && "text-[#FF7AB8]")}>{money(p.profitCents)}</dd>
          <dt className="text-white/60">Margem efetiva</dt><dd className="text-right font-bold">{pct(p.effectiveMarginBp)}</dd>
        </dl>
        {p.pendingCount ? <p className="text-xs rounded-xl bg-magenta/20 text-[#FFB3D6] px-3 py-2">{p.pendingCount} item(ns) com custo pendente, somados como zero.</p> : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {q.status === "rascunho" ? <Button className="bg-white text-foreground hover:bg-white/90" onClick={() => onTab("revisao")}><FileCheck2 /> Revisar e emitir</Button> : <Button className="bg-white text-foreground hover:bg-white/90" onClick={onRevision}><GitBranch /> Nova revisão</Button>}
          <Button className="bg-magenta hover:bg-magenta/90" onClick={() => onTab("pdf")}><Download /> PDF</Button>
        </div>
      </div>
      <Assistant q={q} calc={calc} tips={tips} />
    </div>
  );
}

function Assistant({ q, calc, tips }: { q: Quote; calc: QuoteCalc; tips: Tip[] }) {
  const st = useStore();
  const [ai, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasClaude = !!(window as unknown as { claude?: unknown }).claude;
  const ask = async () => {
    setBusy(true);
    try {
      const claude = (window as unknown as { claude: { use(n: string): Promise<unknown> } }).claude;
      const sample = (await claude.use("sample")) as ((i: string, o?: object) => Promise<{ text: string }>) | null;
      if (!sample) { toast.info("O assistente do Claude não está disponível nesta visualização."); return; }
      const lines = q.lines.map((l) => `- [${l.deliverable}] ${l.description}: ${fq(l.qty, 2)} ${unitLabel(l.unit)}, custo ${calc.qty[l.id]?.costCents == null ? "pendente" : money(calc.qty[l.id].costCents)}, preço ${money(calc.pricing.lines.find((x) => x.id === l.id)?.priceCents ?? 0)}`).join("\n");
      const r = await sample(
        `Você revisa orçamentos de comunicação visual (fachadas, letra caixa, placas, adesivos) no Rio de Janeiro. Responda em português do Brasil, em até 6 tópicos curtos e práticos, apontando itens que costumam faltar, riscos de execução e de margem. Não invente preços.\n\nProjeto: ${q.title}\nAmbiente: ${q.environment}\nMedidas: ${q.measures}\nEscopo: ${q.scope}\nItens:\n${lines}\nTotal: ${money(calc.pricing.totalCents)} · margem efetiva ${pct(calc.pricing.effectiveMarginBp)}`,
        { modelTier: "quick", onText: ({ text }: { text: string }) => setAi(text) },
      );
      setAi(r.text);
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === "not_granted" ? "Permissão para o assistente do Claude negada." : code === "rate_limited" ? "Muitas consultas seguidas. Tente em instantes." : "Não foi possível consultar o assistente.");
    } finally { setBusy(false); }
  };
  const icon = { critico: AlertTriangle, aviso: Info, dica: Lightbulb };
  return (
    <div className="rounded-3xl border bg-card p-5 grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading font-bold flex items-center gap-2"><Sparkles className="size-4 text-magenta" />Assistente</p>
        <span className="text-xs text-muted-foreground">{tips.length ? `${tips.length} ponto(s)` : "tudo certo"}</span>
      </div>
      {tips.length === 0 ? <p className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="size-4 text-ok" />Nenhum alerta para este orçamento.</p> : null}
      <ul className="grid gap-2">
        {tips.map((t, i) => {
          const I = icon[t.level];
          const sup = t.supplierId ? st.suppliers.find((s) => s.id === t.supplierId) : undefined;
          return (
            <li key={i} className={cn("rounded-xl px-3 py-2.5 text-sm flex gap-2.5 animate-in fade-in slide-in-from-right-2", t.level === "critico" ? "bg-magenta/10 text-[#A1004F]" : t.level === "aviso" ? "bg-amber-50 text-aviso" : "bg-muted text-foreground")} style={{ animationDelay: `${i * 40}ms` }}>
              <I className="size-4 shrink-0 mt-0.5" />
              <div className="grid gap-2 min-w-0"><span>{t.text}</span>{sup ? <ContactButtons s={sup} compact /> : null}</div>
            </li>
          );
        })}
      </ul>
      {hasClaude ? (
        <div className="border-t pt-3 grid gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={ask}><Bot /> {busy ? "Analisando…" : "Pedir análise ao Claude"}</Button>
          {ai ? <div className="text-sm whitespace-pre-wrap rounded-xl bg-muted p-3">{ai}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────── Tab 1: client and project ───────────── */

function Commit({ id, value, onCommit, multiline, placeholder, disabled }: { id: string; value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string; disabled?: boolean }) {
  const [v, setV] = useState(value);
  const props = { id, value: v, placeholder, disabled, onChange: (e: { target: { value: string } }) => setV(e.target.value), onBlur: () => v !== value && onCommit(v) };
  return multiline ? <Textarea {...props} rows={3} /> : <Input {...props} className="h-10" />;
}

function ProjectTab({ q, ro, update }: { q: Quote; ro: boolean; update: (p: Partial<Quote>) => void }) {
  const st = useStore();
  const client = st.clients.find((c) => c.id === q.clientId);
  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all([...files].slice(0, 6 - q.photos.length).map((f) => fileToDataUrl(f, 900)));
      update({ photos: [...q.photos, ...urls] });
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border bg-card p-6 md:p-8 grid gap-5">
        <h2 className="text-lg font-bold">Cliente</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Cliente" htmlFor="q-cliente">
            <Select value={q.clientId ?? ""} onValueChange={(v) => update({ clientId: v })} disabled={ro}>
              <SelectTrigger id="q-cliente" className="w-full h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{st.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="text-sm text-muted-foreground self-end">
            {client ? <>{[client.contact, client.phone, client.email].filter(Boolean).join(" · ") || "Sem contato cadastrado."} <a className="text-primary font-semibold" href="#app-clientes">Editar em Clientes</a></> : <a className="text-primary font-semibold" href="#app-clientes">Cadastrar cliente</a>}
          </div>
        </div>
      </section>
      <section className="rounded-3xl border bg-card p-6 md:p-8 grid gap-5">
        <h2 className="text-lg font-bold">Projeto</h2>
        <Field label="Título" htmlFor="q-titulo"><Commit id="q-titulo" value={q.title} onCommit={(v) => update({ title: v })} disabled={ro} /></Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Endereço de instalação" htmlFor="q-end"><Commit id="q-end" value={q.installAddress} onCommit={(v) => update({ installAddress: v })} placeholder="Rua, número, bairro" disabled={ro} /></Field>
          <Field label="Ambiente">
            <div className="flex gap-2">
              {(["interno", "externo"] as const).map((e) => (
                <Button key={e} type="button" disabled={ro} variant={q.environment === e ? "default" : "outline"} className="flex-1 h-10 capitalize" onClick={() => update({ environment: e })}>{e}</Button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Medidas" htmlFor="q-medidas" hint="Ex.: fachada 6,00 × 1,20 m · letras de 40 cm"><Commit id="q-medidas" value={q.measures} onCommit={(v) => update({ measures: v })} disabled={ro} /></Field>
        <Field label="Escopo (vai para o PDF)" htmlFor="q-escopo"><Commit id="q-escopo" multiline value={q.scope} onCommit={(v) => update({ scope: v })} disabled={ro} /></Field>
        <Field label="Observações internas (não vão para o PDF)" htmlFor="q-int"><Commit id="q-int" multiline value={q.internalNotes} onCommit={(v) => update({ internalNotes: v })} disabled={ro} /></Field>
        <Field label="Fotos do local">
          <div className="flex flex-wrap gap-3">
            {q.photos.map((p, i) => (
              <div key={i} className="relative size-24 rounded-xl overflow-hidden border">
                <img src={p} alt={`Foto ${i + 1} do local`} className="size-full object-cover" />
                {!ro ? <button type="button" aria-label="Remover foto" onClick={() => update({ photos: q.photos.filter((_, k) => k !== i) })} className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1"><X className="size-3" /></button> : null}
              </div>
            ))}
            {!ro && q.photos.length < 6 ? (
              <label className="size-24 rounded-xl border border-dashed grid place-items-center text-muted-foreground cursor-pointer hover:border-primary hover:text-primary">
                <span className="grid place-items-center gap-1 text-xs"><ImagePlus className="size-5" />Adicionar</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            ) : null}
          </div>
        </Field>
      </section>
    </div>
  );
}

/* ───────────── Tab 2: items ───────────── */

function groups(q: Quote) {
  const m = new Map<string, QuoteLine[]>();
  for (const l of q.lines) m.set(l.deliverable || "Itens", [...(m.get(l.deliverable || "Itens") ?? []), l]);
  return [...m.entries()];
}

function ItemsTab({ q, calc, ro, update, setLine }: { q: Quote; calc: QuoteCalc; ro: boolean; update: (p: Partial<Quote>) => void; setLine: (id: string, p: Partial<QuoteLine>) => void }) {
  const st = useStore();
  const [add, setAdd] = useState(false);
  const [tpl, setTpl] = useState(false);
  const [edit, setEdit] = useState<QuoteLine | null>(null);
  const price = new Map(calc.pricing.lines.map((l) => [l.id, l]));
  const deliverables = groups(q).map(([d]) => d);
  const addLine = (l: Partial<QuoteLine>) => {
    const line: QuoteLine = { id: uid(), deliverable: deliverables[0] ?? "Itens", description: "Item avulso", category: "outros", unit: "un", qty: 1, wasteBp: 0, perPurchase: 1, unitCostCents: null, chargeMode: "rateado", ...l };
    update({ lines: [...q.lines, line] });
    return line;
  };
  const refresh = () => {
    const r = refreshCosts(q, st.offers);
    if (!r.changed.length) { toast.info("Os custos já estão iguais aos do catálogo."); return; }
    update({ lines: r.quote.lines });
    toast.success(`${r.changed.length} custo(s) atualizado(s) a partir do catálogo.`);
  };
  const renameGroup = (from: string, to: string) => to.trim() && update({ lines: q.lines.map((l) => ((l.deliverable || "Itens") === from ? { ...l, deliverable: to.trim() } : l)) });

  return (
    <div className="grid gap-6">
      {!ro ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdd(true)}><Search /> Adicionar do catálogo</Button>
          <Button variant="outline" onClick={() => setEdit(addLine({}))}><Plus /> Item avulso</Button>
          <Button variant="outline" onClick={() => setTpl(true)}><Layers /> Aplicar modelo</Button>
          <Button variant="ghost" onClick={refresh} title="Copia para este rascunho os preços atuais das ofertas vinculadas"><RefreshCw /> Atualizar custos do catálogo</Button>
        </div>
      ) : null}
      {q.lines.length === 0 ? <Empty title="Nenhum item ainda"><p className="text-sm text-muted-foreground">Adicione do catálogo, aplique um modelo ou crie um item avulso.</p></Empty> : null}
      {groups(q).map(([d, lines]) => {
        const tot = lines.reduce((a, l) => a + (price.get(l.id)?.priceCents ?? 0), 0);
        return (
          <section key={d} className="rounded-3xl border bg-card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b bg-muted/40">
              {ro ? <h3 className="font-bold">{d}</h3> : <DeliverableName name={d} onRename={(v) => renameGroup(d, v)} />}
              <span className="text-sm tabular"><span className="text-muted-foreground">Entregável · </span><b>{money(tot)}</b></span>
            </header>
            <div className="overflow-x-auto">
              <Table className="min-w-[860px] [&_td]:py-4">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[26%]">Item</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Perda</TableHead>
                    <TableHead className="text-right">Custo unit. (compra)</TableHead>
                    <TableHead>Compra</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const c = calc.qty[l.id];
                    const pl = price.get(l.id);
                    const sup = l.supplierId ? st.suppliers.find((s) => s.id === l.supplierId) : undefined;
                    return (
                      <TableRow key={l.id} className={cn(c.pending && "bg-magenta/[0.04]")}>
                        <TableCell className="align-top">
                          <button type="button" className="text-left font-semibold hover:text-primary" onClick={() => setEdit(l)}>{l.description}</button>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 items-center mt-0.5">
                            <span>{CATEGORY_LABEL[l.category]}</span>
                            {sup ? <span className="inline-flex items-center gap-1">· {sup.name}
                              {sup.whatsapp ? <a href={waLink(sup.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-ok" aria-label={`WhatsApp ${sup.name}`} title="Chamar no WhatsApp"><MessageCircle className="size-3.5" /></a>
                                : sup.phones[0] ? <a href={telLink(sup.phones[0])} className="text-primary" aria-label={`Ligar para ${sup.name}`} title="Ligar"><Phone className="size-3.5" /></a> : null}
                            </span> : null}
                            {c.pending ? <Badge variant="outline" className="border-magenta text-magenta h-5">custo pendente</Badge> : null}
                            {l.zeroConfirmed && l.unitCostCents == null ? <Badge variant="outline" className="h-5">custo zero confirmado</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top w-32"><NumInput value={l.qty} onChange={(v) => setLine(l.id, { qty: v ?? 0 })} disabled={ro} suffix={UNITS[l.unit] === "m²" ? "m²" : ""} /><p className="text-[11px] text-muted-foreground text-right mt-1">{unitLabel(l.unit)}</p></TableCell>
                        <TableCell className="align-top w-24"><PctInput value={l.wasteBp} onChange={(v) => setLine(l.id, { wasteBp: v ?? 0 })} disabled={ro} max={20000} /></TableCell>
                        <TableCell className="align-top w-36"><MoneyInput value={l.unitCostCents} onChange={(v) => setLine(l.id, { unitCostCents: v, zeroConfirmed: v === 0 ? true : l.zeroConfirmed })} disabled={ro} /><p className="text-[11px] text-muted-foreground text-right mt-1">por {unitLabel(l.purchaseUnit ?? l.unit)}</p></TableCell>
                        <TableCell className="align-top text-xs whitespace-nowrap">
                          {l.perPurchase > 1 || l.layout ? (
                            <div className="grid gap-0.5 tabular">
                              <span>área: <b>{c.purchaseByArea}</b> {unitLabel(l.purchaseUnit ?? l.unit)}</span>
                              {c.purchaseByLayout != null ? <span>plano: <b>{c.purchaseByLayout}</b></span> : null}
                              {l.manualPurchaseQty ? <span>manual: <b>{l.manualPurchaseQty}</b></span> : null}
                              <button type="button" disabled={ro} onClick={() => setLine(l.id, { chargeMode: l.chargeMode === "compra" ? "rateado" : "compra" })} className="text-left text-primary font-semibold">{l.chargeMode === "compra" ? "cobra compra inteira" : "cobra rateio"}</button>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="align-top text-right tabular whitespace-nowrap">{c.costCents == null ? <span className="text-magenta font-semibold">pendente</span> : money(c.costCents)}</TableCell>
                        <TableCell className="align-top text-right tabular font-bold whitespace-nowrap">{money(pl?.priceCents ?? 0)}<p className="text-[11px] text-muted-foreground font-normal">{pct(pl?.marginBp ?? 0)}</p></TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEdit(l)} aria-label="Detalhes do item" title="Detalhes, chapa e plano de corte"><Settings2 /></Button>
                          {!ro ? <Button variant="ghost" size="icon-sm" onClick={() => update({ lines: q.lines.filter((x) => x.id !== l.id) })} aria-label="Remover item"><Trash2 /></Button> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      <AddFromCatalog open={add} onOpenChange={setAdd} deliverables={deliverables} onAdd={(l) => { addLine(l); toast.success(`“${l.description}” adicionado.`); }} />
      <ApplyTemplate open={tpl} onOpenChange={setTpl} onApply={(lines) => update({ lines: [...q.lines, ...copyLines(lines)] })} />
      {edit ? <LineDialog line={q.lines.find((x) => x.id === edit.id) ?? edit} ro={ro} deliverables={deliverables} onClose={() => setEdit(null)} onChange={(p) => setLine(edit.id, p)} /> : null}
    </div>
  );
}

function DeliverableName({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [v, setV] = useState(name);
  return <Input aria-label="Nome do entregável" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== name && onRename(v)} className="h-9 max-w-xs font-bold bg-transparent border-transparent hover:border-input focus-visible:bg-card" />;
}

function ApplyTemplate({ open, onOpenChange, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; onApply: (l: QuoteLine[]) => void }) {
  const st = useStore();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Aplicar modelo</DialogTitle><DialogDescription>Os itens do modelo entram com custo pendente. Ajuste quantidades e custos depois.</DialogDescription></DialogHeader>
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
          {st.templates.map((t) => (
            <button key={t.id} type="button" onClick={() => { onApply(t.lines); onOpenChange(false); toast.success(`Modelo “${t.name}” aplicado.`); }} className="text-left rounded-2xl border p-4 hover:border-primary hover:bg-roxo-50 transition-colors">
              <p className="font-bold">{t.name}</p><p className="text-sm text-muted-foreground">{t.description}</p><p className="text-xs text-muted-foreground mt-1">{t.lines.length} itens</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddFromCatalog({ open, onOpenChange, deliverables, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; deliverables: string[]; onAdd: (l: Partial<QuoteLine>) => void }) {
  const st = useStore();
  const [t, setT] = useState("");
  const [sel, setSel] = useState<CatalogItem | null>(null);
  const [need, setNeed] = useState<number>(1);
  const [deliv, setDeliv] = useState("");
  const list = useMemo(() => {
    const k = t.toLowerCase();
    return st.items.filter((i) => !k || `${i.family} ${i.variant ?? ""} ${i.group}`.toLowerCase().includes(k)).slice(0, 60);
  }, [st.items, t]);
  const offers = sel ? st.offers.filter((o) => o.itemId === sel.id || st.items.find((x) => x.id === o.itemId)?.family === sel.family) : [];
  const cmp = sel ? compareOffers(offers, need, sel.perPurchase) : [];
  const target = deliv.trim() || deliverables[0] || "Itens";
  const pick = (offerId?: string) => {
    if (!sel) return;
    const o = st.offers.find((x) => x.id === offerId);
    onAdd({
      deliverable: target,
      description: sel.variant ? `${sel.family} ${sel.variant}` : sel.family,
      category: sel.kind === "servico" ? (sel.group === "Logística e instalação" ? "logistica" : "terceirizacao") : "material",
      itemId: sel.id,
      offerId: o?.id,
      supplierId: o?.supplierId,
      unit: sel.consumptionUnit,
      purchaseUnit: sel.purchaseUnit,
      perPurchase: sel.perPurchase,
      qty: need,
      unitCostCents: o?.priceCents ?? null,
      chargeMode: sel.purchaseUnit === "chapa" ? "compra" : "rateado",
      layout: sel.sheetW && sel.sheetH ? null : undefined,
    });
    onOpenChange(false);
    setSel(null);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSel(null); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sel ? sel.family + (sel.variant ? ` ${sel.variant}` : "") : "Adicionar do catálogo"}</DialogTitle><DialogDescription>{sel ? "Compare as ofertas pelo custo efetivo na mesma unidade, já com pedido mínimo e frete." : "Busque por material, serviço ou grupo."}</DialogDescription></DialogHeader>
        {!sel ? (
          <>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="cat-busca" autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="ACM, acrílico, LED, instalação…" className="pl-9 h-10" /></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {list.map((i) => {
                const n = st.offers.filter((o) => o.itemId === i.id).length;
                return (
                  <button key={i.id} type="button" onClick={() => setSel(i)} className="text-left rounded-xl border px-3 py-2.5 hover:border-primary hover:bg-roxo-50 transition-colors">
                    <p className="font-semibold text-sm">{i.family}{i.variant ? ` ${i.variant}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{i.group} · compra por {unitLabel(i.purchaseUnit)} · {n ? `${n} oferta(s)` : "sem oferta"}</p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={`Quantidade necessária (${unitLabel(sel.consumptionUnit)})`} htmlFor="cat-need"><NumInput id="cat-need" value={need} onChange={(v) => setNeed(v ?? 0)} /></Field>
              <Field label="Entregável" htmlFor="cat-deliv" hint={deliverables.length ? `Existentes: ${deliverables.join(", ")}` : undefined}><Input id="cat-deliv" value={deliv} onChange={(e) => setDeliv(e.target.value)} placeholder={deliverables[0] ?? "Ex.: Fachada em ACM"} className="h-10" /></Field>
            </div>
            {cmp.length ? (
              <div className="rounded-2xl border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Oferta</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Compra</TableHead><TableHead className="text-right">Custo efetivo / {unitLabel(sel.consumptionUnit)}</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {cmp.map(({ offer: o, purchaseQty, totalCents, perUnitCents }, k) => {
                      const s = st.suppliers.find((x) => x.id === o.supplierId);
                      return (
                        <TableRow key={o.id}>
                          <TableCell><p className="font-semibold">{o.product}</p><p className="text-xs text-muted-foreground">{s?.name}{o.minQty ? ` · mínimo ${o.minQty}` : ""}{o.freightCents ? ` · frete ${money(o.freightCents)}` : ""} · prazo {o.leadTime}</p>{o.demo ? <Badge variant="outline" className="border-magenta text-magenta mt-1">fictício</Badge> : null}</TableCell>
                          <TableCell className="text-right tabular whitespace-nowrap">{money(o.priceCents)}<span className="text-xs text-muted-foreground"> /{unitLabel(o.unit)}</span></TableCell>
                          <TableCell className="text-right tabular">{purchaseQty} {unitLabel(o.unit)}<p className="text-xs text-muted-foreground">{totalCents != null ? money(totalCents) : ""}</p></TableCell>
                          <TableCell className="text-right tabular font-bold">{perUnitCents != null ? money(Math.round(perUnitCents)) : "sob cotação"}{k === 0 && perUnitCents != null ? <Badge className="ml-2 bg-ok text-white">melhor</Badge> : null}</TableCell>
                          <TableCell><Button size="sm" onClick={() => pick(o.id)}>Usar</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma oferta cadastrada para esta família. O item entra com custo pendente.</p>}
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => setSel(null)}>Voltar à busca</Button>
              <Button variant="outline" onClick={() => pick()}>Adicionar sem oferta (custo pendente)</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LineDialog({ line: l, ro, deliverables, onClose, onChange }: { line: QuoteLine; ro: boolean; deliverables: string[]; onClose: () => void; onChange: (p: Partial<QuoteLine>) => void }) {
  const st = useStore();
  const c = lineQty(l);
  const lay = l.layout;
  const item = st.items.find((i) => i.id === l.itemId);
  const setLay = (p: Partial<NonNullable<QuoteLine["layout"]>>) => onChange({ layout: { pieceW: 0, pieceH: 0, count: 1, sheetW: item?.sheetW ?? 1220, sheetH: item?.sheetH ?? 2440, ...lay, ...p } });
  const pu = unitLabel(l.purchaseUnit ?? l.unit);
  const sup = st.suppliers.find((s) => s.id === l.supplierId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detalhes do item</DialogTitle><DialogDescription>Unidade de compra, conversão, perda, plano de corte e cobrança.</DialogDescription></DialogHeader>
        <fieldset disabled={ro} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Descrição" htmlFor="ld-desc"><Commit id="ld-desc" value={l.description} onCommit={(v) => onChange({ description: v })} /></Field>
            <Field label="Entregável" htmlFor="ld-deliv" hint={deliverables.join(" · ")}><Commit id="ld-deliv" value={l.deliverable} onCommit={(v) => onChange({ deliverable: v })} /></Field>
            <Field label="Categoria" htmlFor="ld-cat">
              <Select value={l.category} onValueChange={(v) => onChange({ category: v as LineCategory })}>
                <SelectTrigger id="ld-cat" className="w-full h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidade de consumo" htmlFor="ld-u">
                <Select value={l.unit} onValueChange={(v) => onChange({ unit: v as Unit })}>
                  <SelectTrigger id="ld-u" className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_KEYS.map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Unidade de compra" htmlFor="ld-pu">
                <Select value={l.purchaseUnit ?? l.unit} onValueChange={(v) => onChange({ purchaseUnit: v as Unit })}>
                  <SelectTrigger id="ld-pu" className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_KEYS.map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label={`Quantidade (${unitLabel(l.unit)})`} htmlFor="ld-q"><NumInput id="ld-q" value={l.qty} onChange={(v) => onChange({ qty: v ?? 0 })} /></Field>
            <Field label="Perda estimada" htmlFor="ld-w"><PctInput id="ld-w" value={l.wasteBp} max={20000} onChange={(v) => onChange({ wasteBp: v ?? 0 })} /></Field>
            <Field label={`${unitLabel(l.unit)} por ${pu}`} htmlFor="ld-per" hint="Ex.: chapa 1,22×2,44 = 2,9768 m²"><NumInput id="ld-per" value={l.perPurchase} onChange={(v) => onChange({ perPurchase: v && v > 0 ? v : 1 })} /></Field>
            <Field label={`Custo por ${pu}`} htmlFor="ld-c"><MoneyInput id="ld-c" value={l.unitCostCents} onChange={(v) => onChange({ unitCostCents: v })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!l.zeroConfirmed} onCheckedChange={(v) => onChange({ zeroConfirmed: !!v })} />Confirmo custo zero quando o custo estiver vazio (ex.: material do cliente)</label>

          {l.perPurchase > 1 || lay || l.purchaseUnit === "chapa" || l.purchaseUnit === "rolo" ? (
            <div className="rounded-2xl border p-4 grid gap-3 bg-muted/30">
              <p className="font-bold">Chapa ou rolo</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Field label="Peça largura (mm)" htmlFor="ld-pw"><NumInput id="ld-pw" value={lay?.pieceW ?? null} allowEmpty onChange={(v) => setLay({ pieceW: v ?? 0 })} /></Field>
                <Field label="Peça altura (mm)" htmlFor="ld-ph"><NumInput id="ld-ph" value={lay?.pieceH ?? null} allowEmpty onChange={(v) => setLay({ pieceH: v ?? 0 })} /></Field>
                <Field label="Nº de peças" htmlFor="ld-pc"><NumInput id="ld-pc" value={lay?.count ?? null} allowEmpty onChange={(v) => setLay({ count: Math.max(1, Math.round(v ?? 1)) })} /></Field>
                <Field label="Chapa largura (mm)" htmlFor="ld-sw"><NumInput id="ld-sw" value={lay?.sheetW ?? item?.sheetW ?? null} allowEmpty onChange={(v) => setLay({ sheetW: v ?? 0 })} /></Field>
                <Field label="Chapa altura (mm)" htmlFor="ld-sh"><NumInput id="ld-sh" value={lay?.sheetH ?? item?.sheetH ?? null} allowEmpty onChange={(v) => setLay({ sheetH: v ?? 0 })} /></Field>
              </div>
              {lay && lay.pieceW > 0 && lay.pieceH > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onChange({ qty: Math.round(((lay.pieceW * lay.pieceH * lay.count) / 1e6) * 10000) / 10000, unit: "m2" })}>Usar área das peças como quantidade ({fq((lay.pieceW * lay.pieceH * lay.count) / 1e6)} m²)</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ layout: null })}>Remover plano de corte</Button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Consumo com perda" value={`${fq(c.consumption, 3)} ${unitLabel(l.unit)}`} />
                <Metric label={`Por área (estimativa)`} value={`${c.purchaseByArea} ${pu}`} sub={`${fq(c.purchaseExact, 3)} exato`} />
                <Metric label="Pelo plano de corte" value={c.purchaseByLayout != null ? `${c.purchaseByLayout} ${pu}` : lay ? "peça não cabe" : "—"} warn={!c.layoutFits} />
                <Metric label="Sobra" value={`${fq(c.leftover, 3)} ${unitLabel(l.unit)}`} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 items-end">
                <Field label={`Quantidade de ${pu} pelo seu plano (manual)`} htmlFor="ld-man" hint="Quando preenchido, substitui as estimativas."><NumInput id="ld-man" value={l.manualPurchaseQty ?? null} allowEmpty onChange={(v) => onChange({ manualPurchaseQty: v })} /></Field>
                <Field label="Cobrança">
                  <div className="flex gap-2">
                    <Button type="button" variant={l.chargeMode === "rateado" ? "default" : "outline"} className="flex-1" onClick={() => onChange({ chargeMode: "rateado" })}>Consumo rateado</Button>
                    <Button type="button" variant={l.chargeMode === "compra" ? "default" : "outline"} className="flex-1" onClick={() => onChange({ chargeMode: "compra" })}>Compra inteira ({c.purchaseQty})</Button>
                  </div>
                </Field>
              </div>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-3 items-start">
            <Field label="Margem própria desta linha" htmlFor="ld-m" hint="Vazio = usa a margem geral. Margem = (venda − custo) ÷ venda."><PctInput id="ld-m" value={l.marginBp ?? null} allowEmpty onChange={(v) => onChange({ marginBp: v })} /></Field>
            <div className="rounded-2xl bg-foreground text-background p-4 text-sm grid gap-1 tabular">
              <span className="text-white/60 text-xs uppercase font-bold">Custo da linha</span>
              <span className="font-heading text-2xl font-extrabold">{c.costCents == null ? "pendente" : money(c.costCents)}</span>
              {c.costCents != null && l.marginBp != null ? <span className="text-white/70">Preço com {pct(l.marginBp)}: {money(priceFromMargin(c.costCents, l.marginBp))}</span> : null}
            </div>
          </div>
        </fieldset>
        {sup ? <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3"><SupplierLogo s={sup} size={40} /><div className="min-w-0 flex-1"><p className="font-bold">{sup.name}</p><p className="text-xs text-muted-foreground">{sup.neighborhood}</p></div><ContactButtons s={sup} compact /></div> : null}
        <DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return <div className={cn("rounded-xl border bg-card p-3", warn && "border-magenta text-magenta")}><p className="text-[11px] uppercase font-bold text-muted-foreground">{label}</p><p className="font-bold tabular">{value}</p>{sub ? <p className="text-[11px] text-muted-foreground tabular">{sub}</p> : null}</div>;
}

/* ───────────── Tab 3: margins ───────────── */

function MarginsTab({ q, calc, ro, update, setLine }: { q: Quote; calc: QuoteCalc; ro: boolean; update: (p: Partial<Quote>) => void; setLine: (id: string, p: Partial<QuoteLine>) => void }) {
  const p = calc.pricing;
  const markup = (bp: number) => (bp >= 10000 ? "—" : pct(Math.round((bp * 10000) / (10000 - bp))));
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border bg-card p-6 md:p-8 grid gap-5">
        <div className="flex flex-wrap gap-2">
          <Button disabled={ro} variant={q.pricingMode === "item" ? "default" : "outline"} onClick={() => update({ pricingMode: "item" })}>Por item</Button>
          <Button disabled={ro} variant={q.pricingMode === "meta" ? "default" : "outline"} onClick={() => update({ pricingMode: "meta" })}>Meta do projeto</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {q.pricingMode === "item"
            ? "A margem geral vale para todas as linhas; uma margem própria substitui a geral naquela linha."
            : "O app calcula o preço total para atingir a meta sobre todos os custos. Linhas com margem própria mantêm o preço; o restante é distribuído pelas demais linhas, proporcional ao custo."}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {q.pricingMode === "item"
            ? <Field label="Margem geral" htmlFor="m-geral" hint={`markup equivalente ${markup(q.marginBp)}`}><PctInput id="m-geral" value={q.marginBp} onChange={(v) => update({ marginBp: v ?? 0 })} disabled={ro} /></Field>
            : <Field label="Meta de margem" htmlFor="m-meta" hint={`markup equivalente ${markup(q.targetMarginBp)}`}><PctInput id="m-meta" value={q.targetMarginBp} onChange={(v) => update({ targetMarginBp: v ?? 0 })} disabled={ro} /></Field>}
          <Field label="Desconto" htmlFor="m-desc"><PctInput id="m-desc" value={q.discountBp} max={10000} onChange={(v) => update({ discountBp: v ?? 0 })} disabled={ro} /></Field>
          <Field label="Taxas comerciais" htmlFor="m-taxa" hint="Impostos ou taxa de cartão sobre o preço final"><PctInput id="m-taxa" value={q.feeBp} max={9999} onChange={(v) => update({ feeBp: v ?? 0 })} disabled={ro} /></Field>
          <div className="rounded-2xl bg-primary text-primary-foreground p-3"><p className="text-[11px] uppercase font-bold opacity-80">Margem efetiva</p><p className="font-heading text-2xl font-extrabold tabular">{pct(p.effectiveMarginBp)}</p><p className="text-[11px] opacity-80">antes do desconto {pct(p.grossMarginBp)}</p></div>
        </div>
        {p.meta ? (
          <div className={cn("rounded-2xl p-4 text-sm grid sm:grid-cols-3 gap-2 tabular", p.meta.feasible ? "bg-ok/10" : "bg-magenta/10 text-[#A1004F]")}>
            <span>Preço necessário: <b>{money(p.meta.targetCents)}</b></span>
            <span>Preço obtido: <b>{money(p.meta.achievedCents)}</b></span>
            <span>Divergência: <b>{money(p.meta.divergenceCents)}</b></span>
            {p.meta.message ? <span className="sm:col-span-3 font-semibold">{p.meta.message}</span> : null}
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl border bg-card overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right w-32">Margem própria</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.lines.map((pl) => {
              const l = q.lines.find((x) => x.id === pl.id)!;
              return (
                <TableRow key={pl.id}>
                  <TableCell><p className="font-semibold">{l.description}</p><p className="text-xs text-muted-foreground">{pl.deliverable}</p></TableCell>
                  <TableCell className="text-right tabular">{pl.pending ? <span className="text-magenta">pendente</span> : money(pl.costCents)}</TableCell>
                  <TableCell><PctInput value={l.marginBp ?? null} allowEmpty placeholder="geral" onChange={(v) => setLine(l.id, { marginBp: v })} disabled={ro} /></TableCell>
                  <TableCell className="text-right tabular font-bold">{money(pl.priceCents)}</TableCell>
                  <TableCell className="text-right tabular">{pct(pl.marginBp)}{pl.locked ? <Badge variant="outline" className="ml-2 border-magenta text-magenta">própria</Badge> : null}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

/* ───────────── Tab 4: internal review + emission ───────────── */

function ReviewTab({ q, calc, ro, setLine }: { q: Quote; calc: QuoteCalc; ro: boolean; setLine: (id: string, p: Partial<QuoteLine>) => void }) {
  const st = useStore();
  const [confirm, setConfirm] = useState(false);
  const blockers = ro ? [] : emissionBlockers(q, calc);
  const p = calc.pricing;
  const pending = q.lines.filter((l) => calc.qty[l.id]?.pending);
  const supIds = [...new Set(q.lines.map((l) => l.supplierId).filter(Boolean))] as string[];
  const doIssue = async () => {
    try {
      const client = st.clients.find((c) => c.id === q.clientId);
      await st.put("quotes", issue(q, companyOrDefault(st.company), client));
      setConfirm(false);
      toast.success("Proposta emitida. Valores congelados.");
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Box label="Custo total" v={money(p.costCents)} />
        <Box label="Preço de venda" v={money(p.subtotalCents)} />
        <Box label="Desconto" v={money(p.discountCents)} />
        <Box label="Taxas comerciais" v={money(p.feeCents)} />
        <Box label="Resultado" v={money(p.profitCents)} strong />
        <Box label="Margem efetiva" v={pct(p.effectiveMarginBp)} strong />
      </section>

      {pending.length && !ro ? (
        <section className="rounded-3xl border border-magenta/40 bg-magenta/5 p-5 grid gap-3">
          <p className="font-bold text-[#A1004F] flex items-center gap-2"><AlertTriangle className="size-4" />Custos pendentes</p>
          {pending.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex-1 min-w-[160px] font-semibold">{l.description}</span>
              <MoneyInput className="w-40" value={l.unitCostCents} onChange={(v) => setLine(l.id, { unitCostCents: v })} />
              <Button size="sm" variant="outline" onClick={() => setLine(l.id, { zeroConfirmed: true })}>Confirmar custo zero</Button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-3xl border bg-card overflow-x-auto">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between"><h3 className="font-bold">Revisão interna</h3><span className="text-xs text-muted-foreground">Não aparece no PDF do cliente</span></div>
        <Table className="min-w-[760px]">
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Qtd. compra</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.lines.map((pl) => {
              const l = q.lines.find((x) => x.id === pl.id);
              const c = calc.qty[pl.id];
              const s = st.suppliers.find((x) => x.id === l?.supplierId);
              return (
                <TableRow key={pl.id}>
                  <TableCell><p className="font-semibold">{l?.description ?? pl.id}</p><p className="text-xs text-muted-foreground">{pl.deliverable} · {l ? CATEGORY_LABEL[l.category] : ""}</p></TableCell>
                  <TableCell className="text-sm">{s?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular text-sm">{l && (l.perPurchase > 1 || l.layout) ? `${c.purchaseQty} ${unitLabel(l.purchaseUnit ?? l.unit)}` : l ? `${fq(c.consumption, 2)} ${unitLabel(l.unit)}` : ""}</TableCell>
                  <TableCell className="text-right tabular">{pl.pending ? <span className="text-magenta">pendente</span> : money(pl.costCents)}</TableCell>
                  <TableCell className="text-right tabular font-bold">{money(pl.priceCents)}</TableCell>
                  <TableCell className="text-right tabular">{pct(pl.marginBp)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {q.internalNotes ? <p className="px-5 py-4 text-sm border-t"><b>Observações internas:</b> {q.internalNotes}</p> : null}
      </section>

      {supIds.length ? (
        <section className="rounded-3xl border bg-card p-5 grid gap-3">
          <h3 className="font-bold">Fornecedores deste orçamento</h3>
          {supIds.map((id) => { const s = st.suppliers.find((x) => x.id === id); return s ? (
            <div key={id} className="flex flex-wrap items-center gap-3"><SupplierLogo s={s} size={40} /><span className="flex-1 min-w-[140px] font-semibold">{s.name}<span className="block text-xs text-muted-foreground font-normal">{s.neighborhood}</span></span><ContactButtons s={s} compact /></div>
          ) : null; })}
        </section>
      ) : null}

      {!ro ? (
        <section className="rounded-3xl bg-foreground text-background p-5 grid gap-3">
          <h3 className="font-bold text-lg">Emitir proposta</h3>
          {blockers.length ? (
            <ul className="grid gap-1.5 text-sm">{blockers.map((b) => <li key={b} className="flex gap-2"><AlertTriangle className="size-4 text-[#FF7AB8] shrink-0 mt-0.5" />{b}</li>)}</ul>
          ) : <p className="text-sm text-white/70">Tudo pronto. Ao emitir, custos, quantidades, margens, condições e dados do PDF ficam congelados nesta revisão.</p>}
          <Button disabled={blockers.length > 0} className="bg-magenta hover:bg-magenta/90 w-fit" onClick={() => setConfirm(true)}><FileCheck2 /> Emitir proposta</Button>
        </section>
      ) : null}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Emitir a proposta {String(q.number).padStart(4, "0")} r{q.revision}?</DialogTitle><DialogDescription>Total {money(p.totalCents)}. Depois de emitida, alterações só por nova revisão.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button><Button onClick={doIssue}>Emitir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Box({ label, v, strong }: { label: string; v: ReactNode; strong?: boolean }) {
  return <div className={cn("rounded-2xl border bg-card p-4", strong && "bg-primary text-primary-foreground border-primary")}><p className={cn("text-[11px] uppercase font-bold", strong ? "opacity-80" : "text-muted-foreground")}>{label}</p><p className="font-heading text-xl font-extrabold tabular">{v}</p></div>;
}

/* ───────────── Tab 5: PDF ───────────── */

function PdfTab({ q, ro, update }: { q: Quote; ro: boolean; update: (p: Partial<Quote>) => void }) {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const d = proposalData(q, companyOrDefault(st.company), st.clients.find((c) => c.id === q.clientId));
  const baixar = async () => {
    setBusy(true);
    try {
      const r = await downloadProposal(d);
      if (r === "saved") toast.success(`${d.fileName} pronto.`); else toast.info("Download cancelado.");
    } catch { toast.error("Não foi possível gerar o PDF. Tente de novo."); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border bg-card p-6 md:p-8 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button disabled={ro} variant={q.display === "entregaveis" ? "default" : "outline"} onClick={() => update({ display: "entregaveis" })}>Valores por entregável</Button>
            <Button disabled={ro} variant={q.display === "total" ? "default" : "outline"} onClick={() => update({ display: "total" })}>Apenas valor total</Button>
          </div>
          <Button size="lg" onClick={baixar} disabled={busy} className="bg-magenta hover:bg-magenta/90"><Download /> {busy ? "Gerando…" : `Baixar ${d.fileName}`}</Button>
        </div>
        {!ro ? <p className="text-xs text-muted-foreground">Rascunhos saem com a marca “RASCUNHO · NÃO EMITIDA”. Emita na aba Revisão para a versão final.</p> : null}
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Validade (dias)" htmlFor="p-val"><NumInput id="p-val" value={q.validityDays} onChange={(v) => update({ validityDays: Math.max(1, Math.round(v ?? 15)) })} disabled={ro} /></Field>
          <Field label="Prazo de execução" htmlFor="p-prazo"><Commit id="p-prazo" value={q.leadTime} onCommit={(v) => update({ leadTime: v })} disabled={ro} /></Field>
          <Field label="Pagamento" htmlFor="p-pag"><Commit id="p-pag" value={q.payment} onCommit={(v) => update({ payment: v })} disabled={ro} /></Field>
          <Field label="Garantia" htmlFor="p-gar"><Commit id="p-gar" value={q.warranty} onCommit={(v) => update({ warranty: v })} disabled={ro} /></Field>
          <Field label="Condições de instalação" htmlFor="p-inst" className="md:col-span-2"><Commit id="p-inst" multiline value={q.installConditions} onCommit={(v) => update({ installConditions: v })} disabled={ro} /></Field>
          <Field label="Observações para o cliente" htmlFor="p-obs" className="md:col-span-2"><Commit id="p-obs" multiline value={q.notes} onCommit={(v) => update({ notes: v })} disabled={ro} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Validade: emitida em {date(q.issuedAt ?? new Date().toISOString())}, válida até {date(addDays(q.issuedAt ?? new Date().toISOString(), q.validityDays))}.</p>
      </section>
      <ProposalPreview d={d} />
    </div>
  );
}

