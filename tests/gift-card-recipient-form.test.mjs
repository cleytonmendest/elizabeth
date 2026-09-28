/**
 * assets/gift-card-recipient-form.js — o destinatário do vale-presente com
 * JavaScript, e a recusa do `/cart/add.js` chegando à cliente (#139).
 *
 * A marcação é a do `snippets/add-to-cart.liquid` renderizado de verdade (ver
 * `tests/helpers/form-de-produto.mjs`): o componente é testado contra o HTML
 * que a loja serve, com o `<add-to-cart>` de `cart.js` em volta — é ele quem
 * envia o form e quem dispara o `cart-error`.
 *
 * A pergunta que atravessa o arquivo é UMA: o que vai no `FormData`? É ele que
 * o `CartManager.addToCart` manda para a Shopify, então "a caixa desmarcada
 * não manda nada" se mede ali, e não na aparência dos campos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';
import { renderizaFormDeProduto, produto, bloco, errosDoEnvio } from './helpers/form-de-produto.mjs';

loadGlobalAsset('money.js', ['formatMoney']);
loadAsset('cart.js');
loadAsset('gift-card-recipient-form.js');

const FUSO_DA_CLIENTE = 180; // UTC-3, em minutos, como `getTimezoneOffset()` devolve

beforeEach(() => {
  installMatchMedia(false);
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(FUSO_DA_CLIENTE);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  globalThis.routes = { cart_add_url: '/cart/add', cart_url: '/cart' };
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/**
 * A PDP mínima: o drawer que o `<add-to-cart>` abre — com o que o `<cart-drawer>`
 * atualiza quando o carrinho chega —, e o form do produto.
 */
function monta({ product = produto({ giftCard: true }), form = {} } = {}) {
  document.body.innerHTML = `
    <a id="minicart-button"><span id="qtd-bubble" class="hidden">0</span></a>
    <cart-drawer>
      <div id="minicart-overlay"></div>
      <div id="cart-empty" class="flex"></div>
      <div id="cart-container" class="hidden"></div>
      <div id="cart-summary-total"><span class="subtotal"></span><span class="total-price"></span></div>
    </cart-drawer>
    <div product-context>${renderizaFormDeProduto({ product, block: bloco({ show_dynamic_checkout: true }), form })}</div>`;

  const f = document.querySelector('form');
  const $ = (seletor) => f.querySelector(seletor);
  return {
    form: f,
    caixa: $('[data-caixa-destinatario]'),
    blocoDosCampos: $('[data-campos]'),
    email: $('[name="properties[Recipient email]"]'),
    nome: $('[name="properties[Recipient name]"]'),
    erroDoEmail: $('[data-erro-campo="email"]'),
    avisoGeral: $('[data-erro-carrinho]'),
    drawer: document.querySelector('cart-drawer'),
  };
}

/** Só as propriedades de linha que o form levaria agora. */
const propriedades = (form) =>
  [...new FormData(form)].filter(([nome]) => nome.startsWith('properties['));

