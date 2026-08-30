/**
 * assets/price-component.js — preço e parcelamento na troca de variante.
 *
 * O cálculo existe DUAS vezes no tema: aqui, e em Liquid
 * (`snippets/price-v2.liquid` e `snippets/card-product-slider.liquid`). O
 * servidor pinta a primeira vez; este componente repinta assim que
 * `variations-selector` dispara `variant:change` — o que acontece já no
 * carregamento da PDP. Os dois PRECISAM concordar, senão o número muda sozinho
 * na frente da cliente. Há um teste abaixo que documenta onde eles não
 * concordam hoje.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { textOf } from './helpers/dom.mjs';

// `price-component.js` chama `formatPrice` sem importar nada: no navegador ela
// é global porque `cart.js` a declara no topo de um script clássico. Carregar
// o cart.js de verdade reproduz esse acoplamento em vez de escondê-lo.
loadGlobalAsset('cart.js', ['formatPrice']);
loadAsset('price-component.js');

// Padrões de config/settings_schema.json: até 10x, mínimo de R$ 50 por parcela.
const MAX_PADRAO = 10;
const MIN_PADRAO = 5000; // centavos — o Liquid faz `settings.min_value_installment | times: 100`

function monta({ mi = MAX_PADRAO, mv = MIN_PADRAO } = {}) {
  document.body.innerHTML = `
    <div product-context>
      <price-component data-mi="${mi}" data-mv="${mv}">
        <span class="listing-price"></span>
        <span class="selling-price"></span>
        <span class="installment-value"></span>
        <span class="installment-price-value"></span>
      </price-component>
    </div>`;
  const q = (sel) => document.querySelector(sel);
  return {
    context: q('[product-context]'),
    listing: q('.listing-price'),
    selling: q('.selling-price'),
    parcelas: q('.installment-value'),
    valorParcela: q('.installment-price-value'),
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
});

describe('parcelamento', () => {
  it('escolhe o maior número de parcelas acima do mínimo', () => {
    // R$ 999,00 com mínimo de R$ 50: 10x de R$ 99,90 cabe.
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 99900, compare_at_price: null });

    expect(textOf(parcelas)).toBe('10x');
    expect(textOf(valorParcela)).toBe('R$ 99,90');
  });

  it('reduz as parcelas quando o preço não alcança o mínimo em 10x', () => {
    // R$ 150,00: 10x daria R$ 15 (abaixo do mínimo). 3x de R$ 50 é o limite.
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 15000, compare_at_price: null });

    expect(textOf(parcelas)).toBe('3x');
    expect(textOf(valorParcela)).toBe('R$ 50,00');
  });

  it('produto barato demais fica em 1x', () => {
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 4999, compare_at_price: null });

    expect(textOf(parcelas)).toBe('1x');
    expect(textOf(valorParcela)).toBe('R$ 49,99');
  });

  it('o mínimo é inclusivo: parcela igual ao mínimo conta', () => {
    // R$ 100,00 em 2x = exatamente R$ 50,00.
    const { context, parcelas } = monta();
    trocaVariante(context, { price: 10000, compare_at_price: null });
    expect(textOf(parcelas)).toBe('2x');
  });

  it('loja sem parcelamento (max = 1) mostra 1x com o preço cheio', () => {
    const { context, parcelas, valorParcela } = monta({ mi: 1 });
    trocaVariante(context, { price: 99900, compare_at_price: null });

    expect(textOf(parcelas)).toBe('1x');
    expect(textOf(valorParcela)).toBe('R$ 999,00');
  });

  it('sem valor mínimo, vai direto ao máximo de parcelas', () => {
    const { context, parcelas, valorParcela } = monta({ mv: 0 });
    trocaVariante(context, { price: 1000, compare_at_price: null });

    expect(textOf(parcelas)).toBe('10x');
    expect(textOf(valorParcela)).toBe('R$ 1,00');
  });

  it('preço zero não vira divisão por zero nem parcela negativa', () => {
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 0, compare_at_price: null });

    expect(textOf(parcelas)).toBe('1x');
    expect(textOf(valorParcela)).toBe('R$ 0,00');
  });

  it('atributos data-* ausentes caem em 1x em vez de NaN', () => {
    // `parseInt(undefined) || 1` — o componente pode ser renderizado por um
    // snippet que esqueceu de passar as configurações.
    document.body.innerHTML = `
      <div product-context>
        <price-component>
          <span class="selling-price"></span>
          <span class="installment-value"></span>
          <span class="installment-price-value"></span>
        </price-component>
      </div>`;
    const context = document.querySelector('[product-context]');

    trocaVariante(context, { price: 99900, compare_at_price: null });

    expect(textOf(document.querySelector('.installment-value'))).toBe('1x');
    expect(textOf(document.querySelector('.installment-price-value'))).toBe('R$ 999,00');
  });

  it('o preço-fallback de price-v2.liquid (1999) não trava o componente', () => {
    // `assign price = target.price | default: 1999` — quando o produto vem
    // nulo (preview de section sem produto escolhido), o servidor pinta
    // R$ 19,99. Se uma variante com esse preço chegar, o cálculo tem que dar
    // o mesmo número que o Liquid deu.
    const { context, selling, parcelas } = monta();
    trocaVariante(context, { price: 1999, compare_at_price: null });

    expect(textOf(selling)).toBe('R$ 19,99');
    expect(textOf(parcelas)).toBe('1x');
  });
});

describe('divergência conhecida com o Liquid', () => {
  it('R$ 99,99: o JS mostra 2x onde o servidor não mostra parcelamento', () => {
    // ATENÇÃO: este teste registra um BUG (issue #48), não um contrato
    // desejado.
    //
    // O Liquid usa `price | divided_by: i`, que é divisão INTEIRA (trunca):
    //   9999 | divided_by: 2  →  4999   →  4999 >= 5000 é falso  →  1x
    // O JS usa `Math.ceil(price / i)`, que arredonda para cima:
    //   Math.ceil(9999 / 2) = 5000      →  5000 >= 5000 é verdade →  2x
    //
    // Resultado na loja: a PDP renderiza sem parcelamento e, no mesmo
    // carregamento, `variations-selector` dispara `variant:change` e o texto
    // vira "até 2x de R$ 50,00" — parcelas de R$ 49,995, abaixo do mínimo que
    // a lojista configurou. E ",99" é o final de preço mais comum do varejo.
    //
    // Quando a issue #48 for corrigida (o caminho provável é o JS passar a
    // usar Math.floor, alinhando-se aos DOIS arquivos Liquid), este teste vai
    // falhar. Isso é o ponto: ele existe para não deixar o bug ser esquecido.
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 9999, compare_at_price: null });

    expect(textOf(parcelas)).toBe('2x');
    expect(textOf(valorParcela)).toBe('R$ 50,00');
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
