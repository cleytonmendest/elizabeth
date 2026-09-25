# 13. O JS servido é gerado, e o teste lê o gerado

- **Status:** Aceito
- **Data:** 2026-09-25

## Contexto

A Shopify serve `assets/` direto, sem passo de build: o arquivo que está no
repositório é o arquivo que a cliente baixa. Enquanto o JS foi escrito à mão
ali, cada comentário e cada nome de variável longa viajou para o navegador em
toda página.

O CSS nunca teve esse problema — `src/tailwind.css` → `assets/application.css`
existe desde o começo, com a regra de lint `build` comparando byte a byte. O JS
ficou de fora, e ninguém decidiu isso; foi só o que aconteceu.

Medido antes de decidir, porque a objeção óbvia era que o CDN já comprime e o
ganho seria contábil:

| | Antes | Depois |
| --- | --- | --- |
| JS global, bruto | 61,8 KB | 29,9 KB |
| JS global, `gzip -9` | 19,5 KB | 10,6 KB |
| Todos os 18 autorais, bruto | 97,3 KB | 45,5 KB |

**A objeção não se sustentou: 45% a menos mesmo depois de comprimido.** O
motivo é que compressão substitui texto repetido por ponteiro, mas não renomeia
identificador. `precoFormatadoDaVariante` continua sendo uma string longa para
o gzip, ainda que ele a referencie barato na segunda ocorrência. O esbuild a
troca por uma letra — e é daí que vem a parte do ganho que a compressão não
alcançava sozinha.

## Decisão

O JS autoral sai de `assets/` e passa a seguir o mesmo caminho do CSS:

```
src/tailwind.css → assets/application.css   (Tailwind)
src/js/*.js      → assets/*.js              (esbuild, minify, target es2019)
```

`src/` já estava no `.shopifyignore`, então a loja recebe só o minificado.

Três consequências foram escolhidas de propósito, e são o conteúdo real desta
decisão:

**1. `tests/helpers/load-asset.mjs` continua lendo `assets/` — o minificado.**

Era a escolha mais desconfortável e é a que preserva a promessa que o próprio
arquivo faz: *"o que se testa é o arquivo que vai para a loja, byte a byte"*.
Ler `src/js/` daria rastreamento de pilha legível e mediria um arquivo que
nenhuma cliente baixa — a mesma classe de defeito que já apareceu quatro vezes
neste repositório, de um verificador que afirma uma coisa e mede outra.

Na prática a garantia ficou mais FORTE: a suíte agora prova que o artefato
construído roda, e não só que o fonte rodaria se alguém o servisse. Os 573
testes passaram contra o minificado sem uma linha de ajuste.

O que torna isso possível é que o esbuild **não renomeia declaração de topo**
em script não-empacotado — ela pode ser global, e ele não pode saber que não
é. `formatMoney` e `AddToCart`, que o epílogo do carregador pede pelo nome,
sobrevivem. Por isso também **não se empacota**: os assets são scripts
clássicos que dependem de globais publicadas na ordem em que o Liquid os
injeta ([ADR 0010](0010-moeda-em-js-vem-do-window-shopify.md)). Empacotar
mudaria o programa; minificar não.

**2. O corredor de mutantes reconstrói entre mutar e testar.**

Sem esse passo, o mutante é escrito num arquivo que o teste não lê, e os 30
mutantes de JS passariam todos a SOBREVIVER — não por os testes serem fracos,
mas por estarem medindo o artefato velho. Seria o pior resultado possível do
script: um relatório confiante sobre outro programa.

Medido, e não suposto: com o fonte mutado e `assets/` intacto,
`tests/money.test.mjs` passa com 11 verdes. Propagando o mesmo mutante,
7 dos 11 falham.

**3. `assets/*.js` sem fonte é erro de lint.**

Um arquivo escrito direto em `assets/` funciona, passa em todos os outros
linters, e simplesmente nunca é minificado. A #96 voltaria de fininho, um
arquivo por vez. A lista `VENDORIZADOS` em `scripts/build-js.mjs` é explícita
e não um padrão `*.min.js`, porque o padrão deixaria qualquer arquivo entrar
bastando o nome terminar certo — e exige o motivo escrito, mesma disciplina do
`design-exceptions.json`.

## Consequências

- `assets/*.js` passa a ser artefato com cara de fonte. Uma edição à mão ali
  sobrevive a todos os testes e some no build seguinte, sem deixar rastro. É a
  regra `build` que transforma esse sumiço em erro, e o `pre-commit` que o pega
  antes do CI.
- Quando um teste quebra, o trecho apontado está minificado. O caminho é abrir
  `src/js/<mesmo nome>`.
- O teto de `perf-budget.json` desceu de 65 KB para 32 KB. Teto que não desce
  depois de uma economia deixa de ser teto e vira enfeite.
- `boundaries.json` e `jsstrings` passaram a apontar para `src/js/` — os dois
  parseiam o JS, e parsear o minificado mediria outra coisa. O baseline mudou
  de 220 para 220 itens: um único renomeio de caminho, nada entrou nem saiu.
- Uma dependência nova (`esbuild`). É de desenvolvimento e não vai para a loja.

## Alternativa descartada

**Manter o fonte em `assets/*.js` e gerar `assets/*.min.js` ao lado.** Custava
quase nada nos verificadores — `jsstrings` já pulava `.min.`, `budget` já conta
o que o Liquid referencia. Foi descartada porque `load-asset.mjs` passaria a
ler o fonte enquanto a loja serve o minificado: a promessa "byte a byte"
continuaria escrita e deixaria de ser verdade, e o arquivo efetivamente servido
seria a única coisa que nada testa. Também empurraria as duas cópias para a
loja.
