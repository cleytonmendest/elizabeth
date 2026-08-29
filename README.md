# Elizabeth — Tema Shopify

Tema customizado para e-commerce de moda feminina (vestidos e ocasiões especiais), construído sobre Shopify Online Store 2.0 + TailwindCSS.

**Autor:** Cleyton Mendes · **Idioma base:** pt-BR (i18n PT/EN)

> Arquitetura, convenções e as regras do repositório: [`CLAUDE.md`](CLAUDE.md).
> Estado atual do tema: `npm run status` (medido, não documentado).
> Decisões e seus porquês: [`docs/adr/`](docs/adr/). Trabalho aberto: GitHub Issues.

## Stack

- **Shopify Liquid** + Online Store 2.0 (seções/templates JSON)
- **TailwindCSS 3.4** — compilado de `src/tailwind.css` → `assets/application.css`
- **JavaScript vanilla** (ES6+ Web Components) — **sem jQuery**
- **Swiper 11** para sliders/carrosséis

## Desenvolvimento

Pré-requisitos: [Shopify CLI](https://shopify.dev/themes/tools/cli/installation), Node.js + npm.

```bash
npm install          # dependências + ativa os hooks de git
npm run tail         # watch do TailwindCSS (src → assets/application.css)
shopify theme dev    # servidor local com live reload
```

### O gate

```bash
npm run gate         # build + linters — rode antes de abrir PR
npm run status       # painel de conformidade
```

Os linters (`scripts/lint/`) verificam i18n, design tokens, settings globais, fronteiras de
capacidade, duplicação entre arquivos, integridade
referencial, contrato dos color schemes, orçamento de performance e Theme
Check. Rodam a cada edição (hook), no `pre-commit` e no CI. Violação nova
reprova; a dívida conhecida está em `scripts/lint/config/baseline.json` e só
pode diminuir.

Deploy: `shopify theme push` · Pull: `shopify theme pull` · Publicar: `shopify theme publish`

> Rode `npm run tail` e `shopify theme dev` em terminais separados durante o desenvolvimento.

## Estrutura

```
layout/        theme.liquid — wrapper, imports e variáveis globais
sections/      seções do editor (header, footer, main-product, sliders, ...)
snippets/      componentes menores (cart-drawer, product-gallery, ...)
templates/     templates JSON de página (index, product, ...) + customers/
assets/        CSS compilado, JS (Web Components) e libs (Swiper)
locales/       traduções storefront (pt-BR/en) + schema (.schema.json)
config/        settings_schema.json / settings_data.json
src/           tailwind.css (fonte do CSS)
docs/          adr/ (decisões), history.md (congelado)
scripts/       linters e painel de estado
.githooks/     gate de pre-commit
```

## Principais recursos

- Carrinho lateral (drawer) com atualização em tempo real
- Busca preditiva, variantes com indicação de disponibilidade, parcelamento configurável
- Galeria de produto com lightbox, Sticky Add to Cart, sliders Swiper
- Header com múltiplos layouts + modo transparente na home
- Testimonials, trust badges, ícones de pagamento, newsletter (snippet + modal)
- Templates de cliente completos, blog, gift card
- SEO estruturado (Product / Organization / Breadcrumb / Article)
- Color schemes + design tokens (cores e `rounded-theme`)

## JavaScript (Web Components)

Componentes em `assets/` registrados como custom elements. Comunicação via eventos (`variant:change`, `cart-update`, `quantity-update`, `cart-error`); `CartManager` (`cart.js`) com pub/sub para o carrinho. Padrão de carregamento de assets e lista completa de componentes em [`CLAUDE.md`](CLAUDE.md).

## Licença

ISC — Desenvolvido com 💜 por Cleyton Mendes