function marca(caixa, marcada = true) {
  caixa.checked = marcada;
  caixa.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('com JavaScript, a caixa é a pergunta', () => {
  it('ao carregar: a caixa aparece, e desmarcada NENHUMA propriedade do destinatário vai no form', () => {
    // Inclui o `if_present` do estado sem JS: deixado ligado, ele mandaria o
    // cartão para o e-mail que a cliente digitou e depois desistiu de usar.
    const { form, caixa, blocoDosCampos } = monta();

    expect(caixa.disabled).toBe(false);
    expect(form.querySelector('[data-caixa]').hidden).toBe(false);
    expect(blocoDosCampos.hidden).toBe(true);
    expect(form.querySelector('p[data-sem-js]').hidden).toBe(true);
    expect(propriedades(form)).toEqual([]);
  });

  it('marcar liga os campos, o pedido de envio e o fuso da cliente', () => {
    const { form, caixa, blocoDosCampos, email, nome } = monta();

    marca(caixa);
    email.value = 'ana@exemplo.com';
    nome.value = 'Ana';
    const dados = new FormData(form);

    expect(blocoDosCampos.hidden).toBe(false);
    expect(dados.getAll('properties[__shopify_send_gift_card_to_recipient]')).toEqual(['true']);
    expect(dados.get('properties[Recipient email]')).toBe('ana@exemplo.com');
    expect(dados.get('properties[Recipient name]')).toBe('Ana');
    expect(dados.has('properties[Message]')).toBe(true);
    expect(dados.has('properties[Send on]')).toBe(true);
    expect(dados.get('properties[__shopify_offset]')).toBe(String(FUSO_DA_CLIENTE));
  });

  it('desmarcar desliga tudo de novo — inclusive o que já foi digitado', () => {
    const { form, caixa, email } = monta();

    marca(caixa);
    email.value = 'ana@exemplo.com';
    marca(caixa, false);

    expect(propriedades(form)).toEqual([]);
  });

  it('com JS, o e-mail é obrigatório só enquanto a caixa está marcada', () => {
    const { caixa, email } = monta();

    expect(email.required).toBe(false);
    marca(caixa);
    expect(email.required).toBe(true);
  });

  it('a página que volta de um envio recusado já abre com a caixa marcada e o erro à vista', () => {
    const { caixa, blocoDosCampos, erroDoEmail } = monta({
      form: { email: 'ana@', errors: errosDoEnvio({ email: 'Email inválido' }) },
    });

    expect(caixa.checked).toBe(true);
    expect(blocoDosCampos.hidden).toBe(false);
    expect(erroDoEmail.hidden).toBe(false);
    expect(erroDoEmail.textContent.trim()).toBe('Email inválido');
  });
});

describe('o erro de campo vai para o lado do campo', () => {
  const recusa = (detail) => new CustomEvent('cart-error', { bubbles: true, cancelable: true, detail });

  it('escreve a mensagem, marca o campo inválido e leva o foco até ele', () => {
    const { form, caixa, email, erroDoEmail } = monta();
    marca(caixa);

    const naoCancelado = form.dispatchEvent(
      recusa({ status: 422, message: 'Cart Error', description: 'Email is invalid', errors: { email: ['is invalid'] } }),
    );

    expect(erroDoEmail.hidden).toBe(false);
    expect(erroDoEmail.textContent).toBe('is invalid');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby').split(/\s+/)).toContain(erroDoEmail.id);
    expect(document.activeElement).toBe(email);
    // Cancelar é o aviso ao `<add-to-cart>`: o erro já foi dito.
    expect(naoCancelado).toBe(false);
  });

  it('também lê o mapa de campos quando ele vem em `description`', () => {
    const { form, caixa, erroDoEmail } = monta();
    marca(caixa);

    form.dispatchEvent(recusa({ status: 422, description: { email: ['is invalid'] } }));

    expect(erroDoEmail.textContent).toBe('is invalid');
  });

  it('recusa sem campo (estoque, limite) não é deste componente', () => {
    const { form, caixa, erroDoEmail } = monta();
    marca(caixa);

    const naoCancelado = form.dispatchEvent(recusa({ status: 422, description: 'Sem estoque suficiente.' }));

    expect(naoCancelado).toBe(true);
    expect(erroDoEmail.hidden).toBe(true);
  });

  it('um novo envio apaga os erros do anterior', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})); // a resposta não importa aqui
    const { form, caixa, email, erroDoEmail } = monta();
    marca(caixa);
    form.dispatchEvent(recusa({ status: 422, errors: { email: ['is invalid'] } }));

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(erroDoEmail.hidden).toBe(true);
    expect(erroDoEmail.textContent).toBe('');
    expect(email.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('o <add-to-cart> não esconde a recusa do /cart/add.js', () => {
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

  const envia = async (form) => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it('as propriedades do destinatário chegam ao /cart/add.js', async () => {
    globalThis.fetch = servidor({ id: 42, quantity: 1 });
    const { form, caixa, email } = monta();
    marca(caixa);
    email.value = 'ana@exemplo.com';

    await envia(form);

    const [url, config] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/cart/add');
    expect(config.body.get('properties[Recipient email]')).toBe('ana@exemplo.com');
    expect(config.body.get('properties[__shopify_send_gift_card_to_recipient]')).toBe('true');
  });

  it('recusa de campo: o erro aparece no campo, o aviso geral fica quieto, e o drawer não abre', async () => {
    globalThis.fetch = servidor({
      status: 422,
      message: 'Cart Error',
      description: 'Email is invalid',
      errors: { email: ['is invalid'] },
    });
    const { form, caixa, erroDoEmail, avisoGeral, drawer } = monta();
    const abre = vi.spyOn(drawer, 'open');
    marca(caixa);

    await envia(form);

    expect(erroDoEmail.textContent).toBe('is invalid');
    expect(avisoGeral.hidden).toBe(true);
    expect(abre).not.toHaveBeenCalled();
  });

  it('recusa sem campo: o aviso geral mostra o texto da Shopify, e o drawer não abre', async () => {
    // Antes, toda recusa seguia o caminho do sucesso: o drawer abria sem o
    // item e a cliente não sabia por quê.
    globalThis.fetch = servidor({ status: 422, message: 'Cart Error', description: 'Só restam 2 unidades.' });
    const { form, avisoGeral, drawer } = monta({ product: produto() });
    const abre = vi.spyOn(drawer, 'open');

    await envia(form);

    expect(avisoGeral.hidden).toBe(false);
    expect(avisoGeral.textContent).toBe('Só restam 2 unidades.');
    expect(abre).not.toHaveBeenCalled();
  });

  it('sucesso: o drawer abre, e o aviso de uma recusa anterior some', async () => {
    const { form, avisoGeral, drawer } = monta({ product: produto() });
    const abre = vi.spyOn(drawer, 'open');
    globalThis.fetch = servidor({ status: 422, description: 'Só restam 2 unidades.' });
    await envia(form);

    globalThis.fetch = servidor({ id: 42, quantity: 1 });
    await envia(form);

    expect(abre).toHaveBeenCalledOnce();
    expect(avisoGeral.hidden).toBe(true);
  });
});
