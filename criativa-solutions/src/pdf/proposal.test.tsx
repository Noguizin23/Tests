import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalDoc, proposalData } from "./proposal";
import { seed, demoQuote, demoClient } from "@/data/seed";
import type { Quote } from "@/domain/types";

const logo = "data:image/png;base64," + readFileSync("public/logos/criativa.png").toString("base64");
const company = { ...seed.company, logo };

describe("PDF da proposta", () => {
  it("não leva custos, fornecedores, margens nem observações internas", () => {
    const d = proposalData(demoQuote, company, demoClient);
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/Demonstrativo \(fictício\)|unitCostCents|marginBp|costCents|internalNotes/);
    expect(json).not.toContain(demoQuote.internalNotes);
    expect(d.totalCents).toBe(d.subtotalCents - d.discountCents);
    expect(d.fileName).toBe("proposta-0001-r0.pdf");
  });

  it("quebra páginas em propostas longas e repete o cabeçalho", async () => {
    const lines = Array.from({ length: 48 }, (_, i) => ({ ...demoQuote.lines[3], id: `l${i}`, deliverable: `Entregável ${String(i + 1).padStart(2, "0")} — placa de sinalização em PS com adesivo e fixação`, description: `Placa ${i + 1}`, unitCostCents: 10000 + i * 137 }));
    const q: Quote = { ...demoQuote, number: 42, revision: 2, lines };
    const buf = await renderToBuffer(<ProposalDoc d={proposalData(q, company, demoClient)} />);
    const pages = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(3);
    mkdirSync("demo", { recursive: true });
    writeFileSync("demo/proposta-0042-r2-teste-multipagina.pdf", buf);
  }, 30000);
});
