# Architecture Decision Records

Registro das decisões estruturais do tema — o **porquê**, que o código não conta.

## A regra que faz isto funcionar

**ADR não se edita.** Uma vez aceito, o texto congela. Se a decisão mudar,
escreve-se um ADR novo que marca o anterior como `Substituído por NNNN`.

É isso que diferencia um ADR de um documento de estado: não existe "esqueci de
atualizar", porque não há nada para atualizar. Um ADR desatualizado ainda é um
registro correto do que se pensava naquele momento — que é exatamente o valor
que ele entrega.

## O que vira ADR

Decisão que alguém vai questionar em seis meses e cuja resposta não está óbvia
no código:

- por que os tokens de cor vêm do color scheme e não de hex
- por que o tema não tem jQuery
- por que o Swiper é carregado assim
- por que existe um baseline de dívida em vez de correção em massa

## O que NÃO vira ADR

- **Estado atual** → `npm run status` (medido, não afirmado)
- **Tarefas e prioridades** → GitHub Issues
- **Como fazer algo** → `CLAUDE.md` ou o próprio código
- Escolha reversível em cinco minutos

## Como criar

```bash
cp docs/adr/TEMPLATE.md docs/adr/000N-titulo-em-kebab-case.md
```

Numeração sequencial, nunca reutilizada.

## Índice

| # | Decisão | Status |
| --- | --- | --- |
| [0001](0001-guard-rails-executaveis-no-lugar-do-roadmap.md) | Guard rails executáveis no lugar do ROADMAP | Aceito |
| [0002](0002-taxonomia-de-labels-em-tres-eixos.md) | Taxonomia de labels em três eixos | Aceito |
| [0003](0003-tres-niveis-de-customizacao.md) | Três níveis de customização | Aceito |
| [0004](0004-o-que-ganha-um-toggle.md) | Um toggle é decisão de negócio, não preferência de layout | Aceito |
