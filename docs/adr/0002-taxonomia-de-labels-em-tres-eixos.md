# 2. Taxonomia de labels em três eixos

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

O repositório acumulou duas taxonomias de label sem que nenhuma fosse decidida.

A primeira, de 2025, misturava natureza e lugar num eixo só: `enhancement`,
`bug`, `front-end`, `general`, `pdp`, `plp`, `header`, `footer`, `blog`. A
segunda nasceu em 2026-08-28 junto com os guard rails: `bug`, `feature`,
`debt`, `theme-store-blocker`, `design-system`, `guard-rail`, `performance`,
`docs`, `security`.

Duas convenções para a mesma coisa é a divergência que o
[ADR 0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md) removeu do
ROADMAP, reaparecendo no backlog. Um filtro por `bug` devolvia resultado
diferente conforme a época em que a issue foi aberta.

Três labels não separavam nada:

- `front-end` — o repositório inteiro é front-end; não existe issue que não seja
- `general` — significa "não soube classificar"
- `enhancement` — sinônimo de `feature`

E um eixo faltava: nada dizia **por que uma issue importa agora**. Bloquear a
submissão à Theme Store, quebrar acessibilidade e pesar na performance são
razões de urgência independentes do tipo e da área.

## Decisão

Três eixos ortogonais. Uma issue recebe **exatamente um** label de tipo, e
quantos precisar dos outros dois.

**Tipo** — a natureza do trabalho:

| Label | Quando |
| --- | --- |
| `bug` | Existe e não funciona como deveria |
| `feature` | Não existe |
| `debt` | Funciona, mas o código está errado — em geral registrado no baseline dos linters |
| `docs` | Documentação |

**Área** — onde no tema:

`pdp` · `plp` · `cart` · `header` · `footer` · `blog` · `customer` ·
`design-system` · `tooling`

`tooling` cobre o que não é o tema publicado: linters, CI, testes, hooks.

**Portão** — por que importa agora:

`theme-store-blocker` · `a11y` · `i18n` · `performance` · `security`

Removidos: `front-end`, `general`, `enhancement`, `guard-rail`. Os três
primeiros por não separarem nada; `guard-rail` porque descrevia uma área e
virou `tooling`.

Os três templates em `.github/ISSUE_TEMPLATE/` já aplicam o eixo de tipo
automaticamente, então uma issue aberta pelo formulário nunca nasce sem
classificação.

### Alternativas descartadas

**Um eixo só, mais granular.** Foi o que existia. Falha porque a mesma issue
precisa ser encontrada por três perguntas diferentes ("o que é um bug?", "o que
mexe na PDP?", "o que trava a submissão?") e um eixo só responde uma.

**Prioridade numérica (`P0`-`P3`).** Prioridade é relativa e muda; um label de
prioridade precisa ser revisado periodicamente ou mente — é a categoria de
artefato que este projeto já decidiu não manter à mão. `theme-store-blocker`
não tem esse problema: é um fato sobre o requisito, não uma opinião sobre a
ordem.

## Consequências

**Ganhamos**

- Um filtro devolve a mesma coisa independentemente de quando a issue foi
  aberta.
- `is:open label:theme-store-blocker` responde "o que falta para submeter" sem
  ninguém manter uma lista.
- Issue aberta pelo formulário nasce classificada.

**Pagamos**

- Um eixo de tipo com quatro valores obriga a escolher em casos mistos. A
  #19 é o exemplo: contém uma feature (wishlist) e um defeito de
  acessibilidade já em produção. Ficou como `bug` porque a parte acionável
  agora é o defeito — mas o certo teria sido dividir em duas issues. Quando o
  tipo for ambíguo, isso costuma indicar que a issue tem dois donos e deveria
  ser dividida.
- A taxonomia é convenção, não código: nada impede alguém de criar um label
  novo pela UI. É prosa, e prosa apodrece — por isso o eixo de tipo foi
  embutido nos templates, que é a parte automatizável.

## Referências

- `.github/ISSUE_TEMPLATE/` — os formulários que aplicam o eixo de tipo
- ADR 0001 — a decisão que moveu o backlog para as Issues
