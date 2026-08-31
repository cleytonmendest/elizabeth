/**
 * assets/cart-extras.js — a barra de frete grátis.
 *
 * Este arquivo escuta `cart-update` e `quantity-update` e lê `total_price`,
 * `items` e `item_count` do payload. O cabeçalho dele AFIRMA que os dois
 * eventos trazem o carrinho completo — e até a issue #4 essa afirmação era
 * falsa metade das vezes, porque `addToCart` publicava o item de linha.
 *
 * O sintoma não era abstrato: `Math.max(limiar - undefined, 0)` é NaN, e a
 * cliente via "Faltam R$ NaN para frete grátis" logo depois de adicionar um
 * produto. Estes testes existem para que a afirmação do cabeçalho passe a ser
 * verificada em vez de escrita.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { textOf } from './helpers/dom.mjs';

const LIMIAR = 19900; // frete grátis a partir de R$ 199,00

function montaBarra() {
  document.body.innerHTML = `
    <div
      data-free-shipping-bar
      data-threshold="${LIMIAR}"
      data-msg-success="Você ganhou frete grátis!"
      data-msg-progress="Faltam {valor} para frete grátis"
    >
      <p data-fs-message></p>
      <div><div data-fs-fill style="width: 0%"></div></div>
    </div>`;
  return {
    mensagem: document.querySelector('[data-fs-message]'),
    preenchimento: document.querySelector('[data-fs-fill]'),
  };
}

const carrinho = (total_price) => ({
  item_count: 1,
  items: [{ id: 1, quantity: 1, final_line_price: total_price }],
  items_subtotal_price: total_price,
  total_discount: 0,
  total_price,
});

const publica = (nome, detail) => document.dispatchEvent(new CustomEvent(nome, { detail }));

// O IIFE registra os ouvintes no `document` uma vez, no carregamento.
loadAsset('cart-extras.js');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('barra de frete grátis', () => {
  it('mostra quanto falta, com o valor formatado', () => {
    const { mensagem, preenchimento } = montaBarra();

    publica('cart-update', carrinho(9990)); // R$ 99,90 de R$ 199,00

    expect(textOf(mensagem)).toBe('Faltam R$ 99,10 para frete grátis');
    expect(parseFloat(preenchimento.style.width)).toBeCloseTo(50.2, 1);
  });

  it('troca para a mensagem de conquista ao atingir o limiar', () => {
    const { mensagem, preenchimento } = montaBarra();

    publica('cart-update', carrinho(LIMIAR));

    expect(textOf(mensagem)).toBe('Você ganhou frete grátis!');
    expect(preenchimento.style.width).toBe('100%');
  });

  it('não passa de 100% quando o carrinho excede o limiar', () => {
    const { preenchimento } = montaBarra();
    publica('cart-update', carrinho(LIMIAR * 3));
    expect(preenchimento.style.width).toBe('100%');
  });

  it('quantity-update atualiza a barra igual a cart-update', () => {
    const { mensagem } = montaBarra();
    publica('quantity-update', carrinho(9990));
    expect(textOf(mensagem)).toBe('Faltam R$ 99,10 para frete grátis');
  });

  it('NUNCA escreve NaN — a regressão da issue #4', () => {
    // A prova do defeito, na forma que a cliente via. Um item de linha não tem
    // `total_price`; se algum publicador voltar a mandar um no `cart-update`,
    // a conta vira NaN e este teste reprova em vez de a loja exibir isso.
    const { mensagem, preenchimento } = montaBarra();
    const itemDeLinha = { id: 42, quantity: 2, price: 9990, final_line_price: 19980 };

    publica('cart-update', itemDeLinha);

    expect(textOf(mensagem)).not.toContain('NaN');
    expect(preenchimento.style.width).not.toContain('NaN');
  });
});
