/**
 * O piso de contraste do texto secundário.
 *
 * ── O que a regra mede, e por que o número é 58 ────────────────────────────
 *
 * O tema usava opacidade como texto secundário — `text-foreground/NN` — em
 * NOVE degraus diferentes, escolhidos um a um. Opacidade sobre fundo claro
 * clareia; sobre fundo escuro escurece. Nenhum valor fixo passa nos dois
 * schemes, e o `e2e/a11y-baseline.json` registrava 8 violações de
 * `color-contrast`, em 8 páginas, todas com essa causa.
 *
 * Medido contra os schemes de `config/settings_data.json` (#ffffff/#121212 e o
 * inverso), com o texto efetivo sendo `α·texto + (1−α)·fundo`:
 *
 *     /70   6,99:1 claro   9,43:1 escuro   passa
 *     /60   4,89:1 claro   7,18:1 escuro   passa
 *     /55   4,14:1 claro   6,20:1 escuro   REPROVA no claro
 *     /50   3,52:1 claro   5,32:1 escuro   REPROVA no claro
 *     /40   2,61:1 claro   3,83:1 escuro   REPROVA nos dois
 *
 * A menor opacidade que passa os 4,5:1 do WCAG AA nos dois schemes é 58%.
 *
 * Repare no que a tabela mostra e o baseline não mostrava: `/60` e `/70` são
 * 197 dos 343 usos e sempre estiveram certos. O defeito nunca foi "usar
 * opacidade" — foi não haver um degrau decidido. É por isso que a regra lê o
 * NÚMERO em vez de proibir a barra.
 *
 * ── Por que este teste existe ──────────────────────────────────────────────
 *
 * A regra `tokens` não tinha teste nenhum. Um piso errado por um degrau — 54
 * em vez de 57 — deixaria passar os 20 usos de `/55`, e o linter exibiria
 * verde com a violação presente. É a mesma forma de silêncio da #99.
 */
import { describe, it, expect } from 'vitest';
import { CHECKS } from '../scripts/lint/rules/tokens.mjs';

const check = CHECKS.find((c) => c.code === 'opacity-contrast');

/** O que a regra acusaria num trecho de markup. */
const acusa = (markup) => [...markup.matchAll(check.pattern)].map((m) => m[0]);

describe('a regra do piso de contraste existe', () => {
  it('o check está registrado', () => {
    // Sem isto, renomear o código faria `check` virar undefined e TODOS os
    // testes abaixo passariam a medir o vazio.
    expect(check, 'check `opacity-contrast` sumiu de CHECKS').toBeDefined();
  });
});

describe('abaixo do piso reprova', () => {
  it('/50 — 3,52:1 no esquema claro, o caso das 8 páginas do baseline', () => {
    expect(acusa('<p class="text-sm text-foreground/50">')).toEqual(['text-foreground/50']);
  });

  it('/55 — 4,14:1, reprova por pouco e reprova igual', () => {
    expect(acusa('<p class="text-foreground/55">')).toEqual(['text-foreground/55']);
  });

  it('/57 — o último degrau que ainda reprova', () => {
    expect(acusa('<p class="text-foreground/57">')).toEqual(['text-foreground/57']);
  });

  it('/40 e abaixo, que reprovam nos DOIS schemes', () => {
    expect(acusa('<span class="text-foreground/40">')).toEqual(['text-foreground/40']);
    expect(acusa('<svg class="text-foreground/25">')).toEqual(['text-foreground/25']);
    expect(acusa('<i class="text-foreground/5">')).toEqual(['text-foreground/5']);
  });

  it('com prefixo de variante também', () => {
    expect(acusa('class="hover:text-foreground/40 md:text-foreground/50"')).toEqual([
      'text-foreground/40',
      'text-foreground/50',
    ]);
  });
});

describe('no piso ou acima passa', () => {
  it('/58 é o piso e passa', () => {
    expect(acusa('<p class="text-foreground/58">')).toEqual([]);
  });

  it('/60 e /70 continuam válidos — são 197 dos 343 usos', () => {
    expect(acusa('<p class="text-foreground/60">')).toEqual([]);
    expect(acusa('<p class="text-foreground/70">')).toEqual([]);
    expect(acusa('<p class="text-foreground/80">')).toEqual([]);
  });

  it('o token que substitui a opacidade não é acusado', () => {
    expect(acusa('<p class="text-sm text-foreground-muted">')).toEqual([]);
  });

  it('opacidade cheia não é acusada', () => {
    expect(acusa('<p class="text-foreground">')).toEqual([]);
  });

  /**
   * Fundo é outra pergunta: `bg-foreground/5` é um realce de superfície, não
   * texto, e o critério de contraste que vale para ele (WCAG 1.4.11) mede
   * contra o que está ADJACENTE, não contra o próprio fundo. Acusar aqui seria
   * dar a resposta certa para a pergunta errada.
   */
  it('bg-foreground/NN não é assunto desta regra', () => {
    expect(acusa('<div class="bg-foreground/5">')).toEqual([]);
  });
});
