/**
 * assets/variations-selector.js — <variant-selects>.
 *
 * Três responsabilidades que ninguém vê acontecer, e que só aparecem quando
 * falham: achar a variante da combinação escolhida, marcar as combinações
 * impossíveis, e manter a URL compartilhável apontando para a variante certa.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('variations-selector.js');

// Preto/P e Preto/M existem; Branco só existe no P — e esgotado.
const VARIANTES = [
  { id: 101, options: ['Preto', 'P'], available: true },
  { id: 102, options: ['Preto', 'M'], available: true },
  { id: 103, options: ['Branco', 'P'], available: false },
];

/**
 * Reproduz o markup de swatches: um <fieldset> por opção, radios com
 * <label for> — que é o elemento que recebe a classe `is-unavailable`.
 */
function monta({ variantes = VARIANTES, cor = 'Preto', tamanho = 'P' } = {}) {
  const fieldset = (nome, valores, escolhido) => `
    <fieldset>
      <legend>${nome}</legend>
      ${valores
        .map(
          (v) => `
        <input type="radio" id="${nome}-${v}" name="${nome}" value="${v}" ${v === escolhido ? 'checked' : ''}>
        <label for="${nome}-${v}">${v}</label>`
        )
        .join('')}
    </fieldset>`;

  document.body.innerHTML = `
    <div product-context>
      <variant-selects>
        <script type="application/json" data-variants>${JSON.stringify(variantes)}</script>
        ${fieldset('Cor', ['Preto', 'Branco'], cor)}
        ${fieldset('Tamanho', ['P', 'M'], tamanho)}
        <span data-selected-swatch-value="Cor"></span>
      </variant-selects>
    </div>`;

  return {
    context: document.querySelector('[product-context]'),
    selects: document.querySelector('variant-selects'),
    radio: (nome, valor) => document.querySelector(`#${nome}-${valor}`),
    label: (nome, valor) => document.querySelector(`label[for="${nome}-${valor}"]`),
  };
}

/** Marca um radio e dispara o `change` que o componente escuta. */
function escolhe(radio) {
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

let variantesRecebidas;
let ouvinte;

beforeEach(() => {
  variantesRecebidas = [];
  ouvinte = (e) => variantesRecebidas.push(e.detail.variant);
  document.addEventListener('variant:change', ouvinte, true);
  window.history.replaceState({}, '', '/produtos/vestido');
});

afterEach(() => {
  document.removeEventListener('variant:change', ouvinte, true);
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('no carregamento', () => {
  it('encontra a variante da combinação marcada e a anuncia', () => {
    monta({ cor: 'Preto', tamanho: 'M' });
    expect(variantesRecebidas).toEqual([VARIANTES[1]]);
  });

  it('escreve a variante na URL para o link ser compartilhável', () => {
    monta({ cor: 'Preto', tamanho: 'M' });
    expect(window.location.search).toBe('?variant=102');
    expect(window.location.pathname).toBe('/produtos/vestido');
  });

  it('preenche o label da opção selecionada', () => {
    monta({ cor: 'Branco' });
    expect(document.querySelector('[data-selected-swatch-value="Cor"]').textContent).toBe('Branco');
  });
});

describe('na troca de opção', () => {
  it('anuncia a nova variante', () => {
    const { radio } = monta({ cor: 'Preto', tamanho: 'P' });

    escolhe(radio('Tamanho', 'M'));

    expect(variantesRecebidas.at(-1)).toEqual(VARIANTES[1]);
  });

  it('atualiza a URL', () => {
    const { radio } = monta({ cor: 'Preto', tamanho: 'P' });

    escolhe(radio('Tamanho', 'M'));

    expect(window.location.search).toBe('?variant=102');
  });

  it('combinação inexistente anuncia undefined e NÃO mexe na URL', () => {
    // Branco/M não existe. Quem escuta (add-to-cart, price-component) recebe
    // `undefined` e desabilita a compra; a URL fica na última variante real,
    // porque uma URL sem variante válida não leva a lugar nenhum.
    const { radio } = monta({ cor: 'Preto', tamanho: 'M' });
    expect(window.location.search).toBe('?variant=102');

    escolhe(radio('Cor', 'Branco'));

    expect(variantesRecebidas.at(-1)).toBeUndefined();
    expect(window.location.search).toBe('?variant=102');
  });
});

describe('disponibilidade', () => {
  it('marca a opção que só forma combinação esgotada', () => {
    // Com Tamanho=P marcado: Branco/P existe mas está esgotado.
    const { label } = monta({ cor: 'Preto', tamanho: 'P' });

    expect(label('Cor', 'Preto').classList.contains('is-unavailable')).toBe(false);
    expect(label('Cor', 'Branco').classList.contains('is-unavailable')).toBe(true);
  });

  it('marca a opção que não forma combinação nenhuma', () => {
    // Com Cor=Branco marcado: Branco/M nem existe na lista de variantes.
    const { label } = monta({ cor: 'Branco', tamanho: 'P' });
    expect(label('Tamanho', 'M').classList.contains('is-unavailable')).toBe(true);
  });

  it('recalcula a cada troca em vez de deixar a marca presa', () => {
    const { radio, label } = monta({ cor: 'Preto', tamanho: 'P' });
    expect(label('Cor', 'Branco').classList.contains('is-unavailable')).toBe(true);

    escolhe(radio('Tamanho', 'M'));
    expect(label('Cor', 'Branco').classList.contains('is-unavailable')).toBe(true);

    escolhe(radio('Tamanho', 'P'));
    expect(label('Cor', 'Branco').classList.contains('is-unavailable')).toBe(true);
    expect(label('Cor', 'Preto').classList.contains('is-unavailable')).toBe(false);
  });
});

describe('dados ruins não derrubam a página', () => {
  it('sem <script data-variants>: registra o erro e para', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<div product-context><variant-selects></variant-selects></div>';

    expect(console.error).toHaveBeenCalledWith(
      'VariantSelects: Elemento <script data-variants> não encontrado!'
    );
    expect(variantesRecebidas).toEqual([]);
  });

  it('JSON inválido: registra o erro e para', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `
      <div product-context>
        <variant-selects><script data-variants>{ isto não é json }</script></variant-selects>
      </div>`;

    expect(console.error).toHaveBeenCalled();
    expect(variantesRecebidas).toEqual([]);
  });

  it('lista vazia de variantes: avisa e para', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    monta({ variantes: [] });

    expect(console.warn).toHaveBeenCalledWith(
      'VariantSelects: Nenhum dado de variante válido encontrado no JSON.'
    );
    expect(variantesRecebidas).toEqual([]);
  });
});
