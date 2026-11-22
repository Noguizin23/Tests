// Money is always integer cents (BRL). Percentages are basis points: 4000 = 40%.
export type Cents = number;
export type Bp = number;

export const UNITS = {
  chapa: "chapa",
  rolo: "rolo",
  barra: "barra",
  ml: "metro linear",
  m2: "m²",
  un: "unidade",
  l: "litro",
  kg: "kg",
  h: "hora",
  diaria: "diária",
  servico: "serviço",
  kit: "kit",
  pct: "pacote",
} as const;
export type Unit = keyof typeof UNITS;

export const GROUPS = [
  "Chapas rígidas",
  "Impressão e mídia",
  "Estrutura",
  "Colagem e fixação",
  "Acabamento e pintura",
  "Iluminação",
  "Produção",
  "Logística e instalação",
] as const;
export type Group = (typeof GROUPS)[number];

export type SupplierKind = "revenda" | "fabricante" | "servico";
export const KIND_LABEL: Record<SupplierKind, string> = {
  revenda: "Revenda de materiais",
  fabricante: "Fabricante",
  servico: "Prestador terceirizado",
};

export interface Source {
  url: string;
  consultedAt: string; // ISO date
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  kinds: SupplierKind[];
  neighborhood: string;
  address?: string;
  city?: string;
  phones: string[];
  whatsapp?: string; // digits with DDD, e.g. 21972247727
  emails: string[];
  website?: string;
  instagram?: string;
  hours?: string;
  categories: string[];
  logo?: string; // URL or data: URL
  logoSource?: string;
  featured?: string;
  verification: string; // what was / was not verified
  sources: Source[];
  demo?: boolean;
}

export interface CatalogItem {
  id: string;
  group: Group;
  family: string;
  variant?: string;
  kind: "material" | "servico";
  sku?: string;
  dims?: string;
  thickness?: string;
  color?: string;
  finish?: string;
  purchaseUnit: Unit;
  consumptionUnit: Unit;
  perPurchase: number; // consumption units per purchase unit (e.g. sheet 1,22×2,44 = 2,9768 m²)
  sheetW?: number; // mm, for cut layout
  sheetH?: number;
  demo?: boolean;
}

export interface Offer {
  id: string;
  supplierId: string;
  itemId?: string;
  product: string;
  spec?: string;
  unit: Unit; // commercial unit
  priceCents: Cents | null; // null = sob cotação
  currency: "BRL";
  minQty?: number;
  leadTime: string;
  stock: string;
  delivery?: string;
  freightCents?: Cents;
  sourceUrl?: string;
  consultedAt?: string;
  note?: string;
  demo?: boolean;
}

export interface Client {
  id: string;
  name: string;
  doc?: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type LineCategory = "material" | "mao_obra" | "terceirizacao" | "logistica" | "outros";
export const CATEGORY_LABEL: Record<LineCategory, string> = {
  material: "Material",
  mao_obra: "Mão de obra",
  terceirizacao: "Terceirização",
  logistica: "Logística",
  outros: "Outros custos",
};

export interface Layout {
  pieceW: number; // mm
  pieceH: number;
  count: number;
  sheetW: number;
  sheetH: number;
}

export interface QuoteLine {
  id: string;
  deliverable: string;
  description: string;
  category: LineCategory;
  itemId?: string;
  offerId?: string;
  supplierId?: string;
  unit: Unit; // consumption unit
  qty: number;
  wasteBp: Bp;
  purchaseUnit?: Unit;
  perPurchase: number;
  unitCostCents: Cents | null; // per purchase unit; null = pending
  zeroConfirmed?: boolean;
  chargeMode: "rateado" | "compra";
  manualPurchaseQty?: number | null;
  layout?: Layout | null;
  marginBp?: Bp | null; // per-line override
}

export interface Company {
  brand: string;
  legalName: string;
  cnpj: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  logo: string;
  defaultMarginBp: Bp;
  defaultFeeBp: Bp;
  validityDays: number;
  payment: string;
  leadTime: string;
  installConditions: string;
  warranty: string;
}

export interface Quote {
  id: string;
  number: number;
  revision: number;
  status: "rascunho" | "emitida";
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  clientId?: string;
  title: string;
  installAddress: string;
  environment: "interno" | "externo";
  measures: string;
  scope: string;
  notes: string;
  internalNotes: string;
  photos: string[];
  pricingMode: "item" | "meta";
  marginBp: Bp;
  targetMarginBp: Bp;
  discountBp: Bp;
  feeBp: Bp;
  validityDays: number;
  leadTime: string;
  payment: string;
  installConditions: string;
  warranty: string;
  display: "entregaveis" | "total";
  lines: QuoteLine[];
  snapshot?: Snapshot;
  demo?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  lines: QuoteLine[];
}

// Frozen copy of everything the PDF shows plus the internal review, taken at emission.
export interface Snapshot {
  company: Company;
  client?: Client;
  quote: Omit<Quote, "snapshot">;
  pricing: import("./pricing").PricingResult;
  lineCosts: Record<string, import("./quantities").LineQty>;
}
