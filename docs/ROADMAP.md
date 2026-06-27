# 🗺️ ROADMAP - Tema Elizabeth

**Versão:** 2.12.0 | **Atualizado:** 2026-06-27

> **⚠️ REGRA DE OURO:** Sempre ler este ROADMAP antes de implementações. PRIORIDADE MÁXIMA = Requisitos Shopify Theme Store. Features secundárias aguardam conclusão dos bloqueadores críticos.

---

## 🚨 REQUISITOS CRÍTICOS - SHOPIFY THEME STORE (Bloqueadores)

### 1. Internacionalização (i18n) + Color Schemes
**Status:** Em Progresso (abordagem: section por section 100% completa) | **Esforço:** 28-42h | **Prioridade:** 🔴 CRÍTICA

Sistema completo de tradução PT-BR ↔ EN + Color Schemes para aprovação na Theme Store.

**Abordagem:** Section 100% completa = i18n storefront + i18n schema + color schemes

**Sections 100% completas:**
- ✅ `header.liquid` (i18n schema + color schemes)
- ✅ `footer.liquid` (i18n schema + color schemes)
- ✅ `announcement-bar.liquid` (i18n schema + color schemes)
- ✅ `testimonials.liquid` (i18n front + schema + dual color schemes: section + card)
- ✅ `trust-badges.liquid` (i18n schema + color schemes)
- ✅ `main-404.liquid` (i18n storefront + schema + color scheme)
- ✅ `main-collection.liquid` (i18n storefront + schema)
- ✅ `main-search.liquid` (i18n storefront + schema; + `search-component` snippet/js)
- ✅ `main-blog.liquid` (i18n storefront + schema; + `card-article` snippet)
- ✅ `main-article.liquid` (i18n storefront + schema)
- ✅ `main-product.liquid` (PDP — i18n storefront + schema; 89 chaves de schema; snippets `sticky-add-to-cart`, `main-product-right` migrados)
- ✅ `highlighted-section.liquid` (i18n schema + storefront; chave reutilizável `general.see_more`)
- ✅ Carrinho (`templates/cart.liquid` + `cart-drawer*` snippets) — storefront via `cart.general.*` (sem schema)

Snippets compartilhados migrados junto: `card-product-slider`, `card-article`, `search-component`. PDP storefront já usava chaves (`product.*`) em price/inventory/quantity/add-to-cart.

**Pendente:** ~6 sections de Home restantes (hero/sliders/highlighted-product/section-images-link/newsletter) → depois migrar os snippets restantes.

**Locales:** `pt-BR.json` (~225 strings), `en.default.json`, `pt-BR.schema.json`, `en.default.schema.json`

**Documentação:** `docs/I18N_MIGRATION_GUIDE.md`

---

### 2. Acessibilidade WCAG 2.1 AA
**Status:** Parcial | **Esforço:** 13-17h | **Prioridade:** 🔴 CRÍTICA

Lighthouse Accessibility Score > 90 (requisito Theme Store).
- ⏳ Contraste 4.5:1 validado
- ⏳ ARIA labels completos
- ⏳ Navegação por teclado testada
- ⏳ Alt texts em todas imagens
- ⏳ Screen reader compatible

---

### 3. Performance Benchmarks
**Status:** Não validado | **Esforço:** 8-12h | **Prioridade:** 🔴 CRÍTICA

Lighthouse Performance > 50 mobile (requisito mínimo).
- ⏳ Lazy loading completo
- ⏳ CSS/JS minificados para produção
- ⏳ WebP + srcset otimizado
- ⏳ TailwindCSS tree-shaking configurado
- ⏳ Lighthouse audit completo

---

### 4. Documentação Merchant
**Status:** Faltando | **Esforço:** 8-12h | **Prioridade:** 🟡 ALTA

README para lojistas (não desenvolvedores).
- ⏳ Setup guide (instalação/configuração)
- ⏳ Feature overview (sections/settings)
- ⏳ Troubleshooting
- ⏳ Screenshots (5-7 high-res 1920x1080)
- ⏳ Demo video opcional (2-3 min)

---

### 5. Code Quality (Theme Check)
**Status:** Parcial — 11 errors, 27 warnings (2026-06-27) | **Esforço:** 4-6h | **Prioridade:** 🟡 ALTA

