# 🗺️ ROADMAP - Tema Elizabeth

**Última atualização:** 2025-11-15 14:00 (Quick Wins Completos: Lazy Loading + Payment Icons!)
**Versão do Tema:** 1.7.0
**Status:** Fase 1 Completa | Fase 2 - Quick Wins Completos!

---

## 📊 Progresso Geral

**Progresso:** 95% (Fase 1 Completa)

| Categoria | Status |
|-----------|--------|
| Templates & Páginas | ✅ 100% |
| Componentes JavaScript | ✅ 100% |
| Funcionalidades Core | ✅ 100% |
| Blog & Conteúdo | ✅ 100% |
| SEO Básico | 🟡 30% |
| Performance | 🟡 65% |

---

## ✅ Itens Concluídos (Resumo)

### Páginas de Cliente
- ✅ Login, Register, Reset Password, Activate Account, Account Dashboard, Addresses (ViaCEP), Order Details (timeline + rastreamento) - 7 páginas completas com validação e UX polido

### Templates Principais
- ✅ Página de Coleção (grid responsivo, filtros, ordenação, paginação, 12 produtos/página)
- ✅ Página de Busca (resultados por tipo, filtros, paginação, buscas populares, estado vazio)
- ✅ Blog (main-blog.liquid: grid 3 cols, filtros tags, sidebar, busca, newsletter, paginação)
- ✅ Artigo (main-article.liquid: hero image, metadata, share social, relacionados, prev/next, comentários, sidebar)

### Componentes & Features
- ✅ Minicart (cart.js corrigido, UI/UX melhorado, sem duplicação de cards, responsivo)
- ✅ Busca Preditiva (keyboard navigation, highlight query, badges, coleções, loading state, price fix R$179,90)
- ✅ Modal de Newsletter (3 triggers: delay/scroll/exit intent, cookie system, validação, Shopify integration)
- ✅ Carousel Manager (Owl Carousel configurado)
- ✅ Variations Selector (variant-selects component)
- ✅ Price Component (formatação BRL)
- ✅ Quantity Selector
- ✅ Cart Integration (pub/sub events)

### Snippets Reutilizáveis
- ✅ card-product-slider.liquid (badges, srcset, lazy load, hover second image, parcelamento)
- ✅ card-article.liquid (imagem, excerpt, autor, tags, tempo leitura, responsive)
- ✅ pagination.liquid (numérica com prev/next)
- ✅ cart-drawer.liquid + cart-drawer-item.liquid
- ✅ breadcrumb.liquid
- ✅ price-v2.liquid (componente de preço)
- ✅ inventory-status.liquid (indicador de estoque baixo com urgência)
- ✅ trust-badge-item.liquid + trust-badge-icon.liquid (componentes de badges de confiança)

### Seções da Homepage
- ✅ blog-posts.liquid (seção reutilizável: grid 3 cols, configurável, pode ser usada em qualquer página)
- ✅ trust-badges.liquid (frete grátis, troca 30 dias, compra segura, 6x sem juros - grid/slider/lista, sticky opcional, 8 ícones SVG)

### Features de Conversão
- ✅ Indicador de Estoque Baixo (PDP: "Apenas X unidades!", atualização em tempo real via variant:change, configurável threshold 0-100, toggle quantidade exata)
- ✅ Payment Icons (PDP: Visa, Mastercard, Elo, Amex, Hipercard, Diners, PIX, Boleto - configurável: color/grayscale, 3 tamanhos, texto parcelamento)

### Otimizações de Performance
- ✅ Lazy Loading Estratégico:
  - Primeiro slide do hero: `loading="eager" fetchpriority="high"` (otimização LCP)
  - Demais imagens: `loading="lazy"` (economia de banda)
  - Atributo `decoding="async"` em todas as imagens (não bloqueia renderização)
  - Aplicado em: slider-image, card-article, card-product, cart-drawer, search, newsletter, orders

### Correções de Bugs
- ✅ BUG-001: HTTP→HTTPS em meta tags (SEO/Segurança)
- ✅ BUG-002: Aspas extras em highlighted-product.liquid
- ✅ BUG-004: Limite de 2→12 produtos por página
- ✅ BUG-005: Duplicação de cards no minicart (innerHTML replace fix)
- ✅ BUG-006: console.log removido (apenas error/warn em produção)
- ✅ BUG-007: Arquivo product-test.liquid deletado

---

