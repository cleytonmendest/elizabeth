/**
 * assets/cart.js — formatação de preço, pub/sub e CartManager.
 *
 * O CartManager é a única porta do tema para a API de carrinho da Shopify. O
 * que se verifica aqui é o CONTRATO com essa API: qual URL, qual método, quais
 * cabeçalhos, qual corpo, e qual evento sai depois. Nenhuma dessas escolhas é
 * visível na tela — quebrar uma delas dá um carrinho que falha em silêncio.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { normalizeCurrency } from './helpers/dom.mjs';

const { formatPrice, fetchConfig, publish, debounce, PUB_SUB_EVENTS, CartManager } = loadAsset(
  'cart.js',
  ['formatPrice', 'fetchConfig', 'publish', 'debounce', 'PUB_SUB_EVENTS', 'CartManager']
);

const brl = (cents) => normalizeCurrency(formatPrice(cents));

describe('formatPrice', () => {
  it('converte centavos em BRL', () => {
    // A API da Shopify devolve centavos inteiros; a vitrine mostra reais.
    expect(brl(1999)).toBe('R$ 19,99');
    expect(brl(99999)).toBe('R$ 999,99');
    expect(brl(0)).toBe('R$ 0,00');
  });

  it('formata desconto negativo com o sinal antes do símbolo', () => {
    // `updateCartSummary` ainda prefixa um "-" próprio nos descontos, então
    // um valor já negativo apareceria como "--R$". Quem chama passa positivo.
    expect(brl(-500)).toBe('-R$ 5,00');
  });

  it('arredonda a fração de centavo em vez de vazar decimal', () => {
    // 1999 / 3 = 666,333… centavos. Sem arredondamento sairia "R$ 6,663333".
    expect(brl(1999 / 3)).toBe('R$ 6,66');
  });
});

describe('fetchConfig', () => {
  it('POSTa JSON por padrão', () => {
    const config = fetchConfig();
    expect(config.method).toBe('POST');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers.Accept).toBe('application/json');
  });

  it('aceita outro tipo de resposta', () => {
    expect(fetchConfig('javascript').headers.Accept).toBe('application/javascript');
  });
});

describe('publish', () => {
  it('emite CustomEvent no document com o detail intacto', () => {
    const ouvinte = vi.fn();
    document.addEventListener(PUB_SUB_EVENTS.cartUpdate, ouvinte);

    publish(PUB_SUB_EVENTS.cartUpdate, { item_count: 3 });

    expect(ouvinte).toHaveBeenCalledOnce();
    expect(ouvinte.mock.calls[0][0].detail).toEqual({ item_count: 3 });
    document.removeEventListener(PUB_SUB_EVENTS.cartUpdate, ouvinte);
  });

  it('os nomes de evento são os que os componentes escutam', () => {
    // Trocar um destes desacopla silenciosamente drawer, bolha e preço: o
    // publisher continua publicando e ninguém mais ouve.
    expect(PUB_SUB_EVENTS).toEqual({
      cartUpdate: 'cart-update',
      quantityUpdate: 'quantity-update',
      variantChange: 'variant-change',
      cartError: 'cart-error',
    });
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('só executa depois do intervalo', () => {
    const fn = vi.fn();
    debounce(fn, 300)();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('colapsa uma rajada numa chamada só, com os últimos argumentos', () => {
    // É o que impede o +/+/+ rápido de disparar três PATCHes no carrinho.
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced(1);
    vi.advanceTimersByTime(200);
    debounced(2);
    vi.advanceTimersByTime(200);
    debounced(3);
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(3);
  });
});

describe('CartManager', () => {
  let eventos;
  let ouvintes;

  beforeEach(() => {
    globalThis.routes = {
      cart_url: '/carrinho',
      cart_add_url: '/carrinho/add',
      cart_change_url: '/carrinho/change',
    };
    eventos = [];
    // O `document` sobrevive entre os testes do arquivo. Sem remover os
    // ouvintes no fim, o segundo teste veria os eventos do primeiro.
    ouvintes = Object.values(PUB_SUB_EVENTS).map((nome) => {
      const fn = (e) => eventos.push({ nome, detail: e.detail });
      document.addEventListener(nome, fn);
      return [nome, fn];
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [nome, fn] of ouvintes) document.removeEventListener(nome, fn);
    vi.restoreAllMocks();
    delete globalThis.fetch;
  });

  const respondeCom = (corpo) => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => corpo });
    return globalThis.fetch;
  };

  describe('getCart', () => {
    it('lê a rota do carrinho com o sufixo .js e publica cart-update', async () => {
      // `routes` vem do Liquid (window.routes em theme.liquid). Cravar "/cart"
      // aqui quebraria a loja em inglês, onde a rota é traduzida.
      const carrinho = { item_count: 2, items: [] };
      const fetch = respondeCom(carrinho);

      await expect(CartManager.getCart()).resolves.toEqual(carrinho);

      expect(fetch).toHaveBeenCalledWith('/carrinho.js');
      expect(eventos).toEqual([{ nome: 'cart-update', detail: carrinho }]);
    });

    it('propaga a falha em vez de devolver carrinho vazio', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

      await expect(CartManager.getCart()).rejects.toThrow('offline');
      expect(eventos).toEqual([]);
    });
  });

  describe('addToCart', () => {
    it('envia o formulário como FormData no formato que a Shopify exige', async () => {
      document.body.innerHTML = `
        <form>
          <input type="hidden" name="id" value="42">
          <input type="hidden" name="quantity" value="2">
        </form>`;
      const fetch = respondeCom({ id: 42, quantity: 2 });

      await CartManager.addToCart(document.querySelector('form'));

      const [url, config] = fetch.mock.calls[0];
      expect(url).toBe('/carrinho/add');
      expect(config.method).toBe('POST');
      // Sem X-Requested-With a Shopify responde com um redirect HTML.
      expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest');
      // Com Content-Type: application/json o navegador não põe o boundary do
      // multipart e o corpo chega ilegível do outro lado.
      expect(config.headers).not.toHaveProperty('Content-Type');
      expect(config.body.get('id')).toBe('42');
      expect(config.body.get('quantity')).toBe('2');
    });

    it('publica cart-update com a resposta', async () => {
      document.body.innerHTML = '<form><input name="id" value="42"></form>';
      respondeCom({ id: 42 });

      await CartManager.addToCart(document.querySelector('form'));

      expect(eventos).toEqual([{ nome: 'cart-update', detail: { id: 42 } }]);
    });
  });

  describe('updateQuantity', () => {
    it('manda linha e quantidade como JSON e publica quantity-update', async () => {
      const carrinho = { item_count: 1, items: [] };
      const fetch = respondeCom(carrinho);

      await CartManager.updateQuantity('2', 5);

      const [url, config] = fetch.mock.calls[0];
      expect(url).toBe('/carrinho/change');
      expect(JSON.parse(config.body)).toEqual({ line: '2', quantity: 5 });
      expect(eventos).toEqual([{ nome: 'quantity-update', detail: carrinho }]);
    });

    it('quantidade 0 é a remoção do item — mesma rota, sem caso especial', async () => {
      const fetch = respondeCom({ item_count: 0, items: [] });

      await CartManager.updateQuantity('1', 0);

      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ line: '1', quantity: 0 });
    });

    it('publica cart-error ANTES de propagar a falha', async () => {
      // É a única das três que avisa: o drawer precisa saber que a quantidade
      // na tela não bate mais com o servidor.
      const falha = new Error('sem estoque');
      globalThis.fetch = vi.fn().mockRejectedValue(falha);

      await expect(CartManager.updateQuantity('1', 99)).rejects.toThrow('sem estoque');
      expect(eventos).toEqual([{ nome: 'cart-error', detail: falha }]);
    });
  });
});
