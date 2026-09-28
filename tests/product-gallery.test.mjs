/**
 * assets/product-gallery.js — a galeria do layout de miniaturas acompanha a
 * troca de variante.
 *
 * Ela escutava `variant:change` no `document`, e a troca feita pela cliente
 * nunca chegava lá: `variant-selects` dispara no [product-context], sem
 * `bubbles` (#157). A cliente escolhia outra cor e a foto não mudava — o
 * código de sincronização nunca tinha rodado.
 *
 * Os dois componentes aqui são os assets reais, conversando pelo evento de
 * verdade: o teste escolhe um radio e olha a galeria, sem disparar o evento
 * à mão. Se um dia o nome do evento, o alvo ou a bolha divergirem entre os
 * dois, é aqui que aparece.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('variations-selector.js');
const { ProductGallery } = loadAsset('product-gallery.js', ['ProductGallery']);

const VARIANTES = [
  { id: 1, options: ['Preto'], available: true, featured_media: { id: 11 } },
  { id: 2, options: ['Branco'], available: true, featured_media: { id: 22 } },
];

const seletor = (prefixo) => `
  <variant-selects>
    <script type="application/json" data-variants>${JSON.stringify(VARIANTES)}</script>
    <fieldset><legend>Cor</legend>
      <input type="radio" id="${prefixo}-preto" name="${prefixo}-cor" value="Preto" checked><label for="${prefixo}-preto">Preto</label>
      <input type="radio" id="${prefixo}-branco" name="${prefixo}-cor" value="Branco"><label for="${prefixo}-branco">Branco</label>
    </fieldset>
  </variant-selects>`;

const galeria = `
  <div data-product-gallery>
    <div class="product-gallery__image" data-media-id="11"></div>
    <div class="product-gallery__image hidden" data-media-id="22"></div>
  </div>`;

/** A PDP e, na mesma página, outro produto com o mesmo catálogo de mídia. */
function monta() {
  document.body.innerHTML = `
    <div product-context id="pdp">${galeria}${seletor('pdp')}</div>
    <div product-context id="destaque">${seletor('destaque')}</div>`;
  return new ProductGallery();
}

function escolhe(id) {
  const radio = document.getElementById(id);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a troca de variante', () => {
  it('escolher outra cor mostra a imagem da variante', () => {
    const g = monta();

    escolhe('pdp-branco');

    expect(g.currentIndex).toBe(1);
    expect(g.images[1].classList.contains('hidden')).toBe(false);
    expect(g.images[0].classList.contains('hidden')).toBe(true);
  });

  it('a troca num OUTRO produto da página não troca a foto da PDP', () => {
    const g = monta();

    escolhe('destaque-branco');

    expect(g.currentIndex).toBe(0);
    expect(g.images[1].classList.contains('hidden')).toBe(true);
  });
});

describe('fora de um produto', () => {
  it('galeria sem [product-context] não quebra e não escuta nada', () => {
    document.body.innerHTML = galeria;

    expect(() => new ProductGallery()).not.toThrow();
  });
});
