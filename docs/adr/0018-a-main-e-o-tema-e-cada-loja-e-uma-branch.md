# 18. A `main` é o tema, e cada loja é uma branch que só puxa dela

- **Status:** Aceito
- **Data:** 2026-09-30

## Contexto

O tema vai ser mostrado em lojas de nichos diferentes, todas montadas com os
mesmos componentes: a de moda que existe hoje, uma de artigos para bebê e
outras depois. O que muda de uma para outra é a ordem da home, os blocos da PDP
e as cores. Nada disso é código.

A Shopify separa as duas coisas, e o repositório também separa, sem dizer:

| | Arquivos |
| --- | --- |
| **Código** | `sections/*.liquid`, `snippets/`, `assets/`, `layout/`, `locales/`, `config/settings_schema.json` |
| **Conteúdo de loja** | `templates/*.json`, `sections/*-group.json`, `config/settings_data.json`, `config/markets.json` |

O conteúdo de loja é o que o editor grava, e é o que a Shopify abre com o
cabeçalho "auto-generated".

Hoje a `main` carrega os dois, e o conteúdo é o da Elizabeth Estudos. Só o
`templates/index.json` aponta 17 imagens (`shopify://shop_images/`), 8 coleções
e 1 produto que existem só naquela loja. O `config/settings_data.json` aponta o
logo e o favicon dela, no `current` e nos quatro presets, além do app embed do
Discounty.

A loja está conectada à `main` pela integração GitHub da Shopify. O commit
`beac89f` é do `shopify[bot]` ("Update from Shopify for theme elizabeth/main"):
a lojista salva no editor, e o bot faz commit na branch conectada. A
documentação da integração diz que esse commit de volta "can't be disabled".

Isso decide o que acontece se uma segunda loja for conectada à `main`. Ela
recebe a home de moda. E o primeiro save no editor dela faz commit na `main`,
por cima da home de moda.

## Decisão

**A `main` é o tema. Cada loja é uma branch `loja/<nome>`, conectada à sua
loja pela integração, e só recebe da `main`.**

- Toda melhoria de código entra na `main`, inclusive a que foi descoberta
  dentro de uma loja.
- Uma `loja/*` só difere da `main` em conteúdo de loja. Nos `locales/*.json`
  ela pode mudar **valor**, não chave. "Editar conteúdo padrão do tema" grava
  ali ([ADR 0017](0017-texto-de-botao-compartilhado-vem-do-locale.md)), e esse
  texto é conteúdo; uma chave nova é código.
- A `main` vira o tema instalado do zero. Ela não aponta nenhum recurso de
  loja (`shopify://`), e a home dela usa todas as sections que podem entrar
  numa home.
- Nenhuma loja fica conectada à `main`.

