/**
 * O form de produto — `snippets/add-to-cart.liquid` renderizado de verdade.
 *
 * Três requisitos da Theme Store moram dentro deste `{% form 'product' %}`, e
 * o que decide cada um é Liquid, não JavaScript:
 *
 *   #134  o checkout acelerado: ligado por padrão, fora do vale-presente, e
 *         sem oferecer compra de variante esgotada
 *   #138  o banner do Shop Pay Installments
 *   #139  o formulário de destinatário do vale-presente, que precisa funcionar
 *         sem JavaScript
 *
 * O HTML vem do `liquidjs` (ver `tests/helpers/form-de-produto.mjs`, que diz o
 * que é de mentira ali). O componente do destinatário NÃO é carregado neste
 * arquivo, de propósito: o que se mede aqui é o estado em que a página chega
 * para quem está sem JavaScript. O estado com JS está em
 * `tests/gift-card-recipient-form.test.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';
import {
  renderizaFormDeProduto,
  produto,
  bloco,
  errosDoEnvio,
  defaultsDoBotaoDeCompra,
} from './helpers/form-de-produto.mjs';

loadAsset('cart.js');

beforeEach(() => {
  installMatchMedia(false);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Monta o form na página, dentro de um `[product-context]` como na PDP. */
function monta(opcoes) {
  document.body.innerHTML = `<div product-context>${renderizaFormDeProduto(opcoes)}</div>`;
  const form = document.querySelector('form');
  return {
    context: document.querySelector('[product-context]'),
    form,
    idInput: form.querySelector('input[name="id"]'),
    botao: form.querySelector('button[name="add"]'),
    acelerado: form.querySelector('[data-checkout-acelerado]'),
    botaoAcelerado: form.querySelector('[data-teste="payment_button"]'),
  };
}

const trocaVariante = (context, variant) =>
  context.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));

