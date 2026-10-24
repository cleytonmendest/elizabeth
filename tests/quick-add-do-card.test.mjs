/**
 * assets/cart.js — o quick-add do card, que não tem <form> (ADR 0021).
 *
 * A marcação é a de `snippets/card-quick-add.liquid` renderizado de verdade e
 * posto DENTRO de um form de filtros, como `main-collection.liquid` e
 * `main-search.liquid` fazem: o componente é testado contra o HTML que a loja
 * serve, e é o aninhamento que quebrava o botão.
 *
 * Até aqui o `<add-to-cart>` só existia com um `<form>` dentro, e o card tinha o
 * dele. Sem form, o componente escuta o CLIQUE do botão e monta sozinho o que o
 * form levava em dois `<input hidden>`: a variante, que o Liquid pôs em
 * `data-variant-id`, e uma unidade.
 *
 * A pergunta que atravessa o arquivo é UMA: o que vai para o `/cart/add.js`, e
 * o que NÃO vai (os filtros da coleção).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';
import { renderizaArquivo } from './helpers/section-liquid.mjs';

loadGlobalAsset('money.js', ['formatMoney']);
loadAsset('cart.js');

beforeEach(() => {
  installMatchMedia(false);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  globalThis.routes = { cart_add_url: '/cart/add', cart_url: '/cart' };
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const IDS = [101, 102, 103];

/** O drawer que o `<add-to-cart>` abre, e a coleção com os cards dentro do form de filtros. */
function monta(ids = IDS) {
  const cards = ids
    .map((id) =>
      renderizaArquivo('snippets/card-quick-add.liquid', {
        product: { url: '/products/x', variants: { size: 1 }, selected_or_first_available_variant: { id } },
        button_class: 'w-full flex',
      })
    )
    .join('');

  document.body.innerHTML = `
    <a id="minicart-button"><span id="qtd-bubble" class="hidden">0</span></a>
    <cart-drawer>
      <div id="minicart-overlay"></div>
      <div id="cart-empty" class="flex"></div>
      <div id="cart-container" class="hidden"></div>
      <div id="cart-summary-total"><span class="subtotal"></span><span class="total-price"></span></div>
    </cart-drawer>
    <form id="filtros" data-filter-form method="get">
      <select name="sort_by"><option value="title-ascending" selected>A-Z</option></select>
      <div data-product-grid>${cards}</div>
    </form>`;

  return {
    filtros: document.getElementById('filtros'),
    botoes: [...document.querySelectorAll('add-to-cart button[name="add"]')],
    drawer: document.querySelector('cart-drawer'),
  };
}

/** `/cart/add.js` e `/cart.js`, na ordem em que o `<add-to-cart>` os pede. */
function servidor(respostaDoAdd) {
  return vi.fn(async (url) => ({
    json: async () =>
      url === '/cart/add'
        ? respostaDoAdd
        : { items: [], item_count: 1, items_subtotal_price: 5000, total_discount: 0, total_price: 5000 },
    text: async () => '',
  }));
}

const clica = async (botao) => {
  botao.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('o clique adiciona ao carrinho', () => {
  it('manda a variante DO CARD clicado, com uma unidade — de qualquer card, inclusive o primeiro', async () => {
    // O primeiro era justamente o que o form aninhado quebrava.
    globalThis.fetch = servidor({ id: 101, quantity: 1 });
    const { botoes } = monta();

    for (const [i, botao] of botoes.entries()) {
      await clica(botao);

      const [url, config] = globalThis.fetch.mock.calls.filter(([u]) => u === '/cart/add')[i];
      expect(url).toBe('/cart/add');
      expect(config.method).toBe('POST');
      expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest');
      expect(config.body.get('id')).toBe(String(IDS[i]));
      expect(config.body.get('quantity')).toBe('1');
    }
  });

  it('um clique, um envio: os listeners dos outros cards não respondem', async () => {
    globalThis.fetch = servidor({ id: 102, quantity: 1 });
    const { botoes } = monta();

    await clica(botoes[1]);

    expect(globalThis.fetch.mock.calls.filter(([u]) => u === '/cart/add')).toHaveLength(1);
  });

  it('sucesso: o drawer abre e o item é anunciado', async () => {
    globalThis.fetch = servidor({ id: 101, quantity: 1 });
    const { botoes, drawer } = monta();
    const abre = vi.spyOn(drawer, 'open');
    const anunciados = [];
    document.addEventListener('cart:item-added', (e) => anunciados.push(e.detail));

    await clica(botoes[0]);

    expect(abre).toHaveBeenCalledOnce();
    expect(anunciados).toEqual([{ id: 101, quantity: 1 }]);
  });
});

describe('o clique não envia o form de filtros', () => {
  it('nenhum submit sai do form que envolve o card', async () => {
    globalThis.fetch = servidor({ id: 101, quantity: 1 });
    const { filtros, botoes } = monta();
    const envios = vi.fn((e) => e.preventDefault());
    filtros.addEventListener('submit', envios);

    for (const botao of botoes) await clica(botao);

    expect(envios).not.toHaveBeenCalled();
  });

  it('o corpo do envio não leva campo de filtro', async () => {
    globalThis.fetch = servidor({ id: 101, quantity: 1 });
    const { botoes } = monta();

    await clica(botoes[0]);

    const [, config] = globalThis.fetch.mock.calls.find(([u]) => u === '/cart/add');
    expect([...config.body.keys()].sort()).toEqual(['id', 'quantity']);
  });
});

describe('a recusa do /cart/add.js', () => {
  it('cart-error sai do <add-to-cart> (não há form) e chega ao document com o motivo da Shopify', async () => {
    const recusa = { status: 422, message: 'Cart Error', description: 'Só restam 2 unidades.' };
    globalThis.fetch = servidor(recusa);
    const { botoes } = monta();
    const ouvido = [];
    document.addEventListener('cart-error', (e) => ouvido.push({ detail: e.detail, alvo: e.target.localName }));

    await clica(botoes[0]);

    expect(ouvido).toEqual([{ detail: recusa, alvo: 'add-to-cart' }]);
  });

  it('o card não tem onde mostrar o aviso: o drawer abre como antes, e o item não é anunciado', async () => {
    // O comentário de `_mostraErro` já diz: sem lugar para mostrar (o quick-add
    // do card, a barra fixa), devolve `false` e o drawer abre. O que este teste
    // acrescenta é que a recusa NÃO vira `cart:item-added`, e que nada lança por
    // o componente não ter `this.form`.
    globalThis.fetch = servidor({ status: 422, description: 'Sem estoque.' });
    const { botoes, drawer } = monta();
    const abre = vi.spyOn(drawer, 'open');
    const anunciados = vi.fn();
    document.addEventListener('cart:item-added', anunciados);

    await clica(botoes[0]);

    expect(abre).toHaveBeenCalledOnce();
    expect(anunciados).not.toHaveBeenCalled();
    // O `<cart-drawer>` loga todo `cart-error` ("Erro detectado:"), de propósito.
    // O que NÃO pode aparecer é o log do `catch` do envio: ele é o sintoma de
    // `this.form.dispatchEvent` sobre um form que o card não tem.
    expect(console.error).not.toHaveBeenCalledWith('Erro ao adicionar o produto ao carrinho:', expect.anything());
  });
});
