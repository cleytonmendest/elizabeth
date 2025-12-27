# Guia de Migração i18n (Internacionalização)

## 📊 STATUS ATUAL

### ✅ CONCLUÍDO

**Storefront i18n:**
- `locales/pt-BR.json` criado com estrutura completa (~225 strings)
- `locales/en.default.json` criado com traduções (~225 strings)
- **9 arquivos migrados (9% storefront):**
  1. `snippets/cart-drawer.liquid` ✅
  2. `snippets/add-to-cart.liquid` ✅
  3. `snippets/inventory-status.liquid` ✅ (incluindo JavaScript)
  4. `snippets/newsletter.liquid` ✅
  5. `snippets/breadcrumb.liquid` ✅
  6. `snippets/search-component.liquid` ✅
  7. `snippets/price-v2.liquid` ✅
  8. `snippets/quantity-selector.liquid` ✅
  9. `sections/testimonials.liquid` ✅

**Schema i18n:**
- `locales/pt-BR.schema.json` e `en.default.schema.json` criados
- **5 sections schemas completas (~28%):**
  1. `sections/header.liquid` ✅
  2. `sections/footer.liquid` ✅
  3. `sections/announcement-bar.liquid` ✅
  4. `sections/testimonials.liquid` ✅
  5. `sections/trust-badges.liquid` ✅

### ⏳ EM PROGRESSO
- Migração de snippets e sections restantes (~93 arquivos)

---

## 📁 ESTRUTURA DE LOCALES

### Dois Tipos de Arquivos i18n

**⚠️ IMPORTANTE:** O Shopify usa dois sistemas de tradução separados:

1. **Storefront i18n** (front-end da loja)
   - `pt-BR.json` e `en.default.json`
   - Usado com `{{ 'key' | t }}` nos arquivos `.liquid`
   - Traduz textos visíveis na loja

2. **Schema i18n** (Theme Editor/Customizer)
   - `pt-BR.schema.json` e `en.default.schema.json`
   - Traduz o painel administrativo do Theme Customizer
   - Traduz: section names, labels, info, placeholders, options

**Ambos são obrigatórios para Theme Store!**

### Categorias Organizadas (Storefront):
```
general/          → Textos gerais (404, acessibilidade, busca, paginação)
header/           → Cabeçalho (menu, carrinho, conta, busca)
footer/           → Rodapé (newsletter, redes sociais, pagamento, copyright)
cart/             → Carrinho (título, vazio, subtotal, total, descontos, botões)
product/          → Produto (ATC, sold out, variantes, estoque, parcelamento)
collection/       → Coleção (ordenação, filtros)
blog/             → Blog (artigos, comentários)
customer/         → Conta do cliente (login, registro, endereços, pedidos)
contact/          → Formulário de contato
gift_card/        → Vale-presente
newsletter/       → Newsletter e modal
testimonials/     → Depoimentos
announcement_bar/ → Barra de anúncios
trust_badges/     → Selos de confiança
sections/         → Seções (sliders, etc.)
```

---

## 🔧 COMO MIGRAR UM ARQUIVO

### PASSO 1: Identificar textos hardcoded

```liquid
<!-- ❌ ANTES (hardcoded) -->
<h3>Carrinho Vazio</h3>
<button>FINALIZAR PEDIDO</button>
<p>Autor</p>
```

### PASSO 2: Localizar a chave correta em locales

```json
// locales/pt-BR.json
{
  "cart": {
    "general": {
      "empty": "Carrinho Vazio",
      "checkout": "FINALIZAR PEDIDO"
    }
  },
  "blog": {
    "general": {
      "author": "Autor"
    }
  }
}
```

### PASSO 3: Substituir por {{ 'chave' | t }}

```liquid
<!-- ✅ DEPOIS (i18n) -->
<h3>{{ 'cart.general.empty' | t }}</h3>
<button>{{ 'cart.general.checkout' | t }}</button>
<p>{{ 'blog.general.author' | t }}</p>
```

---

## 📝 EXEMPLO COMPLETO: add-to-cart.liquid

### ANTES:
```liquid
<button
  data-text-desktop="ADICIONAR AO CARRINHO"
  data-text-mobile="Adicionar"
>
  ADICIONAR AO CARRINHO
</button>
```

### DEPOIS:
```liquid
<button
  data-text-desktop="{{ 'product.general.add_to_cart' | t }}"
  data-text-mobile="{{ 'product.general.add_to_cart' | t }}"
>
  {{ 'product.general.add_to_cart' | t }}
</button>
```

---

## 🎯 PRIORIDADE DE MIGRAÇÃO

