import type { Supplier } from "./types";

const digits = (s: string) => s.replace(/\D/g, "");

/** Brazilian number with DDD → digits with country code 55. */
export function br55(phone: string): string {
  const d = digits(phone);
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export const waLink = (phone: string) => `https://wa.me/${br55(phone)}`;
export const telLink = (phone: string) => `tel:+${br55(phone)}`;
export const mailLink = (email: string) => `mailto:${email}`;
export const mapLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export function formatPhone(phone: string): string {
  const d = digits(phone).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export interface ContactAction {
  kind: "whatsapp" | "ligar" | "email" | "site" | "rota";
  label: string;
  href: string;
  text: string;
}

/** Only the channels the supplier actually published. The first entry is the primary action. */
export function contactActions(s: Pick<Supplier, "whatsapp" | "phones" | "emails" | "website" | "address" | "neighborhood" | "city">): ContactAction[] {
  const out: ContactAction[] = [];
  if (s.whatsapp) out.push({ kind: "whatsapp", label: "Chamar no WhatsApp", href: waLink(s.whatsapp), text: formatPhone(s.whatsapp) });
  if (s.phones[0]) out.push({ kind: "ligar", label: "Ligar", href: telLink(s.phones[0]), text: formatPhone(s.phones[0]) });
  if (s.emails[0]) out.push({ kind: "email", label: "Enviar e-mail", href: mailLink(s.emails[0]), text: s.emails[0] });
  if (s.website) out.push({ kind: "site", label: "Abrir site", href: s.website, text: s.website.replace(/^https?:\/\//, "") });
  if (s.address)
    out.push({
      kind: "rota",
      label: "Ver rota",
      href: mapLink([s.address, s.neighborhood, s.city ?? "Rio de Janeiro - RJ"].filter(Boolean).join(", ")),
      text: s.address,
    });
  return out;
}
