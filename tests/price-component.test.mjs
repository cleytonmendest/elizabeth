/**
 * assets/price-component.js — preço e parcelamento na troca de variante.
 *
 * O cálculo existe DUAS vezes no tema: aqui, e em Liquid
 * (`snippets/price-v2.liquid` e `snippets/card-product-slider.liquid`). O
 * servidor pinta a primeira vez; este componente repinta assim que
 * `variations-selector` dispara `variant:change` — o que acontece já no
 * carregamento da PDP. Os dois PRECISAM concordar, senão o número muda sozinho
 * na frente da cliente. Há um teste abaixo que prova que eles concordam, na
 * contagem e no valor, varrendo as fronteiras onde eles já divergiram (#48).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { textOf, normalizeCurrency } from './helpers/dom.mjs';

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

describe('concordância com o Liquid (issue #48)', () => {
  /**
   * O que o servidor pinta, em Liquid, para o mesmo preço e a mesma config.
   *
   * `divided_by` é divisão INTEIRA, e o valor sai por `| money` a partir de
   * centavos inteiros — os dois arquivos Liquid fazem exatamente isto. Esta
   * função é a régua: se ela e o componente divergirem, o número muda sozinho
   * na frente da cliente, no mesmo carregamento.
   */
  function comoOLiquidPinta(price, { mi = MAX_PADRAO, mv = MIN_PADRAO } = {}) {
    let parcelas = 1;
    if (price > 0 && mi > 1 && mv >= 0) {
      for (let i = mi; i >= 2; i -= 1) {
        if (Math.floor(price / i) >= mv) {
          parcelas = i;
          break;
        }
      }
    }
    return {
      parcelas: `${parcelas}x`,
      // `normalizeCurrency` pelo mesmo motivo que `textOf` a usa: o Intl separa
      // "R$" do número com espaço NÃO-QUEBRÁVEL, e o lado do componente passa
      // por essa normalização. Sem ela os dois valores IMPRIMEM igual e
      // comparam diferente — a primeira versão desta régua acusou 29.001
      // divergências que não existiam.
      valor: normalizeCurrency(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          Math.floor(price / parcelas) / 100
        )
      ),
    };
  }

  // Este era o teste que registrava o bug: até a #48, o JS mostrava 2x de
  // R$ 50,00 onde o servidor mostrava 1x. `Math.ceil(9999 / 2)` dava 5000 e
  // passava no mínimo; `9999 | divided_by: 2` dá 4999 e não passa. As
  // parcelas de R$ 49,995 ficavam abaixo do mínimo que a lojista pediu, e o
  // arredondamento do `formatPrice` escondia isso.
  it('R$ 99,99 com os padrões: 1x, como o servidor', () => {
    const { context, parcelas, valorParcela } = monta();
    trocaVariante(context, { price: 9999, compare_at_price: null });

    expect(textOf(parcelas)).toBe('1x');
    expect(textOf(valorParcela)).toBe('R$ 99,99');
    expect({ parcelas: textOf(parcelas), valor: textOf(valorParcela) }).toEqual(
      comoOLiquidPinta(9999)
    );
  });

  // A outra metade da divergência, e ela morde onde a contagem já estava
  // certa: o VALOR. O Liquid imprime centavos inteiros; o JS dividia em ponto
  // flutuante e deixava o `Intl` arredondar para cima.
  it('R$ 59,99 em 2x: o valor da parcela é o do servidor, ao centavo', () => {
    const { context, parcelas, valorParcela } = monta({ mv: 2000 });
    trocaVariante(context, { price: 5999, compare_at_price: null });

    expect(textOf(parcelas)).toBe('2x');
    // 5999 / 2 = 2999,5 — o servidor trunca para 2999 e imprime R$ 29,99.
    // Com a divisão em ponto flutuante saía R$ 30,00: um centavo a mais,
    // aparecendo sozinho depois do carregamento.
    expect(textOf(valorParcela)).toBe('R$ 29,99');
    expect(textOf(valorParcela)).toBe(comoOLiquidPinta(5999, { mv: 2000 }).valor);
  });

  /**
   * Os preços que PODEM divergir — escolhidos pelo que quebra, não a esmo.
   *
   *   · a FRONTEIRA da contagem: os centavos em volta de `i × mínimo`, para
   *     todo i possível. É exatamente onde `floor` e `ceil` discordam sobre
   *     passar no mínimo — a metade original da #48.
   *   · todo RESTO de divisão por i: `i × mínimo + r`, com r de 0 a i-1. O
   *     `i × mínimo` não é enfeite — é o preço em que o laço escolhe
   *     exatamente i parcelas (`floor(price / i) >= mv` vale para i e falha
   *     para i+1), então cada r exercita um resto REAL da divisão que vai ser
   *     impressa. Uma constante qualquer no lugar dele cairia quase toda em
   *     1x/2x, e o comentário prometeria uma cobertura que o código não tem.
   *   · e uma varredura larga por cima, de 11 em 11 centavos, para pegar o que
   *     eu não pensei. Passo primo de propósito: passo redondo se alinha com
   *     os divisores e visita sempre o caso fácil.
   *
   * Devolve as duas listas separadas porque a asserção final conta cada uma:
   * o largo é 30× maior, e sozinho ele esconderia o sumiço dos alvos.
   */
  function precosQuePodemDivergir({ mv, largo = false }) {
    const alvos = new Set();

    for (let i = 2; i <= MAX_PADRAO; i += 1) {
      for (let d = -2; d <= 2; d += 1) alvos.add(i * mv + d);
      for (let r = 0; r < i; r += 1) alvos.add(i * mv + r);
    }

    const amplos = new Set();
    if (largo) {
      for (let price = 1000; price <= 30000; price += 11) amplos.add(price);
    }

    const positivos = (conjunto) => [...conjunto].filter((price) => price > 0);
    return { alvos: positivos(alvos), amplos: positivos(amplos) };
  }

  // ⚠ A primeira versão varria os 29.001 preços de R$ 10,00 a R$ 300,00, de
  // centavo em centavo. Passava em 4s aqui e estourou o timeout de 5s no
  // runner do CI, com 11,7s — um teste de CORREÇÃO reprovando por velocidade
  // de máquina, que é o defeito que o comentário dentro dele dizia ter
  // evitado. O custo é o `formatPrice`: ele constrói um `Intl.NumberFormat` a
  // cada chamada, e são três por preço (~0,12ms aqui, o triplo no runner).
  //
  // O timeout explícito não está aqui para permitir lentidão — a varredura de
  // hoje roda em fração de segundo. Está para que um runner ruim não
  // transforme uma asserção de correção num vermelho sobre outra coisa.
  it('nas fronteiras, nos restos e por cima da faixa, os dois concordam', () => {
    // Uma montagem por configuração, e o evento disparado N vezes — que é o
    // que a loja faz: a cliente troca de variante na MESMA página. Remontar o
    // DOM a cada preço custava 21s sozinho.
    const divergem = [];
    let alvosVisitados = 0;
    let visitados = 0;

    for (const mv of [MIN_PADRAO, 2000]) {
      const { context, parcelas, valorParcela } = monta({ mv });
      const { alvos, amplos } = precosQuePodemDivergir({ mv, largo: mv === MIN_PADRAO });

      for (const price of [...alvos, ...amplos]) {
        trocaVariante(context, { price, compare_at_price: null });
        visitados += 1;

        const nosso = { parcelas: textOf(parcelas), valor: textOf(valorParcela) };
        const deles = comoOLiquidPinta(price, { mv });
        if (nosso.parcelas !== deles.parcelas || nosso.valor !== deles.valor) {
          divergem.push({ price, mv, js: nosso, liquid: deles });
        }
      }

      alvosVisitados += alvos.length;
    }

    expect(divergem).toEqual([]);

    // Uma varredura que não visitasse preço nenhum passaria vazia e verde — a
    // mesma mentira que a catraca contava ao comparar o total consigo mesma.
    //
    // E são DUAS contagens porque uma só não guardava o que importa: dos 2.783
    // preços visitados, 2.637 vêm do largo e 146 dos alvos. Apagar os dois
    // laços de alvo — os que miram exatamente onde `floor` e `ceil`
    // discordaram na #48 — deixaria o total acima de 2.000 e o teste verde,
    // tendo perdido a única parte que prova alguma coisa.
    //
    // Os números são folgados de propósito: guardam contra as listas virarem
    // vazias, não contra elas mudarem de tamanho.
    expect(alvosVisitados).toBeGreaterThan(80);
    expect(visitados).toBeGreaterThan(2000);
  }, 20_000);
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
