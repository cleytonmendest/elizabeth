# 9. A guarda do clique prova o DOCUMENTO, e a suíte ganha um servidor local para medir isso

- **Status:** Aceito
- **Data:** 2026-09-12

## Contexto

A [ADR 0007](0007-suite-de-navegador-contra-tema-empurrado.md) mudou a suíte de
navegador para medir um tema EMPURRADO na loja de verdade. Com isso, "esta
página veio de um layout nosso?" deixou de separar o que precisava separar — o
tema publicado é o mesmo tema e responde igual —, e `e2e/helpers/loja.mjs`
passou a exigir `window.Shopify.theme.id` a cada navegação. A fixação do tema é
por SESSÃO: se ela cair no meio da execução, toda navegação seguinte recebe 200
da vitrine publicada e a suíte fica verde medindo produção.

A [#73](https://github.com/cleytonmendest/elizabeth/issues/73) mostrou que a
guarda cobria só uma das duas portas por onde um documento novo entra: `goto`
tinha prova, clique não tinha. A correção criou `clicaNoTema`, e ela esperava
**a URL mudar** como procuração para "chegou documento novo".

As duas coincidiam em todo call site de então. Não são a mesma coisa, e a
[#76](https://github.com/cleytonmendest/elizabeth/issues/76) escreveu os dois
lados em que elas se separam:

- **Documento novo com a MESMA URL** — form GET reenviado com os mesmos
  parâmetros, POST que redireciona de volta, filtro clicado quando já estava na
  query. O predicado nunca se satisfazia e a espera estourava em 15s sobre uma
  página que existia para ser provada. O call site parecia guardado e não
  guardava nada.
- **`pushState`** — a URL muda sem documento novo. A guarda APROVAVA, provando
  de novo o documento que a entrada já tinha provado. "Passou pela
  `clicaNoTema`" não implicava "um documento foi provado".

Nenhum call site caía nos buracos, e por isso o texto estava no cabeçalho da
função em vez de num arquivo de tarefas. Mas cabeçalho registra **decisão**; o
que faltava fechar era **pendente**, e pendente em prosa depende de alguém
reler o comentário no dia em que o primeiro call site afetado aparecer — o
gênero de texto que a [ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md)
diz que apodrece.

## Decisão

**O sinal da guarda passa a ser o documento.** Antes do clique, `clicaNoTema`
CARIMBA uma propriedade em `window`; depois, espera o carimbo sumir. Carimbo é
propriedade de um `window`, e `window` morre com o documento — a ausência dele
não é indício de documento novo, é o documento novo. Mesma URL passa;
`pushState` reprova, dizendo que não houve documento.

Alternativas descartadas:

- **`page.waitForEvent('framenavigated')`** — o Playwright emite esse evento
  também para navegação de mesmo documento, então ele não distingue o caso 2.
  E evento tem corrida: a navegação pode terminar durante o próprio `click()`,
  antes de alguém estar escutando. O carimbo é ESTADO, e estado não tem corrida.
- **Aceitar a URL e documentar o limite melhor** — é o que já havia, e é
  exatamente o que a #76 recusa: a mensagem de erro nomeava os dois buracos com
  honestidade, mas nomear não é impedir.

**E a suíte de navegador ganha uma terceira forma de conseguir uma página: um
servidor HTTP local** (`e2e/helpers/servidor.mjs`), com rotas escritas pelo
teste e uma fila de respostas por rota. As duas formas que existiam não
serviam para provar uma guarda de navegação: `setContent` não navega, e a loja
não tem — nem deveria ter — uma rota que responda documento novo na mesma URL
só para o teste conseguir olhar.

`e2e/guarda-do-clique.spec.mjs` é o irmão de `e2e/gate.spec.mjs`: não mede o
tema, mede o VERIFICADOR, e por isso roda em toda execução, com ou sem
credencial da loja.

O teste em jsdom continua existindo e foi refeito com um navegador de mentira
que separa documento de URL. Os dois medem a mesma função de propósito, e o par
é a decisão: o falso concorda com quem o escreveu, então a afirmação "trocar de
documento apaga o `window`, e `history.pushState` não" — que é sobre o
NAVEGADOR, não sobre a nossa função — só o Chromium pode responder. Cada lado
tem seu mutante em `scripts/test-mutants.mjs`, com o mesmo `de` e listas
diferentes.

## Consequências

**Ganhamos** — onde `clicaNoTema` passa, um documento foi provado; onde ela
reprova, ou não veio documento, ou veio do tema errado. As duas afirmações
passam a ser verdadeiras em vez de inferidas uma da outra. Um clique
não-navegante embrulhado por engano reprova na hora, em vez de aprovar em
silêncio. E a suíte ganha a infraestrutura para testar qualquer coisa que
dependa de resposta HTTP sem depender do catálogo da loja.

**Pagamos** — uma ida a mais ao navegador por clique (o `evaluate` do carimbo),
e um carimbo visível no `window` de uma loja de desenvolvimento. O clique que
abre OUTRA ABA fica fora do alcance: o documento novo nasce noutra `page`, o
carimbo desta continua onde estava, e a guarda reprova dizendo que não veio
documento — verdade sobre esta aba. Nenhum call site abre aba; quando o
primeiro aparecer, é uma função nova. E os dois testes de reprovação do
navegador custam 15s cada, porque é o timeout real da espera que eles medem.

## Referências

- `e2e/helpers/loja.mjs`, `e2e/helpers/servidor.mjs`, `e2e/guarda-do-clique.spec.mjs`
- `tests/loja.test.mjs`, `scripts/test-mutants.mjs`
- Issues [#73](https://github.com/cleytonmendest/elizabeth/issues/73) e [#76](https://github.com/cleytonmendest/elizabeth/issues/76); revisão do [PR #75](https://github.com/cleytonmendest/elizabeth/pull/75#discussion_r3929748599)
- [ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md), [ADR 0007](0007-suite-de-navegador-contra-tema-empurrado.md)