Theme Check zerado para a Theme Store. Quality gate por implementação: ver regra 4 em `CLAUDE.md`. Arquivos já revisados (Home/PDP/Coleção/Busca/Carrinho/Blog/Artigo) sem offenses próprios. `ValidSchemaTranslations` **zerado** (testimonials corrigido). Pendentes — 🔴 (11): `ImgWidthAndHeight` (10× → add `width`/`height`) em customers/order, newsletter-modal, product-gallery, testimonial-card, gift_card; `UnknownFilter` (1×, gift_card). 🟡 (28): `UnusedAssign` (11×), `UndefinedObject` (9×), `OrphanedSnippet` (7×), `RemoteAsset` (1×, inerente).

---

## 🔴 FEATURES COMERCIAIS (Alta Prioridade - Pós Theme Store)

### Wishlist (Lista de Desejos)
**Esforço:** 16-20h

Sistema de favoritos com localStorage + metafields.
- Web Component `<wishlist-button>`
- Página dedicada + contador header
- Eventos customizados

### Instagram Feed Custom
**Esforço:** 12-16h

API Instagram Basic Display (sem app).
- Grid 6x2 responsivo com lightbox
- Cache 1h localStorage

### Bundle / Compre Junto
**Esforço:** 20-24h

Cross-sell PDP com desconto progressivo.
- Checkboxes + cálculo real-time
- Metafield `bundle_products`

### Reviews Integration
**Esforço:** 6-8h

Judge.me ou Loox (apps).
- Documentação: `docs/REVIEWS_INTEGRATION.md`
- Schema agregateRating preparado

### Size Guide Modal
**Esforço:** 8-12h

Tabela de medidas customizável. **Bloqueador:** medidas variam por categoria/produto — precisa de fonte de dados que não exija o lojista preencher manualmente (metaobjects/automação). Não entregar como texto global no editor.
- Imagens + dicas de modelagem
- Estratégia de dados por categoria (sem setup técnico do lojista)

---

## 🟡 MELHORIAS PLANEJADAS (Médio/Longo Prazo)

### Migração de tokens (legado)
**Esforço:** contínuo — Substituir `rounded-lg`→`rounded-theme` e hex/cinzas → tokens ao tocar cada arquivo. Sections com `color_scheme` devem **pintar o fundo** (`color-background color-text`), não só setar variáveis — senão schemes escuros ficam ilegíveis (corrigido em footer/blog/artigo).

---

## ✅ CONCLUÍDO (Resumo)

**v2.12.0 - i18n do Highlighted Section** (2026-06-27) — `highlighted-section.liquid` 100% i18n: schema fechado (`button_style` + `link` migrados, chaves órfãs `button_url`/`url` removidas dos locales) e storefront (fallback do CTA agora via nova chave reutilizável `general.see_more`, que servirá às demais sections de Home). Theme Check limpo, ValidSchemaTranslations 0.

**v2.11.0 - i18n da PDP (Produto)** (2026-06-27) — `main-product.liquid` 100% i18n: 89 chaves de schema (`t:sections.main_product.*`) em settings + 11 blocos (title/price/inventory/quantity/variant/buy_button/description/collapsible/assurances/payment_icons), com entradas em `pt-BR.schema.json` + `en.default.schema.json`. Storefront: `sticky-add-to-cart` migrado (aria-labels + botão via `product.general.*`, nova chave `add_to_cart_short`); price/inventory/quantity/add-to-cart já usavam chaves. **Limpeza:** removido placeholder morto `SKU não implementado` e `UnusedAssign` (`product_form_id`) no sticky-atc. Theme-wide 39→38 offenses, ValidSchemaTranslations 0.

**v2.10.0 - Página 404 + color schemes** (2026-06-27) — 404 convertida de `.liquid` cru para template JSON + section `main-404` (editorial: 404 grande, título `font-light`, busca opcional, CTA; color scheme + tokens, editável no editor). Color scheme adicionado a Blog e Artigo; **fix** footer/blog/artigo pintavam só as variáveis sem o fundo (`color-background color-text`) → ilegível em schemes escuros.

**v2.9.0 - Revisão Blog + Artigo (editorial)** (2026-06-27) — Blog (header `font-light`, filtros/categorias como chips outline uppercase, sidebar com bordas tokenizadas, estado vazio), card de artigo (eyebrow de tag, `rounded-theme`, "Ler mais" uppercase) e artigo (título `font-light`, tags/share/bio/prev-next/comentários tokenizados). **Fix:** corpo do artigo (`.article-content`) usava `@apply` em `<style>` .liquid (ignorado pelo navegador) + `prose` sem plugin → movido para `assets/article.css` (CSS real co-locado). Safelist `grid-cols` até 6 (blog), `ImgWidthAndHeight` corrigido nos arquivos tocados.

