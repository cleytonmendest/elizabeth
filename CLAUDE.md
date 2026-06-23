# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme built with TailwindCSS, based on Shopify's Online Store 2.0 architecture. The theme follows a modular section-based approach with custom JavaScript components using Web Components and custom elements.

## 🚨 DEVELOPMENT PRIORITY RULES

1. **Prioridade:** requisitos da Shopify Theme Store vêm primeiro; features secundárias esperam os bloqueadores críticos. **As prioridades e seu status são fonte da verdade em `docs/ROADMAP.md`** — não duplicar aqui.
2. **Consulte o ROADMAP** antes de iniciar uma feature ou mudança que afete escopo/prioridades. Não é necessário para ajustes triviais (typo, tweak pontual, dúvida).
3. **Atualize o ROADMAP** ao concluir ou alterar uma feature (status, linha em `✅ CONCLUÍDO`, novas descobertas).

## Development Commands

### TailwindCSS Development
```bash
npm run tail
```
Watches `./src/tailwind.css` and compiles to `./assets/application.css`. Run this during development for live CSS updates.

### Shopify Theme Development
```bash
shopify theme dev
```
Start local development server with live reload for theme files.

```bash
shopify theme push
```
Deploy theme to Shopify store.

```bash
shopify theme pull
```
Pull latest theme files from Shopify store.

## Architecture Overview

### File Structure
- **`layout/theme.liquid`**: Main theme wrapper containing HTML structure, CSS/JS imports, and global settings
- **`sections/`**: Reusable sections that can be added to pages via the theme editor (e.g., `header.liquid`, `footer.liquid`, `main-product.liquid`)
- **`snippets/`**: Smaller reusable components rendered within sections (e.g., `cart-drawer.liquid`, `breadcrumb.liquid`)
- **`templates/`**: JSON-based page templates defining which sections appear on specific page types (Online Store 2.0)
- **`assets/`**: Static files including compiled CSS, JavaScript, and vendor libraries
- **`config/`**: Theme settings and configuration files
- **`src/`**: Source files for TailwindCSS compilation

### CSS Architecture

TailwindCSS is the primary styling framework:
- Source: `src/tailwind.css` with custom base layer styles
- Compiled output: `assets/application.css`
- Configuration: `tailwind.config.js` scans all `.liquid` files for utility classes
- Custom styles in `@layer base` include scrolling header behaviors and variant availability states

Additional stylesheets:
- `carousel-style.css`: Custom carousel styling (Swiper pagination + CSS announcement-bar marquee)
- `swiper-bundle.min.css`: Swiper library styles
- `color-scheme.css`: `.color-*` scheme classes consuming the CSS variables generated in `theme.liquid` (legacy, in transition to Tailwind tokens)
- **Per-component CSS** (co-located, rendered only where used): `cart.css`, `product-gallery.css`, `sticky-atc.css`, `newsletter-modal.css`, `testimonials.css`, `variant-selector.css`

### JavaScript Architecture

**Component Pattern**: Modern Web Components (Custom Elements) for interactive functionality

Key components in `assets/`:
- **`variations-selector.js`**: `<variant-selects>` custom element handling product variant selection, availability updates, and URL management
- **`cart.js`**: `CartManager` class with pub/sub event system for cart operations (`cart-update`, `quantity-update`, `cart-error`)
- **`price-component.js`**: Price display updates based on variant changes
- **`quantity-selector.js`**: Quantity input controls
- **`search-component.js`**: Predictive search functionality
- **`carousel-manager.js`**: `<my-slider>` custom element — Swiper initialization and configuration (vanilla, no jQuery). The announcement-bar marquee is now pure CSS (no JS).
- **`product-gallery.js`**: PDP gallery — thumbnail switching and lightbox (vanilla, no jQuery)
- **`sticky-atc.js`**: Sticky Add to Cart bar (IntersectionObserver, adaptive text)
- **`newsletter-modal.js`**: Newsletter modal triggers (exit-intent / scroll / delay)
- **`header.js`**: Header scroll behavior and sticky positioning
- **`theme.js`**: Global theme utilities

**Vendor Libraries**:
- Swiper 11.x for sliders/carousels (UMD bundle, no build step), loaded in `theme.liquid`

