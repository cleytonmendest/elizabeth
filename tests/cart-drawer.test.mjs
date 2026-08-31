/**
 * assets/cart.js — <cart-drawer>: a bolha e o resumo.
 *
 * O outro consumidor do `cart-update`. Até a issue #4 ele recebia o item de
 * linha e lia `item_count`, `items_subtotal_price` e `total_price` — nenhum
 * dos três existe num item. A bolha mostrava `undefined` e o resumo, "R$ NaN".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { textOf } from './helpers/dom.mjs';

loadAsset('cart.js');

const CARRINHO = {
  item_count: 3,
  items: [{ id: 1, quantity: 3, final_line_price: 29970 }],
  items_subtotal_price: 29970,
  total_discount: 0,
  total_price: 29970,
};

function monta() {
  document.body.innerHTML = `
    <a id="minicart-button"><span id="qtd-bubble" class="hidden">0</span></a>
    <cart-drawer>
      <div id="minicart-overlay"></div>
      <div id="cart-empty" class="flex"></div>
      <div id="cart-container" class="hidden">
        <div id="cart-items-container">
          <div class="cart-item" data-index="1"><span class="item-total-price"></span></div>
        </div>
      </div>
    </cart-drawer>
    <div id="cart-summary-total">
      <span class="subtotal"></span><span class="discounts"></span><span class="total-price"></span>
    </div>`;
  return {
    bolha: document.querySelector('#qtd-bubble'),
    total: document.querySelector('.total-price'),
    vazio: document.querySelector('#cart-empty'),
    conteudo: document.querySelector('#cart-container'),
  };
}

const publica = (nome, detail) => document.dispatchEvent(new CustomEvent(nome, { detail }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('cart-update com um carrinho', () => {
  it('escreve a quantidade na bolha e o total no resumo', () => {
    const { bolha, total } = monta();

    publica('cart-update', CARRINHO);

    expect(textOf(bolha)).toBe('3');
    expect(textOf(total)).toBe('R$ 299,70');
  });

  it('carrinho cheio esconde o estado vazio e mostra o conteúdo', () => {
    const { vazio, conteudo } = monta();

    publica('cart-update', CARRINHO);

    expect(vazio.classList.contains('hidden')).toBe(true);
    expect(conteudo.classList.contains('flex')).toBe(true);
  });

  it('carrinho vazio faz o contrário', () => {
    const { vazio, conteudo, bolha } = monta();

    publica('cart-update', { ...CARRINHO, item_count: 0, items: [] });

    expect(vazio.classList.contains('flex')).toBe(true);
    expect(conteudo.classList.contains('hidden')).toBe(true);
    expect(bolha.classList.contains('hidden')).toBe(true);
  });
});

describe('cart-update com o que NÃO é carrinho — a regressão da issue #4', () => {
  it('a bolha nunca recebe undefined', () => {
    // O critério de aceite da issue, em uma linha. Antes da guarda, um item de
    // linha aqui escrevia literalmente "undefined" na bolha do header.
    const { bolha } = monta();
    const itemDeLinha = { id: 42, quantity: 2, price: 9990, final_line_price: 19980 };

    publica('cart-update', itemDeLinha);

    expect(textOf(bolha)).toBe('0');
    expect(textOf(bolha)).not.toContain('undefined');
  });

  it('o resumo nunca escreve NaN', () => {
    const { total } = monta();

    publica('cart-update', { id: 42, quantity: 2 });

    expect(textOf(total)).not.toContain('NaN');
  });

  it('quantity-update com payload errado não quebra a renderização', () => {
    // Sem a guarda isto lançava TypeError em `cart.items.forEach`, e o erro
    // subia sem ninguém tratar.
    const { bolha } = monta();

    expect(() => publica('quantity-update', { id: 42 })).not.toThrow();
    expect(textOf(bolha)).toBe('0');
  });
});
