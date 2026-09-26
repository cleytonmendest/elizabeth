/**
 * O que o carrinho e o pedido mostram SEM JavaScript — o Liquid inicial.
 *
 * #144, #143, #136, #135, #139 e #134 pedem a mesma coisa em lugares
 * diferentes: que a cliente veja, no carrinho e no pedido, o que a Shopify já
 * sabe sobre a linha — o desconto e o nome dele, o preço por medida, o plano
 * de assinatura, o destinatário do vale-presente — e que nada disso deixe vão
 * quando não se aplica.
 *
 * Tudo aqui é decisão escrita em Liquid (`{% if %}`, `{% for %}`), e decisão
 * em Liquid não era exercitada por nada antes da ADR 0014. Os linters provam
 * que a chave de tradução existe; só renderizar prova que ela é a chave CERTA
 * para o estado da loja — que é exatamente o defeito da #143.
 *
 * O `money` e o `t` são substitutos (ver `helpers/liquid-carrinho.mjs`). O que
 * se mede é a regra: o que aparece, quando, e com qual texto.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderiza, linha, carrinho, globaisDaLoja } from './helpers/liquid-carrinho.mjs';
import { textOf } from './helpers/dom.mjs';

const monta = (html) => {
  document.body.innerHTML = html;
  return document.body;
};

const renderLinha = (item) =>
  monta(renderiza('snippets/cart-drawer-item.liquid', { escopo: { item }, globais: globaisDaLoja(carrinho([item])) }));

describe('a linha do carrinho (snippets/cart-drawer-item.liquid)', () => {
  it('sem desconto, sem plano, sem propriedade: nenhuma linha extra e nenhum preço riscado', () => {
    const raiz = renderLinha(linha());

    expect(raiz.querySelector('s')).toBeNull();
    expect(raiz.querySelector('ul')).toBeNull();
    expect(raiz.querySelector('dl')).toBeNull();
    expect(raiz.querySelector('[data-unit-price]')).toBeNull();
    // A região dos descontos continua existindo (o JS precisa dela para o dia
    // em que um desconto ligar), mas vazia — sem margem, sem vão.
    expect(raiz.querySelector('[data-cart-live="descontos:111:aaa"]').innerHTML.trim()).toBe('');
    expect(textOf(raiz.querySelector('.item-total-price'))).toBe('R$ 200,00');
  });

  it('com desconto no item: o preço de antes riscado, o de agora, e o nome e o valor do desconto', () => {
    const raiz = renderLinha(linha({ desconto: { nome: 'COMPRE2', valor: 2000 } }));

    expect(textOf(raiz.querySelector('s'))).toBe('R$ 200,00');
    expect(textOf(raiz.querySelector('.item-total-price'))).toBe('R$ 180,00');
    const descontos = raiz.querySelector('ul[aria-label="Descontos neste item"]');
    expect(textOf(descontos)).toBe('COMPRE2 (-R$ 20,00)');
  });

  it('o preço riscado tem nome para quem não enxerga o risco', () => {
    // `<s>` não é anunciado pela maioria dos leitores de tela: sem os rótulos,
    // a cliente ouve dois preços seguidos sem saber qual vale.
    const raiz = renderLinha(linha({ desconto: { nome: 'COMPRE2', valor: 2000 } }));
    const preco = textOf(raiz.querySelector('[data-cart-live="preco:111:aaa"]'));

    expect(preco).toMatch(/^Preço original R\$ 200,00 Preço com desconto R\$ 180,00$/);
  });

  it('as regiões que o JS redesenha carregam a chave da linha', () => {
    // É o que faz o HTML novo cair na linha certa quando o carrinho tem mais
    // de um item. Sem a chave, as duas linhas teriam a mesma região e o
    // desconto de uma apareceria na outra.
    const raiz = renderLinha(linha({ key: '222:bbb' }));

    expect(raiz.querySelector('[data-cart-live="preco:222:bbb"]')).not.toBeNull();
    expect(raiz.querySelector('[data-cart-live="descontos:222:bbb"]')).not.toBeNull();
    // E o seletor de quantidade fica FORA delas — trocar o HTML dele tiraria o
    // foco de quem está clicando no +.
    expect(raiz.querySelector('[data-cart-live] quantity-input')).toBeNull();
  });

  describe('preço unitário (#136)', () => {
    const porMedida = (reference_value, reference_unit, unit_price) =>
      linha({ unit_price, unit_price_measurement: { reference_value, reference_unit } });

    it('mostra o valor de referência quando ele não é 1: "R$ 12,90/100 ml"', () => {
      const raiz = renderLinha(porMedida(100, 'ml', 1290));
      const visivel = raiz.querySelector('[data-unit-price]').cloneNode(true);
      visivel.querySelectorAll('.sr-only').forEach((el) => el.remove());

      expect(textOf(visivel)).toBe('R$ 12,90/100 ml');
    });

    it('omite o valor de referência quando é 1: "R$ 89,90/kg"', () => {
      const raiz = renderLinha(porMedida(1, 'kg', 8990));
      const visivel = raiz.querySelector('[data-unit-price]').cloneNode(true);
      visivel.querySelectorAll('.sr-only').forEach((el) => el.remove());

      expect(textOf(visivel)).toBe('R$ 89,90/kg');
    });

    it('lido em voz alta, a barra vira palavra', () => {
      const raiz = renderLinha(porMedida(100, 'ml', 1290));
      const lido = raiz.querySelector('[data-unit-price]').cloneNode(true);
      lido.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());

      expect(textOf(lido)).toBe('Preço unitário R$ 12,90 por 100 ml');
    });
  });

  it('o plano de venda aparece pelo nome que o app deu (#135)', () => {
    const raiz = renderLinha(
      linha({ selling_plan_allocation: { selling_plan: { name: 'Entrega a cada 30 dias' } } })
    );

    expect(textOf(raiz)).toContain('Entrega a cada 30 dias');
  });
});

describe('as propriedades da linha (snippets/line-item-properties.liquid, #139)', () => {
  const renderPropriedades = (properties) =>
    monta(renderiza('snippets/line-item-properties.liquid', { escopo: { properties } }));

  it('mostra o destinatário do vale-presente e esconde o que é do app', () => {
    const raiz = renderPropriedades({
      'Recipient email': 'amiga@exemplo.com',
      'Recipient name': 'Ana',
      Message: '',
      __shopify_send_gift_card_to_recipient: 'true',
      __shopify_offset: '180',
      _gravacao_interna: 'x',
    });

    const pares = [...raiz.querySelectorAll('dl > div')].map((div) => textOf(div));
    expect(pares).toEqual(['Recipient email: amiga@exemplo.com', 'Recipient name: Ana']);
  });

  it('nada visível: nem o <dl>, nem o vão dele', () => {
    const raiz = renderPropriedades({ _privada: 'x', Mensagem: '' });

    expect(raiz.querySelector('dl')).toBeNull();
    expect(raiz.innerHTML.trim()).toBe('');
  });

  it('arquivo enviado por app vira link com o nome do arquivo', () => {
    const url = 'https://cdn.shopify.com/s/files/1/uploads/estampa.png';
    const raiz = renderPropriedades({ Estampa: url });
    const link = raiz.querySelector('dd a');

    expect(link.getAttribute('href')).toBe(url);
    expect(textOf(link)).toBe('estampa.png');
  });

  it('o que a cliente digitou sai escapado', () => {
    const raiz = renderPropriedades({ Mensagem: '<img src=x onerror=alert(1)>' });

    expect(raiz.querySelector('img')).toBeNull();
    expect(textOf(raiz.querySelector('dd'))).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('impostos e frete (snippets/cart-tax-note.liquid, #143)', () => {
  const frase = ({ taxes_included, politica }) =>
    renderiza('snippets/cart-tax-note.liquid', {
      globais: {
        cart: { taxes_included },
        shop: { shipping_policy: { body: politica ? '<p>Enviamos em 2 dias.</p>' : '', url: '/policies/shipping-policy' } },
      },
    });

  it.each([
    [true, true, 'Impostos incluídos. Frete calculado no checkout.', true],
    [true, false, 'Impostos incluídos. Frete calculado no checkout.', false],
    [false, true, 'Impostos e frete calculados no checkout', true],
    [false, false, 'Impostos e frete calculados no checkout', false],
  ])('impostos incluídos: %s · política de frete: %s → "%s"', (taxes_included, politica, texto, comLink) => {
    const raiz = monta(frase({ taxes_included, politica }));

    expect(textOf(raiz)).toBe(texto);
    const link = raiz.querySelector('a');
    if (comLink) {
      expect(link.getAttribute('href')).toBe('/policies/shipping-policy');
      expect(textOf(link).toLowerCase()).toBe('frete');
    } else {
      expect(link).toBeNull();
    }
  });

  it('a loja com imposto incluso nunca lê que o imposto vem depois', () => {
    // O defeito da #143 na forma em que a cliente o via: "Impostos e frete
    // calculados no checkout" numa loja em que o preço já inclui imposto.
    for (const politica of [true, false]) {
      expect(textOf(monta(frase({ taxes_included: true, politica })))).not.toMatch(/^Impostos e /);
    }
  });
});

describe('a página do carrinho (sections/main-cart.liquid)', () => {
  const SECTION = {
    id: 'template--1__main',
    settings: { color_scheme: 'scheme-1', show_continue_shopping: true, show_notes: false, checkout_label: '' },
  };
  const renderPagina = (cart, extras) =>
    monta(renderiza('sections/main-cart.liquid', { escopo: { section: SECTION }, globais: globaisDaLoja(cart, extras) }));

  it('o desconto do pedido aparece no resumo, com nome e valor, e a conta fecha', () => {
    const cart = carrinho([linha()], { descontosDoPedido: [{ nome: 'FRETE10', valor: 2000 }] });
    const raiz = renderPagina(cart);
    const resumo = raiz.querySelector('[data-cart-live="resumo"]');

    expect(textOf(resumo.querySelector('ul[aria-label="Descontos:"]'))).toBe('FRETE10 -R$ 20,00');
    expect(textOf(raiz.querySelector('[data-cart-subtotal]'))).toBe('R$ 200,00');
    expect(textOf(raiz.querySelector('[data-cart-total]'))).toBe('R$ 180,00');
  });

  it('desconto de item e de pedido juntos: cada um no seu nível, sem somar os dois', () => {
    // O resumo de antes: Subtotal R$ 180,00 · Descontos −R$ 40,00 · Total
    // R$ 160,00. O subtotal já sai com o desconto de item abatido, e a
    // `total_discount` o conta de novo: a conta de cabeça da cliente dava
    // R$ 140,00, e o total impresso logo abaixo dizia outra coisa.
    const cart = carrinho([linha({ desconto: { nome: 'COMPRE2', valor: 2000 } })], {
      descontosDoPedido: [{ nome: 'FRETE10', valor: 2000 }],
    });
    const raiz = renderPagina(cart);

    expect(textOf(raiz.querySelector('.cart-item ul'))).toBe('COMPRE2 (-R$ 20,00)');
    const resumo = textOf(raiz.querySelector('[data-cart-live="resumo"]'));
    expect(resumo).toContain('FRETE10 -R$ 20,00');
    expect(resumo).not.toContain('COMPRE2');
    expect(resumo).not.toContain('R$ 40,00');
  });

  it('sem desconto de pedido, o resumo não ganha lista vazia', () => {
    const raiz = renderPagina(carrinho([linha()]));

    expect(raiz.querySelector('[data-cart-live="resumo"] ul')).toBeNull();
  });

  it('a frase de impostos segue a loja, e não é mais a frase fixa', () => {
    const raiz = renderPagina(carrinho([linha()], { taxes_included: true }));

    expect(textOf(raiz)).toContain('Impostos incluídos. Frete calculado no checkout.');
    expect(textOf(raiz)).not.toContain('Impostos e frete calculados no checkout');
  });

  describe('checkout acelerado (#134)', () => {
    it('com carteira ativa, os botões da Shopify entram logo abaixo do checkout', () => {
      const raiz = renderPagina(carrinho([linha()]), {
        additional_checkout_buttons: true,
        content_for_additional_checkout_buttons: '<div id="botoes-da-shopify"></div>',
      });

      const involucro = raiz.querySelector('.additional-checkout-buttons');
      expect(involucro.querySelector('#botoes-da-shopify')).not.toBeNull();
      // Fora de qualquer região que o JS redesenha: a Shopify inicializa esses
      // botões uma vez, e trocar o HTML deles os mataria.
      expect(involucro.closest('[data-cart-live]')).toBeNull();
    });

    it('sem carteira ativa, nem o involucro — o layout não fica com vão', () => {
      const raiz = renderPagina(carrinho([linha()]), { additional_checkout_buttons: false });

      expect(raiz.querySelector('.additional-checkout-buttons')).toBeNull();
    });
  });
});

describe('a gaveta (sections/cart-drawer.liquid)', () => {
  const renderGaveta = (cart) =>
    monta(renderiza('sections/cart-drawer.liquid', { escopo: { section: { id: 'cart-drawer' } }, globais: globaisDaLoja(cart) }));

  it('mostra o desconto do pedido com nome e a frase de impostos da loja', () => {
    const raiz = renderGaveta(
      carrinho([linha()], { descontosDoPedido: [{ nome: 'FRETE10', valor: 2000 }], taxes_included: true })
    );

    expect(textOf(raiz.querySelector('#cart-summary-total ul'))).toBe('FRETE10 -R$ 20,00');
    expect(textOf(raiz)).toContain('Impostos incluídos. Frete calculado no checkout.');
  });

  it('publica o próprio id para o redesenho, no mesmo involucro que o add-to-cart lê', () => {
    const raiz = renderGaveta(carrinho([linha()]));
    const involucro = raiz.querySelector('[data-cart-section]');

    expect(involucro.dataset.cartSection).toBe('cart-drawer');
    expect(involucro.dataset.sectionId).toBe('cart-drawer');
    expect(involucro.querySelector('#cart-drawer-items[data-cart-items]')).not.toBeNull();
  });
});

describe('o pedido do cliente (templates/customers/order.liquid)', () => {
  let raiz;

  beforeEach(() => {
    const line_item = {
      title: 'Perfume 100 ml',
      variant_title: 'Default Title',
      sku: '',
      quantity: 2,
      product: { url: '/products/perfume' },
      image: null,
      original_price: 15000,
      final_price: 13500,
      final_line_price: 27000,
      unit_price: 13500,
      unit_price_measurement: { reference_value: 100, reference_unit: 'ml' },
      selling_plan_allocation: { selling_plan: { name: 'Assinatura mensal' } },
      properties: { 'Recipient name': 'Ana', _interna: 'x' },
      line_level_discount_allocations: [{ amount: 3000, discount_application: { title: 'COMPRE2' } }],
    };
    const order = {
      name: '#1001',
      created_at: '2026-09-01T10:00:00Z',
      financial_status: 'paid',
      fulfillment_status: null,
      fulfillments: [],
      line_items: [line_item],
      line_items_subtotal_price: 27000,
      cart_level_discount_applications: [{ title: 'FRETE10', total_allocated_amount: 2000 }],
      total_discounts: 5000,
      shipping_price: 0,
      tax_price: 0,
      total_price: 25000,
      shipping_address: null,
      billing_address: null,
    };
    raiz = monta(renderiza('templates/customers/order.liquid', { globais: globaisDaLoja(carrinho([]), { order }) }));
  });

  it('o desconto do item aparece no item, com nome e valor', () => {
    expect(textOf(raiz.querySelector('ul[aria-label="Descontos neste item"]'))).toBe('COMPRE2 (-R$ 30,00)');
  });

  it('o desconto do pedido aparece no resumo, e não a soma dos dois níveis', () => {
    expect(textOf(raiz.querySelector('ul[aria-label="Descontos"]'))).toBe('FRETE10 -R$ 20,00');
    expect(textOf(raiz)).not.toContain('R$ 50,00');
  });

  it('preço unitário, plano e propriedades visíveis — sem as privadas', () => {
    const visivel = raiz.querySelector('[data-unit-price]').cloneNode(true);
    visivel.querySelectorAll('.sr-only').forEach((el) => el.remove());

    expect(textOf(visivel)).toBe('R$ 135,00/100 ml');
    expect(textOf(raiz)).toContain('Assinatura mensal');
    expect(textOf(raiz.querySelector('dl'))).toBe('Recipient name: Ana');
  });
});