The theme is jQuery-free. Sliders use Swiper; the announcement bar uses a CSS keyframe marquee.

**Asset loading pattern** (two strategies):
- **Global/shared** — loaded in `theme.liquid` footer with `defer`: `swiper-bundle.min.js`, `carousel-manager.js`, `search-component.js`, `price-component.js`, `variations-selector.js`, `quantity-selector.js`, `theme.js`.
- **Co-located per-component** — each feature renders its own CSS + JS inside its section/snippet (so it only loads where used): `cart.js`/`cart.css` (cart-drawer), `product-gallery.js`/`.css` (PDP gallery), `sticky-atc.js`/`.css`, `newsletter-modal.js`/`.css`, `testimonials.css`, `variant-selector.css`. `header.js` is loaded with `async` inside `header.liquid`.

**Global Variables** (set in `theme.liquid`):
```javascript
window.shopUrl // Store origin URL
window.routes // Shopify API routes (cart_add_url, cart_change_url, etc.)
```

### Event System

Custom events are used for component communication:
- `variant:change`: Dispatched when product variant selection changes (includes variant data in `detail.variant`)
- `cart-update`: Published when cart state changes
- `quantity-update`: Published when cart item quantity changes
- `cart-error`: Published on cart operation errors

Components listen for these events rather than directly coupling to each other.

### Section Schema & Settings

Sections include JSON schemas defining customizable settings accessible in the theme editor:
- Section-level settings (colors, layout options, content)
- Block-based content (repeatable items within sections)
- Settings are accessed via Liquid: `section.settings.setting_name`

Template JSON files (e.g., `templates/index.json`) define which sections appear on pages and their configuration.

### Header Behavior

The header supports multiple layout modes configured via section settings:
- **Fixed vs. non-fixed**: Sticky positioning on scroll
- **Transparent mode**: Only on homepage (`template.name == 'index'`)
- **Layout types**: Centered logo with menu under, logo left with centered menu, etc.
- Header applies `is-scrolling` class on scroll for background transitions

### Styling Patterns

**Variant Availability**:
- Unavailable swatches: `.swatch-label.is-unavailable` gets dashed border and diagonal line
- Unavailable text options: `.not-swatch.is-unavailable` gets strikethrough

**Responsive Images**:
Sections like `slider-image` include separate images for desktop/tablet/mobile with defined dimensions for optimal loading.

## Important Conventions

1. **Liquid Variable Naming**: Use `snake_case` for Liquid variables and settings
2. **CSS Classes**: TailwindCSS utilities are preferred; custom classes only when necessary
3. **Custom Element Registration**: Always check if element is registered before defining: `if (!customElements.get('element-name'))`
4. **Currency Formatting**: Use `formatPrice()` helper in `cart.js` for consistent BRL formatting
5. **Shopify Routes**: Access cart/search URLs via `window.routes` object, never hardcode
6. **Asset Loading**: Shared/core JS lives in `theme.liquid` footer with `defer`; feature-specific CSS+JS is co-located in its own section/snippet (rendered only where used). See "Asset loading pattern" above before adding a new script.

## Design Standards

### Border Radius (Arredondamentos)

**Padrão definido:** `rounded-theme` (8px) ou sem arredondamento. Os tokens estão centralizados em `tailwind.config.js > borderRadius`:

| Classe | Valor | Uso |
|--------|-------|-----|
| `rounded-theme-sm` | 4px | inputs internos, checkboxes, detalhes |
| `rounded-theme` | 8px | **padrão** — botões, cards, modais, inputs, imagens |
| `rounded-theme-lg` | 12px | containers maiores quando justificado |

**Regras:**
- ✅ Use `rounded-theme` como padrão (botões, cards, modais, inputs, imagens). Mudar o arredondamento do tema inteiro = uma linha no config.
- ✅ Exceções permitidas:
  - `rounded-full`: Avatares, botões circulares de ícone
  - `rounded-none`: Elementos que não devem ter arredondamento

**IMPORTANTE:** Prefira os tokens `rounded-theme*`. Não use `rounded`, `rounded-md`, `rounded-xl`, ou `rounded-2xl` sem justificativa. Código legado ainda usa `rounded-lg` (equivalente a `rounded-theme`); ao tocar nesses pontos, migre para o token.

