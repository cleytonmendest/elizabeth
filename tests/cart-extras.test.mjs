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
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

/**
 * A página do carrinho — o outro consumidor deste arquivo, e o que não tinha
 * teste nenhum até a #66.
 *
 * `updateCartPage` mexe na DOM por SEIS ganchos que quem edita a section não
 * tem como adivinhar: [data-cart-page], .cart-item[data-key],
 * [data-cart-subtotal], [data-cart-total], [data-cart-discount] e
 * [data-cart-discount-row]. Enquanto a página era `templates/cart.liquid`,
 * renomear qualquer um deles deixava a suíte VERDE e o resumo do carrinho
 * congelado no valor do carregamento — a cliente mudava a quantidade e o total
 * não mudava junto.
 *
 * Ao virar `sections/main-cart.liquid` o markup passou a ser editável pela
 * lojista no editor de tema, então o contrato ficou mais exposto, não menos.
 */
describe('página do carrinho: o resumo acompanha o carrinho', () => {
  function montaPagina() {
    document.body.innerHTML = `
      <div data-cart-page>
        <div id="cart-items-container">
          <div class="cart-item" data-index="1" data-key="aaa"><span class="item-total-price">R$ 100,00</span></div>
          <div class="cart-item" data-index="2" data-key="bbb"><span class="item-total-price">R$ 50,00</span></div>
        </div>
        <span data-cart-subtotal>R$ 150,00</span>
        <span data-cart-total>R$ 150,00</span>
        <div class="hidden" data-cart-discount-row><span data-cart-discount>-R$ 0,00</span></div>
      </div>`;
    return {
      subtotal: document.querySelector('[data-cart-subtotal]'),
      total: document.querySelector('[data-cart-total]'),
      desconto: document.querySelector('[data-cart-discount]'),
      linhaDesconto: document.querySelector('[data-cart-discount-row]'),
      itens: () => [...document.querySelectorAll('.cart-item')].map((el) => el.dataset.key),
    };
  }

  const carrinhoCom = (itens, extras = {}) => ({
    item_count: itens.length,
    items: itens,
    items_subtotal_price: itens.reduce((s, i) => s + i.final_line_price, 0),
    total_discount: 0,
    total_price: itens.reduce((s, i) => s + i.final_line_price, 0),
    ...extras,
  });

  it('subtotal e total refletem o carrinho recebido', () => {
    const { subtotal, total } = montaPagina();

    publica('cart-update', carrinhoCom([
      { key: 'aaa', final_line_price: 20000 },
      { key: 'bbb', final_line_price: 5000 },
    ]));

    expect(textOf(subtotal)).toBe('R$ 250,00');
    expect(textOf(total)).toBe('R$ 250,00');
  });

  it('o item removido sai da DOM e os que ficam são renumerados', () => {
    const p = montaPagina();

    publica('cart-update', carrinhoCom([{ key: 'bbb', final_line_price: 5000 }]));

    expect(p.itens()).toEqual(['bbb']);
    // Era data-index="2"; virou o primeiro item da lista.
    expect(document.querySelector('.cart-item[data-key="bbb"]').dataset.index).toBe('1');
  });

  it('a linha de desconto aparece com desconto e some sem ele', () => {
    const p = montaPagina();
    const itens = [{ key: 'aaa', final_line_price: 20000 }, { key: 'bbb', final_line_price: 5000 }];

    publica('cart-update', carrinhoCom(itens, { total_discount: 3000 }));

    expect(p.linhaDesconto.classList.contains('hidden')).toBe(false);
    expect(textOf(p.desconto)).toBe('-R$ 30,00');

    publica('cart-update', carrinhoCom(itens, { total_discount: 0 }));

    expect(p.linhaDesconto.classList.contains('hidden')).toBe(true);
  });

  it('sem [data-cart-page] não toca em nada — o drawer tem DOM própria', () => {
    // O mesmo evento chega nas duas telas. Se o guarda de `updateCartPage`
    // cair, ele começa a apagar `.cart-item` do drawer pelo data-key.
    document.body.innerHTML = `
      <div id="cart-items-container">
        <div class="cart-item" data-index="1" data-key="aaa"></div>
      </div>`;

    publica('cart-update', carrinhoCom([{ key: 'zzz', final_line_price: 100 }]));

    expect(document.querySelectorAll('.cart-item')).toHaveLength(1);
  });

  it('item de linha no lugar do carrinho não apaga a página', () => {
    // Mesma defesa da issue #4, do lado da página: `ehCarrinho` barra antes.
    const p = montaPagina();

    publica('cart-update', { id: 42, quantity: 2, final_line_price: 19980 });

    expect(p.itens()).toEqual(['aaa', 'bbb']);
    expect(textOf(p.subtotal)).toBe('R$ 150,00');
  });
});

/**
 * O contrato dos dois lados. Os testes acima usam um fixture escrito à mão: se
 * a section parar de emitir um gancho, eles continuam verdes medindo um
 * carrinho que não existe mais. Este lê o arquivo de verdade.
 */
describe('sections/main-cart.liquid emite os ganchos que este JS consulta', () => {
  const section = readFileSync(path.resolve(process.cwd(), 'sections/main-cart.liquid'), 'utf8');

  it.each([
    ['data-cart-page', 'a raiz que distingue a página do drawer'],
    ['id="cart-items-container"', 'o container que o cart.js substitui'],
    ['data-cart-subtotal', 'o subtotal do resumo'],
    ['data-cart-total', 'o total do resumo'],
    ['data-cart-discount', 'o valor do desconto'],
    ['data-cart-discount-row', 'a linha que ganha e perde `hidden`'],
    ['data-cart-note', 'as observações, sincronizadas com o drawer'],
  ])('%s — %s', (gancho) => {
    expect(section).toContain(gancho);
  });

  it('pinta fundo E texto do color scheme, não só o fundo', () => {
    // `.color-scheme-N` só define as variáveis; pintar apenas o fundo deixa o
    // texto na cor herdada e é pior que não pintar. Ver `schemecontract`.
    expect(section).toContain('color-{{ section.settings.color_scheme }}');
    expect(section).toContain('color-background');
    expect(section).toContain('color-text');
  });
});
