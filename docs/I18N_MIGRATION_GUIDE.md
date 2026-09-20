# Guia de Migração i18n (Internacionalização)

Referência de **como** migrar textos para locales. O progresso é medido, não escrito: `npm run lint -- --rules=i18n` diz o que falta, e a dívida registrada está em `scripts/lint/config/baseline.json` — não duplicar status aqui. Ver [ADR 0001](adr/0001-guard-rails-executaveis-no-lugar-do-roadmap.md).

## Os dois sistemas de tradução do Shopify

Ambos são obrigatórios para a Theme Store:

1. **Storefront** (`locales/pt-BR.json`, `locales/en.default.json`) — textos visíveis na loja, usados via `{{ 'key' | t }}` nos `.liquid`.
2. **Schema** (`locales/pt-BR.schema.json`, `locales/en.default.schema.json`) — textos do Theme Editor (section names, labels, info, placeholders, options).

### Categorias do storefront

```
general/  header/  footer/  cart/  product/  collection/  blog/
customer/  contact/  gift_card/  newsletter/  testimonials/
announcement_bar/  trust_badges/  sections/
```

## Como migrar um arquivo (storefront)

1. Identifique o texto hardcoded no `.liquid` (títulos, botões, labels, placeholders, mensagens, `aria-label`/`alt`, e data attributes lidos por JS).
2. Localize/crie a chave em `locales/pt-BR.json` **e** `en.default.json`.
3. Substitua por `{{ 'categoria.subcategoria.chave' | t }}` (aspas simples obrigatórias).

```liquid
<!-- antes -->        <h3>Carrinho Vazio</h3>
<!-- depois -->       <h3>{{ 'cart.general.empty' | t }}</h3>
```

Inclui data attributes lidos por JS:

```liquid
<button data-text-desktop="{{ 'product.general.add_to_cart' | t }}">
  {{ 'product.general.add_to_cart' | t }}
</button>
```

## Como migrar um schema (Theme Editor)

**Não remova** os textos do `{% schema %}` — apenas adicione as traduções aos `.schema.json`. Use IDs `snake_case`.

```json
{
  "sections": {
    "section_name": {
      "name": "Section Display Name",
      "settings": { "setting_id": { "label": "...", "info": "...", "placeholder": "..." } },
      "blocks":   { "block_type": { "name": "...", "settings": { "block_setting_id": { "label": "..." } } } }
    }
  }
}
```

## Critério de conclusão (por section)

Uma section está 100% pronta quando:
- Sem textos/`aria-label`/placeholders/data-attrs hardcoded no `.liquid`
- Schema traduzido em PT + EN (`.schema.json`)
- Usa `color-{{ section.settings.color_scheme }}` + `color-background color-text`, sem cores inline
- Testada em PT e EN com diferentes color schemes

## Armadilhas comuns

- Esquecer as aspas simples: `{{ 'cart.general.title' | t }}`, não `{{ cart.general.title | t }}`
- Usar chave inexistente (ex: `cart.title` em vez de `cart.general.title`)
- Esquecer de traduzir `aria-label`/`alt`

## Testar

- PT (padrão): `shopify theme push` e conferir a loja.
- EN: Admin > Settings > Languages > adicionar English; acessar `/en` no storefront.
- Caçar resíduos hardcoded: `grep -rE "Carrinho|Adicionar|Comprar|Em estoque" sections/ snippets/`

## Recursos

- [Storefront locale files](https://shopify.dev/docs/themes/architecture/locales/storefront-locale-files)
- [Translation filter](https://shopify.dev/docs/api/liquid/filters/translate)
- [Theme Store — Localization](https://shopify.dev/docs/themes/store/requirements#localization)