## 🚨 PRIORIDADE ALTA - Próximas Implementações

### 1. SEO Estruturado

**Status:** 🔴 30% Completo

**Pendente:**
- [ ] **JSON-LD Schema Markup**
  - [ ] Product Schema (offers, brand, sku, aggregateRating)
  - [ ] Organization Schema (logo, sameAs, contactPoint)
  - [ ] Breadcrumb Schema (BreadcrumbList)
  - [ ] CollectionPage Schema
  - [ ] BlogPosting Schema (já em blog)
  - [ ] Author Schema

- [ ] **Meta Tags Avançadas**
  - [ ] Canonical tags em todas as páginas
  - [ ] hreflang tags (se internacionalização futura)
  - [ ] Twitter Card metadata
  - [ ] Facebook Open Graph completo

**Estimativa:** 6-8 horas

---

### 2. Homepage - Melhorias de Conversão

**Status Atual:** 8 sections (hero, products, featured, categories, image links, about us, **blog-posts**, **trust-badges**)

#### 🔴 CRÍTICO (Alto ROI)

1. ✅ ~~**Trust Badges / Benefits Bar** 🛡️~~ - CONCLUÍDO
   - ✅ Frete Grátis R$299+ • Troca 30 dias • Compra Segura • 6x sem juros
   - ✅ Grid desktop, slider mobile, lista horizontal
   - ✅ Sticky top opcional
   - ✅ 8 ícones SVG personalizáveis
   - ✅ Sistema de blocos flexível
   - **Impacto:** +25% confiança, -15% bounce rate
   - **Esforço:** ~~3-4h~~ FINALIZADO

2. **Testimonials / Reviews Section** ⭐
   - Slider de depoimentos (foto + nome + cidade + rating 5 estrelas)
   - 3 cards desktop, 1 mobile, auto-play
   - **Impacto:** +30% conversão (prova social)
   - **Esforço:** 8-10h

3. **Instagram Feed** 📸 - SOLICITADO
   - Grid 6x2 posts do Instagram
   - Hover: likes/comments + link
   - Lightbox fullscreen
   - Hashtag #ElizabethModa
   - **Ver seção 4 para detalhes**
   - **Impacto:** +35% engajamento social
   - **Esforço:** 12-16h (API) ou 2-4h (app Shopify)

#### 🟠 IMPORTANTE

4. **Urgency / Scarcity Section** ⏱️
   - Countdown timer + grid produtos em promoção
   - Badge "-X%" em destaque
   - **Esforço:** 8-10h

5. **Featured Products Section** 🎯
   - Produtos escolhidos manualmente (não por coleção)
   - "Favoritos da Semana"
   - Grid 4 colunas, até 8 produtos
   - **Esforço:** 4-6h

6. **Collections Grid** 🗂️
   - Grid 2x3 ou 3x3 estático
   - Hover: overlay + "Ver Coleção"
   - **Esforço:** 4-6h

7. **FAQ Section** ❓
   - Accordion 6-8 perguntas
   - "Como comprar", "Formas de pagamento", "Prazo"
   - **Esforço:** 6-8h

**Total Homepage:** 35-54 horas

---

### 3. PDP (Product Detail Page) - Melhorias

**Status Atual:** Sistema de blocos flexível, 4 layouts galeria, zoom configurável, sticky sidebar

#### 🔴 CRÍTICO

1. **Reviews/Ratings** ⭐⭐⭐⭐⭐
   - App: Judge.me ou Loox
   - Star rating, review count, scroll to reviews
   - **Impacto:** +35% conversão
   - **Esforço:** 6-8h (integração app)

2. **Wishlist** ❤️ - SOLICITADO
   - Web Component `<wishlist-button>`
   - localStorage (guests) + metafields (logados)
   - Contador no header
   - Página dedicada com grid
   - **Ver seção 5 para detalhes**
   - **Impacto:** +20% retorno
   - **Esforço:** 16-20h

3. **Compre Junto** 🛒 - SOLICITADO
   - Bundle com checkboxes
   - Metafield `bundle_products`
   - Desconto progressivo configurável
   - "Economize R$ X"
   - **Ver seção 6 para detalhes**
   - **Impacto:** +30-40% ticket médio
   - **Esforço:** 20-24h

