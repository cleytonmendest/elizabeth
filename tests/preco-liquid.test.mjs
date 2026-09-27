/**
 * O que o Liquid pinta antes de qualquer JavaScript — preço unitário (#136),
 * plano de compra (#135) e imposto (#143).
 *
 * Os três são decisões escritas em `{% if %}`, e é o estado inicial da página:
 * o que a cliente vê sem JS, e o que o <price-component> encontra para
 * repintar. Nenhum deles aparece na loja de dev — ela não tem produto por
 * medida, nem app de assinatura, e o imposto depende de uma chave do admin —,
 * então nenhuma olhada na vitrine denuncia a regressão. Este arquivo denuncia.
 *
 * O motor é o `liquidjs`, com os filtros da Shopify que faltam nele em
 * `tests/helpers/liquid-loja.mjs` (o `t` lê o pt-BR de verdade).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderiza, textoVisivel } from './helpers/liquid-loja.mjs';

const POR_100ML = { measured_type: 'volume', quantity_value: '50.0', quantity_unit: 'ml', reference_value: 100, reference_unit: 'ml' };
const POR_KG = { measured_type: 'weight', quantity_value: '500.0', quantity_unit: 'g', reference_value: 1, reference_unit: 'kg' };

/** Uma variante com a forma dos campos que os snippets leem. */
const variante = (id, extra = {}) => ({
  id,
  price: 9900,
  compare_at_price: null,
  unit_price: null,
  unit_price_measurement: null,
  selling_plan_allocations: [],
  ...extra,
});

/** Assinatura mensal com 10% e pré-venda de 3 entregas pagas de uma vez. */
const MENSAL = { id: 501, name: 'Entrega mensal, 10% off', description: '' };
const TRIMESTRAL = { id: 502, name: '3 entregas, pago agora', description: 'Cobrado uma vez.' };
const GRUPOS = [{ name: 'Assinatura', selling_plans: [MENSAL, TRIMESTRAL] }];

const alocacao = (plano, preco, extra = {}) => ({
  selling_plan: plano,
  price: preco,
  compare_at_price: 9900,
  per_delivery_price: preco,
  unit_price: null,
  ...extra,
});

/** Produto com os dois planos; `v1` é a selecionada. */
function produtoComPlanos(extra = {}) {
  const v1 = variante(11, {
    selling_plan_allocations: [
      alocacao(MENSAL, 8910),
      alocacao(TRIMESTRAL, 26730, { compare_at_price: 29700, per_delivery_price: 8910 }),
    ],
  });
  const v2 = variante(12, {
    price: 12900,
    selling_plan_allocations: [alocacao(MENSAL, 11610, { compare_at_price: 12900 })],
  });
  return {
    id: 1,
    variants: [v1, v2],
    selected_or_first_available_variant: v1,
    selling_plan_groups: GRUPOS,
    requires_selling_plan: false,
    selected_selling_plan: null,
    ...extra,
  };
}

const produtoSimples = (v = variante(11)) => ({
  id: 1,
  variants: [v],
  selected_or_first_available_variant: v,
  selling_plan_groups: [],
  requires_selling_plan: false,
  selected_selling_plan: null,
});

const precoDaPdp = (product, extra = {}) =>
  renderiza('price-v2', { product, use_variant: true, pdp: true, cart: { taxes_included: false }, shop: {}, ...extra });

const visivel = (el) => Boolean(el) && !el.classList.contains('hidden');
const precoEmTela = (el) => textoVisivel(el.querySelector('.selling-price'));

