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
npm test          # Vitest nos Web Components (jsdom)
npm run test:mutants                  # os testes conseguem falhar?
npm run test:e2e                      # Playwright: axe + fluxos
npm run test:e2e:gate                 # só o gate de a11y (não precisa de loja)
npm run test:e2e:baseline             # regrava a dívida de a11y (depois de reduzi-la)
```

**A catraca:** violação já existente é aviso; violação **nova** é erro. E o
baseline precisa descrever o que as regras realmente produzem: entrada
registrada que ninguém mais viola **reprova** o `npm run lint` até ser
regravada — seja porque a dívida foi paga (ótimo, trave o progresso), seja
porque a linha foi escrita à mão para silenciar algo. Ao corrigir dívida, rode
`npm run lint:baseline` e mencione o número antes → depois no PR.

O total só pode cair, e quem verifica isso é `scripts/catraca.mjs` — um script
com teste e com mutante, não um bloco de shell dentro do YAML. Ele trava os
**dois** baselines, o do lint e o de a11y, e conta os itens em vez de acreditar
no campo `total` que cada arquivo carrega.

A única exceção: **melhorar a cobertura de um verificador** encontra violações
que sempre existiram e não eram vistas. Isso é dívida escondida virando
visível, não dívida nova. O CI libera o crescimento quando o diff toca
`scripts/lint/rules/` (lint) ou `e2e/helpers/axe.mjs` / `e2e/a11y.spec.mjs`
(a11y) — e só aí. A lista que vale é a de `CATRACAS`, em `scripts/catraca.mjs`;
esta linha é cópia dela.

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

## O navegador

O jsdom não é navegador: ele não calcula layout, não resolve contraste, não
move foco. Acessibilidade e regressão visual só existem em `e2e/`, com
Playwright.

Essa suíte tem duas metades, e a divisão é o ponto:

- **`e2e/gate.spec.mjs` não precisa de loja.** Ele não testa o tema — testa o
  VERIFICADOR: planta um defeito conhecido (imagem sem alt, contraste baixo,
  botão sem nome) e exige que o axe o encontre, e planta uma página correta e
  exige que ele fique quieto. Sem isso, um critério configurado errado faria
  toda página passar com a mesma cara de quando está tudo certo. Roda sempre.
- **O resto aponta para `THEME_URL`**, a loja de verdade com um tema
  **EMPURRADO** (`shopify theme push --development`). Sem a variável, esses
  testes se declaram PULADOS com o motivo escrito, e `scripts/e2e.mjs` avisa no
  resumo do CI que nenhuma página foi medida.

**A suíte mediu um `shopify theme dev` até a #64, e três grupos de teste
ficaram no `fixme` por causa disso.** O proxy dele serve os arquivos locais e
faz proxy do resto, e a suspeita era que nenhum caminho dependente de SESSÃO
atravessava: a busca preditiva
([#51](https://github.com/cleytonmendest/elizabeth/issues/51)), o login de
cliente ([#64](https://github.com/cleytonmendest/elizabeth/issues/64)) e o
estado sem sessão da página de senha
([#71](https://github.com/cleytonmendest/elizabeth/issues/71)).

**Medir provou que a suspeita valia para dois dos três.** Sem o proxy, a #51
passou na primeira execução. O login continua devolvendo a página limpa, sem
erro e sem sessão — o `theme dev` nunca esteve no caminho dele. Uma hipótese
que explica três sintomas é atraente até você medir; e é por isso que se mede.

Pior que o teste vermelho: o verificador passou a mentir sobre o que media. O
teste de a11y da página de senha media OUTRA página, com header e breadcrumb, e
teria continuado medindo se ninguém abrisse o screenshot do artefato.

Hoje a suíte mede um tema empurrado — ver
[ADR 0007](docs/adr/0007-suite-de-navegador-contra-tema-empurrado.md). O ponto
delicado passou a ser outro, e ele está em `e2e/global-setup.mjs`: a Shopify
fixa o tema por SESSÃO, não por URL. Se a fixação não pegar, cada `page.goto`
mede o tema **publicado** e a suíte fica verde sobre a loja de produção. Por
isso o setup exige `window.Shopify.theme.id` igual ao tema que empurramos, e
não começa sem essa prova.

`fixme` e não `skip` continua valendo para o que sobrou — #64 (os cinco testes
de endereço), #68 e #71: fixme aparece no relatório, e afrouxar a asserção até
passar transformaria defeito real em verde. `skip` silencioso faria o teste
desaparecer sem ninguém notar. A lista que vale é a do código:

```bash
grep -rn "test.fixme" e2e/
```

**A catraca vale aqui também.** A primeira execução contra a loja encontrou
`color-contrast` em sete páginas, quase toda causada pelo mesmo breadcrumb
(`text-foreground/50` dá 3,54:1 no esquema claro, contra os 4,5:1 do WCAG AA).
Um gate de tolerância zero nunca ficaria verde, e gate que nunca fica verde é
desligado. Então: violação registrada em `e2e/a11y-baseline.json` é aviso,
violação **nova** é erro, e o total só pode cair — mesma regra do lint.

"Mesma regra" era meia verdade até `scripts/catraca.mjs` existir. A regra tem
dois lados — violação nova reprova, **e** o baseline não pode crescer — e a
a11y só tinha o primeiro: `npm run test:e2e:baseline` está documentado logo
acima, e quem regravasse para cima passava verde, porque nenhum passo do CI
lia esse arquivo. Agora os dois baselines passam pela mesma catraca, no job
`gate` (que não precisa de navegador para comparar dois números).

A impressão digital é `página|regra`, sem o seletor, pelo mesmo motivo que o
baseline do lint trava itens e não ocorrências: seletor de axe carrega
`:nth-child` e id gerado pelo Shopify, e muda sem nada ter piorado.

Nota sobre opacidade: `text-foreground/50` passa no esquema ESCURO (5,28:1) e
reprova no claro. Opacidade como texto secundário depende das cores que a
lojista escolhe — nenhum valor fixo garante contraste nos dois lados. A
correção certa é um token próprio por scheme, na [issue #29](https://github.com/cleytonmendest/elizabeth/issues/29).

A segunda metade depende de três secrets, já configurados nesta loja de dev:
`SHOPIFY_STORE`, `SHOPIFY_CLI_THEME_TOKEN` (senha de app do Theme Access) e,
porque a loja tem proteção por senha, `SHOPIFY_STORE_PASSWORD`. O job do CI já
roda sempre — o que muda com o secret é quanto ele consegue medir.

O job NÃO está atrás de um `if:`, de propósito. Job que só roda quando um
secret existe é o mesmo defeito que quebrou o board por dois dias.

Neste ambiente remoto o Chromium já vem instalado, mas numa build que pode não
ser a que o Playwright baixaria. Rode com
`CHROMIUM_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome`; não rode
`playwright install` aqui.

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
definir. Comunicação por evento, nunca acoplamento direto. O contrato:

| Evento | O detail carrega |
| --- | --- |
| `cart-update` | o **carrinho** (`items`, `item_count`, `total_price`) |
| `quantity-update` | o **carrinho** |
| `cart:item-added` | o **item** que acabou de entrar (o que `/cart/add.js` devolve) |
| `variant:change` | a variante escolhida, ou `undefined` |
| `cart-error` | o erro |

Os dois primeiros e o terceiro têm nomes diferentes porque carregam coisas
diferentes — até a v2.31.0 o `addToCart` publicava o item como se fosse
carrinho, e a barra de frete grátis exibia "Faltam R$ NaN" ([issue #4](https://github.com/cleytonmendest/elizabeth/issues/4)).
Quem escuta `cart-update` ainda checa o formato: o nome é genérico e app de
terceiro divide a mesma página.

**Globais:** `window.shopUrl` sai de `snippets/theme-head.liquid` — é a MARCA
do tema, e os três layouts a emitem, porque é por ela que a sonda e o
Playwright distinguem nossa página da tela de senha da Shopify.
`window.routes` fica em `theme.liquid`: é capacidade de carrinho e busca, que
o vale-presente e a página de senha não têm. Nunca hardcode URL de carrinho
ou busca.

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
