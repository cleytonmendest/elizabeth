# 14. Decisão escrita em Liquid vira snippet testável

- **Status:** Aceito
- **Data:** 2026-09-25

## Contexto

Os verificadores do tema cobriam duas camadas e deixavam um buraco no meio:

| Camada | Ferramenta | O que alcança |
| --- | --- | --- |
| Estrutura | linters, `theme-check` | o token existe, a chave existe, o asset existe |
| Comportamento em JS | Vitest + jsdom | o que o Web Component faz no clique |
| **Decisão em Liquid** | **nada** | — |

Um `{% if %}` dentro de um `.liquid` não era exercitado por coisa alguma. A
única forma de saber se a condição estava certa era empurrar o tema e olhar.

É esse buraco que produziu a [#36](https://github.com/cleytonmendest/elizabeth/issues/36)
— "entregue na v2.30.0 e nunca validado de ponta a ponta", duas versões em
produção. E quando a issue finalmente foi atacada, a regra nova que ela pedia
(qual forma o submenu assume) cairia no mesmo buraco: escrita no meio do
markup, sem nada que a exercitasse.

## Decisão

**Decisão escrita em Liquid é extraída para um snippet que não usa nada da
Shopify, e testada com `liquidjs`.**

O primeiro é `snippets/menu-forma.liquid`: recebe um `link` e um `promo`,
devolve `dropdown` ou `painel`. Usa `.size`, `if`, `for` e `echo` — e mais
nada. `tests/menu-forma.test.mjs` o renderiza com objetos fabricados.

### Por que `liquidjs` serve, e onde ele não serve

Ele **não é** o Liquid da Shopify: não tem `linklist`, `image_url`, `money`,
nem os drops. Isso seria fatal se a ideia fosse renderizar uma section inteira;
não é. O snippet extraído fica restrito ao subconjunto que os dois motores
implementam igual, e essa restrição é a própria disciplina: **uma decisão que
precisa de filtro da Shopify para ser tomada provavelmente está misturando
decisão com apresentação.**

O limite vale escrito, porque ele é fácil de esquecer: o teste prova que a
REGRA está certa. Que o chamador a invoca com os argumentos certos é outra
pergunta, e quem responde é o navegador.

### E o markup também passou a ser renderizado

`e2e/menu-desktop.spec.mjs` media geometria — o vão entre o item e o painel, o
teto de altura, o caminho do mouse — contra uma marcação **remontada à mão** a
partir das classes do snippet.

Essa cópia divergiu do original três vezes na mesma investigação:

| Divergência | O que o teste mediu | O que a loja tinha |
| --- | --- | --- |
| fixture sem `overflow` no lugar certo | ponte funcionando | ponte recortada |
| fixture sem logo | linha rasa, vão de 14px | linha alta, vão de 26px |
| classes em `{% assign %}` | nada — o extrator parou de casar | as duas formas |

As três vezes o teste ficou **verde** medindo um arranjo que não existia. A
segunda chegou a produzir uma correção publicada que não corrigia nada.

Por isso `snippets/menu-item-desktop.liquid` foi extraído e passou a ser
renderizado por `liquidjs` dentro do Playwright. O que o navegador mede é a
saída do mesmo arquivo que a loja serve. O bloco de promo usa filtros da
Shopify e continua fora do alcance — ele só é alcançado quando existe promo, e
aí o teste é outro.

## Consequências

- Uma dependência nova de desenvolvimento (`liquidjs`). Não vai para a loja.
- Decisão em Liquid que **não** couber no subconjunto comum não é testável por
  aqui. Isso é sinal, não obstáculo: ou ela se separa da apresentação, ou ela
  não era decisão.
- Fixture de marcação copiada à mão passa a ser considerada dívida. Quando o
  alvo for um snippet, renderize-o.
- O teste de classe por busca de string perde a razão de existir onde o
  navegador mede o efeito. `tests/menu.test.mjs` perdeu duas asserções que
  viraram medição em `e2e/menu-desktop.spec.mjs` — manter as duas seria manter
  a mais fraca, que foi justamente a que aprovou a ponte errada.

## Alternativa descartada

**Medir tudo contra o tema empurrado.** É o que a suíte de navegador já faz, e
não resolve: o CI só renderiza o que a loja de desenvolvimento tiver na
Navegação. Um caminho que nenhum menu de lá exercita nunca é medido, e a
ausência aparece como verde. Renderizar a partir de dados fabricados é o que
permite cobrir os quatro casos da matriz sem depender de configuração de loja.