describe('preço unitário — price-unit.liquid (issue #136)', () => {
  it('"R$ 12,90/100ml": valor, barra e referência colados na tela', () => {
    const el = renderiza('price-unit', { unit_price: 1290, measurement: POR_100ML });
    expect(textoVisivel(el)).toBe('R$ 12,90/100ml');
  });

  it('a referência 1 some: "R$ 5,00/kg", não "/1kg"', () => {
    const el = renderiza('price-unit', { unit_price: 500, measurement: POR_KG });
    expect(textoVisivel(el)).toBe('R$ 5,00/kg');
  });

  it('o leitor de tela ouve o rótulo e o separador do locale, não a barra', () => {
    const p = renderiza('price-unit', { unit_price: 1290, measurement: POR_100ML }).querySelector('[data-unit-price]');
    const falado = [...p.childNodes]
      .filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true'))
      .map((n) => n.textContent)
      .join('')
      .replace(/[ \s]+/g, ' ')
      .trim();
    expect(falado).toBe('Preço unitário R$ 12,90 por 100ml');
  });

  it('sem medida, nada é renderizado — nem um vão', () => {
    const el = renderiza('price-unit', { unit_price: null, measurement: null });
    expect(el.innerHTML.trim()).toBe('');
  });

  it('com `reserve`, o lugar existe mas escondido, para o JS preencher', () => {
    const p = renderiza('price-unit', { unit_price: null, measurement: null, reserve: true }).querySelector('[data-unit-price]');
    expect(p).not.toBeNull();
    expect(visivel(p)).toBe(false);
  });
});

describe('price-v2 — preço unitário na PDP', () => {
  it('a variante com medida mostra o preço unitário', () => {
    const el = precoDaPdp(produtoSimples(variante(11, { unit_price: 1290, unit_price_measurement: POR_100ML })));
    const p = el.querySelector('[data-unit-price]');
    expect(visivel(p)).toBe(true);
    expect(textoVisivel(p)).toBe('R$ 12,90/100ml');
  });

  it('variante sem medida, mas OUTRA com: o lugar fica reservado e escondido', () => {
    const sem = variante(11);
    const com = variante(12, { unit_price: 1290, unit_price_measurement: POR_100ML });
    const el = precoDaPdp({ ...produtoSimples(sem), variants: [sem, com] });
    const p = el.querySelector('[data-unit-price]');
    expect(p).not.toBeNull();
    expect(visivel(p)).toBe(false);
  });

  it('nenhuma variante com medida: nenhum markup — o caso de toda peça de moda', () => {
    const el = precoDaPdp(produtoSimples());
    expect(el.querySelector('[data-unit-price]')).toBeNull();
  });
});

describe('price-v2 — imposto na PDP (issue #143)', () => {
  const POLITICA = { body: '<p>Enviamos para todo o Brasil.</p>', url: '/policies/shipping-policy' };
  const nota = (taxes_included, shipping_policy) =>
    precoDaPdp(produtoSimples(), { cart: { taxes_included }, shop: { shipping_policy } }).querySelector('[data-tax-note]');

  it.each([
    [true, POLITICA, 'Impostos incluídos. Frete calculado no checkout.', true],
    [true, { body: '' }, 'Impostos incluídos. Frete calculado no checkout.', false],
    [false, POLITICA, 'Impostos e frete calculados no checkout.', true],
    [false, { body: '' }, 'Impostos e frete calculados no checkout.', false],
  ])('taxes_included=%s, política %#: o texto certo, e o link só quando ela existe', (incluso, politica, texto, temLink) => {
    const el = nota(incluso, politica);
    expect(textoVisivel(el)).toBe(texto);
    const link = el.querySelector('a');
    expect(Boolean(link)).toBe(temLink);
    if (temLink) expect(link.getAttribute('href')).toBe('/policies/shipping-policy');
  });

  it('com o imposto incluso, NÃO diz que imposto é calculado no checkout', () => {
    // A frase fixa que a issue #143 encontrou no carrinho, e que a PDP não pode repetir.
    expect(textoVisivel(nota(true, { body: '' }))).not.toMatch(/Impostos e frete calculados/);
  });

  it('texto secundário no token de contraste, não em opacidade', () => {
    expect(nota(true, { body: '' }).classList.contains('text-foreground-muted')).toBe(true);
  });

  it('só na PDP: sem `pdp` (barra fixa, card) a frase não aparece', () => {
    const el = renderiza('price-v2', { product: produtoSimples(), use_variant: true, cart: { taxes_included: true }, shop: {} });
    expect(el.querySelector('[data-tax-note]')).toBeNull();
  });

  it.each([true, false])('o bloco desligou (`tax_note: false`): nada, com imposto incluso=%s', (incluso) => {
    // No Brasil o preço de vitrine já embute o imposto, e "frete calculado no
    // checkout" é falso numa loja com frete grátis para o país inteiro. O
    // texto certo o tema escolhe sozinho; se a frase existe, é a lojista.
    const el = precoDaPdp(produtoSimples(), { tax_note: false, cart: { taxes_included: incluso } });
    expect(el.querySelector('[data-tax-note]')).toBeNull();
  });

  it('ligado, ou sem o parâmetro (styleguide), a frase continua', () => {
    expect(precoDaPdp(produtoSimples(), { tax_note: true }).querySelector('[data-tax-note]')).not.toBeNull();
    expect(precoDaPdp(produtoSimples()).querySelector('[data-tax-note]')).not.toBeNull();
  });
});

