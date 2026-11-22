import { uid } from "@/domain/format";
import type { Company, Quote, QuoteLine, Template } from "@/domain/types";

export const nextNumber = (quotes: Quote[]) => quotes.reduce((m, q) => Math.max(m, q.number), 0) + 1;
export const nextRevision = (quotes: Quote[], number: number) => quotes.filter((q) => q.number === number).reduce((m, q) => Math.max(m, q.revision), -1) + 1;

export const copyLines = (lines: QuoteLine[]): QuoteLine[] => lines.map((l) => ({ ...structuredClone(l), id: uid() }));

export function newQuote(c: Company, number: number, title: string, clientId?: string, template?: Template): Quote {
  const now = new Date().toISOString();
  return {
    id: uid(),
    number,
    revision: 0,
    status: "rascunho",
    createdAt: now,
    updatedAt: now,
    clientId,
    title: title || template?.name || "Novo orçamento",
    installAddress: "",
    environment: "externo",
    measures: "",
    scope: template?.description ?? "",
    notes: "",
    internalNotes: "",
    photos: [],
    pricingMode: "item",
    marginBp: c.defaultMarginBp,
    targetMarginBp: c.defaultMarginBp,
    discountBp: 0,
    feeBp: c.defaultFeeBp,
    validityDays: c.validityDays,
    leadTime: c.leadTime,
    payment: c.payment,
    installConditions: c.installConditions,
    warranty: c.warranty,
    display: "entregaveis",
    lines: template ? copyLines(template.lines) : [],
  };
}

/** Shrink an image file to a small PNG/JPEG data URL so it fits in a document. */
export function fileToDataUrl(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Envie uma imagem (PNG, JPG, SVG ou WebP)."));
    const r = new FileReader();
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.85));
      };
      img.src = r.result as string;
    };
    r.readAsDataURL(file);
  });
}
