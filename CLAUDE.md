# CLAUDE.md

Tema Shopify Online Store 2.0 (Liquid + TailwindCSS + Web Components, sem
jQuery) para moda feminina em pt-BR. Alvo: aprovação na Shopify Theme Store.

## A regra deste repositório

> **O que precisa ser verdade é verificado por código. O que precisa ser
> lembrado é gerado. Só decisão vira prosa.**

Este arquivo é curto de propósito. Ele contém apenas o que **não** dá para
automatizar — tudo o mais foi movido para onde não apodrece:

| Você quer saber | Onde está | Comando |
| --- | --- | --- |
| Estado atual do tema | medido, não escrito | `npm run status` |
| As regras do tema | `scripts/lint/rules/` | `npm run lint` |
| O que os componentes fazem | `tests/` | `npm test` |
| O que fazer a seguir | GitHub Issues | — |
| Por que algo é assim | `docs/adr/` | — |
| Dívida técnica conhecida | `scripts/lint/config/baseline.json` | `npm run status` |

O antigo `docs/ROADMAP.md` foi removido: ele afirmava um estado que dependia de
alguém lembrar de atualizar, e divergiu do código. Ver
[ADR 0001](docs/adr/0001-guard-rails-executaveis-no-lugar-do-roadmap.md).

**Não recrie um documento de estado.** Se você sentir vontade de escrever "o
que já está pronto" num arquivo, isso é sinal de que falta um linter.

## O gate

Três camadas, autoridade crescente. Nenhuma delas depende de você lembrar:

1. **A cada edição** — hook `PostToolUse` roda `scripts/lint/hook.mjs` no
   arquivo tocado e devolve o erro na hora.
2. **`pre-commit`** — `.githooks/pre-commit`, conjunto rápido. Pulável com
   `--no-verify`.
3. **GitHub Actions** — `.github/workflows/ci.yml`. Não pulável.

```bash
npm run gate      # build + linters + testes (rode antes de abrir PR)
npm run status    # painel de conformidade
npm run lint -- --rules=tokens        # uma regra só
npm run lint -- --files=sections/x.liquid   # um arquivo só
npm run lint:baseline                 # regrava a dívida (só depois de reduzi-la)
npm test          # Vitest nos Web Components
npm run test:mutants                  # os testes conseguem falhar?
```

**A catraca:** violação já existente é aviso; violação **nova** é erro. O total
do baseline só pode cair — o CI reprova se crescer. Ao corrigir dívida, rode
`npm run lint:baseline` e mencione o número antes → depois no PR.

A única exceção: **melhorar a cobertura de um linter** encontra violações que
sempre existiram e não eram vistas. Isso é dívida escondida virando visível,
não dívida nova. O CI libera o crescimento quando o diff toca
`scripts/lint/rules/` — e só nesse caso.

Violação legítima (cor de marca de terceiro, scrim de imagem, lightbox) vai
para `scripts/lint/config/design-exceptions.json` **com justificativa escrita**
— o linter falha se o campo `reason` faltar.

## Os testes

Os linters verificam ESTRUTURA — que o token existe, que a chave de tradução
existe, que o asset referenciado existe. Nada disso olha o que o componente
faz quando a cliente clica. É o que `tests/` cobre, em jsdom.

Os alvos são scripts clássicos: o Liquid os injeta com `<script src defer>`,
eles não exportam nada, e `price-component.js` depende de `formatPrice` ser
global — criada por `cart.js`. `tests/helpers/load-asset.mjs` reproduz essa
semântica em vez de convertê-los em módulos ES: transformar o código de
produção para agradar o teste faria o teste medir outro programa.

**`npm run test:mutants` é a parte que não se pula.** Ele quebra o tema de
propósito, uma quebra por vez, e exige que a suíte fique vermelha. Uma suíte
verde diz que os testes passaram — não que eles verificam alguma coisa. Um
teste que perdeu o alvo (o seletor mudou, o evento trocou de nome) fica verde
exibindo o mesmo silêncio de um teste que funciona. Ao mexer num componente, se
o script reclamar que não achou o trecho a mutar, atualize a lista em
`scripts/test-mutants.mjs` — ela é curta e escolhida a dedo, não uma varredura
automática.

