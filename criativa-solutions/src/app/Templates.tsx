import { useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/data/store";
import { uid } from "@/domain/format";
import { CATEGORY_LABEL, UNITS, type LineCategory, type QuoteLine, type Template, type Unit } from "@/domain/types";
import { Field, NumInput, PageHead, PctInput } from "./common";
import { copyLines } from "./ops";

export default function Templates() {
  const st = useStore();
  const [edit, setEdit] = useState<Template | null>(null);
  const open = st.quotes.find((q) => q.id === st.openQuoteId);
  const fromQuote = async () => {
    if (!open) return;
    const t: Template = { id: uid(), name: `${open.title} (modelo)`, description: open.scope, lines: copyLines(open.lines).map((l) => ({ ...l, unitCostCents: null, zeroConfirmed: false, offerId: undefined, supplierId: undefined })) };
    await st.put("templates", t);
    toast.success("Modelo criado a partir do orçamento aberto, sem custos.");
    setEdit(t);
  };
  return (
    <>
      <PageHead title="Modelos" desc="Pontos de partida editáveis. Os itens entram no orçamento com custo pendente.">
        {open ? <Button variant="outline" onClick={fromQuote}><Save /> Salvar orçamento aberto como modelo</Button> : null}
        <Button size="lg" onClick={() => setEdit({ id: uid(), name: "Novo modelo", description: "", lines: [] })}><Plus /> Novo modelo</Button>
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {st.templates.map((t) => (
          <article key={t.id} className="rounded-3xl border bg-card p-5 grid gap-3 content-start">
            <h2 className="font-heading text-xl font-bold">{t.name}</h2>
            <p className="text-sm text-muted-foreground">{t.description}</p>
            <ul className="text-sm grid gap-1">{t.lines.slice(0, 6).map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.description}</span><span className="text-xs text-muted-foreground shrink-0">{l.deliverable}</span></li>)}</ul>
            {t.lines.length > 6 ? <p className="text-xs text-muted-foreground">+{t.lines.length - 6} itens</p> : null}
            <div className="flex gap-2 pt-2 border-t"><Button size="sm" variant="outline" onClick={() => setEdit(t)}><Pencil /> Editar</Button><Button size="sm" variant="ghost" onClick={async () => { await st.del("templates", t.id); toast.success("Modelo excluído."); }}><Trash2 /> Excluir</Button></div>
          </article>
        ))}
      </div>
      {edit ? <TemplateDialog t={edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function TemplateDialog({ t, onClose }: { t: Template; onClose: () => void }) {
  const st = useStore();
  const [f, setF] = useState<Template>(structuredClone(t));
  const setLine = (id: string, p: Partial<QuoteLine>) => setF({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const add = () => setF({ ...f, lines: [...f.lines, { id: uid(), deliverable: f.lines.at(-1)?.deliverable ?? "Itens", description: "Novo item", category: "material", unit: "un", qty: 1, wasteBp: 0, perPurchase: 1, unitCostCents: null, chargeMode: "rateado" }] });
  const save = async () => { if (!f.name.trim()) { toast.error("Dê um nome ao modelo."); return; } await st.put("templates", f); toast.success("Modelo salvo."); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar modelo</DialogTitle><DialogDescription>Entregáveis, itens, unidades, quantidades sugeridas e perda.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome" htmlFor="t-nome"><Input id="t-nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-10" /></Field>
          <Field label="Descrição (vira o escopo inicial)" htmlFor="t-desc"><Textarea id="t-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} /></Field>
        </div>
        <div className="rounded-2xl border overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader><TableRow><TableHead>Entregável</TableHead><TableHead>Item</TableHead><TableHead>Categoria</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Perda</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {f.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Input aria-label="Entregável" value={l.deliverable} onChange={(e) => setLine(l.id, { deliverable: e.target.value })} className="h-9" /></TableCell>
                  <TableCell><Input aria-label="Descrição" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} className="h-9" /></TableCell>
                  <TableCell><Select value={l.category} onValueChange={(v) => setLine(l.id, { category: v as LineCategory })}><SelectTrigger className="h-9 w-36" aria-label="Categoria"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell><Select value={l.unit} onValueChange={(v) => setLine(l.id, { unit: v as Unit })}><SelectTrigger className="h-9 w-32" aria-label="Unidade"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(UNITS) as Unit[]).map((u) => <SelectItem key={u} value={u}>{UNITS[u]}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell className="w-28"><NumInput value={l.qty} onChange={(v) => setLine(l.id, { qty: v ?? 0 })} /></TableCell>
                  <TableCell className="w-24"><PctInput value={l.wasteBp} max={20000} onChange={(v) => setLine(l.id, { wasteBp: v ?? 0 })} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon-sm" aria-label="Remover item" onClick={() => setF({ ...f, lines: f.lines.filter((x) => x.id !== l.id) })}><Trash2 /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" className="w-fit" onClick={add}><Plus /> Adicionar item</Button>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar modelo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