describe('checkout acelerado na PDP (#134)', () => {
  it.each(['main-product.liquid', 'highlighted-product.liquid'])(
    'o bloco com os defaults do schema de %s já mostra o acelerado, dentro do form',
    (section) => {
      // "Ligado por padrão" é o requisito, e ele tem duas metades que só
      // valem juntas: o default do setting e o `if` que o lê. Medir uma sem a
      // outra aprovaria um default `true` num setting que ninguém consulta.
      const { botaoAcelerado } = monta({ block: bloco(defaultsDoBotaoDeCompra(section)) });

      expect(botaoAcelerado).not.toBeNull();
    },
  );

  it('desligado no bloco, não aparece', () => {
    const { acelerado, botaoAcelerado } = monta({ block: bloco({ show_dynamic_checkout: false }) });

    expect(acelerado).toBeNull();
    expect(botaoAcelerado).toBeNull();
  });

  it('vale-presente nunca oferece o acelerado, mesmo ligado no bloco', () => {
    // A validação do destinatário não roda no checkout acelerado. Um clique
    // ali compraria o cartão sem destinatário — e sem aviso.
    const { botaoAcelerado } = monta({
      product: produto({ giftCard: true }),
      block: bloco({ show_dynamic_checkout: true }),
    });

    expect(botaoAcelerado).toBeNull();
  });

  it('variante inicial esgotada: o acelerado nasce escondido e o `id` fica fora do form', () => {
    const { acelerado, form } = monta({
      product: produto({ disponivel: false }),
      block: bloco({ show_dynamic_checkout: true }),
    });

    expect(acelerado.hidden).toBe(true);
    expect(new FormData(form).has('id')).toBe(false);
  });

  it('o acelerado fica embaixo, e a quantidade lateral continua ao lado do botão', () => {
    // O form era uma linha só (`flex gap-3`): quantidade | botão. Pôr o
    // acelerado ali dentro o espremeria como terceira coluna.
    const { botao, acelerado } = monta({ hasQtd: true, block: bloco({ show_dynamic_checkout: true }) });
    const linha = botao.parentElement;

    expect(linha.querySelector('quantity-selector')).not.toBeNull();
    expect(linha.contains(acelerado)).toBe(false);
    expect(botao.compareDocumentPosition(acelerado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('a troca de variante no <add-to-cart>', () => {
  it('esgotada → à venda: o `id` volta ao form e o acelerado reaparece', () => {
    // O defeito que existia antes do acelerado: o `disabled` que o Liquid põe
    // no input nunca era tirado, e a cliente que abria a página numa variante
    // esgotada e escolhia outra mandava um form sem `id`.
    const { context, form, acelerado } = monta({
      product: produto({ disponivel: false }),
      block: bloco({ show_dynamic_checkout: true }),
    });

    trocaVariante(context, { id: 99, available: true });

    expect(new FormData(form).get('id')).toBe('99');
    expect(acelerado.hidden).toBe(false);
  });

  it('à venda → esgotada: o acelerado sai e o `id` não vai', () => {
    const { context, form, acelerado } = monta({ block: bloco({ show_dynamic_checkout: true }) });

    trocaVariante(context, { id: 99, available: false });

    expect(acelerado.hidden).toBe(true);
    expect(new FormData(form).has('id')).toBe(false);
  });

  it('combinação inexistente: mesmo tratamento de esgotada', () => {
    const { context, form, acelerado } = monta({ block: bloco({ show_dynamic_checkout: true }) });

    trocaVariante(context, undefined);

    expect(acelerado.hidden).toBe(true);
    expect(new FormData(form).has('id')).toBe(false);
  });

  it('o input `id` avisa que mudou — é por ele que o banner e o acelerado acompanham a variante', () => {
    // `.value = x` por script não dispara evento nenhum. Sem o aviso, o
    // parcelamento do Shop Pay continuaria calculado sobre o preço da
    // variante inicial (#138).
    const { context, form, idInput } = monta();
    const vistos = [];
    form.addEventListener('change', (e) => vistos.push([e.target, e.target.value]));

    trocaVariante(context, { id: 99, available: true });

    expect(vistos).toEqual([[idInput, '99']]);
  });
});

describe('Shop Pay Installments (#138)', () => {
  it.each([
    ['produto comum', produto()],
    ['variante esgotada', produto({ disponivel: false })],
    ['vale-presente', produto({ giftCard: true })],
  ])('o banner mora dentro do form em %s', (_, product) => {
    // O helper recusa `payment_terms` fora de um `{% form 'product' %}` —
    // fora do form a Shopify não renderiza nada, e ninguém notaria numa loja
    // brasileira, onde ele também não renderiza nada DENTRO.
    const { form } = monta({ product });

    expect(form.querySelector('[data-teste="payment_terms"]')).not.toBeNull();
  });
});

describe('destinatário do vale-presente — o HTML (#139)', () => {
  const doVale = (opcoes = {}) => monta({ product: produto({ giftCard: true }), ...opcoes });
  const campos = (raiz = document) =>
    [...raiz.querySelectorAll('gift-card-recipient-form input, gift-card-recipient-form textarea')].filter(
      (el) => el.type !== 'hidden',
    );

  it('só existe em vale-presente', () => {
    expect(monta().form.querySelector('gift-card-recipient-form')).toBeNull();
    expect(doVale().form.querySelector('gift-card-recipient-form')).not.toBeNull();
  });

  it('todo campo tem id único na página e um <label for> — mesmo com dois forms', () => {
    // Dois blocos de compra na mesma página (a PDP e um produto em destaque)
    // não podem gerar o mesmo id: o `<label for>` do segundo apontaria para o
    // campo do primeiro.
    const product = produto({ giftCard: true });
    document.body.innerHTML =
      renderizaFormDeProduto({ product, block: bloco({}, 'buy_button_A') }) +
      renderizaFormDeProduto({ product, block: bloco({}, 'buy_button_B') });

    const todos = campos();
    const ids = todos.map((el) => el.id);

    expect(todos).toHaveLength(10); // caixa + 4 campos, duas vezes
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(document.querySelectorAll(`label[for="${id}"]`), `sem <label for="${id}">`).toHaveLength(1);
    }
  });

  it('todo id citado por aria-describedby e aria-controls existe', () => {
    doVale();

    const citados = [...document.querySelectorAll('[aria-describedby], [aria-controls]')].flatMap((el) =>
      `${el.getAttribute('aria-describedby') ?? ''} ${el.getAttribute('aria-controls') ?? ''}`.split(/\s+/),
    );

    for (const id of citados.filter(Boolean)) {
      expect(document.getElementById(id), `#${id} não existe`).not.toBeNull();
    }
  });

  it('sem JavaScript: os campos ficam à vista e o form manda `if_present`, sem o fuso', () => {
    // `if_present`: a Shopify só envia para outra pessoa se o e-mail vier
    // preenchido. Com `true` aqui, quem compra para si mesma sem JS teria o
    // form recusado por falta de e-mail do destinatário.
    const { form } = doVale();
    const dados = new FormData(form);

    expect(form.querySelector('[data-campos]').hidden).toBe(false);
    expect(form.querySelector('[data-caixa]').hidden).toBe(true);
    expect(dados.getAll('properties[__shopify_send_gift_card_to_recipient]')).toEqual(['if_present']);
    expect(dados.has('properties[Recipient email]')).toBe(true);
    expect(dados.has('properties[__shopify_offset]')).toBe(false);
  });

  it('o erro do submit nativo aparece ao lado do campo, e o campo aponta para ele', () => {
    const { form } = doVale({
      form: { email: 'maria@', errors: errosDoEnvio({ email: 'Email inválido' }) },
    });
    const email = form.querySelector('[name="properties[Recipient email]"]');
    const descricao = email
      .getAttribute('aria-describedby')
      .split(/\s+/)
      .map((id) => document.getElementById(id));

    expect(email.value).toBe('maria@');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(descricao.some((el) => !el.hidden && el.textContent.trim() === 'Email inválido')).toBe(true);
    // Com JS, a caixa marcada é o que mantém os campos abertos na volta.
    expect(form.querySelector('[data-caixa-destinatario]').checked).toBe(true);
  });

  it('o que a cliente digitou volta escapado, sem virar markup', () => {
    const { form } = doVale({
      form: { message: '</textarea><b id="injetado">oi</b>', errors: errosDoEnvio({ email: 'x' }) },
    });

    expect(document.getElementById('injetado')).toBeNull();
    expect(form.querySelector('[name="properties[Message]"]').value).toBe('</textarea><b id="injetado">oi</b>');
  });

  it('a mensagem é limitada a 200 caracteres no próprio campo', () => {
    const { form } = doVale();

    expect(form.querySelector('[name="properties[Message]"]').maxLength).toBe(200);
  });
});

describe('a barra fixa leva o plano escolhido (#135)', () => {
  // A barra fixa tem o PRÓPRIO form, sem os radios do seletor de planos. Sem
  // copiar a escolha, comprar por ela mandava compra única — e falhava em
  // produto com `requires_selling_plan`.
  const barra = (campo) => {
    document.body.innerHTML = `
      <div product-context>
        <add-to-cart>
          <form>
            <input type="hidden" name="id" value="1">
            ${campo}
            <button type="submit" name="add" data-text-desktop="Adicionar" data-text-mobile="Adicionar"
              data-text-sold-out="Esgotado" data-text-unavailable="Indisponível">Adicionar</button>
          </form>
        </add-to-cart>
      </div>`;
    return document.querySelector('[product-context]');
  };
  const escolhePlano = (context, sellingPlanId) =>
    context.dispatchEvent(
      new CustomEvent('selling-plan:change', { detail: { sellingPlanId, variantId: 1, prices: null } })
    );

  it('o campo escondido `selling_plan` acompanha a escolha, e volta a vazio na compra única', () => {
    const context = barra('<input type="hidden" name="selling_plan" value="">');
    const campo = document.querySelector('input[name="selling_plan"]');

    escolhePlano(context, 77);
    expect(campo.value).toBe('77');

    escolhePlano(context, null);
    expect(campo.value).toBe('');
  });

  it('no form da PDP os radios são o valor: o evento não mexe neles', () => {
    const context = barra('<input type="radio" name="selling_plan" value="5" checked>');
    const radio = document.querySelector('input[name="selling_plan"]');

    escolhePlano(context, 9);

    expect(radio.value).toBe('5');
    expect(radio.checked).toBe(true);
  });
});
