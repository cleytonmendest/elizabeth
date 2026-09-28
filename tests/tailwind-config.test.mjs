// @vitest-environment node

/**
 * O `tailwind.config.js` é programa, e chave repetida num objeto literal não
 * é erro de JavaScript: a segunda substitui a primeira em silêncio.
 *
 * `theme.extend` teve `minWidth` e `maxWidth` declarados duas vezes (#150). O
 * Tailwind recebeu só a segunda declaração de cada, e as duas classes que o
 * menu usa — `min-w-menu-col` e `max-w-dropdown` — nunca chegaram ao CSS. A
 * regra `tokens` ficou satisfeita, porque o markup usava token e não valor
 * arbitrário, e a regra `build` também, porque o artefato estava em dia com o
 * config. O config é que estava errado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { configComAviso } from '../scripts/lint/rules/build.mjs';
import { ROOT } from '../scripts/build-js.mjs';

const CSS = fs.readFileSync(path.join(ROOT, 'assets/application.css'), 'utf8');

describe('tailwind.config.js', () => {
  it('não tem aviso do esbuild', () => {
    expect(configComAviso()).toEqual([]);
  });

  it('a regra build reprova família declarada duas vezes, na linha da segunda', () => {
    const fonte = [
      'module.exports = {',
      '  theme: {',
      '    extend: {',
      "      minWidth: { 'menu-col': '150px' },",
      "      minWidth: { action: '100px' },",
      '    },',
      '  },',
      '};',
    ].join('\n');

    const [acusacao, ...resto] = configComAviso(fonte);

    expect(resto).toEqual([]);
    expect(acusacao).toMatchObject({
      rule: 'build',
      file: 'tailwind.config.js',
      line: 5,
      code: 'config:duplicate-object-key',
      severity: 'error',
    });
    expect(acusacao.message).toContain('minWidth');
  });

  it('a mesma chave em objetos diferentes não é duplicata', () => {
    const fonte = "module.exports = { a: { bar: '1px' }, b: { bar: '2px' } };";

    expect(configComAviso(fonte)).toEqual([]);
  });

  // O defeito visto do lado da loja: o token existe no config e a classe
  // existe no CSS que a cliente baixa.
  it.each([
    ['max-w-dropdown', 'max-width:28rem'],
    ['min-w-menu-col', 'min-width:150px'],
  ])('.%s chega ao application.css', (classe, declaracao) => {
    expect(CSS).toContain(`.${classe}{${declaracao}}`);
  });
});
