# 16. O tema não exibe urgência que não acaba

- **Status:** Aceito
- **Data:** 2026-09-26

## Contexto

A section `countdown-timer` tinha dois modos, escolhidos em `countdown_type`:

- **`fixed`** contava até uma data e, ao zerar, escondia a seção.
- **`daily`** contava até um horário e, ao zerar, **recomeçava para o dia
  seguinte** (`nextDaily()`, `if (target <= now) target += 86400000;`). Um
  teste travava esse comportamento — "ao zerar, reinicia para o dia seguinte
  em vez de esconder a seção" — e um mutante sustentava o teste.

Os requisitos da Theme Store proíbem exatamente o segundo, na seção
"Consistency and functionality"
([requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)):

> Themes must not mislead or deceive merchants or customers with false data or
> claims. Examples include fake urgency and scarcity tactics like **fictitious
> countdown timers**, stock levels, or viewer activity counts.

A intenção do modo diário era legítima: o comentário do próprio teste citava
"peça até as 14h e enviamos hoje". Um corte de expedição é um prazo real — ele
acaba todo dia e volta no seguinte, e é verdade nos dois momentos. O defeito
estava no que o tema entregava junto com ele: o preset vinha com
`"Oferta por tempo limitado"` e `"A coleção acaba em breve"` sem distinguir o
modo, e o texto de ajuda dizia só "Diária: reseta todos os dias no horário
escolhido". Adicionar a section, trocar para "Diária" e publicar produzia
literalmente o que a regra descreve. O revisor avalia a funcionalidade, não a
intenção.

Nenhum verificador teria pegado, e não por serem fracos: eles mediam se o
contador **funciona**, e ele funcionava. Faltava a pergunta sobre o que ele
**afirma**.

## Decisão

**Todo contador que o tema exibe termina num instante que a lojista escolheu, e
ao zerar sai da página.** Nenhum relógio do tema recomeça.

Aplicando (issue #146):

- `countdown_type` saiu do schema inteiro, com suas quatro chaves de tradução.
  Um `select` de uma opção só é ruído no editor, e manter o id seria deixar a
  porta aberta para o modo voltar como "mais uma opção", sem decisão.
- `nextDaily()` e o ramo de reinício saíram de `src/js/countdown-timer.js`. O
  componente não lê mais `data-mode`.
- "Ao zerar, esconde a seção" virou um `it.each` sobre as configurações que o
  componente aceita — com e sem dias, fuso a leste, sem offset e a marcação
  antiga que ainda dizia `daily` — e um mutante recoloca o reinício (alvo
  + 24h em vez de esconder) e precisa morrer.

**Alternativa considerada e descartada:** manter o modo e reenquadrá-lo como
"horário de corte de envio" — opção renomeada, preset próprio ("Peça até as
14h e enviamos hoje"), texto de oferta proibido nesse modo. É defensável, mas
continua sendo um relógio que recomeça todo dia numa section de marketing
cujos textos são livres: o tema não consegue impedir que a lojista escreva
"Oferta por tempo limitado" ao lado dele. O risco de reprovação não zera, e a
submissão passaria a depender de um revisor aceitar uma justificativa.

**Como o corte de envio pode voltar:** só por uma decisão nova, num ADR que
cite este, e não como opção desta section. O formato que teria semântica
inequívoca é um bloco de prazo de envio na PDP, em que a frase é do tema (chave
de locale) e não um campo livre; em que o horário é um fato operacional da loja
— o corte da expedição — e não um prazo de oferta; e que diz o que acontece ao
zerar ("enviamos no próximo dia útil") em vez de simular uma oferta nova. Esse
bloco precisaria saber de fim de semana: um corte diário que promete "enviamos
hoje" num domingo sem expedição é dado falso também.

É a mesma família da [ADR 0008](0008-o-tema-nao-calcula-dinheiro-que-o-checkout-nao-produz.md):
lá, o tema deixou de exibir um número em dinheiro que o checkout não produz;
aqui, deixa de exibir uma urgência que a loja não tem. Nos dois casos a
funcionalidade removida tinha uso legítimo, e nos dois o tema não tinha como
garantir que a afirmação que ela fazia fosse verdade.

## Consequências

**Ganhamos** — a section não consegue mais produzir o caso que a Theme Store
descreve, e isso passa a ser verificado: o teste exige que o contador acabe em
toda configuração, e o mutante impede que o reinício volte sem que um teste
fique vermelho. Saem um setting, quatro chaves de tradução, um `describe` e um
método.

**Pagamos** — o uso legítimo vai junto. A loja que queria "peça até as 14h e
enviamos hoje" não tem como fazer isso no tema até existir o bloco descrito
acima; hoje, só com app.

A loja que já tinha salvo "Diária" muda de comportamento em silêncio. O valor
de `countdown_type` passa a ser ignorado, e a section conta até a data que está
nos campos de data — que nunca foram apagados, só ignorados naquele modo. Se
ninguém mexeu neles, são os defaults do schema: um prazo real, que acaba, mas
que a lojista não escolheu. Se a data já passou, a seção some da loja e continua
no editor (com o aviso de ano inválido, se foi o ano que ficou para trás); sem
ano, some da loja do mesmo jeito e também continua no editor. O
tema nunca foi publicado na Theme Store, então o alcance real é a loja de
desenvolvimento — o mesmo raciocínio da [ADR 0012](0012-rede-social-no-tema-e-a-que-tem-icone.md).

E fica uma lacuna de verificação: o teste guarda o componente, não o Liquid.
Uma section que montasse a data a partir de `'now'` a cada renderização
reintroduziria o reinício sem tocar em uma linha de JS, e o contador de cada
página "acabaria" corretamente. Nenhum linter pega isso sem falso positivo —
`'now'` tem usos legítimos —, então fica com a revisão de julgamento.

## Referências

- [Issue #146](https://github.com/cleytonmendest/elizabeth/issues/146) — o
  diagnóstico, as duas opções e os critérios de aceite
- `sections/countdown-timer.liquid`, `src/js/countdown-timer.js`
- `tests/countdown-timer.test.mjs` — "ao zerar, esconde a seção — em toda
  configuração" e a loja que tinha salvo o modo diário
- `scripts/test-mutants.mjs` — o mutante que recoloca o reinício
- [ADR 0008](0008-o-tema-nao-calcula-dinheiro-que-o-checkout-nao-produz.md) —
  o tema não afirma o que não pode verificar, aplicado a dinheiro
- [ADR 0012](0012-rede-social-no-tema-e-a-que-tem-icone.md) — o precedente de
  remover setting com valor salvo
