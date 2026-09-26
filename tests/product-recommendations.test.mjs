/**
 * assets/product-recommendations.js — as recomendações da PDP.
 *
 * ── O defeito que este arquivo trava ───────────────────────────────────────
 *
 * O Liquid cravava `intent=related` na URL (issue #140). A lojista que
 * cadastrava no Search & Discovery "este vestido combina com esta sandália"
 * não via isso na loja: o tema só sabia pedir produtos PARECIDOS, nunca os que
 * completam o look.
 *
 * O intent virou parâmetro do componente (`data-intent`), e é o componente
 * que o põe na URL. O primeiro bloco abaixo prova que o que a lojista escolheu
 * é o que a API recebe — um teste contra a string `intent=complementary`
 * escrita no Liquid passaria com o componente ignorando o atributo.
 *
 * ── E o que acontece quando não há o que mostrar ───────────────────────────
 *
 * Produto sem complementares cadastrados é o caso COMUM: a lojista liga a
 * section uma vez e cadastra os pares aos poucos. A resposta vem vazia, e a
 * section precisa sumir inteira — o `<main>` separa sections com `gap`, e uma
 * section vazia no fluxo deixaria um vão sem nada dentro.
 *
 * O que o jsdom NÃO prova: que a troca não empurra a página (CLS). Ele não
 * calcula layout. O que se verifica é o contrato que evita o salto: nada é
 * desenhado antes da resposta, e nada sobra depois de uma resposta vazia.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

/**
 * O jsdom não traz `IntersectionObserver`. O dublê guarda a callback para o
 * teste DIRIGIR a entrada na tela — que é o gatilho real da busca.
 */
let entraNaTela;
globalThis.IntersectionObserver = class {
  constructor(callback) {
    entraNaTela = () => callback([{ isIntersecting: true }], this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

loadAsset('product-recommendations.js');

/** O que o Liquid monta: a base (seção, produto, limite) sem o intent. */
const BASE = '/recommendations/products?section_id=template--1__recs&product_id=42&limit=4';

/** A resposta da Section Rendering API: a própria section, já com produtos (ou não). */
const secao = (miolo) => `<div id="shopify-section-recs"><product-recommendations>${miolo}</product-recommendations></div>`;

const COM_PRODUTOS = secao('<h2>Combina com</h2><ul><li>Sandália</li></ul>');
const VAZIA = secao('\n    \n');

function respondeCom(html, { status = 200 } = {}) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
  }));
}

/** Monta a section como a loja a entrega: o contêiner da Shopify em volta. */
function monta({ intent, emSecao = true } = {}) {
  const attr = intent === undefined ? '' : ` data-intent="${intent}"`;
  const el = `<product-recommendations class="block" data-url="${BASE}"${attr}></product-recommendations>`;
  document.body.innerHTML = emSecao
    ? `<section id="shopify-section-recs" class="shopify-section section">${el}</section>`
    : el;
  return {
    recs: document.querySelector('product-recommendations'),
    section: document.querySelector('.shopify-section'),
  };
}

/** Deixa a cadeia de promessas do fetch terminar. */
const assenta = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A URL que o componente pediu, já desmontada. */
const pedida = () => new URL(globalThis.fetch.mock.calls[0][0], 'https://loja.example');

let erroNoConsole;
beforeEach(() => {
  erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  erroNoConsole.mockRestore();
  document.body.innerHTML = '';
});