**v2.8.0 - Revisão Carrinho (página + drawer)** (2026-06-26) — Página de carrinho reescrita no registro editorial (2 colunas, resumo sticky, tipografia leve, tokens) + estado vazio. Drawer alinhado (pesos leves, a11y: `role=dialog`/`aria-modal`/`aria-hidden` sincronizado + foco). Barra de **frete grátis** (page+drawer) via setting global `cart_free_shipping_threshold`. Reatividade da página por `assets/cart-extras.js` (escuta eventos do `cart.js` **sem modificá-lo**) — totais/linhas/vazio. **Fixes:** `#cart-items-container` id na página (drawer lê dela — acoplamento corrigido), `data-product-id` Liquid inválido, `action` hardcoded → `routes.cart_url`. Contrato de hooks do `cart.js` preservado.
**v2.7.0 - Revisão Coleção + Busca (minimalista de luxo)** (2026-06-25) — Registro editorial aplicado às páginas de listagem: hero/cabeçalho com `font-light tracking-tight` + scrim mais leve (`bg-black/30`), descrição da coleção sobre o hero; sidebar de filtros e contagem com eyebrow `uppercase tracking-[0.18em]` + bordas tokenizadas (`border-border`); pills de tipo (busca) e buscas populares como chips outline uppercase; cards de artigo/página com `rounded-theme` + hover de borda (sem shadow); estados vazios e CTAs no padrão editorial. Tudo via tokens/color scheme, `rounded-lg`→`rounded-theme`, zero setup técnico. **Fixes:** busca preditiva (dropdown editorial, highlight sutil sem amarelo, badges/estado em tokens, overlay agora atrás do header via `z-[1]` no container), `?q=&q=` duplicado removido (`name="q"` do botão submit), botão "Todos" legível (CSS real no lugar de `@apply` em `<style>`), **safelist `grid-cols-[2-5]`** (classe `lg:grid-cols-N` dinâmica do Liquid não era detectada → coleção/busca agora respeitam `products_per_row`), swatches do card limitados a 4 + chip "+N" discreto.

**v2.6.0 - Revisão da Home (minimalista de luxo)** (2026-06-24) — Varredura das 9 seções no registro editorial: hero com overlay editável por slide + color scheme regendo tudo (fundo/nav/texto/botão/scrim); trust-badges (traço fino, fios); card de produto reformulado (swatches hover/chip mobile, quick-add via `card-quick-add`, parcelamento das settings, peek nos sliders via `data-peek`); highlighted-section (blob off + fix `default:true`, link único + dropdown tipo de botão); slider-cards (3:4 + label sobre scrim); section-images-link (tiles flush); testimonials (declutter, defaults pt-BR); newsletter-modal. Tudo segue color scheme e tokens, zero setup técnico.
**v2.5.0 - Redesign PDP (minimalista de luxo)** (2026-06-23) — Coluna direita editorial (eyebrow + título `font-light`, preço `text-2xl` + parcelamento, CTA alinhado); blocos estoque/pagamento ativados; bloco `assurances` + acordeão Entrega; sticky ATC + galeria mobile (dots/contador). Fix pluralização do estoque (`count` nativo pt-BR/en).
**v2.4.0 - Design System & Remoção do jQuery** (2026-06-23) — jQuery removido (Swiper 11 + CSS); design tokens de cor + `rounded-theme` no config; header sticky; asset loading co-locado.
**v2.3.0 - i18n, Color Schemes & Gift Card** (2024-12-26) — Locales PT-BR/EN (~225 strings); color schemes dual em testimonials; gift card standalone; announcement-bar/trust-badges scheme-aware.
**v2.2.0 - Sticky ATC & Padronização** (2025-01-22) — Sticky Add to Cart (IntersectionObserver); arredondamentos padronizados.
**v2.1.0 - Prova Social & SEO** (2025-11) — Testimonials (slider, ratings); schemas SEO (Product/Organization/Breadcrumb/Article).
**v2.0.0 - Core Features** (2025-11) — 7 templates de cliente; blog + busca preditiva + minicart; newsletter modal + trust badges + payment icons.

---

## 🛠️ Como manter

- Máx. **250 linhas**, prioridades no topo, cada feature ≤ 10 linhas (Status | Esforço | Prioridade). Deve sempre refletir o estado atual.
- **Ao concluir:** mover para `✅ CONCLUÍDO` em 1 linha com data, remover do topo, atualizar **Versão**/**Atualizado** no header.

---

**Desenvolvido com 💜 por Cleyton Mendes**
