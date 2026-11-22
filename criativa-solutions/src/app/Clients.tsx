import { useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/data/store";
import { uid } from "@/domain/format";
import type { Client } from "@/domain/types";
import { Empty, Field, PageHead } from "./common";

export default function Clients() {
  const st = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Client | null>(null);
  const rows = st.clients.filter((c) => `${c.name} ${c.contact ?? ""} ${c.address ?? ""}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHead title="Clientes" desc="Contato, documento e endereço usados nas propostas.">
        <Button size="lg" onClick={() => setEdit({ id: uid(), name: "" })}><Plus /> Novo cliente</Button>
      </PageHead>
      <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input id="busca-cli" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="pl-9 h-10" /></div>
      {rows.length === 0 ? <Empty title="Nenhum cliente encontrado" /> : (
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="hidden md:table-cell">Contato</TableHead><TableHead className="hidden md:table-cell">Endereço</TableHead><TableHead className="text-right">Propostas</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.doc}</p></TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{[c.contact, c.phone, c.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{c.address || "—"}</TableCell>
                  <TableCell className="text-right tabular">{st.quotes.filter((x) => x.clientId === c.id).length}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon-sm" aria-label={`Editar ${c.name}`} onClick={() => setEdit(c)}><Pencil /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {edit ? <ClientDialog c={edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function ClientDialog({ c, onClose }: { c: Client; onClose: () => void }) {
  const st = useStore();
  const [f, setF] = useState<Client>(c);
  const set = (k: keyof Client) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.name.trim()) { toast.error("Informe o nome do cliente."); return; }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) { toast.error("E-mail inválido."); return; }
    await st.put("clients", { ...f, name: f.name.trim() });
    toast.success("Cliente salvo.");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{c.name ? "Editar cliente" : "Novo cliente"}</DialogTitle><DialogDescription>Esses dados aparecem no PDF da proposta.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome ou razão social" htmlFor="c-nome" className="sm:col-span-2"><Input id="c-nome" value={f.name} onChange={set("name")} className="h-10" /></Field>
          <Field label="CNPJ ou CPF" htmlFor="c-doc"><Input id="c-doc" value={f.doc ?? ""} onChange={set("doc")} className="h-10" /></Field>
          <Field label="Contato" htmlFor="c-contato"><Input id="c-contato" value={f.contact ?? ""} onChange={set("contact")} className="h-10" /></Field>
          <Field label="Telefone" htmlFor="c-tel"><Input id="c-tel" inputMode="tel" value={f.phone ?? ""} onChange={set("phone")} className="h-10" /></Field>
          <Field label="E-mail" htmlFor="c-email"><Input id="c-email" type="email" value={f.email ?? ""} onChange={set("email")} className="h-10" /></Field>
          <Field label="Endereço" htmlFor="c-end" className="sm:col-span-2"><Input id="c-end" value={f.address ?? ""} onChange={set("address")} className="h-10" /></Field>
          <Field label="Observações" htmlFor="c-obs" className="sm:col-span-2"><Textarea id="c-obs" value={f.notes ?? ""} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