Falta a metade de navegador da [issue #31](https://github.com/cleytonmendest/elizabeth/issues/31):
Playwright + axe contra `shopify theme dev`, que precisa da credencial da loja
como secret do CI.

## Os dois princípios que os linters codificam

**1. Tudo que aparece, o lojista edita.** Nenhum texto, cor, imagem ou link
fica preso no markup. Cor vem sempre do color scheme da Shopify, nunca de hex:

```
config/settings_schema.json   (lojista edita no admin)
      ↓ layout/theme.liquid gera
CSS custom properties (--color-*, --radius-*, --font-scale, --page-width)
      ↓ tailwind.config.js consome
tokens semânticos (bg-background, rounded-theme, text-sm…)
      ↓
.liquid usa SÓ token — e nunca sabe qual é o valor
```

O lojista controla o **valor**; você controla **onde ele se aplica**. É o que
deixa o tema customizável sem virar colagem. Um eixo tem UM controle e a escala
deriva por `calc()` — ver [ADR 0003](docs/adr/0003-tres-niveis-de-customizacao.md),
que também define onde cada setting pode viver.

A classe `.color-scheme-N` **só define as variáveis** — ela não pinta nada
sozinha. Toda section precisa aplicar fundo **e** cor de texto
(`color-background color-text`, ou `bg-background text-foreground`). Pintar só
o fundo é pior que não pintar.

**2. Nada de string nova hardcoded.** Storefront usa `{{ '...' | t }}`; schema
usa `t:sections.<nome>.…`. Toda chave existe em pt-BR **e** en.default. Nunca
`| t: default: '...'` — crie a chave de verdade. *(Defaults de setting e blocos
`presets` são conteúdo do lojista: texto literal ali é o correto.)*

## Comandos

```bash
npm run tail          # Tailwind em watch
npm run build         # compila assets/application.css (precisa ir no commit)
shopify theme dev     # servidor local
shopify theme push    # deploy
```

## Arquitetura

- `layout/theme.liquid` — wrapper, gera as CSS variables dos color schemes,
  carrega os assets globais
- `sections/` — seções do editor · `snippets/` — componentes menores
- `templates/` — templates JSON (OS 2.0) + `customers/*.liquid` (legado)
- `assets/` — CSS compilado, Web Components, Swiper
- `src/tailwind.css` → `assets/application.css` (gerado; nunca editar à mão)

**Carregamento de assets — duas estratégias, e a escolha importa:**
- **Global** (`theme.liquid`, `defer`): só o que roda em toda página.
- **Co-locado** (renderizado dentro da section/snippet que usa): o padrão
  preferido — o asset só pesa onde é necessário.

`npm run lint -- --rules=budget` reprova se o peso global passar do teto em
`scripts/lint/config/perf-budget.json`. Ao adicionar script novo, co-locar é a
opção padrão; global exige justificativa.

**Componentes:** Web Components (`<variant-selects>`, `<my-slider>`,
`<countdown-timer>`…). Sempre `if (!customElements.get('nome'))` antes de
definir. Comunicação por evento (`variant:change`, `cart-update`,
`quantity-update`, `cart-error`), nunca acoplamento direto.

**Globais** (`theme.liquid`): `window.shopUrl`, `window.routes`. Nunca
hardcode URL de carrinho ou busca.

## Convenções

- Liquid em `snake_case`; classes Tailwind preferidas a CSS custom
- Raio: `rounded-theme` é o padrão; `-sm` e `-lg` derivam dele. **O valor é do
  lojista** (`settings.radius_style`), então nunca assuma "8px" — use o token.
  `rounded-full` e `rounded-none` para casos específicos. **Nada de
  `rounded-lg` / `-md` / `-xl`** — o linter reprova.
- Corpo de texto: `text-sm`. A escala inteira é multiplicada por
  `settings.font_scale`, também do lojista. Degraus em `tailwind.config.js`.
- Valor arbitrário (`text-[15px]`, `tracking-[0.18em]`) é violação: promova a
  token no config e use o token.

## Trabalhando aqui

- **Feature ou bug** → abra uma issue com o template. O critério de aceite tem
  que ser verificável por comando; se não é testável, não é critério.
- **Decisão estrutural** → ADR em `docs/adr/` (append-only, nunca se edita).
- **Dívida** → agente `debt-cleaner`, ou issue com label `debt`.
- **Revisão de julgamento** (legibilidade, acoplamento, sem-JS) → agente
  `theme-reviewer`, depois que o lint estiver verde.
