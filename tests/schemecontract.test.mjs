/**
 * A regra `schemecontract` sabe de onde as CSS variables vêm?
 *
 * Ela guardava o caminho `layout/theme.liquid` numa constante. Na #27 o bloco
 * que emite as variáveis saiu do layout para `snippets/theme-styles.liquid`,
 * e a regra passou a reprovar 47 arquivos de uma vez — todos inocentes.
 *
 * O erro de forma não foi o caminho velho; foi o que a regra CONCLUIU dele.
 * "Não achei nenhuma variável gerada" só pode significar uma de duas coisas, e
 * a regra escolhia a improvável: em vez de "o tema inteiro está quebrado",
 * quase sempre é "eu perdi a fonte". Hoje ela diz isso, numa linha só.
 */
import { describe, it, expect } from 'vitest';
import { variaveisGeradas } from '../scripts/lint/rules/schemecontract.mjs';

describe('quais --color-* uma fonte GERA', () => {
  it('pega a declaração', () => {
    expect(variaveisGeradas('--color-background: 255 255 255;')).toEqual(['--color-background']);
  });

  it('pega dentro do laço de color scheme, como o tema escreve', () => {
    const fonte = `
      .color-{{ scheme.id }} {
        --color-background: {{ s.background.red }} {{ s.background.green }} {{ s.background.blue }};
        --color-foreground: {{ s.text.red }} {{ s.text.green }} {{ s.text.blue }};
      }`;

    expect(variaveisGeradas(fonte)).toEqual(['--color-background', '--color-foreground']);
  });

  /**
   * A distinção inteira da regra. Consumir não é gerar — se `var()` contasse,
   * `color-scheme.css` se autoautorizaria e a regra nunca acharia nada, que é
   * o defeito com que ela nasceu (`--color-card-background`).
   */
  it('consumir NÃO conta como gerar', () => {
    expect(variaveisGeradas('background: rgb(var(--color-card-background) / 1);')).toEqual([]);
  });

  it('espaço antes dos dois-pontos continua sendo declaração', () => {
    expect(variaveisGeradas('--color-border : 0 0 0;')).toEqual(['--color-border']);
  });

  it('não quebra com entrada vazia', () => {
    expect(variaveisGeradas('')).toEqual([]);
    expect(variaveisGeradas(undefined)).toEqual([]);
    expect(variaveisGeradas(null)).toEqual([]);
  });
});
