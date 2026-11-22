import { useEffect, useState, type ReactNode } from "react";
import { Globe, Mail, MapPin, MessageCircle, Phone, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { contactActions, type ContactAction } from "@/domain/contacts";
import { initials, parseMoney, parseNum, parsePct } from "@/domain/format";
import type { Supplier } from "@/domain/types";

export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
      <div className="min-w-0">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.05]">{title}</h1>
        {desc ? <p className="text-muted-foreground mt-3 max-w-xl">{desc}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5 min-w-0 content-start", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Text input that commits a parsed value on blur/Enter and shows an inline error when invalid. */
function Parsed<T>({ id, value, format, parse, onCommit, placeholder, className, disabled, suffix, prefix, invalidMsg }: {
  id?: string; value: T; format: (v: T) => string; parse: (s: string) => T | typeof INVALID; onCommit: (v: T) => void;
  placeholder?: string; className?: string; disabled?: boolean; suffix?: string; prefix?: string; invalidMsg: string;
}) {
  const [text, setText] = useState(format(value));
  const [err, setErr] = useState(false);
  useEffect(() => { setText(format(value)); setErr(false); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const v = parse(text);
    if (v === INVALID) { setErr(true); return; }
    setErr(false);
    onCommit(v as T);
  };
  return (
    <div className={cn("relative", className)}>
      {prefix ? <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span> : null}
      <Input
        id={id}
        value={text}
        disabled={disabled}
        inputMode="decimal"
        placeholder={placeholder}
        aria-invalid={err || undefined}
        title={err ? invalidMsg : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn("tabular text-right h-9", prefix && "pl-8", suffix && "pr-7", err && "border-destructive")}
      />
      {suffix ? <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}
const INVALID = Symbol("invalid");

const brNum = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

export function MoneyInput(p: { id?: string; value: number | null; onChange: (c: number | null) => void; disabled?: boolean; className?: string; placeholder?: string }) {
  return (
    <Parsed<number | null>
      {...p}
      className={cn("min-w-[118px]", p.className)}
      prefix="R$"
      placeholder={p.placeholder ?? "pendente"}
      invalidMsg="Valor inválido. Use o formato 1.234,56."
      format={(v) => (v == null ? "" : (v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
      parse={(s) => { const v = parseMoney(s); return v == null ? null : Number.isNaN(v) || v < 0 ? INVALID : v; }}
      onCommit={p.onChange}
    />
  );
}

export function PctInput(p: { id?: string; value: number | null; onChange: (bp: number | null) => void; disabled?: boolean; className?: string; placeholder?: string; max?: number; allowEmpty?: boolean }) {
  const max = p.max ?? 9999;
  return (
    <Parsed<number | null>
      {...p}
      className={cn("min-w-[84px]", p.className)}
      suffix="%"
      invalidMsg={`Use um percentual entre 0 e ${brNum(max / 100)}.`}
      format={(v) => (v == null ? "" : brNum(v / 100))}
      parse={(s) => { if (!s.trim()) return p.allowEmpty ? null : INVALID; const v = parsePct(s); return Number.isNaN(v) || v < 0 || v > max ? INVALID : v; }}
      onCommit={p.onChange}
    />
  );
}

export function NumInput(p: { id?: string; value: number | null; onChange: (n: number | null) => void; disabled?: boolean; className?: string; placeholder?: string; suffix?: string; allowEmpty?: boolean; min?: number }) {
  return (
    <Parsed<number | null>
      {...p}
      className={cn("min-w-[84px]", p.className)}
      invalidMsg="Número inválido."
      format={(v) => (v == null ? "" : brNum(v, 4))}
      parse={(s) => { if (!s.trim()) return p.allowEmpty ? null : INVALID; const v = parseNum(s); return Number.isNaN(v) || v < (p.min ?? 0) ? INVALID : v; }}
      onCommit={p.onChange}
    />
  );
}

export function SupplierLogo({ s, size = 56 }: { s: Pick<Supplier, "name" | "logo">; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [s.logo]);
  const box = { width: size, height: size };
  if (!s.logo || broken)
    return (
      <span style={box} className="grid place-items-center rounded-2xl bg-foreground text-background font-heading font-extrabold shrink-0" aria-label={`Logotipo pendente de ${s.name}`} title="Logotipo pendente">
        {initials(s.name)}
      </span>
    );
  return (
    <span style={box} className="grid place-items-center rounded-2xl bg-muted overflow-hidden shrink-0 [&.escuro]:bg-foreground">
      <img src={s.logo} alt={`Logotipo ${s.name}`} onError={() => setBroken(true)} className="max-w-[82%] max-h-[72%] object-contain" />
    </span>
  );
}

const ICON: Record<ContactAction["kind"], typeof Phone> = { whatsapp: MessageCircle, ligar: Phone, email: Mail, site: Globe, rota: MapPin };

export function ContactButtons({ s, compact }: { s: Supplier; compact?: boolean }) {
  const acts = contactActions(s);
  if (!acts.length) return <p className="text-sm text-muted-foreground">Contato a confirmar.</p>;
  const [main, ...rest] = acts;
  const MainIcon = ICON[main.kind];
  const ext = (a: ContactAction) => (a.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size={compact ? "sm" : "default"} className={cn(main.kind === "whatsapp" && "bg-[#1F8A5B] hover:bg-[#18744c]")}>
        <a href={main.href} {...ext(main)}><MainIcon className="size-4" />{main.label}</a>
      </Button>
      {rest.map((a) => {
        const I = ICON[a.kind];
        return (
          <Button key={a.kind} asChild variant="outline" size={compact ? "icon-sm" : "sm"} title={`${a.label}: ${a.text}`}>
            <a href={a.href} {...ext(a)} aria-label={a.label}><I className="size-4" />{compact ? null : a.label}</a>
          </Button>
        );
      })}
    </div>
  );
}

/** Contact data as selectable text, with copy. */
export function ContactText({ s }: { s: Supplier }) {
  const acts = contactActions(s).filter((a) => a.kind !== "site");
  if (!acts.length) return null;
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("Copiado"); } catch { toast.info(t); }
  };
  return (
    <ul className="grid gap-1 text-sm">
      {acts.map((a) => (
        <li key={a.kind} className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground w-20 shrink-0 text-xs">{a.kind === "whatsapp" ? "WhatsApp" : a.kind === "ligar" ? "Telefone" : a.kind === "email" ? "E-mail" : "Endereço"}</span>
          <span className="select-all truncate tabular">{a.text}</span>
          <button type="button" onClick={() => copy(a.text)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={`Copiar ${a.text}`}><Copy className="size-3.5" /></button>
        </li>
      ))}
      {s.phones.slice(1).map((p) => <li key={p} className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0 text-xs">Telefone</span><a className="tabular" href={`tel:+55${p}`}>{p.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}</a></li>)}
    </ul>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed p-10 text-center grid gap-3 place-items-center bg-card">
      <p className="font-heading text-xl font-bold">{title}</p>
      {children}
    </div>
  );
}

export function Sk({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "roxo" | "magenta" | "tinta" }) {
  return (
    <div className={cn("rounded-3xl p-6 border bg-card", tone === "roxo" && "bg-primary text-primary-foreground border-primary", tone === "magenta" && "bg-magenta text-white border-magenta", tone === "tinta" && "bg-foreground text-background border-foreground")}>
      <p className={cn("text-xs font-bold uppercase tracking-wide", tone ? "opacity-80" : "text-muted-foreground")}>{label}</p>
      <p className="font-heading text-3xl font-extrabold tabular mt-2">{value}</p>
    </div>
  );
}
