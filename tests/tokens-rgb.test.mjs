/**
 * Cor fixa em CSS dentro do Liquid.
 *
 * A regra `tokens` lia classe — `bg-black`, `text-gray-500`, `#fff` — e o CSS
 * escrito no próprio Liquid passava calado: `style="background:rgba(0,0,0,.3)"`
 * e os blocos `<style>`. Foi assim que o scrim do card de produto nunca foi
 * acusado, e que a página de cadastro cravou o gray-900 do Tailwind,
 * `rgb(17, 24, 39)`, no checkbox (#154). O mesmo buraco que os CSS_CHECKS
 * fecharam para `assets/` na #149, em outro contêiner.
 *
 * Os testes passam por `acusaLiquid`, que é o caminho da varredura do tema:
 * o `stripInert`, todos os checks e as exceções de design-exceptions.json.
 */
import { describe, it, expect } from 'vitest';
import { CHECKS, acusaLiquid } from '../scripts/lint/rules/tokens.mjs';

const codigos = (markup, arquivo = 'sections/x.liquid') => acusaLiquid(arquivo, markup).map((o) => o.code);

describe('o check existe', () => {
  it('está registrado em CHECKS', () => {
    // Sem isto, renomear o código faria os testes abaixo medirem o vazio.
    expect(CHECKS.map((c) => c.code)).toContain('rgb');
  });
});

describe('cor fixa no CSS do Liquid reprova', () => {
  it('no style=, o caso do chip do card', () => {
    expect(codigos('<div class="absolute" style="background:rgba(0,0,0,.3)"></div>')).toEqual([
      'rgb:rgba(0,0,0,.3)',
    ]);
  });

  it('dentro de um gradiente', () => {
    expect(codigos('<div style="background:linear-gradient(0deg, rgba(0,0,0,.55) 0%, transparent 100%)"></div>')).toEqual([
      'rgb:rgba(0,0,0,.55)',
    ]);
  });

  it('num bloco <style>, o caso do checkbox do cadastro', () => {
    expect(codigos('<style>\n  input:checked { background-color: rgb(17, 24, 39); }\n</style>')).toEqual([
      'rgb:rgb(17, 24, 39)',
    ]);
  });

  it('hsl e a sintaxe sem vírgula', () => {
    expect(codigos('<p style="color: hsl(0 0% 40%); border-color: rgb(255 255 255 / .5)"></p>')).toEqual([
      'rgb:hsl(0 0% 40%)',
      'rgb:rgb(255 255 255 / .5)',
    ]);
  });

  it('aponta a linha da declaração', () => {
    const [ofensa] = acusaLiquid('sections/x.liquid', '<div>\n\n  <p style="color: rgb(1, 2, 3)"></p>\n</div>');
    expect(ofensa.line).toBe(3);
  });
});

describe('o que é do scheme ou da lojista passa', () => {
  it('a variável do color scheme, com e sem alfa', () => {
    expect(codigos('<p style="color: rgb(var(--color-foreground)); border-color: rgb(var(--color-border) / 0.4)"></p>')).toEqual([]);
  });

  it('a cor que a lojista cadastrou na amostra', () => {
    expect(codigos('<span style="background:rgb({{ value.swatch.color.rgb }});"></span>')).toEqual([]);
  });

  it('comentário não pinta nada', () => {
    expect(codigos('{% comment %}era rgb(17, 24, 39){% endcomment %}<style>/* era rgba(0,0,0,.3) */</style>')).toEqual([]);
  });
});

describe('uma acusação por defeito', () => {
  it('valor arbitrário do Tailwind já é acusado pelo `arbitrary`, com o nome da classe', () => {
    expect(codigos('<div class="shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"></div>')).toEqual([
      'arbitrary:shadow-[0_-4px_12px_rgba(0,0,0,0.06)]',
    ]);
    expect(codigos('<div class="shadow-[rgba(0,0,0,.1)]"></div>')).toEqual(['arbitrary:shadow-[rgba(0,0,0,.1)]']);
  });
});

describe('a exceção do scrim é estreita', () => {
  // design-exceptions.json libera o scrim PRETO nestes arquivos. A exceção não
  // pode virar licença para qualquer cor fixa neles.
  const card = 'snippets/card-product-slider.liquid';

  it('o scrim preto do card passa, com qualquer alfa', () => {
    expect(codigos('<div style="background:rgba(0,0,0,.3)"></div>', card)).toEqual([]);
    expect(codigos('<span style="box-shadow:0 0 0 1px rgba(0,0,0,.55)"></span>', card)).toEqual([]);
  });

  it('outra cor no mesmo arquivo continua reprovando', () => {
    expect(codigos('<div style="background:rgba(255,0,0,.3)"></div>', card)).toEqual(['rgb:rgba(255,0,0,.3)']);
    expect(codigos('<div style="color:rgb(17, 24, 39)"></div>', card)).toEqual(['rgb:rgb(17, 24, 39)']);
  });

  it('o mesmo scrim num arquivo sem exceção reprova', () => {
    expect(codigos('<div style="background:rgba(0,0,0,.3)"></div>', 'snippets/outro.liquid')).toEqual([
      'rgb:rgba(0,0,0,.3)',
    ]);
  });
});
