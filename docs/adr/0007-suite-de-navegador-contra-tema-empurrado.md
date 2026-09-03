# 7. A suíte de navegador mede um tema EMPURRADO, não o proxy do `theme dev`

- **Status:** Aceito
- **Data:** 2026-09-02

## Contexto

A metade de storefront dos testes de navegador apontava para
`http://127.0.0.1:9292` — um `shopify theme dev` autenticado, subido pelo job
de CI. O `theme dev` serve os arquivos locais e faz **proxy** do resto contra a
loja.

Três caminhos falharam por baixo dele, e cada um custou rodadas de CI para ser
entendido. A leitura da época — que a seção "O que a primeira execução mediu"
corrige — era que o proxy engolia os três:

| Issue | O que se suspeitava não atravessar | Como o defeito aparecia |
| --- | --- | --- |
| [#51](https://github.com/cleytonmendest/elizabeth/issues/51) | `/search/suggest.json` | o painel abre, ganha `is-searching`, e fica vazio por 15s |
| [#64](https://github.com/cleytonmendest/elizabeth/issues/64) | `POST /account/login` | volta a página de login **limpa** — sem erro e sem sessão |
| [#71](https://github.com/cleytonmendest/elizabeth/issues/71) | o estado sem sessão | `/password` renderiza pelo `layout/theme.liquid`, com header e breadcrumb |

Três leituras do que parecia ser a mesma coisa: não três bugs, mas uma
característica da ferramenta com uma forma comum — **tudo que depende de sessão
fica fora do alcance da suíte**. A hipótese é boa e explica os três sintomas;
ela vale para dois. Pior, os três falham em silêncio ou com sintoma enganoso: a
#64 gastou três execuções de CI só para estabelecer que o POST não produzia
efeito nenhum, e a #71 só foi entendida ao abrir o screenshot do artefato e ver
um header que não deveria estar ali.

O custo real não é o teste vermelho. É que o VERIFICADOR passou a mentir sobre
o que mede: `sem violação NOVA de WCAG AA: loja protegida por senha` media
outra página, e teria continuado medindo enquanto alguém não olhasse a imagem.

Enquanto isso, `preview.yml` já empurra um tema de desenvolvimento a cada PR
(`shopify theme push --development --development-context "pr-N"`) e recebe de
volta uma `preview_url` da loja de verdade. A vitrine sem proxy sempre esteve
a um passo de distância, sendo usada para outra coisa.

## Decisão

**A suíte inteira de storefront passa a rodar contra um tema empurrado.** O job
de navegador do `ci.yml` deixa de subir `shopify theme dev` e passa a fazer
`shopify theme push --development`, medindo a `preview_url` que volta.

**Toda a suíte, não só os testes autenticados.** Manter os dois caminhos
significaria manter duas respostas para "qual storefront serviu esta página?",
e essa pergunta sem resposta única é exatamente a forma de defeito que este
repositório já pagou três vezes. O efeito colateral é bem-vindo: o axe passa a
medir a vitrine que a Theme Store vai avaliar, e não uma aproximação dela.

**O gate passa a escrever na loja a cada PR.** É o que este ADR existe para
registrar. A capacidade não é nova — o `preview.yml` já escreve —, mas o gate
DEPENDER de uma escrita externa é diferente de um comentário de PR depender.

O contexto do tema é `ci-pr-N`, separado do `pr-N` do preview. Dois workflows
empurrando para o mesmo tema ao mesmo tempo é corrida por arquivos, e o
`--development-context` reaproveita o tema em vez de criar um por push, então o
custo é um tema de desenvolvimento por PR, não um por execução. Em `push` na
main não existe número de PR: o contexto é `ci-main`, também estável — a
primeira versão caía em `github.run_id`, único por execução, e criava um tema
novo a cada merge.

### Alternativas descartadas

**Migrar só os testes autenticados.** Menor risco imediato e baseline de a11y
intocado. Descartada porque deixaria a #51 e a #71 abertas por construção, e
porque manter dois backends de storefront no CI dobra os modos de falha
justamente na parte da suíte que já provou ser a mais difícil de diagnosticar.

**Consumir o tema que o `preview.yml` já empurrou.** Evitaria o segundo tema
por PR. Descartada porque criaria dependência entre workflows: o `ci.yml`
precisaria de um artefato do `preview.yml`, e um PR de fork — onde o secret não
chega — teria que degradar dos dois lados de forma coordenada. O gate não pode
depender da ordem em que dois workflows terminam.

**Continuar no proxy e aceitar os `fixme`.** É o estado atual. Descartada
porque o número de caminhos inalcançáveis só cresce: eram um, viraram três em
duas semanas, e o terceiro só apareceu porque alguém foi olhar um screenshot.

## O que a primeira execução mediu

Este ADR foi escrito antes de existir uma execução contra a loja, e a execução
refutou parte dele. O texto abaixo é o corrigido; o que ele previa está no
histórico do git, que é onde previsão desmentida deve morar.

**A migração funciona.** A sessão fixou (`[setup] Sessão aberta no tema
158207180978`), o `pb=0` desligou a barra de preview, e o POST da senha da
vitrine passou pelo Playwright.

**A #51 era o proxy — provado.** A busca preditiva passou na primeira
execução, sem ajuste nenhum.

**A #64 NÃO era.** Na vitrine real, sem proxy, com cookies e sessão reais, o
POST em `/account/login` devolve o mesmo sintoma de sempre: a página de login
limpa, sem erro e sem sessão. Quatro rodadas, e a quarta é a que descarta a
ferramenta. Os cinco testes de `e2e/endereco.spec.mjs` continuam em `fixme`,
agora com o diagnóstico certo: o que sobra precisa do admin da loja — conta não
ativada, ou a loja em "novas contas de cliente", em que o formulário clássico
deixa de ser o caminho de login.

Isso não invalida a decisão: a #51 fechou, o axe passou a medir a vitrine, e a
#71 ganhou um caminho que antes não existia — ainda não percorrido. Invalida a
previsão de que **um** dos três caminhos seria destravado por ela.

## Consequências

**Ganhamos**

- Login, sessão e cookies reais no caminho da suíte — o que a #64 precisava
  para ser diagnosticada, ainda que não para ser corrigida.
- A busca preditiva volta a ser medida (#51).
- A página de senha passa a ser alcançável no estado que a usa — visitante sem
  sessão —, o que é a única forma de medir `layout/password.liquid`. O caminho
  mudou de forma: quem atravessa a senha agora é o `globalSetup`, e a sessão
  vale para a suíte inteira, então falta um contexto SEM ela (#71).
- O axe mede a vitrine, não uma aproximação servida por proxy.

**Pagamos**

- **O gate fica dependente da loja.** Token expirado, loja pausada ou API fora
  do ar passam a reprovar o job de navegador. Antes isso derrubava só a metade
  de storefront; agora derruba a mesma metade, mas por mais causas.
- **Cada PR escreve um tema de desenvolvimento na loja.** São efêmeros (a
  Shopify os expira) e reaproveitados por contexto, mas a biblioteca de temas
  da loja passa a ter tráfego que não tinha.
- **O push é mais lento que o `theme dev`** — sobe o tema inteiro antes do
  primeiro teste, em vez de servir arquivo local na hora.
- **A senha da vitrine passa a ser atravessada pelo Playwright**, não pelo CLI.
  Isso é ganho para a #71 e custo para todo o resto: cada contexto de navegador
  precisa da sessão, e um erro aí reprova a suíte inteira de uma vez.
- **O guard `abrePaginaDoTema` continua necessário.** A primeira versão deste
  ADR previa que ele sairia junto com o proxy. Não sai: a fixação do tema é por
  SESSÃO, então cada `page.goto` ainda pode receber o tema publicado se a
  sessão se perder, e a pergunta "esta página é do tema que empurramos?" não
  desaparece — muda de dono. Quem a responde primeiro passa a ser o
  `e2e/global-setup.mjs`, que se recusa a começar sem a prova; o guard fica
  como rede para o resto da execução.
- O baseline de a11y foi medido contra o proxy. Medir a vitrine pode mover
  números — a catraca trata crescimento como cobertura nova quando o diff toca
  `e2e/helpers/axe.mjs` ou `e2e/a11y.spec.mjs` (a lista está em
  `scripts/catraca.mjs`, não em `e2e/` inteiro), e o PR precisa confirmar que o
  tema não piorou. Reparar que essa porta abre com um diff de COMENTÁRIO nesses
  arquivos: ela é generosa de propósito, e por isso o número antes → depois vai
  no corpo do PR.
- **O gate de mutantes de a11y precisa do ambiente PODADO.** `globalSetup` é de
  config e roda em toda invocação do Playwright, inclusive nas que só medem o
  verificador. Com a loja no ambiente, um `globalSetup` que estoura viraria
  "mutante morto" sem o axe ter rodado. Quem poda é `ambienteDoMutante`, em
  `scripts/test-mutants.mjs`, com teste.

## Referências

- #51, #64, #71 — os três caminhos que se atribuíam ao proxy; dois eram
- `.github/workflows/preview.yml` — de onde veio o `theme push --development`
- `scripts/tema-de-teste.mjs` — separa a origem do id, e reprova um push sem
  `preview_theme_id` em vez de deixar medir o tema publicado
- `e2e/global-setup.mjs` — abre a sessão uma vez e PROVA que ela ficou fixada
- `scripts/loja-no-ar.mjs` — a sonda, APAGADA aqui. Ela esperava um servidor
  local subir, e `theme push` é síncrono. Já estava quebrada antes disso: nasceu
  para separar "o tema respondeu" de "a tela de senha da Shopify respondeu", e
  a #27 deu ao tema a sua própria página de senha, que emite `window.shopUrl`
  como qualquer outra — desde então uma loja trancada passava na sonda. O
  `globalSetup` faz a pergunta estritamente mais forte: não "é o nosso tema?",
  mas "é a nossa BRANCH?"
- ADR 0001 — guard rails executáveis: um verificador que mede a página errada
  é a mesma falha que um baseline que se compara consigo mesmo