### ALTA PRIORIDADE (Muito visíveis):
1. ✅ `snippets/cart-drawer.liquid` - CONCLUÍDO
2. ✅ `snippets/add-to-cart.liquid` - CONCLUÍDO
3. ✅ `snippets/inventory-status.liquid` - CONCLUÍDO (incluindo JavaScript)
4. ✅ `snippets/newsletter.liquid` - CONCLUÍDO
5. ✅ `snippets/breadcrumb.liquid` - CONCLUÍDO
6. ✅ `snippets/search-component.liquid` - CONCLUÍDO
7. ✅ `snippets/price-v2.liquid` - CONCLUÍDO
8. ✅ `snippets/quantity-selector.liquid` - CONCLUÍDO
9. ✅ `sections/testimonials.liquid` - CONCLUÍDO (storefront + schema + dual color schemes)
10. ⏳ `sections/header.liquid` - OK (sem textos hardcoded)
11. ⏳ `sections/footer.liquid` - OK (sem textos hardcoded)
12. ⏳ `sections/main-product.liquid` - Página de produto
13. ⏳ `sections/main-collection.liquid` - Página de coleção

### MÉDIA PRIORIDADE:
11. `sections/newsletter-modal.liquid`
12. `sections/main-article.liquid`
13. `sections/main-blog.liquid`
14. `templates/cart.liquid`
15. `templates/404.liquid`

### BAIXA PRIORIDADE:
16. Customer account templates (login, register, etc.)
17. Gift card template
18. Contact page
19. Other sections

---

## 🔍 CHECKLIST POR ARQUIVO

Ao migrar cada arquivo, verifique:

- [ ] Títulos e headings
- [ ] Textos de botões
- [ ] Labels de formulários
- [ ] Placeholders de inputs
- [ ] Mensagens de erro/sucesso
- [ ] Textos de acessibilidade (aria-label, alt)
- [ ] Tooltips e títulos hover
- [ ] Textos em JavaScript (data attributes)

---

## 📚 CHAVES MAIS COMUNS

### Geral:
```liquid
{{ 'general.accessibility.close' | t }}
{{ 'general.accessibility.loading' | t }}
{{ 'general.breadcrumbs.home' | t }}
{{ 'general.search.placeholder' | t }}
{{ 'general.pagination.previous' | t }}
{{ 'general.pagination.next' | t }}
```

### Carrinho:
```liquid
{{ 'cart.general.title' | t }}
{{ 'cart.general.empty' | t }}
{{ 'cart.general.subtotal' | t }}
{{ 'cart.general.total' | t }}
{{ 'cart.general.checkout' | t }}
{{ 'cart.general.continue_shopping' | t }}
```

### Produto:
```liquid
{{ 'product.general.add_to_cart' | t }}
{{ 'product.general.sold_out' | t }}
{{ 'product.general.quantity' | t }}
{{ 'product.inventory.in_stock' | t }}
{{ 'product.inventory.out_of_stock' | t }}
{{ 'product.inventory.low_stock' | t }}
```

### Blog:
```liquid
{{ 'blog.general.author' | t }}
{{ 'blog.general.read_more' | t }}
{{ 'blog.general.reading_time' | t }}
{{ 'blog.article.back_to_blog' | t }}
```

### Newsletter:
```liquid
{{ 'newsletter.title' | t }}
{{ 'newsletter.placeholder' | t }}
{{ 'newsletter.button' | t }}
{{ 'newsletter.success' | t }}
{{ 'newsletter.error' | t }}
```

---

## 🚨 ARMADILHAS COMUNS

### ❌ ERRO: Esquecer aspas simples
```liquid
<!-- ERRADO -->
{{ cart.general.title | t }}

<!-- CORRETO -->
{{ 'cart.general.title' | t }}
```

### ❌ ERRO: Usar chave errada
```liquid
<!-- ERRADO (chave não existe) -->
{{ 'cart.title' | t }}

<!-- CORRETO -->
{{ 'cart.general.title' | t }}
```

### ❌ ERRO: Esquecer de traduzir aria-labels
```liquid
<!-- ERRADO -->
<button aria-label="Fechar">X</button>

<!-- CORRETO -->
<button aria-label="{{ 'general.accessibility.close' | t }}">X</button>
```

---

## 🧪 COMO TESTAR

### Teste em Português (padrão):
1. Deploy: `shopify theme push`
2. Abrir a loja
3. Verificar se todos os textos aparecem corretamente

### Teste em Inglês:
1. No Shopify Admin: Settings > Languages
2. Adicionar idioma "English"
3. Publicar
4. Mudar idioma no storefront (se tiver language picker)
5. OU acessar `/en` na URL

### Validação:
```bash
# Verificar se há textos hardcoded restantes (buscar textos comuns)
grep -r "Carrinho" sections/ snippets/
grep -r "Adicionar" sections/ snippets/
grep -r "Comprar" sections/ snippets/
grep -r "Em estoque" sections/ snippets/
```

---

## 📊 PROGRESSO

### Arquivos Migrados: 11/101 (11%)

| Arquivo | Status | Strings Migradas |
|---------|--------|------------------|
| snippets/cart-drawer.liquid | ✅ | 9/9 |
| snippets/add-to-cart.liquid | ✅ | 3/3 |
| snippets/inventory-status.liquid | ✅ | 14/14 (incluindo JS) |
| snippets/newsletter.liquid | ✅ | 3/3 |
| snippets/breadcrumb.liquid | ✅ | 4/4 |
| snippets/search-component.liquid | ✅ | 4/4 |
| snippets/price-v2.liquid | ✅ | 2/2 |
| snippets/quantity-selector.liquid | ✅ | 3/3 |
| sections/testimonials.liquid | ✅ | 3/3 + schema completo + dual color schemes |
| sections/announcement-bar.liquid | ✅ | schema completo + color schemes |
| sections/trust-badges.liquid | ✅ | schema completo + refatoração color schemes |
| ... | ⏳ | ... |

