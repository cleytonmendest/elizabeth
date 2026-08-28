# 1. Guard rails executáveis no lugar do ROADMAP

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

O projeto mantinha `docs/ROADMAP.md` como fonte da verdade para prioridades,
estado de conformidade e histórico. O `CLAUDE.md` obrigava a lê-lo antes de
cada implementação e atualizá-lo depois.

Na prática o documento ficou desatualizado, e de um jeito específico: as
correções eram feitas, registradas como concluídas, e **reapareciam em arquivos
que ninguém tinha varrido**. Dois exemplos medidos:

- O ROADMAP registra "sections com `color_scheme` devem pintar o fundo —
  corrigido em footer/blog/artigo". O mesmo defeito seguia em `main-product`,
  `main-collection`, `section-images-link`, `slider-cards`, `slider-image` e
  `video` — incluindo as duas páginas mais importantes da loja.
- O requisito de i18n era descrito como "essencialmente completo". As 88
  settings globais de `config/settings_schema.json`, a página de Contato e o
  template de Página seguiam sem nenhuma tradução.

A causa não é falta de disciplina de quem escreve nem da IA que ajuda. É que o
ROADMAP é **prosa mantida à mão fazendo o trabalho de estado-da-verdade**. Todo
artefato dessa categoria diverge do código; a única questão é em quanto tempo.

Havia ainda uma dependência estrutural indesejada: o processo pressupunha que um
agente de IA leria e atualizaria o documento a cada tarefa. Isso é frágil por
construção — depende de comportamento não verificável, a cada execução, para
sempre.

## Decisão

Separar os três papéis que o ROADMAP acumulava, cada um no artefato cuja
natureza impede que ele apodreça:

| Papel | Vira | Por que não apodrece |
| --- | --- | --- |
| Estado de conformidade | `npm run status`, medido pelos linters | É output de código, não afirmação |
| Backlog e prioridades | GitHub Issues + Projects | O merge do PR fecha a issue sozinho |
| Decisões e justificativas | ADRs (este diretório) | São append-only: nunca se editam, só se supersedem |

`docs/ROADMAP.md` é removido.

As regras que antes eram prosa normativa no `CLAUDE.md` viram linters em
`scripts/lint/rules/`, executados em três pontos com autoridade crescente:

1. **Hook de edição** (`.claude/settings.json`) — depois de cada Edit/Write num
   arquivo do tema, devolve o erro imediatamente ao agente.
2. **`pre-commit`** (`.githooks/`) — gate rápido local; pode ser pulado.
3. **GitHub Actions** — autoridade final; não pode ser pulado.

O `CLAUDE.md` passa a conter apenas o que **não** dá para automatizar.

### A catraca

A dívida existente é registrada em `scripts/lint/config/baseline.json` (505
itens na criação). Violação registrada sai como aviso; violação nova é erro e
quebra o build. O CI verifica que o total do baseline nunca cresce.

Descartamos a alternativa de bloquear todo o débito de um arquivo assim que
alguém o toca: criaria o incentivo de não mexer no arquivo. O hook mostra a
dívida do arquivo tocado como nota informativa, e o número global só pode cair.

## Consequências

**Ganhamos**

- Nenhuma regra do tema depende mais de alguém — humano ou IA — lembrar dela.
- A dívida técnica passa a ser um número que se acompanha, não uma seção de
  documento.
- Contribuição por IA fica mais segura: o harness verifica o resultado a cada
  edição, em vez de confiar que as instruções foram seguidas.
- Três defeitos reais apareceram na primeira execução dos linters: a section
  `apps` referenciada sem existir, `--color-card-background` consumida sem
  nunca ser gerada, e as 7 sections com color scheme mal aplicado.

**Pagamos**

- Um linter novo é código novo: pode ter bug e falso positivo. Mitigação: toda
  exceção exige justificativa escrita, o que mantém a pressão sobre a qualidade
  da regra em vez de sobre o silenciamento dela.
- O histórico narrativo do ROADMAP (o que foi feito em cada versão) sai do
  repositório e passa a viver nas releases e no log do git.
- Perde-se a leitura de "tudo em um arquivo". Em troca, cada pedaço fica onde é
  verificável.

## Referências

- `scripts/lint/index.mjs` — runner e mecânica da catraca
- `scripts/status.mjs` — painel de conformidade gerado
- ADR 0002 — escalas do design system
