# 4. Um toggle é decisão de negócio, não preferência de layout

- **Status:** Aceito
- **Data:** 2026-08-29

## Contexto

[ADR 0003](0003-tres-niveis-de-customizacao.md) resolveu *onde* um setting pode
viver, mas não *se ele deve existir*. Ficou uma pergunta aberta que o tema vinha
respondendo por hábito: quando uma funcionalidade ganha um checkbox
`enable_x` / `show_x` e quando ela simplesmente existe?

O estado medido antes desta decisão, com o critério que cada um implicava:

| Funcionalidade | Toggle? | O que a resposta dependia |
| --- | --- | --- |
| `show_installments` | sim | o gateway do lojista parcela ou não |
| `cart_free_shipping_enabled` | sim | a loja oferece frete grátis ou não |
| `cart_notes` | sim | o lojista lê observação de pedido ou não |
| `enable_cookie_banner` | sim | a jurisdição exige, ou já tem um app de LGPD |
| `cookie_show_decline` | sim | mesma coisa |
| `show_back_to_top` | sim | — nada; é preferência de layout |
| Busca preditiva | não | — |
| Cart drawer | não | — |
| Barra fixa de comprar | **três toggles, nenhum lido** | — |

Os cinco primeiros seguem um critério coerente: só existem porque a resposta
certa **depende de um fato sobre a loja** que o tema não tem como saber. Os três
últimos não seguiam critério nenhum.

A barra fixa de comprar era o caso extremo. O bloco `buy_button` declarava
`floating_button`, `show_product_name` e `show_product_price` em duas sections
(`main-product` e `highlighted-product`), todos com `default: true` — e o
markup não lia nenhum dos três. Pior: `highlighted-product` declarava os três
sem nem renderizar a barra. Desligar `floating_button` no admin não desligava
nada; a barra continuava aparecendo com nome e preço. Foi a regra `settings`
(escopo de section) que tornou isso visível.

Ao mesmo tempo a barra só existia no mobile (`lg:hidden`), sem que nada no
código explicasse por quê — provavelmente porque a coluna direita da PDP já é
`lg:sticky`, o que cobre a leitura do produto mas não o resto da página.

## Decisão

**Uma funcionalidade só ganha toggle quando a resposta certa depende de um fato
sobre a loja que o tema não pode descobrir.** Fato sobre a loja é: o que o
gateway suporta, o que a lei exige, o que a operação do lojista faz. Não é
gosto, e não é layout.

As três perguntas, na ordem:

1. **Existe loja em que ligar isto está errado?** Não → sem toggle.
2. **O que decide é um fato sobre a loja, e não gosto?** Não → sem toggle; é o
   desenvolvedor que tem que acertar o layout.
3. **O lojista consegue responder sem abrir o código?** Não → sem toggle; o
   rótulo seria adivinhação.

Aplicando à barra fixa de comprar: ela sobe quando o botão principal sai da
tela e some quando ele volta. Não existe loja em que isso esteja errado, o que
decide não é fato nenhum, e "exibir nome do produto?" não é uma pergunta que o
lojista tenha como responder. Então: **a barra é infraestrutura de conversão,
não é opção.** Os três settings foram removidos, e a barra passa a valer em
desktop e mobile.

`show_back_to_top` falha o mesmo teste e continua existindo — remover um setting
que o lojista pode ter desligado quebra loja em produção. Fica como dívida
registrada, não como precedente.

### Alternativas descartadas

**Ligar os três settings no markup.** Era o caminho mais curto e teria deixado o
linter verde. Mas transformaria em contrato público uma pergunta que não tem
resposta certa: nenhum lojista sabe se deve esconder o nome do produto numa
barra de 360px. Isso é problema de layout, e a resposta é `truncate`, não um
checkbox.

**Manter só `floating_button` e remover os dois de conteúdo.** Metade do
problema. Um lojista que desligasse a barra estaria desligando o mecanismo que
mais recupera compra na PDP, sem nenhum fato sobre a loja dele que justificasse.

**Escrever isto no `CLAUDE.md` em vez de um ADR.** O `CLAUDE.md` responde *como
fazer*, e apodrece quando vira histórico. Isto aqui é o *porquê* de três
settings terem sumido de um bloco público — exatamente o que alguém vai
questionar em seis meses.

## Consequências

**Ganhamos** — um critério que decide sozinho, sem reunião, se a próxima
funcionalidade nasce com checkbox. E três settings a menos que mentiam para o
lojista.

**Pagamos** — remover setting de bloco é mudança pública: uma loja que já tinha
`floating_button: false` guardado no template passa a ver a barra. Como o valor
nunca foi lido, ela já via — o que muda é a expectativa de quem clicou naquele
checkbox. E a barra em desktop é comportamento novo numa PDP que já tem coluna
`lg:sticky`; os dois mecanismos são complementares (a coluna cobre a leitura do
produto, a barra cobre o resto da página), mas a transição entre eles precisa de
conferência visual, que nenhum linter faz.

**Não ganhamos um linter.** "Este toggle depende de um fato sobre a loja?" não é
decidível por máquina — nenhuma das três perguntas acima pode ser respondida
lendo JSON. O que a máquina cobra é a metade verificável: a regra `settings`
reprova setting declarado e não lido, que é o sintoma que denunciou este caso.
O critério em si fica aqui, em prosa, e é revisão humana (`theme-reviewer`) que
o aplica.

## Referências

- `snippets/sticky-add-to-cart.liquid`, `assets/sticky-atc.js`
- `sections/main-product.liquid`, `sections/highlighted-product.liquid`
- `scripts/lint/rules/settings.mjs` — a regra que tornou os três visíveis
- [ADR 0003](0003-tres-niveis-de-customizacao.md) — onde um setting pode viver
