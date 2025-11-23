# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme built with TailwindCSS, based on Shopify's Online Store 2.0 architecture. The theme follows a modular section-based approach with custom JavaScript components using Web Components and custom elements.

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
- `carousel-style.css`: Custom carousel styling
- `owl.carousel.min.css` & `owl.theme.default.min.css`: Owl Carousel library styles

### JavaScript Architecture

**Component Pattern**: Modern Web Components (Custom Elements) for interactive functionality

Key components in `assets/`:
- **`variations-selector.js`**: `<variant-selects>` custom element handling product variant selection, availability updates, and URL management
- **`cart.js`**: `CartManager` class with pub/sub event system for cart operations (`cart-update`, `quantity-update`, `cart-error`)
- **`price-component.js`**: Price display updates based on variant changes
- **`quantity-selector.js`**: Quantity input controls
- **`search-component.js`**: Predictive search functionality
- **`carousel-manager.js`**: Owl Carousel initialization and configuration
- **`header.js`**: Header scroll behavior and sticky positioning
- **`theme.js`**: Global theme utilities

**Vendor Libraries** (loaded in `theme.liquid`):
- jQuery 3.x
- Owl Carousel 2.x for sliders/carousels
- jQuery Marquee for scrolling text

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
6. **Asset Loading**: All JS loaded with `defer` attribute in `theme.liquid` footer

## Design Standards

### Border Radius (Arredondamentos)

**Padrão definido:** `rounded-lg` (8px) ou sem arredondamento

**Regras:**
- ✅ Botões: `rounded-lg`
- ✅ Cards: `rounded-lg`
- ✅ Modais: `rounded-lg`
- ✅ Inputs: `rounded-lg`
- ✅ Imagens (quando aplicável): `rounded-lg`
- ✅ Exceções permitidas:
  - `rounded-full`: Avatares, botões circulares de ícone
  - `rounded-none`: Elementos que não devem ter arredondamento

**IMPORTANTE:** Todos os layouts devem seguir o mesmo nível de arredondamento padrão (`rounded-lg` ou nenhum). Não use `rounded`, `rounded-md`, `rounded-xl`, ou `rounded-2xl` sem justificativa.

**Roadmap:** Centralização futura via Tailwind config com classes `rounded-theme`, `rounded-theme-sm`, `rounded-theme-lg`.

### Color Scheme

**Status atual:** Cores hardcoded em alguns arquivos (a ser migrado)

**Roadmap:** Sistema de design tokens centralizado com CSS variables + Tailwind config. Todas as cores serão configuráveis globalmente via `assets/color-scheme.css` para facilitar mudanças de tema e suporte a dark mode.

**Prioridade:** Alta - próxima implementação

## Shopify CLI Integration

Theme uses standard Shopify CLI commands. Configuration stored in `.shopify/` directory (gitignored except metafields).

## ROADMAP Maintenance

**Location:** `docs/ROADMAP.md`

### Format Rules

1. **Keep it concise** - Maximum 150 lines total
2. **Priority ordering** - Most important tasks at the top
3. **One-line completions** - Completed items get ONE line in the "Concluído" section at the bottom
4. **10-line maximum** - Tools/features can have up to 10 lines of detail
5. **Always update** - When a feature is completed, move it to the bottom and update the top with next priorities

### Update Workflow

**When completing a task:**
1. Move completed item to `## ✅ CONCLUÍDO (Resumo)` section at bottom
2. Summarize in ONE line with date (e.g., "Sticky ATC melhorado (2025-01-22)")
3. Remove from top priority section
4. Update version number in header
5. Update "Atualizado" date

**When planning new features:**
1. Add to appropriate priority section (🔴 Alta, 🟡 Média)
2. Include: Status, Esforço (hours), Prioridade
3. Keep description under 10 lines
4. Order by importance (most important first)

### Example Format

```markdown
### 1. Feature Name
**Status:** Planejado | **Esforço:** 12-16h | **Prioridade:** 🔴 Alta

Brief description (1 line).
- Key point 1
- Key point 2
- Key point 3
```

**IMPORTANT:** The ROADMAP must always reflect the current state of the project. Never let it become outdated.

## Theme Context

This is a Portuguese-language (pt-BR) e-commerce theme for a women's fashion brand ("Elizabeth") specializing in elegant dresses and special occasion wear. Product categories include vestidos (dresses), blusas (blouses), calças (pants), etc.