4. ✅ ~~**Indicador de Estoque Baixo** 📦~~ - CONCLUÍDO
   - ✅ Snippet inventory-status.liquid criado
   - ✅ "Apenas X unidades!" com badge vermelho urgência
   - ✅ Atualização em tempo real (event variant:change)
   - ✅ Configurável: threshold 0-100, mostrar/ocultar quantidade
   - ✅ 3 estados: estoque baixo (vermelho), disponível (verde), fora de estoque
   - ✅ Schema descomentado e integrado em main-product.liquid
   - **Impacto:** +15% conversão
   - **Esforço:** ~~1-2h~~ FINALIZADO

5. **Size Guide Modal** 📏
   - Tabela de medidas por categoria
   - Imagens + dicas de modelagem
   - **Impacto:** -20% devoluções (crítico para moda)
   - **Esforço:** 8-12h

#### 🟠 IMPORTANTE

6. Trust Badges (Compra Segura, Frete Grátis, Troca 30 dias) - 2-3h
7. Shipping Calculator (CEP + API Correios) - 8-10h
8. Product Recommendations ("Você Também Pode Gostar") - 6-8h
9. Share Buttons (WhatsApp essencial) - 4-6h
10. Sticky Add to Cart Desktop - 6-8h

**Total PDP:** 77-101 horas

---

### 4. Instagram Feed 📸

**Status:** 🔴 Não implementado - SOLICITADO PELO CLIENTE

**IMPORTANTE:** Cliente optou por implementação **custom do zero** (sem app Shopify) para maior flexibilidade

**Implementação:**

- [ ] **Escolher Abordagem**
  - ~~Opção 1: App Shopify (POWR/Elfsight) - 2-4h~~ ❌ DESCARTADO (cliente quer custom)
  - Opção 2: API Instagram Basic Display - 12-16h ⭐ **ESCOLHIDA** (flexibilidade total)
  - Opção 3: Embed manual com hashtag - 6-8h (menos flexível)

- [ ] **Criar `sections/instagram-feed.liquid`**
  - Grid 6x2 responsivo (6 desktop, 3 tablet, 2 mobile)
  - Imagens 1:1 aspect ratio
  - Hover overlay (likes/comments + link Instagram)
  - Lightbox fullscreen (imagem grande + caption + navegação)
  - Header: "Siga @elizabeth" + botão "Seguir"

