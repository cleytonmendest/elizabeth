# 🗺️ ROADMAP - Tema Elizabeth

**Versão:** 2.3.0 | **Atualizado:** 2024-12-24

> **⚠️ REGRA DE OURO:** Sempre ler este ROADMAP antes de implementações. PRIORIDADE MÁXIMA = Requisitos Shopify Theme Store. Features secundárias aguardam conclusão dos bloqueadores críticos.

---

## 🚨 REQUISITOS CRÍTICOS - SHOPIFY THEME STORE (Bloqueadores)

### 1. Internacionalização (i18n)
**Status:** Em Progresso (8% storefront + schemas iniciados) | **Esforço:** 28-42h | **Prioridade:** 🔴 CRÍTICA

Sistema completo de tradução PT-BR ↔ EN para aprovação na Theme Store.

**Storefront i18n (front-end):**
- ✅ Locales criados: `pt-BR.json` (~220 strings), `en.default.json` (completo)
- ✅ Migrado: 8 arquivos críticos (cart, product, search, breadcrumb, newsletter)
- ⏳ Pendente: ~93 arquivos (snippets, sections, templates)

**Schema i18n (Theme Editor):**
- ✅ Arquivos base criados: `pt-BR.schema.json`, `en.default.schema.json`
- ✅ Schemas traduzidos: header, footer
- ⏳ Pendente: ~30 sections restantes

**Arquivos migrados:** cart-drawer, add-to-cart, inventory-status, newsletter, breadcrumb, search-component, price-v2, quantity-selector

**Documentação:** `docs/I18N_MIGRATION_GUIDE.md`

---

### 2. Color Scheme System
**Status:** Parcial (60%) | **Esforço:** 6-10h restantes | **Prioridade:** 🔴 CRÍTICA

Cores customizáveis via Theme Customizer (requisito obrigatório).
- ✅ CSS variables completas (14 cores)
- ✅ `color-scheme.css` carregado no tema
- ✅ 7 sections com suporte a color_scheme
- ✅ Snippets críticos migrados (cart, add-to-cart, inventory, testimonials)
- ⏳ Refinar aplicação em algumas pages/sections
- ⏳ Testar troca de esquemas (Light/Dark/Gray)

---

### 3. Acessibilidade WCAG 2.1 AA
**Status:** Parcial | **Esforço:** 13-17h | **Prioridade:** 🔴 CRÍTICA

Lighthouse Accessibility Score > 90 (requisito Theme Store).
- ⏳ Contraste 4.5:1 validado
- ⏳ ARIA labels completos
- ⏳ Navegação por teclado testada
- ⏳ Alt texts em todas imagens
- ⏳ Screen reader compatible

---

### 4. Performance Benchmarks
**Status:** Não validado | **Esforço:** 8-12h | **Prioridade:** 🔴 CRÍTICA

Lighthouse Performance > 50 mobile (requisito mínimo).
- ⏳ Lazy loading completo
- ⏳ CSS/JS minificados para produção
- ⏳ WebP + srcset otimizado
- ⏳ TailwindCSS tree-shaking configurado
- ⏳ Lighthouse audit completo

---

### 5. Documentação Merchant
**Status:** Faltando | **Esforço:** 8-12h | **Prioridade:** 🟡 ALTA

README para lojistas (não desenvolvedores).
- ⏳ Setup guide (instalação/configuração)
- ⏳ Feature overview (sections/settings)
- ⏳ Troubleshooting
- ⏳ Screenshots (5-7 high-res 1920x1080)
- ⏳ Demo video opcional (2-3 min)

---

### 6. Code Quality
**Status:** Parcial | **Esforço:** 4-6h | **Prioridade:** 🟡 ALTA

Theme Check compliance (zero erros críticos).
- ⏳ Executar `shopify theme check`
- ⏳ Corrigir warnings/erros
- ⏳ Validar Liquid syntax

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

Tabela de medidas customizável.
- Imagens + dicas de modelagem
- Configurável via metafields

---

## 🟡 MELHORIAS PLANEJADAS (Médio/Longo Prazo)

### Border Radius Tokens
**Esforço:** 4-6h

Centralizar em Tailwind config (`rounded-theme`).

### jQuery → Vanilla JS
**Esforço:** 37-46h

Migração completa + Owl Carousel → Swiper.

---

## ✅ CONCLUÍDO (Resumo)

**v2.3.0 - i18n, Color Schemes & Gift Card** (2024-12-24)
- Sistema i18n: locales PT-BR/EN completos (~200 strings), guia migração, cart-drawer migrado (1/101 arquivos)
- Color Schemes: CSS variables (14 cores), 7 sections + 5 snippets migrados, 3 esquemas (Light/Dark/Gray)
- Gift Card: template completo com layout standalone, QR code, código copiável, status/saldo, print otimizado (@page margins, background white), Apple Wallet, 100% i18n + color schemes

**v2.2.0 - Sticky ATC & Padronização** (2025-01-22)
- Sticky Add to Cart com IntersectionObserver e texto adaptativo
- Arredondamentos padronizados: `rounded-lg` (8px) global

**v2.1.0 - Prova Social & SEO** (2025-11)
- Testimonials Section (slider 3 cards, ratings, verified badges)
- SEO Estruturado: Product/Organization/Breadcrumb/BlogPosting Schemas

**v2.0.0 - Core Features** (2025-11)
- 7 customer templates (login, register, account, addresses, orders, reset, activate)
- Blog completo + busca preditiva + minicart polido
- Newsletter modal (3 triggers) + trust badges + payment icons
- Sistema componentes reutilizáveis

---

**Desenvolvido com 💜 por Cleyton Mendes**
