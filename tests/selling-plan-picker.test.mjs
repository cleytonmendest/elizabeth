/**
 * assets/selling-plan-picker.js — compra única ou plano, e o preço junto.
 *
 * O teste monta a PDP com o markup DE VERDADE: `price-v2.liquid` e
 * `selling-plan-picker.liquid` renderizados pelo `liquidjs`, dentro de um
 * `[product-context]`, com o seletor dentro de um <form> — que é onde
 * `snippets/add-to-cart.liquid` o renderiza. Assim a tabela de preços que o
 * Liquid escreve, o evento que o seletor publica e o que o <price-component>
 * pinta são exercitados juntos: um campo renomeado em qualquer ponta deixa
 * este arquivo vermelho.
 *
 * Os dois componentes não se conhecem. O seletor publica `selling-plan:change`
 * no contexto; o preço escuta. Nenhum dos dois consulta o DOM do outro.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { textOf, installShopify } from './helpers/dom.mjs';
import { renderiza, textoVisivel } from './helpers/liquid-loja.mjs';

loadGlobalAsset('money.js', ['formatMoney']);
loadAsset('price-component.js');
loadAsset('selling-plan-picker.js');
installShopify();

const POR_100ML = { reference_value: 100, reference_unit: 'ml' };
const MENSAL = { id: 501, name: 'Entrega mensal, 10% off' };
const PRE_PAGO = { id: 502, name: '3 entregas, pago agora' };

const alocacao = (plano, price, extra = {}) => ({
  selling_plan: plano,
  price,
  compare_at_price: 9900,
  per_delivery_price: price,
  unit_price: null,
  ...extra,
});

// Preta (11) tem os dois planos; Off-white (12) só o mensal.
const PRETA = {
  id: 11,
  price: 9900,
  compare_at_price: null,
  unit_price: 19800,
  unit_price_measurement: POR_100ML,
  selling_plan_allocations: [
    alocacao(MENSAL, 8910, { unit_price: 17820 }),
    alocacao(PRE_PAGO, 26730, { compare_at_price: 29700, per_delivery_price: 8910, unit_price: 17820 }),
  ],
};
const OFF_WHITE = {
  id: 12,
  price: 12900,
  compare_at_price: null,
  unit_price: null,
  unit_price_measurement: null,
  selling_plan_allocations: [alocacao(MENSAL, 11610, { compare_at_price: 12900 })],
};

function produto(extra = {}) {
  return {
    id: 1,
    variants: [PRETA, OFF_WHITE],
    selected_or_first_available_variant: PRETA,
    selling_plan_groups: [{ name: 'Assinatura', selling_plans: [MENSAL, PRE_PAGO] }],
    requires_selling_plan: false,
    selected_selling_plan: null,
    ...extra,
  };
}

/**
 * `seletorPrimeiro` inverte a ordem no documento — e com ela a ordem em que os
 * dois componentes se registram como ouvintes de `variant:change`.
 */
function montaPdp(product = produto(), { seletorPrimeiro = false } = {}) {
  const preco = renderiza('price-v2', { product, use_variant: true, pdp: true, cart: {}, shop: {} }).innerHTML;
  const form = `<form>${renderiza('selling-plan-picker', { product }).innerHTML}</form>`;
  document.body.innerHTML = `<div product-context>${seletorPrimeiro ? form + preco : preco + form}</div>`;

  const q = (sel) => document.querySelector(sel);
  return {
    context: q('[product-context]'),
    form: q('form'),
    selling: q('.selling-price'),
    listing: q('.listing-price'),
    porEntrega: q('[data-per-delivery]'),
    unitario: q('[data-unit-price]'),
    radio: (valor) => q(`input[name="selling_plan"][value="${valor}"]`),
  };
}

/** Marca um radio e dispara o `change` que o navegador dispararia. */
function escolhe(radio) {
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Troca de variante como <variant-selects> faz — o objeto é o do
 * `{{ product.variants | json }}`, e espera a republicação do seletor.
 */
async function trocaVariante(context, variant) {
  context.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));
  await Promise.resolve();
}