- [ ] **Configurações (Schema)**
  - Username/Account ID
  - Número de posts (6/8/12/16)
  - Hashtag filter (#ElizabethModa)
  - Título e subtítulo customizáveis
  - Border radius, gap entre imagens
  - Hover effect tipo

- [ ] **JavaScript Component** (se API)
  - Fetch posts
  - Cache 1h (localStorage)
  - Error handling + retry logic
  - Lazy load images

- [ ] **Localizações**
  - Homepage (após produtos)
  - Footer (mini: 4-6 fotos)
  - Blog sidebar (4 fotos)

**Estimativa:** ~~2-4h (app)~~ | **12-16h (API custom)** ⭐ ESCOLHIDA pelo cliente

---

### 5. Wishlist (Lista de Desejos) ❤️

**Status:** 🔴 Não implementado - SOLICITADO PELO CLIENTE

**Implementação:**

- [ ] **Sistema de Armazenamento**
  - localStorage para guests (chave: `wishlist_items`)
  - Customer metafields para logados (`customer.metafields.custom.wishlist`)
  - Sincronizar ao login (merge de listas)
  - Limite: 50 produtos/usuário

- [ ] **Web Component `<wishlist-button>`**
  - Ícone coração (outline ↔ filled)
  - Animação no toggle
  - Estados: vazio, loading, adicionado, removido
  - Pub/sub events (`wishlist:add`, `wishlist:remove`, `wishlist:update`)
  - Contador no header (próximo ao cart icon)

- [ ] **Página Wishlist**
  - Template `page.wishlist.liquid`
  - Grid de produtos (mesmo card de collection)
  - Botão "Adicionar ao Carrinho" individual
  - Botão "Adicionar Todos ao Carrinho"
  - Botão "Remover" com confirmação
  - Empty state: "Sua lista está vazia" + "Continuar Comprando"

- [ ] **Integração em Locais**
  - PDP (próximo ao "Adicionar ao Carrinho")
  - Cards de produto (hover: botão aparece)
  - Quick View modal (futuro)
  - Badge "❤️ Na Wishlist" nos cards

- [ ] **API/JavaScript**
  - `assets/wishlist.js`
  - CRUD operations (add, remove, get, clear)
  - localStorage helpers
  - Shopify metafield helpers (se logado)
  - Event emitter

**Estimativa:** 16-20 horas

---

### 6. Compre Junto (Bundle/Cross-Sell) 🛒

**Status:** 🔴 Não implementado - SOLICITADO PELO CLIENTE

**Implementação:**

- [ ] **Metafield Setup**
  - `product.metafields.custom.bundle_products` (list of product IDs)
  - `product.metafields.custom.bundle_discount` (percentual: 5%, 10%, 15%)
  - Admin UI para selecionar produtos

- [ ] **Componente Visual**
  - Seção "Compre Junto e Economize"
  - Cards compactos: checkbox + imagem 80x80 + nome + preço
  - Produto principal sempre selecionado (disabled checkbox)
  - Até 4 produtos adicionais
  - Cálculo total em tempo real
  - Destaque: "Economize R$ 35,97 (10%)!"

- [ ] **Lógica de Preço**
  - Validar estoque de todos produtos
  - Aplicar desconto apenas se todos selecionados
  - Mostrar: preço individual vs. bundle

- [ ] **Botão "Adicionar Bundle"**
  - Adiciona múltiplos produtos de uma vez
  - Loading state
  - Feedback visual + abre minicart
  - Error handling (estoque insuficiente)

- [ ] **Localização**
  - PDP: abaixo botão "Adicionar ao Carrinho"
  - OU: collapsible tab
  - OU: seção separada após descrição

- [ ] **JavaScript**
  - `assets/bundle-products.js`
  - Web Component `<bundle-products>`
  - Calcular total dinamicamente
  - Integrar com cart.js

**Exemplo Visual:**
```
┌─────────────────────────────────────┐
│ 🎁 Compre Junto e Economize         │
├─────────────────────────────────────┤
│ [✓] Vestido Floral         R$ 179,90│
│ [ ] Cinto Dourado          R$  49,90│
│ [ ] Bolsa Tiracolo         R$ 129,90│
│ [ ] Sandália Nude          R$  89,90│
├─────────────────────────────────────┤
│ Total: R$ 359,70                    │
│ Economize R$ 35,97 (10%)! 🎉        │
│ [Adicionar Selecionados ao Carrinho]│
└─────────────────────────────────────┘
```

**Estimativa:** 20-24 horas

---

## 🟡 PRIORIDADE MÉDIA

### 7. Performance - Otimização

- [ ] Migração jQuery → Vanilla JS (theme.js, header.js) - 20-24h
- [ ] Substituir Owl Carousel (avaliar Swiper/Splide) - 8-10h
- [ ] Lazy loading de imagens abaixo da dobra - 2-3h
- [ ] Srcset em todas as imagens - 4-5h
- [ ] WebP com fallback - 3-4h

**Estimativa:** 37-46 horas

---

### 8. Acessibilidade (A11y)

- [ ] Alt texts em todas as imagens - 3-4h
- [ ] ARIA labels em ícones/botões - 2-3h
- [ ] Skip links ("Pular para conteúdo") - 1h
- [ ] Navegação por teclado (menu, modais) - 4-5h
- [ ] Contraste de cores (WCAG AA 4.5:1) - 3-4h

**Estimativa:** 13-17 horas

---

### 9. Recursos Avançados

- [ ] Quick View Modal - 12-14h
- [ ] Filtros Avançados (Faceted Search) - 20-24h
- [ ] Recently Viewed Products - 6-8h
- [ ] Mega Menu - 12-16h
- [ ] Color Schemes System (trocar temas por data) - 20-28h
- [ ] Gift Guide / Lookbook - 10-12h
- [ ] Countdown Timer (promoções) - 8-10h
- [ ] Back in Stock Notifications - 12-14h
- [ ] Currency Selector - 8-10h
- [ ] Language Selector - 8-10h

**Estimativa:** 116-156 horas

---

### 10. Social Features

- [ ] Social Sharing (produto/artigo completo) - 4-6h
- [ ] User Generated Content Gallery - 12-16h
- [ ] Store Locator (Google Maps) - 16-20h

**Estimativa:** 32-42 horas

---

### 11. Marketing & Conversão

- [ ] Promo Banner System (agendável) - 8-10h
- [ ] Stock Urgency ("Apenas X unidades") - 4-6h
- [ ] Payment Icons (Visa, Master, Elo, Pix) - 2-3h
- [ ] Video de Produto na galeria - 6-8h
- [ ] Social Proof "X pessoas vendo" - 4-6h

**Estimativa:** 24-33 horas

---

### 12. Code Quality & Testing

- [ ] Refatoração (remover duplicação, padronizar) - 12-16h
- [ ] Error handling robusto em todos async - 6-8h
- [ ] Unit tests para componentes JS - 12-16h
- [ ] Cross-browser testing - 4-6h
- [ ] Performance testing - 4-6h

**Estimativa:** 38-52 horas

---

## 📊 Estimativas Totais

| Prioridade | Items | Horas |
|------------|-------|-------|
| 🔴 Alta | 6 grupos | 155-207h |
| 🟡 Média | 6 grupos | 260-346h |
| **TOTAL** | **12 grupos** | **415-553h** |

---

## 🎯 Recomendações de Próximos Passos

### Quick Wins (< 4h, alto impacto) ✅ TODOS CONCLUÍDOS
1. ✅ ~~Ativar Indicador de Estoque Baixo (1-2h)~~ - CONCLUÍDO
2. ✅ ~~Trust Badges na Home (3-4h)~~ - CONCLUÍDO
3. ✅ ~~Blog Posts Section (2-3h)~~ - CONCLUÍDO (seção reutilizável criada)
4. ✅ ~~Lazy loading de imagens (2-3h)~~ - CONCLUÍDO (estratégico + decoding async)
5. ✅ ~~Payment Icons na PDP (2-3h)~~ - CONCLUÍDO (8 bandeiras + configurável)

### Fase 2 - Prova Social & Conversão (2-3 semanas)
1. Instagram Feed com app Shopify (2-4h)
2. Testimonials na Home (8-10h)
3. Reviews na PDP (6-8h app)
4. SEO Estruturado (6-8h)

### Fase 3 - Features Premium (4-6 semanas)
1. Wishlist (16-20h)
2. Compre Junto (20-24h)
3. Size Guide (8-12h)
4. Shipping Calculator (8-10h)

---

## 🏆 Conquistas

### Fase 1 - Funcionalidades Core
- ✅ 7 páginas de cliente completas com UX profissional
- ✅ Blog completo (listing + artigo) com sidebar e compartilhamento social
- ✅ Seção de Blog Posts reutilizável (pode ser usada em qualquer página)
- ✅ Busca preditiva com keyboard navigation
- ✅ Minicart sem bugs e UI polido
- ✅ Modal de newsletter com 3 triggers
- ✅ Sistema de componentes reutilizáveis (cards, pagination, price, inventory, trust badges, payment icons)
- ✅ Arquitetura Online Store 2.0 completa

### Fase 2 - Quick Wins (Conversão & Performance) ✅ COMPLETA
- ✅ Indicador de estoque baixo com atualização em tempo real (3 estados visuais)
- ✅ Trust Badges flexível (grid/slider/lista, 8 ícones SVG, sticky opcional)
- ✅ Payment Icons para PDP (8 bandeiras brasileiras: Visa, Master, Elo, Amex, Hipercard, Diners, PIX, Boleto)
- ✅ Lazy Loading estratégico:
  - Hero otimizado para LCP (`loading="eager" fetchpriority="high"`)
  - Imagens below-the-fold com `loading="lazy"`
  - `decoding="async"` em todas as imagens
- ✅ 0 bugs bloqueadores

**Tempo Fase 1:** ~6 horas (estimativa original: 48-64h) 🚀
**Tempo Quick Wins (Fase 2):** ~10-12 horas (estimativa original: 10-13h) ✨
**Economia total:** ~40-52 horas!

---

## 📝 Notas Importantes

1. **Instagram Feed:** Cliente optou por implementação **custom usando API Instagram Basic Display** (12-16h) ao invés de app Shopify, para maior flexibilidade e controle. Implementação será feita na próxima fase.

2. **Reviews:** Apps Judge.me/Loox são melhores que custom (moderação, photos, SEO built-in).

3. ✅ ~~**Indicador de Estoque:** Código já existe comentado em `main-product.liquid:161-203`~~ - **COMPLETADO** com snippet `inventory-status.liquid` e atualização em tempo real.

4. **Priorização:** Focar em Quick Wins primeiro para maximizar impacto com mínimo esforço.

5. **Performance:** Migração de jQuery pode esperar até após lançamento - não é bloqueador.

---

**Desenvolvido com 💜 por Cleyton Mendes**
**Tema Elizabeth - Shopify Online Store 2.0**
