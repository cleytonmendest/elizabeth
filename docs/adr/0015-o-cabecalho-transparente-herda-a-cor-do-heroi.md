# 15. O cabeçalho transparente herda a cor do herói

- **Status:** Aceito
- **Data:** 2026-09-25

## Contexto

Cabeçalho sobre a imagem de abertura é o idioma visual de moda com
posicionamento de luxo, e o tema não oferecia. A feature já tinha sido tentada
e **removida por bugs**.

A saída intuitiva é medir o brilho da imagem em JavaScript e escolher texto
claro ou escuro. Ela é frágil de três jeitos:

- a imagem com `loading="lazy"` ainda não chegou quando a medição roda;
- o resultado pisca na troca, porque a decisão muda depois da pintura;
- foto de contraste misto — céu claro em cima, mar escuro embaixo — não tem
  resposta certa.

## Decisão

**A cor não é detectada. É herdada da primeira section da página.**

A lojista já escolheu um color scheme para ela, porque foi o que deixou o
título do herói legível sobre aquela foto. O cabeçalho copia a classe
`color-scheme-N` dessa section enquanto está transparente.

```
primeira section tem esquema com texto claro
      ↓
cabeçalho transparente usa o MESMO esquema
      ↓
logo, links e ícones ficam claros
```

Três consequências que são o motivo da escolha:

- **Nenhum setting de cor novo** — coerente com a [ADR 0003](0003-tres-niveis-de-customizacao.md).
- **Impossível divergir do herói.** Se o título dele está legível, o cabeçalho
  também está: é a mesma decisão, aplicada duas vezes.
- **Trocar o esquema do herói leva o cabeçalho junto**, sem a lojista fazer
  nada.

### Duas condições, e a segunda não é escolha

| Pergunta | Quem responde |
| --- | --- |
| A lojista quer? | o toggle `transparent_header` |
| Dá para querer nesta página? | a primeira section tem `[data-hero-media]`? |

Precisa das **duas**. Sem a segunda o cabeçalho fica sólido mesmo com o toggle
ligado, e é isso que impede o defeito clássico: link claro sobre fundo branco
na coleção, no produto, ou numa home que começa com texto. A lojista não
precisa lembrar de desligar por template.

Hoje declaram `data-hero-media`: `image-banner`, `slider-image` e `video`.

### O estado sólido é o padrão

Nada disto roda sem JavaScript, e o transparente é o estado **adicionado**. Um
cabeçalho que só fica legível depois que o script carrega é pior que um sólido
sempre.

Pelo mesmo raciocínio, transparente e `is-scrolling` são o mesmo interruptor
invertido: transparente só no topo absoluto, sombra só fora dele. Eles nunca
coexistem por construção — e é assim que a sombra deixa de aparecer como um
risco flutuando sobre a imagem, sem precisar de uma regra que a desligue.

## Consequências

- O herói sobe por `margin-top: calc(-1 * var(--header-height))`, usando a
  altura que `header.js` já mede e publica. Não há troca de `position`, que é
  de onde vêm os saltos de layout nessa feature.
- O `<div class="page-width py-4">` do breadcrumb saiu do `layout/theme.liquid`
  e virou parte do próprio snippet. Ele era emitido sempre, inclusive na home,
  onde o breadcrumb não renderiza nada: **32px de padding vazio no topo de toda
  home**, medidos. Ninguém notava enquanto o cabeçalho era sólido e branco
  sobre fundo branco.
- Slideshow com slides de esquemas diferentes: o cabeçalho herda o do primeiro
  e não acompanha a troca. Registrado, não resolvido.

## O scrim do cabeçalho

O scrim do banner pode ser **lateral** — `linear-gradient(270deg, cor 0%,
transparent 65%)` —, escurecendo cerca de 35% da largura, que é onde o título
dele mora. O cabeçalho atravessa a largura inteira, inclusive o pedaço onde
aquele gradiente já virou transparente: ali o texto dele não tem nada
ajudando.

Por isso o cabeçalho ganha o próprio scrim, um gradiente do topo, **só enquanto
transparente**. A cor sai de `--color-background` do esquema herdado, pelo
mesmo raciocínio do resto: herói escuro dá scrim escuro, que ajuda texto claro;
herói claro dá scrim claro, que ajuda texto escuro. Preto cravado ajudaria
metade dos casos e atrapalharia a outra.

Ele **melhora as chances, não garante** contraste — nenhum scrim garante, com
foto arbitrária atrás.

O pseudo-elemento existe sempre, com opacidade zero, e não só no estado
transparente: pseudo-elemento que nasce junto com o estado não tem de onde
animar, e a troca apareceria como um salto no meio de uma transição que é suave
em todo o resto.

## O que o portão automático não alcança

O axe reporta texto sobre `background-image` como **incomplete**, não como
falha — ele não amostra pixel de imagem. Ou seja: a feature cujo único risco
real é contraste é exatamente a que a varredura de a11y não vê. Um cabeçalho
branco sobre uma foto clara passa verde.

O que os testes provam é a **máquina de estados** (quando liga, quando não
liga, de onde a cor vem) e a **consequência geométrica** (o fundo some, o herói
sobe). O contraste em si é olho humano sobre screenshot, e está escrito assim
na [issue #121](https://github.com/cleytonmendest/elizabeth/issues/121) em vez
de fingido num critério verde.

## Alternativa descartada

**Um segundo setting de cor no cabeçalho** (`transparent_color_scheme`).
Explícito e sem inferência, mas cria duas fontes para a mesma decisão: a
lojista escolhe o esquema do herói para o título dele, e escolheria de novo
para o cabeçalho. Elas divergem no dia em que ela troca uma e esquece a outra —
e o sintoma é texto ilegível sobre a foto, que é o defeito que a feature
inteira existe para evitar.
