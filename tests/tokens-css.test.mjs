/**
 * A regra `tokens` também lê o CSS escrito à mão.
 *
 * Até aqui ela só lia `.liquid`, e o CSS de `assets/` ficava de fora. Foi por
 * esse buraco que `assets/variant-selector.css` pintou os seletores de
 * variante da PDP de `#000`, `#666` e `#ddd`: num scheme escuro, a borda do
 * hover era preta sobre fundo preto — e o linter dizia "tudo limpo", com a
 * mesma cara de quando está tudo certo.
 *
 * Estes testes fixam as duas metades que podem falhar em silêncio: QUAIS
 * arquivos entram na varredura, e O QUE conta como cor fixa.
 */
import { describe, it, expect } from 'vitest';
import { CSS_CHECKS, acusaCss, cssDoTema } from '../scripts/lint/rules/tokens.mjs';

const codigos = (src) => acusaCss('assets/x.css', src).map((o) => o.code);

describe('quais arquivos a regra lê', () => {
  const arquivos = cssDoTema();

  it('o CSS escrito à mão de assets/ — o caso que escapou', () => {
    expect(arquivos).toContain('assets/variant-selector.css');
    expect(arquivos).toContain('assets/color-scheme.css');
  });

  it('os fontes em src/, onde mora o `theme(colors.*)` do Tailwind', () => {
    expect(arquivos).toContain('src/tailwind.css');
    expect(arquivos).toContain('src/checkout-acelerado.css');
  });

  it('não lê o gerado: o fonte já é lido, e o gerado repetiria cada acusação', () => {
    expect(arquivos).not.toContain('assets/application.css');
    expect(arquivos).not.toContain('assets/checkout-acelerado.css');
  });

  it('não lê biblioteca de terceiro', () => {
    expect(arquivos).not.toContain('assets/swiper-bundle.min.css');
  });
});

describe('o que conta como cor fixa', () => {
  it('hex de 3, 6 e 8 dígitos', () => {
    expect(codigos('a { color: #000; border-color: #dddddd; background: #0000001a; }')).toEqual([
      'hex:#000',
      'hex:#dddddd',
      'hex:#0000001a',
    ]);
  });

  it('rgb/rgba/hsl com número', () => {
    expect(codigos('a { color: rgba(0, 0, 0, 0.5); background: rgb(255 255 255); fill: hsl(0 0% 50%); }')).toEqual([
      'rgb:rgba(0, 0, 0, 0.5)',
      'rgb:rgb(255 255 255)',
      'rgb:hsl(0 0% 50%)',
    ]);
  });

  it('cor nomeada, sozinha ou dentro de um atalho', () => {
    expect(codigos('a { color: black; border: 1px solid white !important; }')).toEqual([
      'nomeada:black',
      'nomeada:white',
    ]);
  });

  it('a paleta do Tailwind pelo theme()', () => {
    expect(codigos("a { border-color: theme('colors.gray.400'); }")).toEqual(["palette:theme('colors.gray.400')"]);
  });

  it('a linha apontada é a da declaração', () => {
    const [ofensa] = acusaCss('assets/x.css', '/* cabeçalho\n   de duas linhas */\na {\n  color: #000;\n}');
    expect(ofensa.line).toBe(4);
  });
});

describe('o que NÃO é cor fixa', () => {
  it('a variável do scheme, com e sem alfa', () => {
    expect(
      codigos(
        'a { color: rgb(var(--color-foreground)); background: rgb(var(--color-text) / 0.05); border-color: rgb(var(--color-border) / var(--tw-border-opacity)); }'
      )
    ).toEqual([]);
  });

  it('palavra-chave que não é cor', () => {
    expect(codigos('a { white-space: nowrap; color: currentColor; background: transparent; border-color: inherit; }')).toEqual([]);
  });

  it('comentário: é onde se explica a cor que foi removida', () => {
    expect(codigos('/* nascia com o azul da Shopify (#1990c6) e rgb(25, 144, 198) */ a { color: inherit; }')).toEqual([]);
  });

  it('o tema() de token que não é da paleta', () => {
    expect(codigos("a { border-radius: theme('borderRadius.theme'); }")).toEqual([]);
  });
});

describe('os checks existem', () => {
  it('os quatro estão registrados', () => {
    expect(CSS_CHECKS.map((c) => c.code)).toEqual(['hex', 'rgb', 'nomeada', 'palette']);
  });
});