describe('o bloco de preço decide se a frase de imposto existe', () => {
  // As duas metades valem juntas: o setting declarado com default ligado, e a
  // chamada que o entrega ao snippet. Um setting que ninguém lê desligaria
  // nada no editor — o defeito que o ADR 0004 registrou na barra fixa.
  const RAIZ = path.resolve(import.meta.dirname, '..');
  const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const blocoDePreco = (section) => {
    const [, json] = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(ler(`sections/${section}`));
    return JSON.parse(json).blocks.find((b) => b.type === 'price');
  };

  it.each([
    ['main-product.liquid', 'snippets/main-product-right.liquid'],
    ['highlighted-product.liquid', 'sections/highlighted-product.liquid'],
  ])('%s: `show_tax_note` nasce ligado e chega ao price-v2', (section, quemRenderiza) => {
    const setting = blocoDePreco(section).settings.find((s) => s.id === 'show_tax_note');
    expect(setting).toMatchObject({ type: 'checkbox', default: true });
    expect(ler(quemRenderiza)).toMatch(/render 'price-v2',[^%]*\bpdp: true, tax_note: block\.settings\.show_tax_note\b/);
  });
});

describe('price-v2 — preço inicial com plano (issue #135)', () => {
  it('sem plano exigido, o preço é o da compra única', () => {
    const el = precoDaPdp(produtoComPlanos());
    expect(precoEmTela(el)).toBe('R$ 99,00');
  });

  it('com `requires_selling_plan`, o preço é o do primeiro plano — o que vem marcado', () => {
    const el = precoDaPdp(produtoComPlanos({ requires_selling_plan: true }));
    expect(precoEmTela(el)).toBe('R$ 89,10');
    expect(visivel(el.querySelector('.listing-price'))).toBe(true);
    expect(textoVisivel(el.querySelector('.listing-price'))).toBe('R$ 99,00');
  });

  it('o plano da URL (`?selling_plan=`) decide o preço, e o pré-pago mostra o valor por entrega', () => {
    const el = precoDaPdp(produtoComPlanos({ selected_selling_plan: TRIMESTRAL }));
    expect(precoEmTela(el)).toBe('R$ 267,30');
    const porEntrega = el.querySelector('[data-per-delivery]');
    expect(visivel(porEntrega)).toBe(true);
    expect(textoVisivel(porEntrega)).toBe('R$ 89,10 por entrega');
  });

  it('plano pago a cada entrega: a linha "por entrega" repetiria o preço, então fica escondida', () => {
    const el = precoDaPdp(produtoComPlanos({ requires_selling_plan: true }));
    expect(visivel(el.querySelector('[data-per-delivery]'))).toBe(false);
  });

  it('produto sem plano não carrega a linha "por entrega"', () => {
    expect(precoDaPdp(produtoSimples()).querySelector('[data-per-delivery]')).toBeNull();
  });
});

