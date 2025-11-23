# 🗺️ ROADMAP - Tema Elizabeth

**Versão:** 2.2.0 | **Atualizado:** 2025-01-22

---

## 🔴 PRÓXIMAS IMPLEMENTAÇÕES (Prioridade Alta)

### 1. Color Scheme System
**Status:** Planejado | **Esforço:** 12-16h | **Prioridade:** 🔴 Alta

Centralizar cores do tema em design tokens (CSS variables + Tailwind config).
- Substituir cores hardcoded (orange-500, green-600, red-600)
- Configuração global em `assets/color-scheme.css`
- Integração com Tailwind config
- Preparado para dark mode futuro

**Arquivos com cores hardcoded identificados:**
- `assets/newsletter-modal.css`, `snippets/testimonial-card.liquid`

---

### 2. Instagram Feed Custom (API)
**Status:** Solicitado | **Esforço:** 12-16h | **Prioridade:** 🔴 Alta

Implementação custom usando Instagram Basic Display API (sem app Shopify).
- Grid 6x2 responsivo (6 desktop, 2 mobile)
- Hover overlay (likes/comments + link)
- Lightbox fullscreen com navegação
- Configurável: username, número de posts, hashtag filter
- Cache 1h (localStorage)

---

### 3. Wishlist (Lista de Desejos)
**Status:** Solicitado | **Esforço:** 16-20h | **Prioridade:** 🔴 Alta

Sistema de favoritos com localStorage (guests) + metafields (logados).
- Web Component `<wishlist-button>`
- Contador no header
- Página dedicada `page.wishlist.liquid`
- Integração: PDP, cards de produto, quick view
- Eventos: `wishlist:add`, `wishlist:remove`, `wishlist:update`

---

### 4. Compre Junto (Bundle)
**Status:** Solicitado | **Esforço:** 20-24h | **Prioridade:** 🔴 Alta

Cross-sell na PDP com checkboxes e desconto progressivo.
- Metafield: `product.metafields.custom.bundle_products`
- Cards compactos com checkbox + imagem + preço
- Cálculo total em tempo real
- "Economize R$ X (10%)!" em destaque
- Botão "Adicionar Bundle" (múltiplos produtos de uma vez)

---

### 5. Reviews Integration
**Status:** Preparado | **Esforço:** 6-8h | **Prioridade:** 🟡 Média

Integração com Judge.me ou Loox (apps recomendados).
- Documentação completa: `docs/REVIEWS_INTEGRATION.md`
- Schema preparado para aggregateRating
- Suporte para blocos @app

---

### 6. Size Guide Modal
**Status:** Planejado | **Esforço:** 8-12h | **Prioridade:** 🟡 Média

Tabela de medidas customizável por categoria.
- Imagens + dicas de modelagem
- Modal responsivo
- Configurável via metafields

---

## 🟡 MELHORIAS PLANEJADAS (Médio Prazo)

### Border Radius Tokens
**Esforço:** 4-6h

Centralizar arredondamentos em Tailwind config (`rounded-theme`, `rounded-theme-sm`).
- **Padrão atual:** `rounded-lg` (8px) ou sem arredondamento

### Performance Otimizat

ions
**Esforço:** 37-46h

- Migração jQuery → Vanilla JS
- Substituir Owl Carousel (Swiper/Splide)
- WebP com fallback
- Srcset em todas imagens

### Acessibilidade (A11y)
**Esforço:** 13-17h

- Alt texts completos
- ARIA labels em ícones/botões
- Navegação por teclado
- Contraste WCAG AA (4.5:1)

---

## ✅ CONCLUÍDO (Resumo)

**Fase 4 - PDP UI/UX** (2025-01-22)
- Sticky Add to Cart melhorado com componente `<add-to-cart>` padronizado e IntersectionObserver
- Padronização de arredondamentos: `rounded-lg` (8px) em modais, cards, botões, imagens
- Sticky button texto adaptativo mobile/desktop via data attributes

**Fase 3 - Prova Social & SEO** (2025-11)
- Testimonials Section (slider 3 cards, ratings, fotos, badges)
- SEO Estruturado: Product Schema, Organization Schema, Breadcrumb Schema, BlogPosting Schema

**Fase 2 - Quick Wins** (2025-11)
- Trust Badges (grid/slider/lista, 8 ícones SVG, sticky opcional)
- Payment Icons (8 bandeiras brasileiras)
- Lazy Loading estratégico (hero LCP otimizado)
- Indicador de estoque baixo com tempo real

**Fase 1 - Core** (2025-11)
- 7 páginas de cliente (login, register, account, addresses, orders, reset password, activate)
- Blog completo (listing + artigo com sidebar)
- Busca preditiva (keyboard navigation, highlight query)
- Minicart polido (sem duplicação)
- Modal newsletter (3 triggers: delay/scroll/exit intent)
- Sistema de componentes reutilizáveis (cards, pagination, price, inventory)

---

**Desenvolvido com 💜 por Cleyton Mendes**