### Color Scheme

**Status:** Design tokens implementados. Cores mapeadas dos color schemes em `tailwind.config.js`.

**Como usar:** prefira os tokens Tailwind em vez de hex hardcoded — eles seguem o color scheme (e dark mode futuro) automaticamente:
- `bg-background`, `text-foreground`, `border-border`
- `bg-button` / `text-button-text`, `bg-badge` / `text-badge-text`
- `text-success` / `text-error` / `text-warning`, `text-link`, `shadow`
- Opacidade suportada: `text-foreground/70`, `bg-background/50` (vars em formato espaço habilitam `<alpha-value>`)

As CSS variables são geradas em `layout/theme.liquid` a partir das configs do admin e consumidas via `assets/color-scheme.css` (classes `.color-*`, legado em transição) + tokens Tailwind (preferencial).

**Mapeamento de migração (cinza/preto/branco → token):**
- `text-gray-700/600/500/400/300` → `text-foreground/70` `/60` `/50` `/40` `/30`
- `bg-gray-50/100` → `bg-foreground/5`; `bg-gray-200` → `bg-foreground/10`; `bg-gray-300` → `bg-foreground/20`
- `border-gray-*` → `border-border`; `ring-gray-*` → `ring-foreground/40`
- `text-black` → `text-foreground`; `bg-white` → `bg-background`; `border-black` → `border-foreground`
- Par `bg-black text-white` (botões/badges/tags) → `bg-foreground text-background`; hover `bg-gray-800` → `opacity-90`
- Badge de desconto/erro → `bg-badge text-badge-text`; botão primário → `color-button` ou `bg-button text-button-text`

**Hex/cores fixas legítimas (NÃO migrar):** cores de marca (ícones de pagamento, botões WhatsApp/Facebook), defaults de settings no schema, **scrims de imagem** (overlay escuro sobre foto + texto branco, ex: hero de coleção), **lightbox** (visualizador de imagem, sempre escuro), **indicadores semânticos** (azul de status "info" sem token equivalente, espectro de medidor de força de senha).

O `newsletter.liquid` (snippet) e o `newsletter-modal.liquid` (section) já são scheme-aware: usam classes `color-*` + tokens e o modal expõe seu próprio `color_scheme` no schema.

**Páginas de cliente:** controladas pelo setting global `settings.customer_color_scheme` (admin > Cores > Páginas de Cliente). Cada template (`templates/customers/*.liquid`) tem o wrapper `color-{{ settings.customer_color_scheme }} color-background color-text` na div raiz. Status de feedback usam tokens: success/warning/error (verde/amarelo/vermelho); "info" (azul) fica literal por não ter token.

### Tipografia

**Corpo padrão:** `14px` (`text-sm`). O `body` herda 14px em `layout/theme.liquid`. Não há setting de tamanho no editor (só família via `font_picker`).

**Escala** (fonte única da verdade em `tailwind.config.js > fontSize`):

| Classe | Tamanho | Uso |
|--------|---------|-----|
| `text-xs` | 12px | legendas, labels, legal |
| `text-sm` | 14px | **corpo (padrão)** |
| `text-base` | 16px | corpo destacado / títulos pequenos |
| `text-lg` | 18px | subtítulo / h6 |
| `text-xl` | 20px | h5 |
| `text-2xl` | 24px | h4 / título de seção |
| `text-3xl` | 30px | h3 |
| `text-4xl` | 36px | h2 |
| `text-5xl` | 48px | h1 / hero |

**Regra:** corpo de texto usa `text-sm`. Não usar tamanhos arbitrários (`text-[15px]`) sem justificativa — escolher o degrau mais próximo da escala.

## Shopify CLI Integration

Theme uses standard Shopify CLI commands. Configuration stored in `.shopify/` directory (gitignored except metafields).

## ROADMAP Maintenance

Sempre consulte e mantenha `docs/ROADMAP.md` atualizado e enxuto. As regras de formato/workflow ficam na seção **"Como manter"** no próprio ROADMAP.

## Theme Context

This is a Portuguese-language (pt-BR) e-commerce theme for a women's fashion brand ("Elizabeth") specializing in elegant dresses and special occasion wear. Product categories include vestidos (dresses), blusas (blouses), calças (pants), etc.