**Total migrado**: ~48 strings storefront + 5 schemas completos | **Total estimado**: ~400-500 strings

---

## 💡 DICAS DE PRODUTIVIDADE

### 1. Migre por categoria
- Faça todos os snippets de carrinho
- Depois todos de produto
- Depois todos de blog
- Etc.

### 2. Use Find & Replace
No VS Code:
- Buscar: `"Carrinho Vazio"`
- Substituir: `{{ 'cart.general.empty' | t }}`

### 3. Teste incrementalmente
Não migre 50 arquivos de uma vez. Faça 5-10, teste, depois continue.

### 4. Documente novos textos
Se encontrar um texto que NÃO está nos locales:
1. Adicione em `locales/pt-BR.json`
2. Adicione tradução em `locales/en.default.json`
3. Use no arquivo

---

## 📋 TEMPLATE PARA NOVOS TEXTOS

Se você encontrar um texto que falta:

```json
// locales/pt-BR.json
{
  "categoria": {
    "subcategoria": {
      "novo_texto": "Texto em português"
    }
  }
}

// locales/en.default.json
{
  "category": {
    "subcategory": {
      "new_text": "Text in English"
    }
  }
}
```

Depois use:
```liquid
{{ 'categoria.subcategoria.novo_texto' | t }}
```

---

## 📝 SCHEMA i18n (Theme Editor)

### Estrutura de arquivo `.schema.json`

```json
{
  "sections": {
    "section_name": {
      "name": "Section Display Name",
      "settings": {
        "setting_id": {
          "label": "Setting Label",
          "info": "Helper text",
          "placeholder": "Placeholder text"
        }
      },
      "blocks": {
        "block_type": {
          "name": "Block Name",
          "settings": {
            "block_setting_id": {
              "label": "Block Setting Label"
            }
          }
        }
      }
    }
  }
}
```

### Como migrar schemas

**IMPORTANTE:** NÃO remova textos hardcoded dos schemas! Apenas adicione as traduções aos arquivos `.schema.json`.

1. Identifique a section (ex: `header.liquid`)
2. Extraia todos os textos do `{% schema %}`
3. Adicione em `locales/pt-BR.schema.json` e `locales/en.default.schema.json`
4. Use IDs snake_case (ex: `menu_type` ao invés de `menu-type`)

**Status:** Header e Footer schemas criados ✅ | Restante pendente ⏳

---

## ✅ CRITÉRIO DE CONCLUSÃO

**⚠️ NOVA ABORDAGEM:** Section por section, 100% completa antes de prosseguir.

Uma **section** está 100% completa quando:

1. ✅ **i18n Storefront:** Não há textos visíveis hardcoded no `.liquid`
2. ✅ **i18n Storefront:** Todos aria-labels usam locales
3. ✅ **i18n Storefront:** Placeholders usam locales
4. ✅ **i18n Storefront:** Data attributes de JavaScript usam locales
5. ✅ **i18n Schema:** Schema traduzido em `.schema.json` (PT + EN)
6. ✅ **Color Schemes:** Section usa `color-{{ section.settings.color_scheme }}` + classes `color-background color-text`
7. ✅ **Color Schemes:** Sem cores hardcoded (inline styles removidos)
8. ✅ **Testado:** Funciona em PT e EN, com diferentes color schemes

**Objetivo:** Todas sections 100% completas → depois migrar snippets.

---

## 🎯 OBJETIVO FINAL

**Para Theme Store Shopify:**
- ✅ 100% dos textos storefront em locales (`.json`)
- ✅ 100% dos schemas em locales (`.schema.json`)
- ✅ Tema funciona perfeitamente em inglês
- ✅ Tema funciona perfeitamente em português
- ✅ Theme Editor completamente traduzido
- ✅ Fácil adicionar novos idiomas

**Estimativa**:
- Storefront i18n: 20-30h
- Schema i18n: 8-12h
- **Total: 28-42h**

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

1. Migrar `add-to-cart.liquid` (5 min)
2. Migrar `inventory-status.liquid` (10 min)
3. Migrar `newsletter.liquid` (5 min)
4. Migrar `breadcrumb.liquid` (3 min)
5. Migrar `header.liquid` (15 min)
6. Migrar `footer.liquid` (10 min)
7. Continuar com sections e snippets restantes

**Total tempo estimado para os 6 primeiros**: ~48 min

---

## 📞 RECURSOS

- [Shopify Liquid i18n](https://shopify.dev/docs/themes/architecture/locales/storefront-locale-files)
- [Translation filter](https://shopify.dev/docs/api/liquid/filters/translate)
- [Theme Store requirements - Localization](https://shopify.dev/docs/themes/store/requirements#localization)

---

Boa sorte com a migração! 🚀
