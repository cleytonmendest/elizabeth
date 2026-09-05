# 8. O tema não calcula dinheiro que o checkout não produz

- **Status:** Aceito
- **Data:** 2026-09-05

## Contexto

O tema exibia "Em até 10x de R$ X" em toda prateleira e na PDP. O número saía de
duas configurações globais — `max_installments` e `min_value_installment` — e era
calculado três vezes: em `snippets/price-v2.liquid`, em
`snippets/card-product-slider.liquid` e de novo em `assets/price-component.js`,
que repintava a linha na troca de variante.

O número estava errado de três formas independentes, e nenhuma delas era um bug
a corrigir:

1. **Não havia controle por produto.** Os dois settings eram globais. O tema lê
   metafields para outras coisas (`custom.badge`, `custom.gtin`), mas não havia
   nenhum para parcelamento. Um produto que não parcela exibia parcelamento, e o
   único jeito de calar era o toggle global, que apagava a informação da loja
   inteira.

2. **A conta era sobre o preço do produto, não sobre o pedido.** O divisor era
   `target.price` / `card_product.price` — um item. Parcelamento incide sobre o
   total. Para qualquer carrinho com mais de um item o número da prateleira já
   nascia errado; não por defeito, mas porque era isso que a fórmula calculava.

3. **O tema não tinha como acertar.** O primitivo oficial da Shopify é
   `{{ form | payment_terms }}`, que renderiza os termos vindos do provedor de
   pagamento — nunca esteve no tema, e não atenderia: Shop Pay Installments não
   opera no BR. Aqui os termos vêm do gateway (Mercado Pago, Appmax, Pagar.me) e
   dependem de bandeira, emissor, total do pedido, antifraude e promoção
   vigente. Nada disso é acessível pelo Liquid.

O schema já admitia o problema no próprio rótulo: o grupo se chamava
`"Parcelamento (somente visual)"`.

O custo de manter era medível. As issues #48 e #79 existiam só por causa desta
feature. `tests/price-component.test.mjs` tinha dois `describe` — quinze testes —
cujo alvo era garantir que o servidor e o JS produzissem o **mesmo** número, mais
três mutantes em `scripts/test-mutants.mjs` sustentando essa concordância. Nenhum
verificava que o número era verdadeiro. Eles verificavam que as duas cópias
erravam igual. E `product.installments.interest_free` (`"sem juros"`) estava nos
dois locales sem uso: no dia em que alguém a plugasse, o tema passaria a fazer
uma afirmação financeira que a loja não controla, e publicidade vincula o
fornecedor (CDC art. 30).

## Decisão

**O tema não calcula valores monetários que o checkout não produz.** Ele exibe o
que a Shopify já lhe deu — `price`, `compare_at_price`, os totais do carrinho — e
não deriva nenhum outro número em dinheiro a partir de configuração do lojista.

O cálculo de parcelamento foi removido dos três lugares, junto dos três settings
globais, dos quatro settings de section que o repassavam, das chaves de locale e
dos testes e mutantes que o sustentavam.

A informação de parcelamento continua possível, e por um caminho que já existia
no tema antes desta decisão: o bloco `payment_icons` da PDP expõe
`show_installment_text` + `installment_text` (`snippets/payment-icons.liquid`) —
texto livre que a lojista escreve com o que o gateway dela realmente faz. Sem
cálculo, sem número derivado, e nas palavras dela. Quem quiser termos reais e
por produto instala o app do gateway, que entrega app block de OS 2.0 para a
PDP: o trabalho do tema é deixar o espaço, não adivinhar o número.

**Alternativa considerada e descartada:** manter a exibição com
`show_installments` em `default: false` e um metafield de kill switch por produto
(`custom.no_installments`). Resolve o item 1 e não toca nos itens 2 e 3 — mais
código para sustentar um número que continua sendo palpite.

## Consequências

**Ganhamos** — o tema deixa de afirmar uma condição de pagamento que não pode
verificar. Somem duas issues (#48, #79), quinze testes, três mutantes e três
cópias da mesma fórmula. A superfície de erro que restava — dois números globais
aplicados a um catálogo heterogêneo — deixa de existir, e com ela a classe de bug
que a produzia.

**Pagamos** — parcelamento na prateleira é argumento de conversão forte no varejo
brasileiro, e todo tema concorrente tem. A lojista que quiser a informação
precisa escrevê-la no bloco `payment_icons` (uma frase, uma vez) ou instalar o
app do gateway; nenhuma das duas mostra o valor da parcela por produto na
listagem. É uma perda real de vitrine, aceita porque a alternativa era exibir um
número que a loja não honra no checkout.

E fica uma lacuna de verificação: nenhum linter pega a reincidência. Os linters
verificam estrutura — o token existe, a chave existe, o asset existe. "Este
número não corresponde a nada no mundo" é estrutura *certa* sobre um dado que o
tema não possui. O guard rail possível é grepável (reprovar `divided_by` aplicado
a `price` fora dos snippets de desconto) e vale abrir com label `guard-rail`
depois desta remoção — antes dela, a regra reprovaria o próprio código que existe
para impedir.

## Referências

- Issue #80 — o diagnóstico e os critérios de aceite desta remoção
- Issues #48 e #79 — os dois bugs que só existiam por causa da feature
- `snippets/payment-icons.liquid` — o texto livre que fica no lugar
- [ADR 0003](0003-tres-niveis-de-customizacao.md) — o lojista controla o valor, o
  tema controla onde ele se aplica; aqui o valor não era do lojista nem do tema
