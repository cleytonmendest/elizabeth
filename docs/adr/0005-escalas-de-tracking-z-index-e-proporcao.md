# 5. Nomear as escalas de tracking, z-index e proporção a partir do que o código já fazia

- **Status:** Aceito
- **Data:** 2026-09-01

## Contexto

O sistema de **cor** e o de **raio** têm pipeline: a lojista escolhe, o
`theme.liquid` gera CSS variables, o Tailwind consome, o Liquid usa só token
([ADR 0003](0003-tres-niveis-de-customizacao.md)). Três eixos nunca tiveram
escala nenhuma — nem token, nem valor único, nem linter. Medido no código antes
de decidir:

| Eixo | Valores distintos | Ocorrências |
| --- | --- | --- |
| Letter-spacing | **10** (`tight`, `wide`, `wider`, `widest`, `0.12em`, `0.14em`, `0.16em`, `0.18em`, `0.2em`, `0.3em`) | 152 |
| z-index | **7** (`0`, `1`, `2`, `10`, `40`, `50`, `9999`) | 35 |
| Proporção | **6** (`3/4`, `2/3`, `4/3`, `16/9`, `4/5`, `21/9`) | 14 |

O número que decide a questão não é nenhum desses. É este: **a combinação
`text-xs uppercase` — um único papel visual, o rótulo curto em caixa alta —
carregava quatro trackings diferentes** (`0.12em`, `0.14em`, `0.16em`,
`0.18em`). Não é compensação óptica, porque o tamanho da fonte é o mesmo nos
quatro. É tentativa e erro sedimentada.

A [issue #29](https://github.com/cleytonmendest/elizabeth/issues/29) mediu
esses eixos em agosto e contou **apenas os valores entre colchetes**. As
classes stock do Tailwind (`tracking-widest`, `z-10`) não aparecem no
`tokens`, porque a regra procura `algo-[valor]` — então a metade stock do
problema era invisível para a medição e para o linter ao mesmo tempo.

Havia um precedente do que acontece quando uma escala existe mas nada a
protege: o raio. Metade do tema em `rounded-theme`, metade em `rounded-lg`,
os dois valendo 8px — **indistinguíveis até o dia em que a lojista mudasse o
setting**, quando metade do tema deixaria de acompanhar. A escala existia; o
que faltava era a regra que fecha a porta de trás.

## Decisão

**Nomeamos os degraus que o código já usa, em vez de projetar uma escala
nova.** Para cada eixo, o token recebe o valor que a maioria das ocorrências
já tinha, e a migração dessas ocorrências é byte a byte idêntica no CSS
compilado.

```js
letterSpacing: { title: '-0.025em', label: '0.18em', hero: '0.3em' }
zIndex:        { base: 0, raised: 1, above: 2, sticky: 10,
                 overlay: 40, drawer: 50, modal: 9999 }
aspectRatio:   { portrait: '3/4', product: '2/3',
                 landscape: '4/3', ultrawide: '21/9' }  // `video` (16/9) já é do Tailwind
```

**Tracking — três papéis, não dois.** A issue previa dois degraus. O código
mostra três: `title` (−0.025em, em h1–h3, 45 ocorrências consistentes),
`label` (0.18em, o rótulo em caixa alta, valor dominante com 47 de 74
ocorrências arbitrárias) e `hero` (0.3em, 4 ocorrências, todas em kicker de
11px sobre mídia de destaque — em `video`, `image-banner`, `slider-image` e
`countdown-timer`). O `hero` sobrevive como degrau próprio porque seu uso é
**consistente e restrito a um papel**; é o oposto do ruído que justifica
colapsar os outros.

**z-index — nomear sem renumerar.** Os sete degraus viram sete nomes com os
mesmos números. Renumerar para uma escala "limpa" (10/20/30…) foi considerado
e descartado: a página de uma loja Shopify hospeda app de terceiro que não
conhece nossa escala e escolhe o próprio z-index. O `modal: 9999` é feio e
fica — ele é alto de propósito, para ficar acima de quem também está gritando.

**Proporção — `portrait` e `product` continuam separados.** `3/4` (0,75) e
`2/3` (0,667) parecem dois nomes para a mesma intenção, e `2/3` só existe no
`card-product-slider`. Unificá-los mudaria a forma de todo card de produto —
decisão de design com consequência visível em toda página de coleção, não
limpeza de dívida. Fica registrado como pergunta em aberto, para quando a
baseline de regressão visual existir e puder provar o efeito.

**A regra vem junto.** O `tokens` ganha dois checks para classe **stock** do
Tailwind nesses eixos (`tracking-widest`, `z-10`). Sem isso a escala seria
sugestão, e o eixo repetiria o 50/50 do raio — que é exatamente como o raio
chegou onde chegou.

### O que foi deliberadamente deixado de fora

Migração que **muda pixel** não entrou junto com a que não muda, para que o
diff fosse revisável como uma coisa só:

- 33 usos de `tracking-wide` / `wider` / `widest` e 23 de `0.12em` / `0.14em` /
  `0.16em` / `0.2em` → todos convergem para `tracking-label`, mas cada um move
  o espaçamento
- `aspect-[4/5]` (1 uso) e `rounded-md` (2 usos), que não têm equivalente exato
- O piso tipográfico de 12px, violado por `text-[10px]`, `text-[11px]` e
  `text-[8px]` — nove ocorrências que a issue mede mas não lista entre as
  ações, e que esbarram em legibilidade, não só em token

Esses ficam registrados no baseline como dívida **visível**, que é a diferença
entre dívida e esquecimento.

## Consequências

**Ganhamos** — os três eixos passam a ter nome, ordem e um linter que reprova
degrau fora da escala. Quem for escrever `z-30` amanhã recebe o erro na hora,
com a lista de degraus válidos na mensagem. E `rounded-lg` deixa de existir no
tema: os 87 usos viram `rounded-theme`, o que os faz obedecer
`settings.radius_style` pela primeira vez — hoje isso é invisível (8px = 8px),
e deixa de ser no instante em que a lojista escolher 0px ou 16px.

**Pagamos** — a cobertura nova do linter torna visível dívida que sempre
existiu: 33 ocorrências de tracking stock entram no baseline. O total sobe, e
sobe legitimamente ([ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md)
prevê exatamente este caso). Também aceitamos, por ora, dois nomes
(`portrait` e `product`) que podem ser o mesmo degrau — preferimos um nome a
mais a uma mudança visual não provada.

E pagamos um limite honesto: o critério de aceite da #29 diz "nada muda
visualmente onde não era para mudar", mas o mecanismo que provaria isso — a
baseline de regressão visual do style guide — **ainda não existe**, porque o
PNG de referência nunca foi commitado e o teste se declara pulado. Este ADR
contorna a falta escolhendo só migrações byte-idênticas, verificáveis
comparando o CSS compilado antes e depois. A fatia seguinte, que move pixel,
depende daquela baseline para ser mais que uma promessa.

## Referências

- [issue #29](https://github.com/cleytonmendest/elizabeth/issues/29) — a medição de agosto
- [ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md) — a catraca e quando crescer é legítimo
- [ADR 0003](0003-tres-niveis-de-customizacao.md) — o que é do lojista e o que é do tema
- `tailwind.config.js`, `scripts/lint/rules/tokens.mjs`