describe('o intent é o que a lojista escolheu', () => {
  it('complementary chega à API — é o que o Search & Discovery alimenta', async () => {
    respondeCom(COM_PRODUTOS);
    monta({ intent: 'complementary' });
    entraNaTela();
    await assenta();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(pedida().searchParams.get('intent')).toBe('complementary');
  });

  it('related também — e o resto da URL que o Liquid montou fica intacto', async () => {
    respondeCom(COM_PRODUTOS);
    monta({ intent: 'related' });
    entraNaTela();
    await assenta();

    const url = pedida();
    expect(url.pathname).toBe('/recommendations/products');
    expect(url.searchParams.get('intent')).toBe('related');
    expect(url.searchParams.get('section_id')).toBe('template--1__recs');
    expect(url.searchParams.get('product_id')).toBe('42');
    expect(url.searchParams.get('limit')).toBe('4');
    // Um intent só: dois `intent=` na URL deixariam a API escolher.
    expect(url.searchParams.getAll('intent')).toHaveLength(1);
  });

  it.each([
    ['sem data-intent', undefined],
    ['com um intent que a API não conhece', 'parecidos'],
  ])('%s, pede related — o comportamento de antes da #140', async (_caso, intent) => {
    // Uma section salva antes do setting existir não carrega o atributo, e
    // precisa continuar mostrando o que mostrava.
    respondeCom(COM_PRODUTOS);
    monta({ intent });
    entraNaTela();
    await assenta();

    expect(pedida().searchParams.get('intent')).toBe('related');
  });

  it('não busca nada antes de a section chegar perto da tela', () => {
    // A PDP já baixa galeria, variantes e preço. Recomendação lá embaixo
    // espera a cliente rolar.
    respondeCom(COM_PRODUTOS);
    monta({ intent: 'complementary' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('com produtos, a section aparece', () => {
  it('o conteúdo da resposta entra no elemento, e a section fica visível', async () => {
    respondeCom(COM_PRODUTOS);
    const { recs, section } = monta({ intent: 'complementary' });
    entraNaTela();
    await assenta();

    expect(recs.querySelector('h2').textContent).toBe('Combina com');
    expect(recs.querySelectorAll('li')).toHaveLength(1);
    expect(section.hidden).toBe(false);
    expect(erroNoConsole).not.toHaveBeenCalled();
  });
});

describe('sem produtos, a section some inteira', () => {
  it('resposta vazia: some o contêiner da section, não só o elemento', async () => {
    // O caso comum do intent complementary. Esconder só o elemento deixaria o
    // `<section>` da Shopify no fluxo do `<main>`, cercado pelo gap entre
    // sections — um vão sem nada dentro.
    respondeCom(VAZIA);
    const { recs, section } = monta({ intent: 'complementary' });
    entraNaTela();
    await assenta();

    expect(section.hidden).toBe(true);
    // E nada de título órfão: o elemento continua sem conteúdo.
    expect(recs.textContent.trim()).toBe('');
  });

  it('resposta vazia não é erro — o console fica quieto', async () => {
    // Produto sem par cadastrado é estado normal da loja. Um erro no console
    // a cada PDP é ruído que a revisão da Theme Store nota.
    respondeCom(VAZIA);
    monta({ intent: 'complementary' });
    entraNaTela();
    await assenta();

    expect(erroNoConsole).not.toHaveBeenCalled();
  });

  it('erro HTTP: some, e o erro fica registrado para quem investiga', async () => {
    // A página de erro da Shopify é HTML válido, sem recomendação nenhuma:
    // sem olhar o status, o componente a trataria como "vazio" em silêncio, e
    // uma URL quebrada pareceria loja sem pares cadastrados.
    respondeCom('<html><body><h1>Erro</h1></body></html>', { status: 500 });
    const { section } = monta({ intent: 'complementary' });
    entraNaTela();
    await assenta();

    expect(section.hidden).toBe(true);
    expect(erroNoConsole).toHaveBeenCalledTimes(1);
    expect(String(erroNoConsole.mock.calls[0][1])).toContain('500');
  });

  it('falha de rede: some também', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { section } = monta({ intent: 'related' });
    entraNaTela();
    await assenta();

    expect(section.hidden).toBe(true);
    expect(erroNoConsole).toHaveBeenCalled();
  });

  it('fora de um contêiner de section, esconde o próprio elemento', async () => {
    respondeCom(VAZIA);
    const { recs } = monta({ intent: 'complementary', emSecao: false });
    entraNaTela();
    await assenta();

    expect(recs.hidden).toBe(true);
  });
});
