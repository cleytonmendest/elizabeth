/**
 * assets/price-component.js — preço na troca de variante.
 *
 * O servidor pinta o preço em `snippets/price-v2.liquid`; este componente o
 * repinta assim que `variations-selector` dispara `variant:change` — o que
 * acontece já no carregamento da PDP — e quando `selling-plan-picker` publica
 * `selling-plan:change` (issue #135). Junto do preço vão o preço unitário
 * (#136) e, no plano pré-pago, o valor por entrega.
 *
 * Este arquivo já teve duas suítes a mais: `parcelamento` e `concordância com
 * o Liquid (issue #48)`. Elas provavam que a conta de parcelas do JS dava o
 * mesmo número que a do Liquid — nunca que o número era verdadeiro. Ele nunca
 * era: o tema não tem os dados de parcelamento (ver
 * docs/adr/0008-o-tema-nao-calcula-dinheiro-que-o-checkout-nao-produz.md).
 * Saíram junto com a feature, na issue #80.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { textOf, installShopify } from './helpers/dom.mjs';
import { renderiza, textoVisivel } from './helpers/liquid-loja.mjs';

// `price-component.js` chama `formatMoney` sem importar nada: no navegador ela
// é global porque `money.js` a declara no topo de um script clássico, e o
// layout o carrega antes. Carregar o arquivo de verdade reproduz esse
// acoplamento em vez de escondê-lo. Até a issue #39 quem a declarava era o
// `cart.js`, com o nome `formatPrice` — o componente de PREÇO dependia do
// arquivo do CARRINHO para exibir preço.
loadGlobalAsset('money.js', ['formatMoney']);
loadAsset('price-component.js');

// `formatMoney` lê moeda e idioma de `window.Shopify`, que a vitrine escreve e
// o jsdom não tem. As asserções abaixo são em reais porque a loja do teste é.
installShopify();

function monta() {
  document.body.innerHTML = `
    <div product-context>
      <price-component>
        <span class="listing-price"></span>
        <span class="selling-price"></span>
      </price-component>
    </div>`;
  const q = (sel) => document.querySelector(sel);
  return {
    context: q('[product-context]'),
    listing: q('.listing-price'),
    selling: q('.selling-price'),
  };
}

const trocaVariante = (context, variant) =>
  context.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('preço', () => {
  it('mostra o preço da variante', () => {
    const { context, selling } = monta();
    trocaVariante(context, { price: 12990, compare_at_price: null });
    expect(textOf(selling)).toBe('R$ 129,90');
  });

  it('mostra o preço riscado quando há desconto', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: 19900 });

    expect(listing.classList.contains('hidden')).toBe(false);
    expect(textOf(listing)).toBe('R$ 199,00');
  });

  it('esconde o preço riscado quando não há desconto', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: 9900 });
    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('esconde o riscado quando a variante não tem compare_at_price', () => {
    const { context, listing } = monta();
    trocaVariante(context, { price: 9900, compare_at_price: null });
    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('trocar de variante cara para barata volta a esconder o riscado', () => {
    // Só o `toggle` garante isso: quem só adiciona a classe deixa o riscado
    // preso na tela da variante anterior.
    const { context, listing } = monta();

    trocaVariante(context, { price: 9900, compare_at_price: 19900 });
    trocaVariante(context, { price: 9900, compare_at_price: null });

    expect(listing.classList.contains('hidden')).toBe(true);
  });

  it('o preço-fallback de price-v2.liquid (1999) não trava o componente', () => {
    // `assign price = target.price | default: 1999` — quando o produto vem
    // nulo (preview de section sem produto escolhido), o servidor pinta
    // R$ 19,99. Uma variante com esse preço tem que repintar o mesmo número.
    const { context, selling } = monta();
    trocaVariante(context, { price: 1999, compare_at_price: null });

    expect(textOf(selling)).toBe('R$ 19,99');
  });
});

describe('fora de um [product-context]', () => {
  it('avisa em vez de quebrar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<price-component></price-component>';
    expect(console.warn).toHaveBeenCalledWith(
      'PriceComponent: Contexto do produto [product-context] não encontrado.'
    );
  });
});

/**
 * Daqui para baixo o markup é o de `snippets/price-v2.liquid`, renderizado
 * pelo `liquidjs` — e não um HTML escrito à mão neste arquivo. Os pontos em que
 * o componente escreve (`data-unit-price-amount`, `data-per-delivery`…) são um
 * contrato entre o Liquid e o JS; uma cópia aqui continuaria verde no dia em
 * que um dos dois renomeasse o seu.
 */
const POR_100ML = { measured_type: 'volume', quantity_value: '50.0', quantity_unit: 'ml', reference_value: 100, reference_unit: 'ml' };
const POR_KG = { measured_type: 'weight', quantity_value: '500.0', quantity_unit: 'g', reference_value: 1, reference_unit: 'kg' };

// As variantes têm a forma do `{{ product.variants | json }}` que
// <variant-selects> despacha: é esse objeto que chega em `variant:change`.
const SEM_MEDIDA = { id: 11, price: 9900, compare_at_price: null, unit_price_measurement: null };
const PERFUME_50ML = { id: 12, price: 6450, compare_at_price: null, unit_price: 12900, unit_price_measurement: POR_100ML };
const GRANEL_500G = { id: 13, price: 250, compare_at_price: null, unit_price: 500, unit_price_measurement: POR_KG };

