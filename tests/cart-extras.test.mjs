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
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { textOf, installShopify } from './helpers/dom.mjs';
import { renderiza, linha, carrinho as carrinhoDaLoja, globaisDaLoja } from './helpers/liquid-carrinho.mjs';

// `cart-extras.js` formata preço com a `formatMoney` global de `money.js`, que
// por sua vez lê moeda e idioma de `window.Shopify` — a vitrine escreve os
// dois, o jsdom não escreve nenhum.
loadGlobalAsset('money.js', ['formatMoney']);
installShopify();

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
 * `updateCartPage` mexe na DOM por ganchos que quem edita a section não tem
 * como adivinhar: [data-cart-page], .cart-item[data-key], [data-cart-subtotal]
 * e [data-cart-total] — e, desde a #144, as regiões [data-cart-live] que o
 * servidor redesenha. Enquanto a página era `templates/cart.liquid`,
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
      </div>`;
    return {
      subtotal: document.querySelector('[data-cart-subtotal]'),
      total: document.querySelector('[data-cart-total]'),
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

  it('sem [data-cart-page] não toca em nada — o drawer tem DOM própria', () => {
    // O mesmo evento chega nas duas telas. Se o guarda de `updateCartPage`
    // cair, ele começa a apagar `.cart-item` do drawer pelo data-key.
    document.body.innerHTML = `
      <div id="cart-drawer-items">
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
 * O desconto que liga e desliga com a quantidade — o critério de aceite da
 * #144 que só o JS alcança.
 *
 * "Leve 2, pague menos" é desconto AUTOMÁTICO: a cliente não digita nada, ela
 * aperta o + e o desconto passa a valer. O nome dele, e se ele vale para o
 * item ou para o pedido, só o servidor sabe desenhar — então a página e a
 * gaveta pedem as próprias sections de volta e trocam as regiões
 * `[data-cart-live]`.
 *
 * Os dois lados deste teste saem do Liquid de verdade: a página viva é
 * `sections/main-cart.liquid` renderizada com o carrinho de ANTES, e a
 * resposta do "servidor" é o mesmo arquivo renderizado com o carrinho de
 * DEPOIS. Se o snippet renomear uma região, esquecer a chave da linha ou
 * deixar de desenhar o desconto, este teste fica vermelho — um fixture escrito
 * à mão continuaria verde (ADR 0014).
 */
