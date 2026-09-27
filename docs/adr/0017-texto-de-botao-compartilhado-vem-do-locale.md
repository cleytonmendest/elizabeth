# 17. Texto de botão que aparece em vários lugares vem do locale, não de um setting

- **Status:** Aceito
- **Data:** 2026-09-27

## Contexto

O mesmo botão, "Adicionar ao carrinho", aparece em três lugares, e cada um
tinha uma fonte de texto diferente:

| Onde | Arquivo | Texto vinha de |
| --- | --- | --- |
| PDP e Produto Destaque | `snippets/add-to-cart.liquid` | campo `button_text` do bloco de compra; vazio, `product.general.add_to_cart` |
| Barra fixa | `snippets/sticky-add-to-cart.liquid` | `product.general.add_to_cart` |
| Card de prateleira | `snippets/card-quick-add.liquid` | `product.general.add_to_cart_short` |

O campo existia só no bloco da PDP. A lojista que escrevia "COMPRAR" ali via
"COMPRAR" na PDP e "Adicionar" no card, com o mesmo botão dizendo duas coisas.
O pedido que abriu esta decisão foi exatamente esse: mudar o texto uma vez e
valer em toda a loja.

O campo tinha também um problema de idioma. Ele nascia preenchido com o
literal "ADICIONAR AO CARRINHO", e a loja em inglês mostrava o botão em
português. A correção disso (`3f6c504`, modo 6 da regra `i18n`) esvaziou o
campo, mas o campo continuava mudando só um dos três lugares.

A Shopify já tem uma tela para isso: **Loja virtual › Temas › Editar conteúdo
padrão do tema** edita as chaves do locale da loja, por idioma. É o caminho que
o Dawn usa, e ele não tem campo de texto no botão de compra.

## Decisão

**Texto de um controle que aparece em mais de um lugar vem só do locale.** Não
ganha campo em bloco nem em section. A lojista o muda em "Editar conteúdo padrão
do tema", e a mudança chega a todos os lugares que leem a mesma chave, em cada
idioma.

O campo `button_text` saiu dos blocos de compra de `main-product` e
`highlighted-product`, e o botão da PDP lê só `product.general.add_to_cart`.
`tests/form-de-produto.test.mjs` exige que um `button_text` antigo, salvo num
template de antes da mudança, não volte a valer.

**Alternativa descartada: setting global em "Configurações do tema".** Seria
mais fácil de achar, mas tem três custos:

- um texto só para todos os idiomas, que precisa ser traduzido à parte no
  Translate & Adapt;
- um texto escrito para a PDP pode não caber no card;
- o [ADR 0003](0003-tres-niveis-de-customizacao.md) reserva o nível global
  para valores de design, e texto é conteúdo.

## Consequências

**Ganhamos:**
- um lugar só para mudar o texto do botão;
- cada idioma tem o seu texto, sem tradução à parte;
- nada do texto de um botão mora em markup de section.

**Pagamos:**
- a tela "Editar conteúdo padrão do tema" é menos conhecida que o editor, e por
  isso o FAQ da lojista explica o caminho;
- o card continua com a versão curta ("Adicionar"), porque a largura dele não
  comporta a longa. São duas chaves na mesma tela, e para o texto ficar igual
  em toda a loja a lojista muda as duas.

Texto de um controle que existe num lugar só (o botão da 404, o de finalizar
compra do carrinho) continua podendo ter campo, desde que ele nasça vazio. O
campo vazio cai na tradução, e o modo 6 da `i18n` verifica isso.

## Referências

- `snippets/add-to-cart.liquid`, `snippets/sticky-add-to-cart.liquid`,
  `snippets/card-quick-add.liquid`
- `docs/lojista/faq.md` e `docs/merchant/faq.md`: "Como mudo o texto do botão"
- [ADR 0003](0003-tres-niveis-de-customizacao.md): três níveis de customização
- [ADR 0004](0004-o-que-ganha-um-toggle.md): o que ganha um toggle
