/**
 * assets/carousel-manager.js — o Swiper chega sob demanda (issue #32).
 *
 * O bundle são 151 KB de JS e 18 KB de CSS que o `theme.liquid` mandava para
 * TODA página: carrinho, conta, políticas, 404. O linter `budget` trava o peso
 * do layout, mas ele lê Liquid — não sabe dizer se o <my-slider> consegue
 * buscar o bundle depois, nem se DOIS sliders na mesma página o buscam duas
 * vezes. Isso só existe quando o elemento conecta, e é o que se verifica aqui.
 *
 * O `load` do <script> é disparado à mão: o jsdom não busca recurso externo, e
 * um teste que dependesse da rede mediria a rede.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('carousel-manager.js');

const CDN = 'https://cdn.shopify.com/s/files/1/0001/assets';
const SWIPER_JS = `${CDN}/swiper-bundle.min.js?v=1`;
const SWIPER_CSS = `${CDN}/swiper-bundle.min.css?v=1`;

/** A tag que o `theme.liquid` emite, com as URLs já resolvidas pelo `asset_url`. */
function tagDoTema({ comUrls = true } = {}) {
  const tag = document.createElement('script');
  tag.src = `${CDN}/carousel-manager.js?v=1`;
  if (comUrls) {
    tag.dataset.swiperJs = SWIPER_JS;
    tag.dataset.swiperCss = SWIPER_CSS;
  }
  document.head.appendChild(tag);
}

const bundles = () => [...document.querySelectorAll(`script[src="${SWIPER_JS}"]`)];
const folhas = () => [...document.querySelectorAll(`link[href="${SWIPER_CSS}"]`)];

function markupDoSlider({ items = 3 } = {}) {
  const itens = Array.from({ length: items }, (_, i) => `<div class="item">${i}</div>`).join('');
  return `
    <my-slider data-items="${items}" data-qty-desk="1" data-qty-tab="1" data-qty-mob="1">
      <div class="my-slider__container">${itens}</div>
    </my-slider>`;
}

/** Deixa as promessas do `connectedCallback` correrem até o fim. */
const assentar = () => new Promise((resolve) => setTimeout(resolve, 0));

/** O navegador terminou o download: o global aparece e o `load` dispara. */
async function bundleChega() {
  window.Swiper = vi.fn(function Swiper() {
    this.slides = [];
    this.destroy = () => {};
  });
  bundles().forEach((tag) => tag.dispatchEvent(new Event('load')));
  await assentar();
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  tagDoTema();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  delete window.Swiper;
  delete window.swiperCarregando;
});

describe('quem NÃO tem carrossel não baixa o Swiper', () => {
  it('a barra de avisos — que está em toda página — não arrasta o bundle junto', async () => {
    document.body.innerHTML = `
      <announcement-bar data-duration="40">
        <div class="announcement-marquee"><div class="announcement-track">Frete grátis</div></div>
      </announcement-bar>`;
    await assentar();

    expect(bundles()).toHaveLength(0);
    expect(folhas()).toHaveLength(0);
  });

  it('slider com um item só não inicializa — e por isso não baixa nada', async () => {
    document.body.innerHTML = markupDoSlider({ items: 1 });
    await assentar();

    expect(bundles()).toHaveLength(0);
  });
});

describe('quem tem carrossel baixa o Swiper uma vez', () => {
  it('o bundle e a folha de estilo entram na página quando o slider conecta', async () => {
    document.body.innerHTML = markupDoSlider();
    await assentar();

    expect(bundles()).toHaveLength(1);
    expect(folhas()).toHaveLength(1);
  });

  it('duas sections com carrossel na mesma página baixam o bundle UMA vez', async () => {
    document.body.innerHTML = markupDoSlider() + markupDoSlider({ items: 4 });
    await assentar();

    expect(bundles()).toHaveLength(1);
    expect(folhas()).toHaveLength(1);
  });

  it('os dois sliders inicializam quando o bundle chega — nenhum fica para trás', async () => {
    document.body.innerHTML = markupDoSlider() + markupDoSlider({ items: 4 });
    await assentar();

    const sliders = [...document.querySelectorAll('my-slider')];
    expect(sliders.map((el) => Boolean(el.swiper))).toEqual([false, false]);

    await bundleChega();

    expect(window.Swiper).toHaveBeenCalledTimes(2);
    expect(sliders.map((el) => Boolean(el.swiper))).toEqual([true, true]);
  });

  it('um terceiro slider que conecta depois reaproveita o bundle já na página', async () => {
    document.body.innerHTML = markupDoSlider();
    await assentar();
    await bundleChega();

    document.body.insertAdjacentHTML('beforeend', markupDoSlider({ items: 5 }));
    await assentar();

    expect(bundles()).toHaveLength(1);
    expect(window.Swiper).toHaveBeenCalledTimes(2);
  });
});

describe('quando o bundle não vem', () => {
  it('sem as URLs na tag do tema, avisa em vez de estourar', async () => {
    document.head.innerHTML = '';
    tagDoTema({ comUrls: false });
    document.body.innerHTML = markupDoSlider();
    await assentar();

    expect(bundles()).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('data-swiper-js'));
  });

  it('falha de rede não congela o cache: o próximo slider tenta de novo', async () => {
    document.body.innerHTML = markupDoSlider();
    await assentar();
    bundles().forEach((tag) => tag.dispatchEvent(new Event('error')));
    await assentar();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('falha ao carregar'));

    document.body.insertAdjacentHTML('beforeend', markupDoSlider({ items: 4 }));
    await assentar();

    expect(bundles()).toHaveLength(2);
  });
});