describe('selling-plan-picker.liquid — o seletor sem JavaScript (issue #135)', () => {
  const seletor = (product) => renderiza('selling-plan-picker', { product });
  const radios = (el) => [...el.querySelectorAll('input[type="radio"][name="selling_plan"]')];
  const marcado = (el) => radios(el).find((r) => r.checked);

  it('produto sem plano: nada — nem o script', () => {
    expect(seletor(produtoSimples()).innerHTML.trim()).toBe('');
  });

  it('sem plano exigido: compra única existe, vem marcada e manda `selling_plan` vazio', () => {
    const el = seletor(produtoComPlanos());
    expect(radios(el).map((r) => r.value)).toEqual(['', '501', '502']);
    expect(marcado(el).value).toBe('');
  });

  it('com `requires_selling_plan`: sem compra única, e o primeiro plano marcado', () => {
    const el = seletor(produtoComPlanos({ requires_selling_plan: true }));
    expect(radios(el).map((r) => r.value)).toEqual(['501', '502']);
    expect(marcado(el).value).toBe('501');
  });

  it('o plano da URL vem marcado', () => {
    expect(marcado(seletor(produtoComPlanos({ selected_selling_plan: TRIMESTRAL }))).value).toBe('502');
  });

  it('cada radio tem nome acessível — o nome do plano, dentro de um grupo com legenda', () => {
    const el = seletor(produtoComPlanos());
    for (const radio of radios(el)) {
      expect(radio.closest('label').textContent.trim()).not.toBe('');
      expect(radio.closest('fieldset').querySelector('legend').textContent.trim()).not.toBe('');
    }
  });

  it('a tabela de preços é JSON válido, com a alocação de cada variante', () => {
    const el = seletor(produtoComPlanos());
    const tabela = JSON.parse(el.querySelector('[data-selling-plan-prices]').textContent);
    expect(tabela['11']['']).toMatchObject({ price: 9900, compare_at_price: null });
    expect(tabela['11']['502']).toMatchObject({ price: 26730, compare_at_price: 29700, per_delivery_price: 8910 });
    expect(tabela['12']['501']).toMatchObject({ price: 11610, compare_at_price: 12900 });
    expect(tabela['12']['502']).toBeUndefined();
  });

  it('a tabela leva a medida do preço unitário (produto de variante única não tem outra fonte)', () => {
    const v = variante(11, {
      unit_price: 1290,
      unit_price_measurement: POR_100ML,
      selling_plan_allocations: [alocacao(MENSAL, 8910, { unit_price: 1161 })],
    });
    const el = seletor({ ...produtoComPlanos(), variants: [v], selected_or_first_available_variant: v });
    const tabela = JSON.parse(el.querySelector('[data-selling-plan-prices]').textContent);
    expect(tabela['11']['501'].unit_price).toBe(1161);
    expect(tabela['11']['501'].unit_price_measurement).toEqual({ reference_value: 100, reference_unit: 'ml' });
  });

  it.each([
    ['sem plano exigido', {}],
    ['com plano exigido', { requires_selling_plan: true }],
    ['com plano na URL', { selected_selling_plan: TRIMESTRAL }],
  ])('%s: o preço que price-v2 pinta é o do radio que vem marcado', (_caso, extra) => {
    // A regra de "qual plano vem marcado" está escrita nos DOIS arquivos. Se
    // divergirem, a cliente lê um preço e o form manda outro plano.
    const product = produtoComPlanos(extra);
    const plano = marcado(seletor(product)).value;
    const tabela = JSON.parse(seletor(product).querySelector('[data-selling-plan-prices]').textContent);
    const esperado = tabela['11'][plano].price;
    expect(precoEmTela(precoDaPdp(product))).toBe(`R$ ${(esperado / 100).toFixed(2).replace('.', ',')}`);
  });
});

describe('card-product-slider — preço unitário no card (issue #136)', () => {
  const card = (v) =>
    renderiza('card-product-slider', {
      card_product: {
        title: 'Perfume',
        url: '/products/perfume',
        price: v.price,
        compare_at_price: null,
        available: true,
        images: [],
        options_with_values: [],
        selected_or_first_available_variant: v,
      },
      show_quick_add: false,
    });

  it('a variante com medida mostra "R$ 12,90/100ml" embaixo do preço', () => {
    const p = card(variante(11, { unit_price: 1290, unit_price_measurement: POR_100ML })).querySelector('[data-unit-price]');
    expect(visivel(p)).toBe(true);
    expect(textoVisivel(p)).toBe('R$ 12,90/100ml');
  });

  it('sem medida, o card não ganha nem uma linha vazia', () => {
    expect(card(variante(11)).querySelector('[data-unit-price]')).toBeNull();
  });
});
