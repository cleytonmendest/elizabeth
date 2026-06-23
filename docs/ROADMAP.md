# 🗺️ ROADMAP - Tema Elizabeth

**Versão:** 2.4.0 | **Atualizado:** 2026-06-23

> **⚠️ REGRA DE OURO:** Sempre ler este ROADMAP antes de implementações. PRIORIDADE MÁXIMA = Requisitos Shopify Theme Store. Features secundárias aguardam conclusão dos bloqueadores críticos.

---

## 🚨 REQUISITOS CRÍTICOS - SHOPIFY THEME STORE (Bloqueadores)

### 1. Internacionalização (i18n) + Color Schemes
**Status:** Em Progresso (abordagem: section por section 100% completa) | **Esforço:** 28-42h | **Prioridade:** 🔴 CRÍTICA

Sistema completo de tradução PT-BR ↔ EN + Color Schemes para aprovação na Theme Store.

**Abordagem:** Section 100% completa = i18n storefront + i18n schema + color schemes

**Sections 100% completas (17%):**
- ✅ `header.liquid` (i18n schema + color schemes)
- ✅ `footer.liquid` (i18n schema + color schemes)
- ✅ `announcement-bar.liquid` (i18n schema + color schemes)
- ✅ `testimonials.liquid` (i18n front + schema + dual color schemes: section + card)
- ✅ `trust-badges.liquid` (i18n schema + color schemes)

**Pendente:** ~13 sections restantes → depois migrar ~92 snippets

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

### 5. Code Quality
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

### Migração de tokens (legado)
**Esforço:** contínuo

Substituir resíduos de `rounded-lg` → `rounded-theme` e hex/cinzas hardcoded → tokens conforme se toca em cada arquivo (sem refator big-bang).

---

## ✅ CONCLUÍDO (Resumo)

**v2.4.0 - Design System & Remoção do jQuery** (2026-06-23)
- jQuery 100% removido (Owl/marquee → Swiper 11 + CSS); design tokens de cor + `rounded-theme` centralizados no `tailwind.config.js`; sections/templates de cliente e newsletter padronizados com tokens; header sticky; asset loading core (`theme.liquid`) + CSS/JS co-locados por componente.

**v2.3.0 - i18n, Color Schemes & Gift Card** (2024-12-26)
- Locales PT-BR/EN (~225 strings) + guia; color schemes dual (section + card) em testimonials; gift card standalone (QR, print); announcement-bar e trust-badges refatorados scheme-aware + i18n schema.

**v2.2.0 - Sticky ATC & Padronização** (2025-01-22) — Sticky Add to Cart (IntersectionObserver, texto adaptativo); arredondamentos padronizados.

**v2.1.0 - Prova Social & SEO** (2025-11) — Testimonials (slider, ratings); schemas SEO (Product/Organization/Breadcrumb/Article).

**v2.0.0 - Core Features** (2025-11) — 7 templates de cliente; blog + busca preditiva + minicart; newsletter modal + trust badges + payment icons; componentes reutilizáveis.

---

## 🛠️ Como manter

- Máx. **150 linhas**, prioridades no topo, cada feature ≤ 10 linhas (Status | Esforço | Prioridade). Deve sempre refletir o estado atual.
- **Ao concluir:** mover para `✅ CONCLUÍDO` em 1 linha com data, remover do topo, atualizar **Versão**/**Atualizado** no header.

---

**Desenvolvido com 💜 por Cleyton Mendes**
