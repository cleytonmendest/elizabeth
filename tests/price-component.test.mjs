/**
 * assets/price-component.js — preço na troca de variante.
 *
 * O servidor pinta o preço em `snippets/price-v2.liquid`; este componente o
 * repinta assim que `variations-selector` dispara `variant:change` — o que
 * acontece já no carregamento da PDP.
 *
 * Este arquivo já teve duas suítes a mais: `parcelamento` e `concordância com
 * o Liquid (issue #48)`. Elas provavam que a conta de parcelas do JS dava o
 * mesmo número que a do Liquid — nunca que o número era verdadeiro. Ele nunca
 * era: o tema não tem os dados de parcelamento (ver
 * docs/adr/0008-o-tema-nao-calcula-dinheiro-que-o-checkout-nao-produz.md).
 * Saíram junto com a feature, na issue #80.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { textOf } from './helpers/dom.mjs';

// `price-component.js` chama `formatPrice` sem importar nada: no navegador ela
// é global porque `cart.js` a declara no topo de um script clássico. Carregar
// o cart.js de verdade reproduz esse acoplamento em vez de escondê-lo.
loadGlobalAsset('cart.js', ['formatPrice']);
loadAsset('price-component.js');

function monta() {
  document.body.innerHTML = `
    <div product-context>
      <price-component>
        <span class="listing-price"></span>
        <span class="selling-price"></span>
      </price-component>
    </div>`;
  const q = (sel) => document.querySelector(sel);
  return {
    context: q('[product-context]'),
    listing: q('.listing-price'),
    selling: q('.selling-price'),
  };
}

const trocaVariante = (context, variant) =>
  context.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('preço', () => {
  it('mostra o preço da variante', () => {
    const { context, selling } = monta();
    trocaVariante(context, { price: 12990, compare_at_price: null });
    expect(textOf(selling)).toBe('R$ 129,90');
  });

  it('mostra o preço riscado quando há desconto', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: 19900 });

    expect(listing.classList.contains('hidden')).toBe(false);
    expect(textOf(listing)).toBe('R$ 199,00');
  });

  it('esconde o preço riscado quando não há desconto', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: 9900 });
    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('esconde o riscado quando a variante não tem compare_at_price', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: null });
    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('trocar de variante cara para barata volta a esconder o riscado', () => {
    // Só o `toggle` garante isso: quem só adiciona a classe deixa o riscado
    // preso na tela da variante anterior.
    const { context, listing } = monta();

    trocaVariante(context, { price: 9900, compare_at_price: 19900 });
    trocaVariante(context, { price: 9900, compare_at_price: null });

    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('o preço-fallback de price-v2.liquid (1999) não trava o componente', () => {
    // `assign price = target.price | default: 1999` — quando o produto vem
    // nulo (preview de section sem produto escolhido), o servidor pinta
    // R$ 19,99. Uma variante com esse preço tem que repintar o mesmo número.
    const { context, selling } = monta();
    trocaVariante(context, { price: 1999, compare_at_price: null });

    expect(textOf(selling)).toBe('R$ 19,99');
  });
});

describe('fora de um [product-context]', () => {
  it('avisa em vez de quebrar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<price-component></price-component>';
    expect(console.warn).toHaveBeenCalledWith(
      'PriceComponent: Contexto do produto [product-context] não encontrado.'
    );
  });
});
