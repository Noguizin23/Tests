# Criativa Solutions

App interno de orçamentos de comunicação visual da Criativa Grupo (Rio de Janeiro).
Fluxo: **Cliente → Projeto → Materiais e serviços → Margens → Revisão → PDF**.

## Iniciar

```bash
cd criativa-solutions
npm install
npm run dev      # http://localhost:5173 — página inicial; o app abre em #app
npm test         # testes de domínio (preço, margem, quantidades, CSV, contatos) e do PDF
npm run build    # gera dist/index.html (página única) e dist/artifact.html
```

Requer Node 20+ e Python 3 (usado para montar o `index.html` a partir de `landing/landing.src.html`).

Sem servidor: os dados ficam no IndexedDB do navegador quando rodado localmente. Publicado como Artifact no claude.ai, o app usa o banco compartilhado do artifact (todos com acesso de edição veem os mesmos dados) e o download do PDF passa pela confirmação do próprio claude.ai.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/domain/pricing.ts` | **Função única de preço** (`priceQuote`), usada pela tela, pela revisão e pelo PDF |
| `src/domain/quantities.ts` | Consumo com perda, conversão de unidade, chapa inteira (área × plano de corte × manual), comparação de ofertas |
| `src/domain/quote.ts` | Cálculo do orçamento, bloqueios de emissão, emissão com congelamento, revisão, duplicação, atualização explícita de custos |
| `src/domain/tips.ts` | Assistente por regras (custos pendentes, LED sem fonte, peça externa, margem baixa, fornecedor principal de acrílico…) |
| `src/domain/csv.ts` | Importação de ofertas por CSV com prévia e validação linha a linha |
| `src/pdf/proposal.tsx` | PDF A4 (react-pdf): só dados comerciais autorizados, cabeçalho e cabeçalho da tabela repetidos, numeração de páginas |
| `src/data/seed.ts` | Catálogo inicial pesquisado, modelos e projeto demonstrativo (fictício) |
| `src/data/store.tsx` | Persistência: banco compartilhado do Artifact ou IndexedDB local |
| `src/app/*` | Telas: Orçamentos, Orçamento aberto, Clientes, Catálogo, Fornecedores, Modelos, Empresa |
| `landing/landing.src.html` | Página inicial (preloader, animações, vitrine no scroll) |
| `demo/` | PDFs gerados pelo próprio app |

## Regras de preço

- Margem = (venda − custo) ÷ venda; preço = custo ÷ (1 − margem). R$ 100,00 a 40% → **R$ 166,67**.
- Valores em centavos inteiros; margem aceita de 0% até 99,99%.
- **Por item**: margem geral como padrão; margem própria substitui a geral na linha.
- **Meta do projeto**: preço total = custo total ÷ (1 − meta). Linhas com margem própria mantêm o preço; o restante é distribuído pelas demais, proporcional ao custo, pelo método do maior resto (determinístico). Se as margens próprias consumirem a meta, o app mostra a divergência e bloqueia a emissão.
- Total = soma dos preços exibidos por entregável. Desconto e taxas comerciais recalculam a margem efetiva.
- O campo “markup equivalente” é só informativo (custo × (1 + markup)).

## Validação feita (22/11/2026)

Testes automáticos (`npm test`, 22 testes): margem geral, margem por item, meta com margem específica, meta inviável, arredondamento determinístico, desconto + taxa, conversão barra → metro linear, chapa inteira por área/plano/manual, orientação da peça, peça maior que a chapa, comparação de ofertas com pedido mínimo e frete, custo pendente × custo zero confirmado, emissão congelada após mudança no catálogo, CSV, links de WhatsApp, PDF sem dados internos e PDF de 5 páginas.

Teste de ponta a ponta no navegador (Playwright): cadastro de cliente → novo orçamento → item do catálogo pela melhor oferta → item avulso → margem 40% (total R$ 641,67 conferido) → emissão → download `proposta-0002-r0.pdf`; projeto demonstrativo bloqueado por custo pendente → custo informado → emissão → `demo/proposta-0001-r0.pdf`; preço do ACM alterado no catálogo → proposta emitida manteve R$ 12.878,17 → revisão r1 só mudou (R$ 15.411,51) após “Atualizar custos do catálogo”; busca de fornecedores por material e bairro; oferta adicionada ao orçamento aberto; tela do celular sem rolagem lateral.

## Fontes do catálogo inicial (consulta em 22/11/2026)

| Fornecedor | Bairro | Fonte | Situação |
|---|---|---|---|
| Dacril Multicor | Cordovil | https://dacril.com.br/contato · /servicos | **Principal em acrílico** (definição da Criativa). Site não abriu (certificado do servidor incompleto): contatos e logotipo a confirmar |
| Mundo das Cores | Tijuca | https://www.mundodascores.com/contato/ | Página exigiu verificação anti-robô: a confirmar |
| ViaFlex BR | Ramos | https://viaflexbr.com/rio-de-janeiro/ | Verificado: endereço, telefone, WhatsApp, e-mail, linhas, logotipo |
| Vivametal | Ramos | https://www.vivametal.com.br/ | Certificado do site expirado: a confirmar |
| Universal Acrílicos | Penha | https://www.universalacrilico.com.br/ | Verificado; WhatsApp do botão (98669-6822) difere do texto (98668-6822) e e-mail usa outro domínio: confirmar |
| Casa das Letras | Cachambi | https://www.casadasletras.com/ | Bloqueio Cloudflare: a confirmar |
| Harto (Acrílico Harto) | Inhaúma | https://acrilicoharto.com.br/comunicacao-visual/ | Verificado: endereço, telefones, WhatsApp, e-mail, categorias, logotipo |
| Sinaliza Placas | Del Castilho | https://sinalizaplacas.com.br/empresa.html | Verificado; logotipo é o ícone do site (baixa resolução) |
| Castilha Ferro e Aço | Ramos | https://www.castilhaferroeaco.com.br/ | Metalon, chapas, cantoneiras. Dados de resultados de busca do site oficial |
| Rio Supercorte | Honório Gurgel | https://riosupercorte.com.br/ | Galvanizado, chapas, corte e dobra. Endereço diverge de diretórios: confirmar |
| Rio LED Iluminação | Santíssimo (fora do corredor) | https://www.riolediluminacao.com.br/ | Módulos, fontes, neon. Preços vistos em resultados de busca, sem data: confirmar |
| Fattu (filial Rio) | Bonsucesso | https://www.fattu.com.br/ | Fita VHB 3M 4910. Telefone diverge entre páginas |
| Parafusos UNC | Vila da Penha | http://www.parafusosunc.com.br/ | Parafusos, buchas, chumbadores |
| Grupo de Ideias | São Cristóvão | https://grupodeideias.com.br/ | Fita VHB/ACM, dupla face, primer |
| Criativa Grupo (emissor) | — | https://criativagrupo.com.br | Endereço, telefone, e-mail, Instagram, logotipo e cores |

Lacunas: não foi encontrado fornecedor de LED para comunicação visual com site oficial na Zona Norte; nenhum fornecedor com site oficial em Cachambi, Del Castilho ou Inhaúma para metalon, LED ou fixadores. Famílias sem preço publicado ficam “sob cotação”, sem SKU, especificação ou preço inventados. O projeto demonstrativo e o “Fornecedor Demonstrativo (fictício)” usam valores fictícios, marcados na interface.
