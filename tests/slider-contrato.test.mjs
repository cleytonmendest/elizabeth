/**
 * Todo `<my-slider>` declara, para o CSS, quantos slides mostra por faixa.
 *
 * O Swiper é baixado pelo próprio componente, depois do HTML (ADR 0011), e até
 * ele chegar quem desenha o carrossel é a regra de pré-inicialização de
 * `src/carousel-style.css`. Ela precisa saber quantos slides cabem por tela, e
 * CSS não lê número de atributo: por isso cada consumidor declara
 * `--por-vez-mob`, `--por-vez-tab` e `--por-vez-desk` no `style`.
 *
 * Sem a declaração, os slides apareciam empilhados e a página saltava quando o
 * Swiper inicializava (#161). Com uma declaração DIFERENTE do `data-qty-*` que
 * o JS lê, o salto volta mais discreto: a trilha nasce numa largura e o Swiper
 * a troca por outra. Este teste reprova os dois casos, em todo arquivo que tem
 * um `<my-slider>`, inclusive o próximo que alguém criar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAIXAS = ['mob', 'tab', 'desk'];

function consumidores() {
  return ['sections', 'snippets']
    .flatMap((pasta) => fs.readdirSync(path.join(RAIZ, pasta)).map((f) => `${pasta}/${f}`))
    .filter((f) => f.endsWith('.liquid'))
    .flatMap((arquivo) => {
      const texto = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
      return [...texto.matchAll(/<my-slider\b[^>]*>/g)].map(([tag]) => ({ arquivo, tag }));
    });
}

/** `{ mob, tab, desk }` do `data-qty-*` e do `style`, como texto do Liquid. */
function declaracoes(tag) {
  const estilo = tag.match(/\bstyle="([^"]*)"/)?.[1] ?? '';
  return Object.fromEntries(
    FAIXAS.map((faixa) => [
      faixa,
      {
        js: tag.match(new RegExp(`data-qty-${faixa}="([^"]*)"`))?.[1],
        css: estilo.match(new RegExp(`--por-vez-${faixa}:\\s*([^;]+?)\\s*(?:;|$)`))?.[1],
      },
    ])
  );
}

describe('os consumidores de <my-slider>', () => {
  const todos = consumidores();

  it('são encontrados — senão o teste abaixo mediria o vazio', () => {
    expect(todos.map((c) => c.arquivo)).toEqual(
      expect.arrayContaining(['sections/slider-image.liquid', 'snippets/product-gallery.liquid'])
    );
    expect(todos.length).toBeGreaterThanOrEqual(7);
  });

  it.each(consumidores().map((c) => [c.arquivo, c.tag]))(
    '%s declara as três faixas, com os mesmos valores que o JS lê',
    (arquivo, tag) => {
      for (const [faixa, { js, css }] of Object.entries(declaracoes(tag))) {
        expect(css, `${arquivo}: falta --por-vez-${faixa} no style do <my-slider>`).toBeDefined();
        expect(css, `${arquivo}: --por-vez-${faixa} diverge de data-qty-${faixa}`).toBe(js);
      }
    }
  );
});

describe('a leitura do contrato', () => {
  it('acusa a faixa que falta', () => {
    const d = declaracoes('<my-slider data-qty-mob="1" data-qty-tab="2" data-qty-desk="4" style="--por-vez-mob: 1; --por-vez-tab: 2">');
    expect(d.desk).toEqual({ js: '4', css: undefined });
  });

  it('acusa o valor que diverge, e lê expressão de Liquid inteira', () => {
    const d = declaracoes(
      '<my-slider data-qty-mob="{{ qty_mob }}" data-qty-tab="2" data-qty-desk="4" style="--por-vez-mob: {{ qty_mob }}; --por-vez-tab: 3; --por-vez-desk: 4">'
    );
    expect(d.mob).toEqual({ js: '{{ qty_mob }}', css: '{{ qty_mob }}' });
    expect(d.tab).toEqual({ js: '2', css: '3' });
  });
});