const visivel = (el) => !el.classList.contains('hidden');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('escolher a forma de compra', () => {
  it('o plano repinta o preço com a alocação — e o preço sem plano aparece riscado', () => {
    const { selling, listing, radio } = montaPdp();
    expect(textOf(selling)).toBe('R$ 99,00');

    escolhe(radio('501'));

    expect(textOf(selling)).toBe('R$ 89,10');
    expect(visivel(listing)).toBe(true);
    expect(textOf(listing)).toBe('R$ 99,00');
  });

  it('voltar para a compra única devolve o preço da variante', () => {
    // Sem <variant-selects> na página (produto de variante única), a tabela do
    // seletor é a única fonte do preço de compra única — nada mais o repintaria.
    const { selling, listing, radio } = montaPdp();
    escolhe(radio('501'));
    escolhe(radio(''));

    expect(textOf(selling)).toBe('R$ 99,00');
    expect(visivel(listing)).toBe(false);
  });

  it('pré-pago: o preço é o total, e a linha "por entrega" aparece', () => {
    const { selling, porEntrega, radio } = montaPdp();
    escolhe(radio('502'));

    expect(textOf(selling)).toBe('R$ 267,30');
    expect(visivel(porEntrega)).toBe(true);
    expect(textoVisivel(porEntrega)).toBe('R$ 89,10 por entrega');

    escolhe(radio('501'));
    expect(visivel(porEntrega)).toBe(false);
  });

  it('o preço unitário acompanha o plano', () => {
    const { unitario, radio } = montaPdp();
    expect(textoVisivel(unitario)).toBe('R$ 198,00/100ml');

    escolhe(radio('501'));
    expect(textoVisivel(unitario)).toBe('R$ 178,20/100ml');
  });
});

describe('troca de variante com um plano escolhido', () => {
  it('o plano persiste, e o preço acompanha a alocação da variante nova', async () => {
    const { context, selling, radio } = montaPdp();
    escolhe(radio('501'));

    await trocaVariante(context, { id: 12, price: 12900, compare_at_price: null, unit_price_measurement: null });

    expect(radio('501').checked).toBe(true);
    expect(textOf(selling)).toBe('R$ 116,10');
  });

  it('a ordem dos ouvintes não decide o preço: o do plano é sempre o último a ser pintado', async () => {
    // Com o seletor ANTES do preço no documento, ele é o primeiro a ouvir
    // `variant:change`. Se republicasse na hora, o <price-component> pintaria
    // o preço do plano e, em seguida, o de compra única por cima.
    const { context, selling, radio } = montaPdp(produto(), { seletorPrimeiro: true });
    escolhe(radio('501'));

    await trocaVariante(context, { id: 12, price: 12900, compare_at_price: null, unit_price_measurement: null });

    expect(textOf(selling)).toBe('R$ 116,10');
  });

  it('a variante que não tem o plano marcado mostra o preço de compra única DELA', async () => {
    const { context, selling, listing, radio } = montaPdp();
    escolhe(radio('502'));

    await trocaVariante(context, { id: 12, price: 12900, compare_at_price: null, unit_price_measurement: null });

    expect(textOf(selling)).toBe('R$ 129,00');
    expect(visivel(listing)).toBe(false);
  });

  it('combinação inexistente (`undefined`) não troca a variante do seletor', async () => {
    const { context, selling, radio } = montaPdp();
    escolhe(radio('501'));

    await trocaVariante(context, undefined);
    escolhe(radio('502'));

    expect(textOf(selling)).toBe('R$ 267,30');
  });
});

describe('sem JavaScript, o form leva o plano', () => {
  // O `FormData(form)` é o corpo do submit nativo E o do
  // `CartManager.addToCart` (src/js/cart.js). O radio precisa estar dentro do
  // form para entrar nele — é por isso que o seletor mora em add-to-cart.liquid.
  const plano = (form) => new FormData(form).get('selling_plan');

  it('compra única manda `selling_plan` vazio', () => {
    expect(plano(montaPdp().form)).toBe('');
  });

  it('o plano escolhido vai no corpo', () => {
    const { form, radio } = montaPdp();
    escolhe(radio('502'));
    expect(plano(form)).toBe('502');
  });

  it('`requires_selling_plan`: o primeiro plano já vai no corpo, e não há compra única', () => {
    const { form, radio, selling } = montaPdp(produto({ requires_selling_plan: true }));
    expect(radio('')).toBeNull();
    expect(plano(form)).toBe('501');
    expect(textOf(selling)).toBe('R$ 89,10');
  });
});

describe('fora de um [product-context]', () => {
  it('avisa em vez de quebrar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<selling-plan-picker></selling-plan-picker>';
    expect(console.warn).toHaveBeenCalledWith(
      'SellingPlanPicker: Contexto do produto [product-context] não encontrado.'
    );
  });
});