Nenhuma dessas quatro frases vale por estar escrita. Cada uma vira uma
verificação, na [issue #168](https://github.com/cleytonmendest/elizabeth/issues/168):

- a lista do que é conteúdo de loja mora num lugar só, `CONTEUDO_DA_LOJA` em
  `scripts/lojas.mjs`;
- um diff de `loja/*` fora dessa lista reprova;
- um job leva a `main` para cada `loja/*`, e um conflito em conteúdo fica com
  a versão da loja;
- todo PR na `main` valida o conteúdo de cada loja contra o código novo;
- um commit do `shopify[bot]` na `main` reprova.

A validação do PR precisa de um verificador novo, e isso foi medido antes de
ser escrito. Com o `templates/product.json` apontando um bloco que não existe e
um setting que não existe, `npm run lint -- --rules=themecheck,refs,templates`
sai limpo. Hoje só uma section inexistente reprova (pela `refs` e pelo
`JSONMissingSection` do Theme Check). Renomear um setting e remover um bloco,
que são as duas quebras mais prováveis, passam.

### Alternativas descartadas

**Um repositório por loja.** Um defeito achado na loja de bebê seria corrigido
no repositório dela, e a loja de moda não receberia a correção. É o problema
que motivou esta decisão.

**Uma pasta por loja na `main` (`lojas/bebe/`), montada por script antes do
push.** Foi a primeira proposta. Ela pega a quebra antes do merge lendo o
disco, sem precisar buscar outras branches. Em troca, perde a integração: a
integração sincroniza a branch do jeito que ela está, sem passo de montagem.
A loja teria de ser enviada pelo CLI, e o que a lojista salva no editor só
voltaria por um `theme pull` manual. O conteúdo que mais muda seria justamente
o único que depende de alguém lembrar.

**Presets.** Os quatro presets de `config/settings_data.json` trocam cor,
fonte e logo. A ordem das seções é a mesma nos quatro
([`docs/THEME_STORE_SUBMISSION.md`](../THEME_STORE_SUBMISSION.md) §4,
[issue #114](https://github.com/cleytonmendest/elizabeth/issues/114)), e o
layout é justamente o que precisa mudar entre as lojas.

**Uma branch por loja sem verificação.** É esta decisão sem a parte que a faz
funcionar. Uma regra como "a correção vai na `main`" escrita em prosa é do
tipo que este repositório já viu ser quebrada
([ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md)).

## Consequências

**Ganhamos**

- Quantas lojas se quiser. O editor de cada uma sincroniza sem script, porque
  o bot já faz commit na branch dela.
- Uma correção feita uma vez chega a todas as lojas.
- A `main` passa a ser o que a Theme Store recebe e o que uma lojista instala:
  um tema sem recurso de outra loja.
- O `e2e/a11y.spec.mjs` mede `/`. Com a home da `main` usando todas as
  sections, ele passa a medir todos os componentes, e não só os oito tipos da
  home de moda.

**Pagamos**

- A quebra de uma loja por uma mudança na `main` só é pega se a busca pelas
  `loja/*` funcionar dentro do PR. Com pastas, bastaria ler o disco.
- Uma section nova chega a todas as lojas, mas colocá-la na página é decisão
  de cada uma, no editor. Uma mudança no JSON padrão da `main`, como um bloco
  novo na PDP, não chega às lojas que já existem. Isso é de propósito, e custa
  trabalho repetido em cada loja.
- O job de merge pode empurrar para uma `loja/*` no mesmo instante em que a
  lojista salva no editor. A doc da integração diz que, nesse caso, o commit do
  bot pode ser recusado, e o remédio é "Reset to last commit" no card do tema.
  É raro, mas o conserto é manual.
- O preview de PR (`preview.yml`) e a suíte de navegador passam a mostrar a
  home neutra, e não a loja de moda. Ver uma mudança dentro de uma loja
  específica fica para depois.
- A migração é manual e tem ordem. A `loja/moda` precisa estar conectada e
  publicada **antes** de a `main` perder o conteúdo de moda. Na ordem inversa,
  a loja no ar passa a mostrar a home neutra.
- A home neutra pode revelar uma violação de a11y antiga, numa section que a
  home de moda não usa. A catraca não libera crescimento por mudança de
  template, então a correção vem no mesmo PR.

## Referências

- [Issue #168](https://github.com/cleytonmendest/elizabeth/issues/168):
  as verificações, a migração e a ordem entre elas
- Commit `beac89f`: o `shopify[bot]` fazendo commit na `main`
- [Shopify GitHub integration for themes](https://shopify.dev/docs/storefronts/themes/tools/github)
  e [Version control for Shopify themes](https://shopify.dev/docs/storefronts/themes/best-practices/version-control)
- [ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md): regra em
  prosa vira verificação
- [ADR 0007](0007-suite-de-navegador-contra-tema-empurrado.md): a suíte de
  navegador mede o tema empurrado
- [ADR 0017](0017-texto-de-botao-compartilhado-vem-do-locale.md): o texto do
  botão vem do locale
- `docs/THEME_STORE_SUBMISSION.md` §4 e
  [issue #114](https://github.com/cleytonmendest/elizabeth/issues/114): os
  presets não mudam o layout
