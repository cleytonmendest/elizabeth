/**
 * O que o linter considera "não é markup ativo".
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * `stripInert` roda ANTES de qualquer regra e decide o que elas enxergam. Um
 * erro aqui não aparece como erro: aparece como uma regra acusando um trecho
 * que ninguém escreveu para valer, ou — pior — deixando de acusar um que foi
 * escrito.
 *
 * Ele conhecia três formas de comentário e faltava a quarta: dentro de uma tag
 * `{% liquid %}`, uma linha cujo primeiro caractere não-branco é `#` é
 * comentário pela definição da própria Liquid.
 *
 * O sintoma foi a #106: `# Ver #105.` reprovava na regra `tokens`, porque
 * `#105` tem três dígitos hexadecimais válidos e o check `hex` o casava como
 * cor. O contorno era escrever o comentário fora do bloco — ou seja, o linter
 * ditando onde o comentário pode morar.
 *
 * O mesmo aconteceu com `#121` dentro de um comentário de bloco de CSS num
 * `<style>`, noutro arquivo e meses depois. Mesma classe, outro contêiner:
 * por isso os dois estão cobertos aqui.
 */
import { describe, it, expect } from 'vitest';
import { stripInert } from '../scripts/lint/lib.mjs';

/** O que sobra depois da limpeza, sem linhas em branco. */
const sobra = (src) => stripInert(src).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

describe('as quatro formas de comentário somem', () => {
  it('bloco {% comment %}', () => {
    expect(sobra('{%- comment -%}cor #fff{%- endcomment -%}<p>ativo</p>')).toBe('<p>ativo</p>');
  });

  it('comentário de HTML', () => {
    expect(sobra('<!-- cor #fff --><p>ativo</p>')).toBe('<p>ativo</p>');
  });

  it('linha de # dentro de {% liquid %} — a que faltava', () => {
    expect(stripInert('{%- liquid\n  # Ver #105.\n  assign x = 1\n-%}')).not.toContain('#105');
  });

  it('comentário de bloco de CSS', () => {
    // Medido na #121: `#121` dentro de um `/* */` num `<style>` reprovava no
    // check `hex` exatamente como o `#105` do caso acima.
    expect(stripInert('<style>/* Ver #121 */\n.x{color:red}</style>')).not.toContain('#121');
  });
});

describe('e o que NÃO é comentário continua visível', () => {
  it('cerquilha no meio da linha não comenta em Liquid', () => {
    // A regra da Liquid é o primeiro caractere não-branco. Apagar a linha
    // inteira por conter `#` esconderia cor cravada de verdade.
    expect(stripInert("{%- liquid\n  assign cor = '#fff'\n-%}")).toContain('#fff');
  });

  it('cor em atributo de estilo', () => {
    expect(stripInert('<div style="color:#fff">x</div>')).toContain('#fff');
  });

  it('cor dentro de CSS de verdade, fora de comentário', () => {
    expect(stripInert('<style>.x{color:#fff}</style>')).toContain('#fff');
  });

  it('cerquilha fora de qualquer bloco', () => {
    expect(stripInert('# isto não é Liquid\n<p>#fff</p>')).toContain('#fff');
  });
});

describe('a contagem de linhas não escorrega', () => {
  it('cada forma apagada preserva o número de linhas', () => {
    // Erro apontado na linha errada é erro que a pessoa procura no lugar
    // errado — e desconfia do linter, não do código.
    const casos = [
      '{%- comment -%}\numa\nduas\n{%- endcomment -%}\n<p>fim</p>',
      '<!--\numa\nduas\n-->\n<p>fim</p>',
      '{%- liquid\n  # uma\n  # duas\n  assign x = 1\n-%}\n<p>fim</p>',
      '<style>/*\numa\nduas\n*/\n.x{color:red}</style>',
    ];

    for (const src of casos) {
      expect(stripInert(src).split('\n').length, JSON.stringify(src.slice(0, 24))).toBe(
        src.split('\n').length
      );
    }
  });
});
