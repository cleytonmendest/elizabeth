/**
 * Os eventos de produto ficam no contexto do produto (#157).
 *
 * `variant-selects` e `quantity-selector` disparam no [product-context] do
 * produto a que pertencem. Até a #157 a bolha era diferente em cada disparo:
 * o `variant:change` da carga borbulhava e o da troca não, e o
 * `quantity:change` borbulhava sempre. Um ouvinte no `document` recebia um
 * subconjunto sem sentido — a quantidade de todo produto da página e a
 * variante de nenhum —, e foi lá que a galeria e o aviso de estoque foram
 * escutar.
 *
 * O teste escuta no `document` na fase de BOLHA, que é o que um componente
 * faz com `document.addEventListener(nome, f)`. Na fase de captura o
 * `document` recebe tudo, com ou sem bolha — é por isso que
 * tests/variations-selector.test.mjs pode escutar lá e continuar valendo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('variations-selector.js');
loadAsset('quantity-selector.js');

let noContexto;
let noDocument;
const ouvintes = [];

function escuta(alvo, nome, lista) {
  const f = (e) => lista.push(e.type);
  alvo.addEventListener(nome, f);
  ouvintes.push(() => alvo.removeEventListener(nome, f));
}

beforeEach(() => {
  noContexto = [];
  noDocument = [];
  window.history.replaceState({}, '', '/produtos/vestido');
});

afterEach(() => {
  ouvintes.splice(0).forEach((desliga) => desliga());
  document.body.innerHTML = '';
});

describe('variant:change', () => {
  const VARIANTES = [
    { id: 1, options: ['Preto'], available: true },
    { id: 2, options: ['Branco'], available: true },
  ];

  function monta() {
    document.body.innerHTML = `<div product-context></div>`;
    const contexto = document.querySelector('[product-context]');
    escuta(contexto, 'variant:change', noContexto);
    escuta(document, 'variant:change', noDocument);
    // Conectado DEPOIS dos ouvintes, para o disparo da carga também ser medido.
    contexto.innerHTML = `
      <variant-selects>
        <script type="application/json" data-variants>${JSON.stringify(VARIANTES)}</script>
        <fieldset><legend>Cor</legend>
          <input type="radio" id="preto" name="Cor" value="Preto" checked><label for="preto">Preto</label>
          <input type="radio" id="branco" name="Cor" value="Branco"><label for="branco">Branco</label>
        </fieldset>
      </variant-selects>`;
  }

  it('na carga e na troca, chega ao contexto e não ao document', () => {
    monta();
    const branco = document.getElementById('branco');
    branco.checked = true;
    branco.dispatchEvent(new Event('change', { bubbles: true }));

    expect(noContexto).toEqual(['variant:change', 'variant:change']);
    expect(noDocument).toEqual([]);
  });
});

describe('quantity:change', () => {
  it('chega ao contexto e não ao document', () => {
    document.body.innerHTML = `<div product-context></div>`;
    const contexto = document.querySelector('[product-context]');
    escuta(contexto, 'quantity:change', noContexto);
    escuta(document, 'quantity:change', noDocument);
    contexto.innerHTML = `
      <quantity-selector>
        <button type="button" name="minus">-</button>
        <input type="number" name="quantity" value="1">
        <button type="button" name="plus">+</button>
      </quantity-selector>`;

    contexto.querySelector('button[name="plus"]').click();

    expect(noContexto).toEqual(['quantity:change']);
    expect(noDocument).toEqual([]);
  });
});
