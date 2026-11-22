import { useMemo, useState } from "react";
import { Copy, FilePlus2, GitBranch, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyOrDefault, useStore } from "@/data/store";
import { calcQuote, duplicate, revise } from "@/domain/quote";
import { date, money, uid } from "@/domain/format";
import type { Quote } from "@/domain/types";
import { Empty, Field, PageHead, Stat } from "./common";
import { newQuote, nextNumber, nextRevision } from "./ops";
import { go } from "./route";

export default function Dashboard() {
  const st = useStore();
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<Quote | null>(null);
  const clientName = (id?: string) => st.clients.find((c) => c.id === id)?.name ?? "Sem cliente";

  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return [...st.quotes]
      .filter((x) => !t || `${x.number} ${x.title} ${clientName(x.clientId)}`.toLowerCase().includes(t))
      .sort((a, b) => b.number - a.number || b.revision - a.revision)
      .map((x) => ({ q: x, total: calcQuote(x).pricing.totalCents }));
  }, [st.quotes, st.clients, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const issued = rows.filter((r) => r.q.status === "emitida");
  const open = (x: Quote) => { st.setOpenQuoteId(x.id); go("app-orcamento"); };

  const dup = async (x: Quote) => {
    const n = duplicate(x, nextNumber(st.quotes), uid());
    await st.put("quotes", n);
    toast.success(`Proposta ${String(n.number).padStart(4, "0")} criada a partir da ${String(x.number).padStart(4, "0")}.`);
    open(n);
  };
  const rev = async (x: Quote) => {
    const n = revise(x, nextRevision(st.quotes, x.number), uid());
    await st.put("quotes", n);
    toast.success(`Revisão r${n.revision} criada.`);
    open(n);
  };

  return (
    <>
      <PageHead title="Orçamentos" desc="Rascunhos, propostas emitidas e revisões.">
        <Button size="lg" onClick={() => setNovo(true)}><Plus /> Novo orçamento</Button>
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Rascunhos" value={rows.filter((r) => r.q.status === "rascunho").length} />
        <Stat label="Emitidas" value={issued.length} />
        <Stat label="Total emitido" value={money(issued.reduce((a, r) => a + r.total, 0))} tone="roxo" />
        <Stat label="Clientes" value={st.clients.length} tone="tinta" />
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input id="busca-orc" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, título ou cliente" className="pl-9 h-10" />
      </div>

      {rows.length === 0 ? (
        <Empty title="Nenhum orçamento ainda"><Button onClick={() => setNovo(true)}><FilePlus2 /> Criar o primeiro</Button></Empty>
      ) : (
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden md:table-cell">Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ q: x, total }) => (
                <TableRow key={x.id} className="cursor-pointer" onClick={() => open(x)}>
                  <TableCell className="tabular font-bold whitespace-nowrap">{String(x.number).padStart(4, "0")}<span className="text-muted-foreground">·r{x.revision}</span></TableCell>
                  <TableCell className="max-w-[320px]"><span className="line-clamp-2 font-semibold">{x.title}</span>{x.demo ? <Badge variant="outline" className="mt-1 border-magenta text-magenta">demonstrativo</Badge> : null}</TableCell>
                  <TableCell className="hidden md:table-cell">{clientName(x.clientId)}</TableCell>
                  <TableCell>{x.status === "emitida" ? <Badge className="bg-ok text-white">Emitida</Badge> : <Badge variant="secondary">Rascunho</Badge>}</TableCell>
                  <TableCell className="text-right tabular font-bold whitespace-nowrap">{money(total)}</TableCell>
                  <TableCell className="hidden md:table-cell tabular text-muted-foreground">{date(x.updatedAt)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon-sm" title="Duplicar como nova proposta" aria-label="Duplicar" onClick={() => dup(x)}><Copy /></Button>
                    <Button variant="ghost" size="icon-sm" title="Criar revisão" aria-label="Criar revisão" onClick={() => rev(x)}><GitBranch /></Button>
                    {x.status === "rascunho" ? <Button variant="ghost" size="icon-sm" title="Excluir rascunho" aria-label="Excluir rascunho" onClick={() => setDel(x)}><Trash2 /></Button> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewQuote open={novo} onOpenChange={setNovo} onCreated={open} />

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir rascunho?</DialogTitle><DialogDescription>“{del?.title}” será removido. Propostas emitidas não podem ser excluídas.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { await st.del("quotes", del!.id); if (st.openQuoteId === del!.id) st.setOpenQuoteId(null); setDel(null); toast.success("Rascunho excluído."); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewQuote({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (q: Quote) => void }) {
  const st = useStore();
  const [clientId, setClientId] = useState<string>("");
  const [newClient, setNewClient] = useState("");
  const [title, setTitle] = useState("");
  const [tpl, setTpl] = useState("nenhum");
  const create = async () => {
    let cid = clientId && clientId !== "novo" ? clientId : undefined;
    if (clientId === "novo") {
      if (!newClient.trim()) { toast.error("Informe o nome do novo cliente."); return; }
      cid = uid();
      await st.put("clients", { id: cid, name: newClient.trim() });
    }
    const q = newQuote(companyOrDefault(st.company), nextNumber(st.quotes), title.trim(), cid, st.templates.find((t) => t.id === tpl));
    await st.put("quotes", q);
    onOpenChange(false);
    setTitle(""); setNewClient(""); setClientId(""); setTpl("nenhum");
    onCreated(q);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Novo orçamento</DialogTitle><DialogDescription>O rascunho é salvo na hora. Você pode completar depois.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <Field label="Cliente" htmlFor="nq-cliente">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="nq-cliente" className="w-full"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">+ Cadastrar novo cliente</SelectItem>
                {st.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {clientId === "novo" ? <Field label="Nome do novo cliente" htmlFor="nq-novo"><Input id="nq-novo" value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Razão social ou nome" /></Field> : null}
          <Field label="Título do projeto" htmlFor="nq-titulo"><Input id="nq-titulo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Fachada em ACM da loja Centro" /></Field>
          <Field label="Começar por um modelo" htmlFor="nq-modelo">
            <Select value={tpl} onValueChange={setTpl}>
              <SelectTrigger id="nq-modelo" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Em branco</SelectItem>
                {st.templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create}>Criar rascunho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
