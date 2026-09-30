/**
 * Toda foto é pedida à CDN numa largura (#163).
 *
 * `image_url` sem `width` nem `height` devolve a foto no tamanho e no formato
 * originais. Eram oito chamadas, e duas eram o LCP: o slider do topo da home
 * (`Banner_1_mobile.png`, 40 KB de PNG) e a galeria do celular da PDP, que
 * ainda baixava TODAS as fotos do produto de imediato.
 *
 * Três metades: a regra (`scripts/lint/rules/imagens.mjs`) acusa a chamada sem
 * largura; o slider do topo gera `srcset` nas três fontes do `<picture>`; e a
 * galeria da PDP carrega só a primeira foto na hora, com prioridade alta
 * apenas onde ela é o LCP.
 */
import { describe, it, expect } from 'vitest';
import { semLargura, run } from '../scripts/lint/rules/imagens.mjs';
import { renderizaArquivo, renderizaSection } from './helpers/section-liquid.mjs';

describe('a regra acusa image_url sem largura', () => {
  const acusa = (src) => semLargura(src).length;

  it('sem argumento nenhum, o caso das oito chamadas', () => {
    expect(acusa('<img src="{{ image | image_url }}">')).toBe(1);
  });

  it('com a cadeia quebrando linha, o caso da galeria de duas colunas', () => {
    expect(acusa('{{\n  image\n  | image_url\n  | image_tag: class: "w-full"\n}}')).toBe(1);
  });

  it('com argumentos que não dizem o tamanho', () => {
    expect(acusa("{{ image | image_url: crop: 'center', format: 'pjpg' }}")).toBe(1);
  });

  it('width ou height, com qualquer valor, passa', () => {
    expect(acusa('{{ image | image_url: width: 600 }}')).toBe(0);
    expect(acusa('{{ image | image_url: height: 300, crop: "center" }}')).toBe(0);
    expect(acusa('{{ image | image_url: width: largura_px }}')).toBe(0);
    expect(acusa('{{ image\n  | image_url: width: 1200\n  | image_tag: widths: "400, 800" }}')).toBe(0);
  });

  it('uma variável chamada image_url não é o filtro', () => {
    expect(acusa("{%- assign swatch = 'url(' | append: image_url | append: ')' -%}")).toBe(0);
  });

  it('e o tema não tem nenhuma', () => {
    expect(run().map((o) => `${o.file}:${o.line}`)).toEqual([]);
  });
});

// ── O slider do topo ──────────────────────────────────────────────────────

const foto = (nome) => ({ src: `/cdn/shop/files/${nome}` });

function heroi() {
  return renderizaSection('slider-image.liquid', {
    id: 'heroi',
    settings: { color_scheme: 'scheme-1', fullwidth: true, loop: true, nav: false, dot: false, 'qty-desk': 1, 'qty-tablet': 1, 'qty-mob': 1 },
    blocks: [1, 2].map((n) => ({
      settings: {
        imgMob: foto(`mob-${n}.png`),
        imgTablet: foto(`tab-${n}.png`),
        imgDesktop: foto(`desk-${n}.png`),
        alt_text: `Foto ${n}`,
      },
    })),
  });
}

/** As larguras de um `srcset`, em ordem. */
const larguras = (srcset) => srcset.split(',').map((e) => Number(e.trim().split(/\s+/)[1].replace('w', '')));

describe('o slider do topo pede a foto em várias larguras, nas três fontes', () => {
  const html = heroi();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const primeiro = doc.querySelector('picture');

  it('o celular, o tablet e o desktop têm srcset com várias larguras e sizes', () => {
    const img = primeiro.querySelector('img');
    const tablet = primeiro.querySelector('source[media="(min-width: 500px)"]');
    const desktop = primeiro.querySelector('source[media="(min-width: 1024px)"]');

    expect(larguras(img.getAttribute('srcset'))).toEqual([375, 550, 750, 1100]);
    expect(larguras(tablet.getAttribute('srcset'))).toEqual([600, 800, 1024, 1500]);
    expect(larguras(desktop.getAttribute('srcset'))).toEqual([1200, 1600, 1920, 2560]);
    for (const el of [img, tablet, desktop]) expect(el.getAttribute('sizes')).toBe('100vw');
  });

  it('cada fonte pede a SUA foto, e o src de reserva também tem largura', () => {
    const img = primeiro.querySelector('img');
    expect(img.getAttribute('srcset')).toContain('/mob-1.png?width=375');
    expect(primeiro.querySelector('source[media="(min-width: 500px)"]').getAttribute('srcset')).toContain('/tab-1.png?width=600');
    expect(primeiro.querySelector('source[media="(min-width: 1024px)"]').getAttribute('srcset')).toContain('/desk-1.png?width=1200');
    expect(img.getAttribute('src')).toBe('/cdn/shop/files/mob-1.png?width=750');
  });

  it('nenhuma URL de foto sai sem largura', () => {
    const urls = [...html.matchAll(/\/cdn\/shop\/files\/[^\s"',]+/g)].map(([u]) => u);
    expect(urls.length).toBeGreaterThan(10);
    expect(urls.filter((u) => !/\?width=\d+$/.test(u))).toEqual([]);
  });

  it('a primeira foto continua sendo a prioridade, e a segunda espera', () => {
    const [um, dois] = doc.querySelectorAll('picture img');
    expect([um.getAttribute('loading'), um.getAttribute('fetchpriority')]).toEqual(['eager', 'high']);
    expect([dois.getAttribute('loading'), dois.getAttribute('fetchpriority')]).toEqual(['lazy', null]);
  });
});

// ── A galeria da PDP ──────────────────────────────────────────────────────

function galeria({ qtd = 1, prioridade } = {}) {
  const html = renderizaArquivo('snippets/product-page-slider.liquid', {
    section: { id: 'produto' },
    qtd,
    prioridade,
    product: { title: 'Blazer', images: [1, 2, 3].map((n) => ({ src: `/cdn/shop/files/blazer-${n}.jpg` })) },
  });
  return [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.carousel-item img')];
}

const atributos = (img) => [img.getAttribute('loading'), img.getAttribute('fetchpriority')];

describe('a galeria da PDP carrega só a primeira foto na hora', () => {
  it('na PDP, a primeira é o LCP: carrega já, com prioridade alta; as outras esperam', () => {
    expect(galeria({ prioridade: true }).map(atributos)).toEqual([
      ['eager', 'high'],
      ['lazy', 'auto'],
      ['lazy', 'auto'],
    ]);
  });

  it('no "Produto em destaque" ninguém pede prioridade alta', () => {
    expect(galeria({ qtd: 2 }).map(atributos)).toEqual([
      ['eager', 'auto'],
      ['lazy', 'auto'],
      ['lazy', 'auto'],
    ]);
  });

  it('toda foto pede largura, e o sizes acompanha quantas aparecem por vez', () => {
    for (const img of galeria({ prioridade: true })) {
      expect(img.getAttribute('src')).toMatch(/\?width=1200$/);
      expect(larguras(img.getAttribute('srcset'))).toEqual([400, 600, 800, 1000, 1200]);
      expect(img.getAttribute('sizes')).toBe('(min-width: 1024px) 50vw, 100vw');
    }
    expect(galeria({ qtd: 2 })[0].getAttribute('sizes')).toBe('(min-width: 1024px) 25vw, 100vw');
  });
});
