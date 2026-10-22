# 20. O conteúdo que o tema entrega é escrito em inglês

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto

O tema tem dois tipos de texto, e eles seguem regras diferentes:

| Tipo | Onde mora | Idioma |
| --- | --- | --- |
| **Interface** | `locales/*.json` e `locales/*.schema.json`, lido por `{{ '…' \| t }}` e `t:` | um por idioma; pt-BR e en.default em paridade |
| **Conteúdo** | `templates/*.json`, `sections/*-group.json`, `default` de setting e `presets` nos schemas, `default` em `config/settings_schema.json` | um só: o que está escrito no arquivo |

Texto de conteúdo é **valor de setting**, e valor de setting não troca com o
idioma da loja. Não há chave de locale por trás dele.

Até 2026-10-22 esse conteúdo estava em português, com uma única exceção: o texto
padrão da barra de anúncio ("Up to 12x interest-free!"). O levantamento daquele
dia achou 247 textos em português fora do locale. Desses, 143 são conteúdo: 63
gravados em templates e grupos, 32 `default` e 42 `presets` nos schemas, 6
`default` globais (frete grátis e banner de cookies); o resto é a página de
styleguide e mensagens de console. O locale padrão do tema é `en.default`, então
uma loja em inglês exibia o banner de cookies, a barra de frete grátis, o
rodapé e a home inteira em português.

A exceção em inglês foi tratada como inconsistência e "corrigida" para português
(`3c8901b`). Estava certa, e foi revertida na rodada seguinte. Sem uma decisão
escrita, a próxima pessoa a ver um texto em inglês isolado faria o mesmo.

## Decisão

**Todo texto de conteúdo que o tema entrega é escrito em inglês.** A lojista o
reescreve na língua dela no editor; é para isso que ele é conteúdo.

- O texto de interface continua nos locales, em pt-BR e en.default, sem mudança.
- **Nomes próprios ficam como são:** nomes e cidades dos depoimentos de exemplo,
  "Pix" e "boleto bancário".
- **`{valor}` fica.** É o token que `snippets/cart-free-shipping.liquid` e
  `src/js/cart-extras.js` substituem pelo valor restante, e o `info` do setting
  já o cita nos dois idiomas. Renomeá-lo quebraria o texto salvo em qualquer loja.
- **Os IDs de bloco ficam** (`text_boas_vindas`, `links_rodape`, `collapsible_entrega`):
  não são texto, e a loja os referencia em `block_order`.
- **Nomes de preset de estilo ficam** (`Rosé`, `Botânico`): são nome de produto, e docs,
  issue template e mutantes os citam.

**Alternativas descartadas**

- *Português como padrão.* É o que havia. A loja em inglês mostra português em
  tudo que a lojista ainda não reescreveu; o cabeçalho de `jsstrings.mjs` já
  registra que português numa loja em inglês é reprovação direta na Theme Store.
- *Conteúdo por idioma, via locale.* A Shopify não traduz valor de setting; seria
  preciso Translate & Adapt, loja a loja, e o `default` de um setting não tem
  como apontar para uma chave.
- *Um detector de idioma como gate.* O `jsstrings` mediu esse caminho: nenhum
  teste de idioma separa `'ESGOTADO'` de `'beforeend'`. Nome próprio em português
  ("São Paulo, SP") reprovaria o gate a cada rodada.

## Consequências

**Ganhamos:**
- uma loja em inglês não exibe mais português que ela não escreveu;
- uma regra só para onde cada idioma mora, e a razão escrita.

**Pagamos:**
- **A loja conectada recebe o conteúdo em inglês no deploy.** Enquanto não existir
  `loja/*`, a `main` é a loja conectada ([ADR 0018](0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md)):
  home, rodapé e barra de anúncio passam a vir em inglês, e frete grátis e banner
  de cookies também onde a loja nunca salvou um valor. A lojista reescreve no editor.
- **Nada verifica o idioma.** É decisão, não linter, pelo motivo da terceira
  alternativa. Se um texto em português aparecer em conteúdo, o conserto é esta
  decisão, não uma exceção.
- **O texto continua falando do Brasil** ("R$ 299", "Delivery across Brazil", Pix).
  A tradução foi fiel ao que estava escrito; não reescrevi a oferta.

## Referências

- [ADR 0003](0003-tres-niveis-de-customizacao.md): texto é conteúdo, e onde cada setting pode viver.
- [ADR 0017](0017-texto-de-botao-compartilhado-vem-do-locale.md): o que vem do locale e o que é conteúdo.
- [ADR 0018](0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md): a `main` é o conteúdo do tema instalado do zero.
- `scripts/lint/rules/i18n.mjs`: o que a regra verifica (e o que, de propósito, não).

## Nota (2026-10-22): o que este ADR alcança de fato

A seção Consequências diz que, sem `loja/*`, a `main` é a loja conectada e que
ela recebe o conteúdo em inglês no deploy. Isso estava errado. Já existiam
`loja/elizabeth` (o tema publicado) e `loja/livia`, e o `propagar` as atualizou
minutos depois do merge.

Pelo [ADR 0019](0019-o-conteudo-que-a-loja-tem-e-dela.md), o conteúdo que a loja
já tem (`templates/*.json`, grupos de seção) é dela e não muda com a `main`. O
que chegou às lojas foi o código e o que não é conteúdo salvo: os 6 `default`
globais (barra de frete grátis e banner de cookies), que passaram a valer em
inglês onde a loja não salvou valor. Nenhuma das duas salvou.

**Pagamos, além do que está acima:** uma loja com conteúdo em português e
defaults em inglês mistura os dois idiomas até o conteúdo dela ser reescrito. O
conteúdo em inglês da `main` só chega a uma loja quando o conteúdo dela muda —
pela lojista, no editor, ou por PR para a `loja/*`.
