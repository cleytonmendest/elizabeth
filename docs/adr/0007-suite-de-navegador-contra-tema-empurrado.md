# 7. A suíte de navegador mede um tema EMPURRADO, não o proxy do `theme dev`

- **Status:** Aceito
- **Data:** 2026-09-02

## Contexto

A metade de storefront dos testes de navegador apontava para
`http://127.0.0.1:9292` — um `shopify theme dev` autenticado, subido pelo job
de CI. O `theme dev` serve os arquivos locais e faz **proxy** do resto contra a
loja.

Esse proxy engoliu três caminhos, e cada um custou rodadas de CI para ser
entendido:

| Issue | O que não atravessa | Como o defeito aparecia |
| --- | --- | --- |
| [#51](https://github.com/cleytonmendest/elizabeth/issues/51) | `/search/suggest.json` | o painel abre, ganha `is-searching`, e fica vazio por 15s |
| [#64](https://github.com/cleytonmendest/elizabeth/issues/64) | `POST /account/login` | volta a página de login **limpa** — sem erro e sem sessão |
| [#71](https://github.com/cleytonmendest/elizabeth/issues/71) | o estado sem sessão | `/password` renderiza pelo `layout/theme.liquid`, com header e breadcrumb |

Três leituras da mesma coisa. Não são três bugs: é uma característica da
ferramenta, e ela tem uma forma comum — **tudo que depende de sessão fica fora
do alcance da suíte**. Pior, os três falham em silêncio ou com sintoma
enganoso: a #64 gastou três execuções de CI só para estabelecer que o POST não
produzia efeito nenhum, e a #71 só foi entendida ao abrir o screenshot do
artefato e ver um header que não deveria estar ali.

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
custo é um tema de desenvolvimento por PR, não um por execução.

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

## Consequências

**Ganhamos**

- Login, sessão e cookies reais. `e2e/endereco.spec.mjs` sai do `fixme`.
- A página de senha passa a ser alcançável no estado que a usa — visitante sem
  sessão —, o que é a única forma de medir `layout/password.liquid`.
- O axe mede a vitrine, não uma aproximação servida por proxy.
- Um modo de falha a menos: some a classe inteira de "o proxy serviu outra
  coisa", que exigia o guard `abrePaginaDoTema` como rede de segurança.

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
- O baseline de a11y foi medido contra o proxy. Medir a vitrine pode mover
  números — a catraca já trata isso como cobertura nova quando o diff toca
  `e2e/`, e o PR precisa confirmar que o tema não piorou.

## Referências

- #51, #64, #71 — os três caminhos que o proxy engole
- `.github/workflows/preview.yml` — de onde veio o `theme push --development`
- `scripts/loja-no-ar.mjs` — a sonda, que passa a ter dois modos
- ADR 0001 — guard rails executáveis: um verificador que mede a página errada
  é a mesma falha que um baseline que se compara consigo mesmo
