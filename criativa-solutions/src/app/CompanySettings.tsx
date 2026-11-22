import { useEffect, useState } from "react";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { companyOrDefault, useStore } from "@/data/store";
import type { Company } from "@/domain/types";
import { Field, NumInput, PageHead, PctInput } from "./common";
import { fileToDataUrl } from "./ops";

export default function CompanySettings() {
  const st = useStore();
  const [f, setF] = useState<Company>(companyOrDefault(st.company));
  useEffect(() => setF(companyOrDefault(st.company)), [st.company]);
  const set = (k: keyof Company) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.brand.trim()) { toast.error("Informe o nome da marca."); return; }
    if (f.cnpj && f.cnpj.replace(/\D/g, "").length !== 14) { toast.error("CNPJ deve ter 14 dígitos."); return; }
    await st.saveCompany(f);
    toast.success("Dados da empresa salvos. Novas propostas e rascunhos usam estes dados; emitidas não mudam.");
  };
  return (
    <>
      <PageHead title="Empresa" desc="Identidade e dados do emissor nas propostas, e padrões dos novos orçamentos.">
        <Button size="lg" onClick={save}>Salvar</Button>
      </PageHead>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border bg-card p-5 grid gap-4 content-start">
          <h2 className="text-lg font-bold">Identidade</h2>
          <div className="flex items-center gap-4">
            <div className="h-16 min-w-32 rounded-2xl bg-muted grid place-items-center px-4">{f.logo ? <img src={f.logo} alt="Logotipo atual" className="max-h-10 w-auto" /> : <span className="text-xs text-muted-foreground">sem logotipo</span>}</div>
            <label className="inline-flex items-center gap-2 rounded-lg border px-3 h-9 text-sm cursor-pointer hover:border-primary"><ImageUp className="size-4" />Trocar logotipo
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setF({ ...f, logo: await fileToDataUrl(file, 600) }); } catch (err) { toast.error((err as Error).message); } }} />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome da marca (aparece no PDF)" htmlFor="e-marca"><Input id="e-marca" value={f.brand} onChange={set("brand")} className="h-10" /></Field>
            <Field label="Razão social" htmlFor="e-razao"><Input id="e-razao" value={f.legalName} onChange={set("legalName")} className="h-10" /></Field>
            <Field label="CNPJ" htmlFor="e-cnpj"><Input id="e-cnpj" value={f.cnpj} onChange={set("cnpj")} className="h-10" placeholder="00.000.000/0000-00" /></Field>
            <Field label="Endereço" htmlFor="e-end"><Input id="e-end" value={f.address} onChange={set("address")} className="h-10" /></Field>
            <Field label="Telefone" htmlFor="e-tel"><Input id="e-tel" value={f.phone} onChange={set("phone")} className="h-10" /></Field>
            <Field label="WhatsApp" htmlFor="e-wa"><Input id="e-wa" value={f.whatsapp} onChange={set("whatsapp")} className="h-10" /></Field>
            <Field label="E-mail comercial" htmlFor="e-mail"><Input id="e-mail" value={f.email} onChange={set("email")} className="h-10" /></Field>
            <Field label="Site" htmlFor="e-site"><Input id="e-site" value={f.website} onChange={set("website")} className="h-10" /></Field>
            <Field label="Instagram" htmlFor="e-ig"><Input id="e-ig" value={f.instagram} onChange={set("instagram")} className="h-10" /></Field>
          </div>
        </section>
        <section className="rounded-3xl border bg-card p-5 grid gap-4 content-start">
          <h2 className="text-lg font-bold">Padrões dos novos orçamentos</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Margem geral" htmlFor="e-margem"><PctInput id="e-margem" value={f.defaultMarginBp} onChange={(v) => setF({ ...f, defaultMarginBp: v ?? 0 })} /></Field>
            <Field label="Taxas comerciais" htmlFor="e-taxa"><PctInput id="e-taxa" value={f.defaultFeeBp} onChange={(v) => setF({ ...f, defaultFeeBp: v ?? 0 })} /></Field>
            <Field label="Validade (dias)" htmlFor="e-val"><NumInput id="e-val" value={f.validityDays} onChange={(v) => setF({ ...f, validityDays: Math.max(1, Math.round(v ?? 15)) })} /></Field>
          </div>
          <Field label="Prazo" htmlFor="e-prazo"><Input id="e-prazo" value={f.leadTime} onChange={set("leadTime")} className="h-10" /></Field>
          <Field label="Pagamento" htmlFor="e-pag"><Input id="e-pag" value={f.payment} onChange={set("payment")} className="h-10" /></Field>
          <Field label="Condições de instalação" htmlFor="e-inst"><Textarea id="e-inst" value={f.installConditions} onChange={set("installConditions")} /></Field>
          <Field label="Garantia" htmlFor="e-gar"><Textarea id="e-gar" value={f.warranty} onChange={set("warranty")} /></Field>
        </section>
      </div>
    </>
  );
}
