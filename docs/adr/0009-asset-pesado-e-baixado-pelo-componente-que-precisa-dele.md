# 9. Asset pesado é baixado pelo COMPONENTE que precisa dele, não pelo layout

- **Status:** Aceito
- **Data:** 2026-09-12

## Contexto

O tema tinha duas estratégias de carregamento, e o `CLAUDE.md` as descreve:
**global** (o `layout/theme.liquid` emite a tag, e o asset vai em toda página) e
**co-locado** (a section ou o snippet que usa emite a tag, e o asset só pesa
onde é renderizado). Co-locado é o padrão preferido; global exige justificativa.

O Swiper estava no global sem justificativa. Medido por
`npm run lint -- --rules=budget`:

| | Antes | Depois |
| --- | --- | --- |
| JS global | 209,2 KB | 58,2 KB |
| CSS global | 73,1 KB | 55,1 KB |

151 KB de JS e 18 KB de CSS em toda página — carrinho, conta, políticas, 404,
PDP. Nenhuma delas tem carrossel. O bundle sozinho era 72% do JS que toda
visitante baixava ([#32](https://github.com/cleytonmendest/elizabeth/issues/32)).

**Co-locar não resolvia.** São sete consumidores de `<my-slider>` — quatro
sections e três snippets —, e `{% render %}` tem escopo isolado: não existe
variável que atravesse duas sections para dizer "o bundle já foi emitido". Uma
home com um slider de cards e um de depoimentos emitiria a tag duas vezes.
Tags iguais o navegador resolve pelo cache, mas o arquivo EXECUTA duas vezes, e
um bundle de 151 KB reavaliado é tempo de main thread que ninguém pediu. Pior:
a dedupe ficaria por conta de quem escrevesse a próxima section com carrossel.

## Decisão

**Existe uma terceira estratégia, e ela é para dependência pesada de
componente: o asset é baixado em RUNTIME pelo custom element que precisa
dele.** `<my-slider>` injeta `swiper-bundle.min.js` e `.css` no
`connectedCallback` e só então inicializa. Página sem slider não baixa byte
nenhum; página com seis sliders baixa uma vez.

**As URLs viajam por data-attribute na tag que carrega o componente.** Um asset
`.js` não resolve `asset_url`, e o caminho da CDN da Shopify tem um `?v=` que
muda a cada deploy — hardcodá-lo quebraria na primeira publicação. Então o
Liquid escreve o que só ele sabe:

```liquid
<script
  src="{{ 'carousel-manager.js' | asset_url }}"
  data-swiper-js="{{ 'swiper-bundle.min.js' | asset_url }}"
  data-swiper-css="{{ 'swiper-bundle.min.css' | asset_url }}"
  defer
></script>
```

**O cache do download mora no `window`, não numa variável do arquivo.** O que
ele impede é o bundle ser baixado duas vezes; duas cópias de
`carousel-manager.js` na mesma página — o dia em que alguém co-locar o que hoje
é global — teriam duas variáveis de módulo, cada uma se achando a primeira. A
dedupe precisa valer por PÁGINA, e é no `window` que a página mora.

**Isso não muda o padrão do tema.** Co-locado continua sendo o default para
asset de section. O runtime é para o caso em que o asset é pesado E a dedupe
entre sections importa — hoje, só o Swiper.

### Alternativas descartadas

**Co-locar a tag nos sete consumidores.** É o padrão do tema e seria a resposta
óbvia. Descartada pelo motivo acima: o Liquid não tem como deduplicar entre
sections, e o custo do erro (reavaliar 151 KB) é invisível na tela — só
aparece na aba Network de quem for olhar.

**Emitir a tag num snippet renderizado pelo `theme.liquid` atrás de um `{% if %}`
que detecte carrossel na página.** Não existe essa pergunta em Liquid: o layout
é avaliado antes do `content_for_layout`, e não há como saber quais sections o
template vai montar.

**Deixar o CSS global e só adiar o JS.** Resolveria 151 dos 169 KB com metade
do risco, e o CSS chegaria sempre antes do JS por construção. Descartada porque
18 KB em toda página continuam sendo 18 KB que o carrinho não usa, e porque o
motivo que justificaria manter — a ordem — é atendido pela ordem de injeção.

**Esperar o `load` do `<link>` antes de inicializar.** Removeria por completo a
janela em que o Swiper inicializa sobre slides ainda empilhados. Descartada:
uma folha bloqueada por extensão pode não disparar `load` nem `error`, e o
carrossel nunca inicializaria. A folha é injetada ANTES do bundle e é 8x menor;
os dois downloads começam no mesmo instante, na mesma origem.

## Consequências

**Ganhamos**

- 151 KB de JS e 18 KB de CSS a menos em toda página sem carrossel — que é a
  maioria das páginas de uma sessão de compra.
- Slider com menos de dois itens não inicializa e, por isso mesmo, não baixa:
  o caso em que o download nunca se pagaria.
- O teto de `perf-budget.json` desceu junto (215000/78000 → 62000/58000). Ele
  é o que impede o bundle de voltar ao layout sem discussão.

**Pagamos**

- **O carrossel passa a inicializar mais tarde.** Antes o bundle vinha com o
  resto do `<head>`; agora o download só começa quando o elemento conecta. Na
  home, acima da dobra, isso é visível: a área do slider fica com os itens
  empilhados por mais tempo do que ficava.
- **Uma dependência a mais entre Liquid e JS.** Se alguém remover os
  `data-swiper-*` da tag, nada explode — o componente avisa no console e o
  carrossel não aparece. É uma falha silenciosa a mais no tema, e a defesa
  contra ela é `tests/carousel-manager.test.mjs`.
- **A sincronia da galeria da PDP com a troca de variante fica sujeita a uma
  corrida.** `product-gallery.js` lê `container.swiper` e já era guardado por
  `if (swiper)`; enquanto o bundle não chega, a troca de variante não desliza a
  galeria mobile. A janela é o tempo do download, e a troca de variante é
  interação humana — mas a janela existe, e antes não existia.
- **O linter `budget` deixa de ver o Swiper.** Ele lê Liquid e conta o que o
  layout carrega; um asset baixado em runtime some da conta por construção. É
  correto — ele não pesa em toda página —, mas significa que o peso do bundle
  não é mais vigiado por nenhum número, além do teto `perAsset`. Quem verifica
  o COMPORTAMENTO (uma vez só, e não antes da hora) passa a ser o teste em
  jsdom, com dois mutantes.

## Referências

- [#32](https://github.com/cleytonmendest/elizabeth/issues/32) — a issue, com a medição que originou isto
- `assets/carousel-manager.js` — `carregarSwiper()` e o cache no `window`
- `tests/carousel-manager.test.mjs` — dois sliders, um download
- `scripts/lint/rules/budget.mjs` — o teto que impede a volta
- ADR 0001 — o que precisa ser verdade é verificado por código: aqui o teto
  guarda o layout e o teste guarda o componente, porque nenhum dos dois
  alcança o que o outro vê
