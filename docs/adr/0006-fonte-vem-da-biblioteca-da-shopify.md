# 6. A tipografia vem da biblioteca da Shopify, e nenhum setting injeta markup

- **Status:** Aceito
- **Data:** 2026-09-01

## Contexto

Os quatro presets definiam a tipografia por dois settings do tipo `textarea`
(`custom_font_head`, `custom_font_body`) cujo valor default era uma tag
`<link>` para `fonts.googleapis.com`. O `layout/theme.liquid` imprimia esse
valor **cru** dentro do `<head>`:

```liquid
{%- if settings.custom_font_head != blank -%}
  {{ settings.custom_font_head }}
{% endif %}
```

Três fatos mediram a situação:

1. **A Theme Store reprova.** Fonte precisa vir da biblioteca da Shopify
   (`font_picker`); asset de domínio de terceiro é restrito. O tema baixava
   fonte do Google em toda página, nos quatro presets.

2. **O verificador existia e não via.** O Theme Check tem a regra
   `RemoteAsset`, feita exatamente para isso. Ela lê o markup, e a tag não
   estava no markup — estava num valor de setting, chegando em tempo de
   render. O tema passou em `Theme Check 0 offenses` o tempo inteiro.

3. **O `font_picker` já existia e nunca era usado.** `type_header_font` e
   `type_body_font` estavam declarados desde sempre, e os presets não os
   definiam: ficavam no default `assistant_n4` e eram sobrescritos pelo
   caminho custom. O mecanismo alternativo não precisava ser construído —
   precisava parar de ser contornado.

Havia ainda um defeito ativo nesse caminho: `layout/gift_card.liquid` emitia o
`<link>` do corpo e **nunca** o de título, mas mesmo assim sobrescrevia
`--font-heading-family` com `custom_font_head_name`. O nome da família era
aplicado sem o arquivo ter sido carregado, então o gift card renderizava o
título na fonte de fallback ([issue #40](https://github.com/cleytonmendest/elizabeth/issues/40)).

## Decisão

**Fazemos a tipografia vir só do `font_picker`, e removemos os quatro settings
de fonte customizada.** Os presets passam a declarar as duas famílias por
handle da biblioteca:

| Preset | Título | Corpo |
| --- | --- | --- |
| Elizabeth | `work_sans_n4` | `work_sans_n4` |
| Rosé | `cormorant_garamond_n4` | `work_sans_n4` |
| Noir | `playfair_display_n4` | `work_sans_n4` |
| Botânico | `fraunces_n4` | `work_sans_n4` |

As duas ramificações de `--font-body-family` / `--font-heading-family` somem
dos dois layouts: sobra a atribuição direta a partir do `font_picker`, que é o
que o `{% style %}` logo acima já vinha carregando com `font_face`.

A alternativa considerada era **manter o setting trocando `textarea` por um
campo só com o nome da família**, montando o `<link>` no Liquid. Ela fecha a
injeção de HTML e não resolve o domínio externo — que é o bloqueador. Foi
descartada por resolver a metade menor do problema.

**E fazemos a regressão ser verificada por código.** Nasce a regra de lint
`remotes`, que olha os dois lados do defeito, porque ele precisa dos dois para
existir: nenhum valor em `config/*.json` guarda tag de subrecurso (`<link>`,
`<script>`, `<iframe>`…), e nenhum setting global de texto livre (`textarea`,
`html`, `liquid`) é impresso sem filtro que o neutralize. Um verificador que
lesse só o markup erraria de novo pelo mesmo motivo.

## Consequências

**Ganhamos** — o `<head>` deixa de receber markup digitado no admin, some o
bloqueador de asset externo, a fonte passa a ser servida pelo CDN da própria
loja (uma conexão a menos, sem `fonts.gstatic.com`), o gift card volta a
carregar a fonte de título ([#40](https://github.com/cleytonmendest/elizabeth/issues/40)),
e a porta fica fechada por regra em vez de por lembrança.

**Pagamos** — três coisas, e a última é a que dói:

- **O lojista perde a saída de emergência.** Fonte fora da biblioteca da
  Shopify não tem mais como entrar sem editar código. É exatamente o que a
  Theme Store exige, mas é menos poder do que ele tinha ontem.
- **Os pesos disponíveis passam a ser os da biblioteca.** O `font_modify` do
  layout pede `bold` e `italic`; família que não os tenha cai no sintético do
  navegador.
- **A regra `remotes` acendeu uma dívida que já existia.** `logo_svg` é um
  `textarea` cujo conteúdo sai cru em `templates/gift_card.liquid` — mesma
  classe de superfície, feature legítima, fora do escopo desta decisão. Entrou
  no baseline como dívida registrada em vez de ser silenciada. O total caiu de
  341 para 334.

## Referências

- [issue #35](https://github.com/cleytonmendest/elizabeth/issues/35) — o bloqueador
- [issue #40](https://github.com/cleytonmendest/elizabeth/issues/40) — o gift card, resolvido de carona
- `scripts/lint/rules/remotes.mjs`, `tests/remotes.test.mjs`
- [ADR 0003](0003-tres-niveis-de-customizacao.md) — onde cada setting pode viver
