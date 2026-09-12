# 9. A moeda do JS vem do `window.Shopify`, e existe um único formatador

- **Status:** Aceito
- **Data:** 2026-09-12

## Contexto

O tema tinha **três** funções de formatar preço em JS, escritas
independentemente, com três nomes:

| Arquivo | Função | Divide por 100? |
| --- | --- | :---: |
| `assets/cart.js` | `formatPrice(value)` | sim |
| `assets/cart-extras.js` | `formatBRL(cents)` | sim |
| `assets/search-component.js` | `_formatPrice(price)` | **não** |

Nenhuma sabia da existência das outras. Dois defeitos saíram daí, e o segundo é
o grave:

**1. Elas discordavam sobre a unidade.** A terceira trazia um comentário que se
contradizia — "a API do Shopify retorna o preço já em centavos (17990 =
R$ 179,90) / não dividimos por 100" —, e formatar 17990 direto dá R$ 17.990,00.
Ou o comentário estava errado, ou o código estava; a resposta não estava em
lugar nenhum que pudesse ficar vermelho.

**2. As três cravavam `pt-BR` e `BRL`.** O Liquid não tem esse problema:
`| money` respeita a moeda ativa da loja, e o tema tem seletor de moeda no
rodapé (`snippets/localization-form.liquid`). No instante em que a cliente
troca, o Liquid acompanha e o JS continua imprimindo reais — no carrinho, no
mini-carrinho e na busca preditiva, que são exatamente as telas onde o preço é
reescrito por JS. É bloqueador de Theme Store pela mesma razão da #25: o tema
precisa funcionar fora do Brasil.

A regra `boundaries` já existia e teria pego a terceira cópia — mas ela protege
capacidade que já tem dono, e não centraliza sozinha. Por isso `money-format`
ficou de fora das fronteiras declaradas quando aquela regra nasceu: uma
capacidade com três donos acidentais não é fronteira, é dívida. Issue #39.

## Decisão

**Existe um formatador, `formatMoney(centavos)`, em `assets/money.js`, e ele lê
moeda e idioma de `window.Shopify`.**

`Intl.NumberFormat(Shopify.locale, { style: 'currency', currency:
Shopify.currency.active })`. As duas entradas são escritas pelo
`{{ content_for_header }}` — pela SHOPIFY, não pelo tema. É o mesmo argumento
que `e2e/global-setup.mjs` faz sobre `window.Shopify.theme.id`: a plataforma
responde em que moeda esta sessão está, e qualquer cópia que o tema guardasse
seria uma segunda verdade a divergir.

**A alternativa descartada foi expor `shop.money_format` via `window`.** Ela é
atraente porque dá paridade literal com o `| money` do Liquid, e foi descartada
por dois motivos:

1. **Ela traz um interpretador junto.** `money_format` é um template da Shopify
   (`{{amount}}`, `{{amount_with_comma_separator}}`,
   `{{amount_no_decimals_with_space_separator}}`…). Consumi-lo em JS significa
   reimplementar esse parser — uma segunda máquina de formatação dentro do
   arquivo criado para haver só uma.
2. **Ela é uma string do TEMA, não da sessão.** O `Intl` já sabe agrupar
   milhar, posicionar símbolo e escolher o número de casas decimais de cada
   moeda em cada idioma, e é o navegador que responde. Um `money_format`
   copiado para o `window` é o tema respondendo sobre a plataforma.

**Sem `Shopify.currency.active`, o número sai sem símbolo** (`style` decimal,
duas casas). Inventar uma moeda no fallback seria repor o defeito que este ADR
remove: um número incompleto é visível; um número na moeda errada não é.

**A unidade canônica é o centavo**, porque é o que os JSONs da Shopify
devolvem. E ela não é afirmada por leitura de documentação — `e2e/moeda.spec.mjs`
compara os inteiros de `/products/<handle>.js` e de `/cart.js` com os dígitos
que o próprio `| money` imprime na página. A exceção é `/search/suggest.json`,
que responde em unidades da moeda, como **string** (`"179.90"`): quem conhece
essa diferença é `moneyToCents()`, no mesmo arquivo, e o mesmo spec a mede. O
tipo é o discriminador, e não o valor — nenhuma inspeção do número separa 17990
centavos de 17990 unidades, e foi essa ambiguidade que produziu o bug original.

**A fronteira `money-format` fica declarada** em
`scripts/lint/config/boundaries.json`, com `assets/money.js` como dono. É o que
impede o quarto formatador.

## Consequências

**Ganhamos** — o preço escrito por JS acompanha o seletor de moeda do rodapé,
como o Liquid sempre acompanhou. A divergência do `/100` passa a ter uma
resposta medida em vez de três opiniões. O quarto formatador reprova no
`npm run lint`, com uma mensagem que diz onde o código já está. E os testes
deixaram de ser brasileiros: `tests/money.test.mjs` troca de moeda, que é o
único caso capaz de separar "lê a loja" de "crava o Brasil" — com a loja em
BRL, as duas implementações imprimem `R$ 19,99`.

**Pagamos** — mais um `<script defer>` global no `layout/theme.liquid`.
`money.js` precisa carregar antes de `cart.js` (que vem do snippet
`cart-drawer`, na linha 51) e da busca preditiva, então co-locar não era opção:
ele fica no `<head>`, e a ordem do `defer` é o que garante a precedência. São
~2 KB que entram no teto de `npm run lint -- --rules=budget`, e o teto não
subiu — por isso o arquivo é curto e o "porquê" longo mora aqui, e não nele.

Também pagamos uma dependência global a mais entre scripts clássicos. Ela já
existia (`price-component.js` chamava a `formatPrice` de `cart.js` — o
componente de PREÇO dependia do arquivo do CARRINHO), e agora aponta para o
lugar certo; mas continua sendo acoplamento por variável global, que só existe
porque os assets do tema não são módulos ES.

## Referências

- Issue [#39](https://github.com/cleytonmendest/elizabeth/issues/39) — três formatadores, nenhum respeita a moeda da loja
- Issue [#25](https://github.com/cleytonmendest/elizabeth/issues/25) — o tema não escreve em qual país ele está (regra `mercado`)
- `assets/money.js`, `tests/money.test.mjs`, `e2e/moeda.spec.mjs`
- `scripts/lint/config/boundaries.json` (capacidade `money-format`), `tests/boundaries.test.mjs`
- [ADR 0007](0007-suite-de-navegador-contra-tema-empurrado.md) — por que a suíte de navegador mede um tema empurrado
