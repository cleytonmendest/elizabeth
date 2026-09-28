/**
 * O `!` de importância antes da variante.
 *
 * No Tailwind v3 o `!` vem DEPOIS das variantes: `lg:!py-12`. Escrito antes,
 * `!lg:py-12` não gera CSS nenhum e não dá erro em lugar nenhum. Quatro
 * sections passaram a vida assim (#151): blog, destaque, imagens com link e
 * artigo declaravam o espaçamento de desktop, e o desktop ficava com o valor
 * do mobile.
 *
 * Nenhuma regra acusava, porque nenhuma perguntava se a classe existe. O check
 * `important` da regra `tokens` pergunta a coisa mais estreita que resolve o
 * caso: a ordem do `!`.
 */
import { describe, it, expect } from 'vitest';
import { CHECKS } from '../scripts/lint/rules/tokens.mjs';
import { allLiquid, read, stripInert } from '../scripts/lint/lib.mjs';

const check = CHECKS.find((c) => c.code === 'important');

/** O que a regra acusaria num trecho de markup. */
const acusa = (markup) => [...markup.matchAll(check.pattern)].map((m) => m[0]);

describe('o check existe', () => {
  it('está registrado em CHECKS', () => {
    // Sem isto, renomear o código faria `check` virar undefined e todos os
    // testes abaixo passariam a medir o vazio.
    expect(check, 'check `important` sumiu de CHECKS').toBeDefined();
  });
});

describe('! antes da variante reprova', () => {
  it('!lg:py-12, o caso do blog', () => {
    expect(acusa('<div class="page-width !py-8 !lg:py-12">')).toEqual(['!lg:py-12']);
  });

  it('no começo do atributo e em parâmetro de render', () => {
    expect(acusa('<div class="!md:px-4">')).toEqual(['!md:px-4']);
    expect(acusa("{% render 'x', class: '!lg:mb-12' %}")).toEqual(['!lg:mb-12']);
  });

  it('a mensagem ensina a forma certa, com o ! depois da última variante', () => {
    expect(check.message('!lg:py-12')).toContain('Escreva lg:!py-12.');
    expect(check.message('!md:hover:px-2')).toContain('Escreva md:hover:!px-2.');
  });
});

describe('o resto passa', () => {
  it('a forma certa, e a classe sem variante', () => {
    expect(acusa('<div class="!py-8 lg:!py-12 lg:py-6 md:hover:!px-2">')).toEqual([]);
  });

  it('o != do Liquid e a negação do JavaScript', () => {
    expect(acusa("{% if a != 'b:c' %}{% endif %}")).toEqual([]);
    expect(acusa('if (!aberto) { x = { a: !b }; }')).toEqual([]);
    expect(acusa('.x { color: red !important; }')).toEqual([]);
  });
});

describe('o tema', () => {
  it('nenhum arquivo põe o ! antes da variante', () => {
    const achados = allLiquid().flatMap((arquivo) => acusa(stripInert(read(arquivo))).map((v) => `${arquivo}: ${v}`));

    expect(achados).toEqual([]);
  });
});
