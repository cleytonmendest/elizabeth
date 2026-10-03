# 19. O conteúdo que a loja tem é dela, mesmo o que ela nunca mexeu

- **Status:** Aceito
- **Data:** 2026-10-01

## Contexto

O [ADR 0018](0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md) fez de cada
loja uma branch `loja/<nome>` que só recebe da `main`. A propagação, como saiu
no PR #169, decidia o conteúdo de loja (`CONTEUDO_DA_LOJA`) assim:

- o arquivo que a loja MUDOU desde o merge-base volta inteiro para ela;
- o arquivo que ela nunca tocou recebe a versão da `main`.

O primeiro save no editor de cada loja mostrou o problema. A Elizabeth Estudos
(`c197524`) e a Livia (`ac22c45`) mudaram só o `templates/index.json`. O
`product.json`, os grupos de cabeçalho e rodapé e o `settings_data.json` (cores,
logo, o app embed) das duas eram idênticos aos da `main`. Elas os herdaram de
quando a `main` ERA a Elizabeth Estudos, e não de uma escolha de alguém.

A fase 3 da [#168](https://github.com/cleytonmendest/elizabeth/issues/168)
troca o conteúdo da `main` por um tema instalado do zero. Pela regra acima, essa
troca chegaria à Elizabeth Estudos no ar, que perderia a PDP, o cabeçalho, o
rodapé e as cores. "A loja nunca tocou" não quer dizer "não é da loja".

## Decisão

**Todo arquivo de conteúdo que a loja tem é dela.** Na propagação:

- o arquivo de conteúdo que existe na loja volta à versão dela, inteiro, mexido
  ou não;
- o arquivo de conteúdo que ela apagou continua apagado;
- da `main` só chega o arquivo de conteúdo que a loja nunca teve, como um
  template de página novo ou um section group novo;
- o código chega sempre, como antes. Os locales continuam mesclados por linha,
  e um conflito neles reprova.

Isso vale em `planoDoMerge`, em `scripts/lojas.mjs`. O caso da Elizabeth está
plantado em `tests/lojas.test.mjs`: a `main` troca a home e o `settings_data`, a
loja só mudou um locale, e as duas versões dela precisam sair intactas. Esse
teste reprova o código da regra anterior.

### Alternativas descartadas

**Marcar o conteúdo herdado como "da loja" com um commit em cada branch.**
Cada loja precisaria de um commit que tocasse todos os seus arquivos de
conteúdo antes da fase 3. É um passo manual, por loja, que alguém precisa
lembrar, e esquecer não dá erro nenhum: a loja só perde o layout no dia em que
a `main` muda.

**Mesclar o JSON por chave.** Juntar a PDP da `main` com a da loja chave a
chave produz um layout que ninguém montou. É o mesmo motivo pelo qual o ADR
0018 já não deixava o git mesclar por linha.

## Consequências

**Ganhamos**

- A fase 3 pode deixar a `main` neutra sem tocar no conteúdo de nenhuma loja.
- O conteúdo de uma loja só muda quando alguém salva no editor dela. A regra
  cabe numa frase: se a loja tem, é dela.

**Pagamos**

- Uma melhoria no JSON padrão da `main`, como um bloco novo na PDP ou um valor
  novo no `settings_data`, não chega às lojas que já existem. Cada loja a
  acrescenta pelo editor. Um setting novo no schema continua chegando com o
  valor padrão, porque a Shopify preenche a chave ausente.
- Uma correção de conteúdo feita na `main` também não chega. Os 5 settings
  órfãos que o #169 tirou da `main` só saíram das duas lojas porque a primeira
  propagação ainda usava a regra anterior. Daqui em diante, um órfão numa loja
  aparece como aviso no `validar` e se corrige no editor dela.

## Referências

- [ADR 0018](0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md): a `main` é o
  tema, e cada loja é uma branch
- [Issue #168](https://github.com/cleytonmendest/elizabeth/issues/168): a fase
  3 que esta decisão destrava
- Commits `c197524` (Elizabeth Estudos) e `ac22c45` (Livia): o primeiro save
  de cada loja
- `scripts/lojas.mjs` (`planoDoMerge`) e `tests/lojas.test.mjs`

## Atualização

Em "Pagamos", "se corrige no editor dela" não foi medido. O editor não mostra
o setting que o schema não declara mais, e não se sabe se ele apaga essa chave
ao salvar. O caminho garantido é um commit na `loja/*` que mude só o JSON
dela: o `conferir` aceita, e a integração da Shopify o leva ao tema. As
mensagens de `scripts/lojas.mjs` dizem isso (`COMO_CORRIGIR_O_CONTEUDO`).
