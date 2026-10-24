# 21. O quick-add do card não tem `<form>`, porque o card mora dentro de formulários

- **Status:** Aceito
- **Data:** 2026-10-24

## Contexto

Na página de coleção e na de busca, o botão ADD do primeiro produto de 1
variante de cada página não adicionava nada ao carrinho: a página recarregava
com `?sort_by=…&filter.v.price.gte=…&form_type=product&id=…&quantity=1&add=…` na
URL.

A causa é que o HTML não aninha formulários. `sections/main-collection.liquid`
e `sections/main-search.liquid` envolvem a grade INTEIRA num
`<form data-filter-form>`, e o card de 1 variante trazia o `<form>` do próprio
quick-add (`{% form 'product' %}`). Quando o parser vê um `<form>` com outro já
aberto, descarta o interno. Medido no Chromium, com a estrutura da coleção:

- no primeiro card de 1 variante o `<form>` do quick-add **deixa de existir**, e
  o botão passa a pertencer ao form de filtros, que ganha os campos `id` e
  `add`;
- o `</form>` do quick-add ainda **fecha o form de filtros** ali — o "Carregar
  mais" que vem depois cai para fora dele;
- os cards seguintes encontram o ponteiro de form limpo e ganham o form deles,
  então funcionam. Só o primeiro quebrava, e é por isso que nunca foi visto à
  mão: bastava clicar no segundo.

O `<add-to-cart>` (`src/js/cart.js`) lia `this.querySelector('form')` no
construtor. Sem form, não registrava listener de submit: nenhum `fetch`, nenhum
drawer. O teste de navegador que prova o fluxo (`e2e/fluxos.spec.mjs`,
"quick-add do card…") existia, mas se pula quando o catálogo não tem produto de
1 variante — e a loja de desenvolvimento não tinha. No dia em que o catálogo
ganhou chapéus, lenços e bolsas, o teste passou a rodar e reprovou o CI.

## Decisão

O quick-add do card **não tem `<form>`**. O botão é
`<button type="button" name="add" data-variant-id="…">` dentro do
`<add-to-cart>`, e o componente, quando não encontra um form, escuta o clique do
botão e envia ao `/cart/add.js` o que o form levava em dois `<input hidden>`: a
variante e uma unidade (`AddToCart.connectedCallback` e `submitHandler`).

`CartManager.addToCart` passou a aceitar um `<form>` **ou** o corpo já montado
(um `URLSearchParams`). O `cart-error` de uma recusa sai do próprio
`<add-to-cart>` quando não há form, e borbulha até o `document` como antes.

As alternativas, e por que ficaram de fora:

- **Tirar a grade de dentro do form de filtros**, ligando os controles a ele
  pelo atributo `form="…"`. É o desenho "certo" do HTML, mas muda o contrato do
  `facets.js` (o `change` de um controle fora do form não passa por ele), toca
  o painel de filtros inteiro e a ordenação, nas duas sections — para consertar
  um botão, arriscar a funcionalidade principal da página.
- **Um form compartilhado fora da grade, com `form="…"` em cada botão.** Resolve
  o aninhamento e preserva o envio nativo, mas o `FormData` do form não inclui o
  botão que o disparou sem o `submitter`, o "Carregar mais" injetaria cards que
  dependem de um form fora da grade, e o `<add-to-cart>` registraria um
  listener por card no MESMO form — um envio dispararia N adições.
- **Manter o `<form>` e avisar quem chama** (`in_form: true`). Dois markups, dois
  caminhos de JS, e um parâmetro que cada section nova teria de lembrar — "tem
  que lembrar" é o que este repositório troca por verificação.

## Consequências

**Ganhamos** — o botão funciona em qualquer lugar onde o card for posto, dentro
de form ou fora dele, e nenhuma section nova precisa saber disso. Um teste
(`tests/card-quick-add.test.mjs`) reprova qualquer `<form>` num snippet que o
card renderiza, hoje ou amanhã; o clique é coberto por
`tests/quick-add-do-card.test.mjs` contra o HTML que a loja serve, posto dentro
de um form de filtros.

**Pagamos** — sem JavaScript o botão do card fica inerte. Antes, fora de um form
de filtros (os sliders da home, as recomendações), o `<form>` fazia um envio
nativo para `/cart/add`; dentro de um, não fazia nem isso. O link "ver produto"
do card continua funcionando sem JS, que é o caminho que sobra. Também: o corpo
do quick-add viaja `application/x-www-form-urlencoded`, e o da PDP segue
multipart (a Shopify aceita os dois).

O código novo cabe no teto de JS global (33.979 B contra 34.000) por pouco, e
só porque duas linhas do `disconnectedCallback` do `AddToCart` foram removidas.
Elas chamavam `removeEventListener` com uma função diferente da que tinha sido
adicionada (`.bind()` devolve outra a cada chamada) e portanto nunca removiam
nada. O vazamento que elas fingiam evitar — o ouvinte de `variant:change` que o
`AddToCart` deixa no contexto do produto — continua existindo e é dívida
anterior a esta decisão. Quem for pagá-la precisa guardar a função ligada, e
vai precisar de folga no teto: o `variations-selector.js` e o
`quantity-selector.js` (5 KB juntos) são carregados em toda página e só a PDP e o
produto em destaque os usam, mas mover o primeiro muda a ordem em que o
`variant:change` inicial encontra seus ouvintes, e merece medição própria.

## Referências

- `snippets/card-quick-add.liquid`, `src/js/cart.js` (`AddToCart`,
  `CartManager.addToCart`)
- `sections/main-collection.liquid`, `sections/main-search.liquid` — o form de
  filtros que envolve a grade
- `tests/card-quick-add.test.mjs`, `tests/quick-add-do-card.test.mjs`,
  `e2e/fluxos.spec.mjs` ("quick-add do card mantém o ícone e adiciona sem sair
  da coleção")
- [ADR 0011](0011-asset-pesado-e-baixado-pelo-componente-que-precisa-dele.md) —
  o que é global e o que é co-locado