describe('os descontos aparecem e somem sem recarregar (#144)', () => {
  const PAGINA = 'template--1__main';
  const GAVETA = 'cart-drawer';
  const SECTION = {
    id: PAGINA,
    settings: { color_scheme: 'scheme-1', show_continue_shopping: true, show_notes: false, checkout_label: '' },
  };

  const pagina = (cart) =>
    renderiza('sections/main-cart.liquid', { escopo: { section: SECTION }, globais: globaisDaLoja(cart) });
  const gaveta = (cart) =>
    renderiza('sections/cart-drawer.liquid', { escopo: { section: { id: GAVETA } }, globais: globaisDaLoja(cart) });

  /** Uma unidade: nenhum desconto vale. */
  const UMA = carrinhoDaLoja([linha()]);
  /** Duas unidades: "COMPRE2" no item e "FRETE10" no pedido passam a valer. */
  const DUAS = carrinhoDaLoja(
    [linha({ quantity: 2, preco: 40000, desconto: { nome: 'COMPRE2', valor: 4000 } })],
    { descontosDoPedido: [{ nome: 'FRETE10', valor: 1000 }] }
  );

  /** O servidor responde, a cada pedido, com as sections do carrinho que recebeu. */
  function servidor(...carrinhos) {
    const fila = [...carrinhos];
    globalThis.fetch = vi.fn(async () => {
      const cart = fila.shift();
      return { json: async () => ({ [PAGINA]: pagina(cart), [GAVETA]: gaveta(cart) }) };
    });
    return globalThis.fetch;
  }

  const naPagina = (seletor) => document.querySelector(`[data-cart-page] ${seletor}`);
  const textoNaPagina = (seletor) => textOf(naPagina(seletor) ?? document.createElement('i'));

  beforeEach(() => {
    window.routes = { cart_url: '/cart' };
    document.body.innerHTML = pagina(UMA);
  });

  afterEach(() => {
    delete window.routes;
    delete globalThis.fetch;
    vi.restoreAllMocks();
  });

  it('o + que liga o desconto mostra o nome no item e no pedido; o − que desliga some com os dois', async () => {
    servidor(DUAS, UMA);

    publica('quantity-update', DUAS);

    await vi.waitFor(() => expect(textoNaPagina('.cart-item ul')).toBe('COMPRE2 (-R$ 40,00)'));
    expect(textoNaPagina('.cart-item s')).toBe('R$ 400,00');
    expect(textoNaPagina('[data-cart-live="resumo"] ul')).toBe('FRETE10 -R$ 10,00');

    publica('quantity-update', UMA);

    await vi.waitFor(() => expect(naPagina('.cart-item ul')).toBeNull());
    expect(naPagina('.cart-item s')).toBeNull();
    expect(naPagina('[data-cart-live="resumo"] ul')).toBeNull();
  });

  it('pede as sections da página E da gaveta num pedido só', async () => {
    // A gaveta mora em toda página, inclusive nesta: as duas mostram o mesmo
    // carrinho, e a Section Rendering API devolve várias sections de uma vez.
    document.body.innerHTML = gaveta(UMA) + pagina(UMA);
    const fetch = servidor(DUAS);

    publica('quantity-update', DUAS);

    await vi.waitFor(() => expect(textOf(document.querySelector('#cart-summary-total ul') ?? document.createElement('i'))).toBe('FRETE10 -R$ 10,00'));
    expect(textoNaPagina('[data-cart-live="resumo"] ul')).toBe('FRETE10 -R$ 10,00');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`/cart?sections=${GAVETA},${PAGINA}`);
  });

  it('o seletor de quantidade é o MESMO elemento depois do redesenho — o foco não se perde', async () => {
    // Trocar a lista inteira seria mais simples, e tiraria o foco do + que a
    // cliente acabou de apertar: o segundo clique cairia no vazio.
    const seletor = naPagina('quantity-input');
    servidor(DUAS);

    publica('quantity-update', DUAS);

    await vi.waitFor(() => expect(naPagina('.cart-item ul')).not.toBeNull());
    expect(naPagina('quantity-input')).toBe(seletor);
  });

  it('um item que o servidor acrescentou (um brinde) entra na lista', async () => {
    // Não há região correspondente onde encaixar uma linha nova: quando o
    // conjunto de itens muda, a lista inteira é trocada.
    const brinde = linha({ key: '999:brinde', index: 1, preco: 0 });
    const comBrinde = carrinhoDaLoja([linha(), brinde]);
    servidor(comBrinde);

    publica('cart-update', comBrinde);

    await vi.waitFor(() =>
      expect([...document.querySelectorAll('[data-cart-page] .cart-item')].map((el) => el.dataset.key)).toEqual([
        '111:aaa',
        '999:brinde',
      ])
    );
  });

  it('a resposta atrasada de um pedido antigo não desfaz o mais novo', async () => {
    // Dois cliques no + e o servidor responde fora de ordem. Sem a guarda, a
    // resposta do primeiro (sem desconto) chegaria por último e ficaria na
    // tela — com o desconto valendo no checkout e sumido do carrinho.
    const respostas = [];
    globalThis.fetch = vi.fn(
      () => new Promise((resolve) => respostas.push(resolve))
    );
    const responde = (i, cart) =>
      respostas[i]({ json: async () => ({ [PAGINA]: pagina(cart), [GAVETA]: gaveta(cart) }) });

    publica('quantity-update', UMA);
    publica('quantity-update', DUAS);
    expect(respostas).toHaveLength(2);

    responde(1, DUAS);
    await vi.waitFor(() => expect(naPagina('.cart-item ul')).not.toBeNull());
    responde(0, UMA);
    await new Promise((r) => setTimeout(r, 20));

    expect(textoNaPagina('.cart-item ul')).toBe('COMPRE2 (-R$ 40,00)');
    expect(textoNaPagina('[data-cart-live="resumo"] ul')).toBe('FRETE10 -R$ 10,00');
  });

  it('servidor fora do ar: fica o que o JSON já escreveu, sem exceção solta', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    publica('quantity-update', DUAS);

    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(textoNaPagina('[data-cart-total]')).toBe('R$ 350,00');
  });

  it('carrinho vazio não pede nada — a página recarrega de qualquer jeito', () => {
    document.body.innerHTML = gaveta(UMA);
    const fetch = servidor(UMA);

    publica('cart-update', { ...UMA, item_count: 0, items: [] });

    expect(fetch).not.toHaveBeenCalled();
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
    ['data-cart-section="{{ section.id }}"', 'o id que o redesenho pede ao servidor'],
    ['data-cart-items', 'a lista que é trocada inteira quando os itens mudam'],
    ['data-cart-live="resumo"', 'o resumo, com os descontos do pedido'],
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