function montaDoLiquid({ variants = [SEM_MEDIDA, PERFUME_50ML, GRANEL_500G], planos = [] } = {}) {
  const product = {
    id: 1,
    variants,
    selected_or_first_available_variant: variants[0],
    selling_plan_groups: planos,
    requires_selling_plan: false,
    selected_selling_plan: null,
  };
  const preco = renderiza('price-v2', { product, use_variant: true, pdp: true, cart: {}, shop: {} });
  document.body.innerHTML = `<div product-context>${preco.innerHTML}</div>`;
  const q = (sel) => document.querySelector(sel);
  return {
    context: q('[product-context]'),
    selling: q('.selling-price'),
    listing: q('.listing-price'),
    unitario: q('[data-unit-price]'),
    porEntrega: q('[data-per-delivery]'),
  };
}

const visivel = (el) => !el.classList.contains('hidden');

describe('preço unitário na troca de variante (issue #136)', () => {
  it('aparece quando a cliente escolhe a variante vendida por medida', () => {
    const { context, unitario } = montaDoLiquid();
    expect(visivel(unitario)).toBe(false);

    trocaVariante(context, PERFUME_50ML);

    expect(visivel(unitario)).toBe(true);
    expect(textoVisivel(unitario)).toBe('R$ 129,00/100ml');
  });

  it('muda junto com a variante — e a referência 1 some ("/kg")', () => {
    const { context, unitario } = montaDoLiquid();
    trocaVariante(context, PERFUME_50ML);
    trocaVariante(context, GRANEL_500G);

    expect(textoVisivel(unitario)).toBe('R$ 5,00/kg');
  });

  it('some na variante sem medida — sem vão, e sem o valor da anterior preso na tela', () => {
    const { context, unitario } = montaDoLiquid();
    trocaVariante(context, PERFUME_50ML);
    trocaVariante(context, SEM_MEDIDA);

    expect(visivel(unitario)).toBe(false);
  });

  it('o preço de venda continua acompanhando a variante', () => {
    const { context, selling } = montaDoLiquid();
    trocaVariante(context, PERFUME_50ML);
    expect(textOf(selling)).toBe('R$ 64,50');
  });
});

describe('preço do plano (issue #135)', () => {
  // `selling-plan:change` é publicado por <selling-plan-picker>; aqui o teste
  // publica no lugar dele — o que se verifica é o que o PREÇO faz com o
  // detail. A conversa inteira, com o seletor de verdade, está em
  // tests/selling-plan-picker.test.mjs.
  const escolhePlano = (context, prices, sellingPlanId = '501') =>
    context.dispatchEvent(
      new CustomEvent('selling-plan:change', { detail: { sellingPlanId, variantId: '11', prices } })
    );
  const PLANOS = [{ name: 'Assinatura', selling_plans: [{ id: 501, name: 'Mensal' }] }];

  it('repinta com o preço da alocação, e o preço sem plano aparece riscado', () => {
    const { context, selling, listing } = montaDoLiquid({ planos: PLANOS });
    escolhePlano(context, { price: 8910, compare_at_price: 9900, per_delivery_price: 8910 });

    expect(textOf(selling)).toBe('R$ 89,10');
    expect(visivel(listing)).toBe(true);
    expect(textOf(listing)).toBe('R$ 99,00');
  });

  it('pré-pago: o preço é o total, e a linha diz quanto sai cada entrega', () => {
    const { context, porEntrega } = montaDoLiquid({ planos: PLANOS });
    escolhePlano(context, { price: 26730, compare_at_price: 29700, per_delivery_price: 8910 });

    expect(visivel(porEntrega)).toBe(true);
    expect(textoVisivel(porEntrega)).toBe('R$ 89,10 por entrega');
  });

  it('plano pago a cada entrega esconde a linha — ela repetiria o preço', () => {
    const { context, porEntrega } = montaDoLiquid({ planos: PLANOS });
    escolhePlano(context, { price: 26730, compare_at_price: 29700, per_delivery_price: 8910 });
    escolhePlano(context, { price: 8910, compare_at_price: 9900, per_delivery_price: 8910 });

    expect(visivel(porEntrega)).toBe(false);
  });

  it('voltar para a compra única (sem `per_delivery_price`) esconde a linha', () => {
    const { context, selling, porEntrega } = montaDoLiquid({ planos: PLANOS });
    escolhePlano(context, { price: 26730, compare_at_price: 29700, per_delivery_price: 8910 });
    escolhePlano(context, { price: 9900, compare_at_price: null }, null);

    expect(textOf(selling)).toBe('R$ 99,00');
    expect(visivel(porEntrega)).toBe(false);
  });

  it('o preço unitário acompanha a alocação do plano', () => {
    const { context, unitario } = montaDoLiquid({ variants: [PERFUME_50ML], planos: PLANOS });
    escolhePlano(context, {
      price: 5805,
      compare_at_price: 6450,
      per_delivery_price: 5805,
      unit_price: 11610,
      unit_price_measurement: POR_100ML,
    });

    expect(textoVisivel(unitario)).toBe('R$ 116,10/100ml');
  });

  it('sem preços no detail, nada muda — o preço na tela não vira "R$ NaN"', () => {
    const { context, selling } = montaDoLiquid({ planos: PLANOS });
    escolhePlano(context, null);
    expect(textOf(selling)).toBe('R$ 99,00');
  });
});

describe('combinação que não existe', () => {
  it('`variant:change` com `undefined` mantém o preço em vez de quebrar', () => {
    // O contrato do evento (CLAUDE.md) permite `undefined`: é o que
    // <variant-selects> despacha quando a combinação de opções não existe.
    const { context, selling } = montaDoLiquid();
    trocaVariante(context, PERFUME_50ML);
    expect(() => trocaVariante(context, undefined)).not.toThrow();
    expect(textOf(selling)).toBe('R$ 64,50');
  });
});
