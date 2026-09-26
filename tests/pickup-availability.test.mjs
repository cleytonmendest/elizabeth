/**
 * Retirada na loja, na PDP (issue #137).
 *
 * Duas metades, e a divisão é a do próprio recurso:
 *
 *   o servidor   `snippets/pickup-availability-info.liquid` decide O QUE se
 *                diz para uma variante — nada, disponível no principal, ou
 *                indisponível nele e disponível em outro. Renderizado aqui pelo
 *                `liquidjs`, como em `tests/menu-forma.test.mjs`.
 *
 *   o componente `assets/pickup-availability.js` troca esse HTML quando a
 *                variante muda, e abre o diálogo com as lojas.
 *
 * A marcação que o componente recebe é a SAÍDA dos snippets, renderizada por
 * `tests/helpers/retirada.mjs` — o mesmo módulo que `e2e/retirada.spec.mjs` usa
 * para medir o diálogo num navegador. O limite do `liquidjs` está escrito lá.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { textOf } from './helpers/dom.mjs';
import { PRAZO, local, variante, info, hospedeiro, respostaDaSecao } from './helpers/retirada.mjs';

/** Monta HTML solto num contêiner, para as asserções lerem a DOM e não a string. */
function dom(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

// ── O que o servidor diz ────────────────────────────────────────────────────

describe('o servidor pinta o estado da variante', () => {
  it('sem local com retirada, não imprime nada', () => {
    expect(info(variante(1, [])).trim()).toBe('');
  });

  it('local que estoca a peça mas não faz retirada não conta', () => {
    // `store_availabilities` traz todo local que ESTOCA a variante. Anunciar
    // "retirada indisponível em Depósito" para um depósito que nunca atende
    // cliente seria inventar uma loja.
    expect(info(variante(1, [local('Depósito', { retirada: false })])).trim()).toBe('');
  });

  it('disponível no principal: a loja e o prazo, e as informações dela', () => {
    const html = dom(info(variante(1, [local('Centro')])));

    expect(textOf(html.querySelector('p'))).toBe(`Retirada disponível em Centro · ${PRAZO}`);
    expect(textOf(html.querySelector('[data-pickup-abrir]'))).toBe('Ver informações da loja');
  });

  it('indisponível no principal e disponível em outro: diz isso, e oferece a lista', () => {
    const html = dom(
      info(variante(1, [local('Centro', { disponivel: false }), local('Shopping', { telefone: '(11) 5555-0000' })]))
    );

    expect(textOf(html.querySelector('p'))).toBe('Retirada indisponível no momento em Centro');
    expect(textOf(html.querySelector('[data-pickup-abrir]'))).toBe('Ver disponibilidade nas outras lojas');

    const lojas = [...html.querySelectorAll('dialog li')].map((li) => ({
      nome: textOf(li.querySelector('h3')),
      estado: textOf(li.querySelector('p')),
    }));
    expect(lojas).toEqual([
      { nome: 'Centro', estado: 'Indisponível para retirada no momento' },
      { nome: 'Shopping', estado: `Disponível para retirada · ${PRAZO}` },
    ]);
    expect(html.querySelector('dialog a[href^="tel:"]').getAttribute('href')).toBe('tel:(11)5555-0000');
  });

  it('o diálogo tem nome: o título que ele anuncia é o que o aria-labelledby aponta', () => {
    const dialogo = dom(info(variante(7, [local('Centro')]))).querySelector('dialog');
    const titulo = dialogo.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`);

    expect(textOf(titulo)).toBe('Retirada na loja');
  });

  it('sem retirada, a PDP nasce com o hospedeiro escondido — sem vão no lugar', () => {
    const vazio = dom(hospedeiro(variante(1, []))).querySelector('pickup-availability');
    const cheio = dom(hospedeiro(variante(2, [local('Centro')]))).querySelector('pickup-availability');

    expect(vazio.hidden).toBe(true);
    expect(cheio.hidden).toBe(false);
    expect(cheio.dataset.variantId).toBe('2');
  });
});

// ── O componente ────────────────────────────────────────────────────────────

loadAsset('pickup-availability.js');

/**
 * `showModal` e `close` não existem no jsdom. O stub faz o mínimo que o
 * navegador faz e NADA de foco: é o componente que precisa movê-lo, e um stub
 * que focasse sozinho deixaria o teste verde com o componente mudo.
 */
function instalaDialogo() {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * `fetch` controlável: cada chamada fica pendente até o teste decidir
 * responder — e em que ORDEM, que é o ponto do teste da resposta atrasada.
 */
function instalaFetch() {
  const pendentes = [];
  window.fetch = vi.fn(
    (url) =>
      new Promise((resolve, reject) => {
        pendentes.push({
          url,
          responde: (corpo, ok = true) => resolve({ ok, text: () => Promise.resolve(corpo) }),
          falha: () => reject(new TypeError('Failed to fetch')),
        });
      })
  );
  return pendentes;
}

/** Deixa as promessas do componente (fetch → text → pinta) andarem. */
const assenta = () => new Promise((resolve) => setTimeout(resolve, 0));

const V1 = variante(1, [local('Centro')]);
// Com telefone nas duas lojas: o diálogo tem três focáveis (fechar e dois
// links), e o Tab tem começo, meio e fim para medir.
const V2 = variante(2, [
  local('Centro', { disponivel: false, telefone: '(11) 4444-0000' }),
  local('Shopping', { telefone: '(11) 5555-0000' }),
]);
const V3 = variante(3, [local('Norte')]);
const SEM_RETIRADA = variante(4, []);

let pendentes;

function monta(inicial = V1) {
  document.body.innerHTML = `<div product-context>${hospedeiro(inicial)}</div>`;
  return {
    contexto: document.querySelector('[product-context]'),
    el: document.querySelector('pickup-availability'),
  };
}

/** O que `<variant-selects>` faz: dispara no [product-context], sem bubbles. */
const trocaVariante = (contexto, v) =>
  contexto.dispatchEvent(new CustomEvent('variant:change', { detail: { variant: v } }));

/** A frase do resumo — é o que diz a loja de QUAL variante está na tela. */
const resumo = (el) => textOf(el.querySelector('[data-pickup-conteudo] > p'));

beforeEach(() => {
  instalaDialogo();
  pendentes = instalaFetch();
  window.Shopify = { routes: { root: '/en/' } };
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.Shopify;
});

describe('na troca de variante', () => {
  it('pede o fragmento da variante nova, com o prefixo de idioma da vitrine', () => {
    // `/en/` e não `/`: uma URL cravada devolveria o fragmento no idioma
    // padrão para quem navega em inglês.
    const { contexto } = monta();
    trocaVariante(contexto, V2);

    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(pendentes[0].url).toBe('/en/variants/2/?section_id=pickup-availability');
  });

  it('pinta o que chegou', async () => {
    const { contexto, el } = monta();
    trocaVariante(contexto, V2);
    pendentes[0].responde(respostaDaSecao(V2));
    await assenta();

    expect(resumo(el)).toBe('Retirada indisponível no momento em Centro');
    expect(el.dataset.variantId).toBe('2');
  });

  it('a variante que já está na tela não é pedida de novo', () => {
    // `<variant-selects>` dispara `variant:change` já no carregamento, com a
    // variante que o servidor acabou de pintar.
    const { contexto } = monta(V1);
    trocaVariante(contexto, V1);

    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('descarta a resposta que chega atrasada de uma variante anterior', async () => {
    const { contexto, el } = monta(V1);
    trocaVariante(contexto, V2);
    trocaVariante(contexto, V3);

    // A de V3 chega primeiro; a de V2, que ficou para trás, chega depois.
    pendentes[1].responde(respostaDaSecao(V3));
    await assenta();
    pendentes[0].responde(respostaDaSecao(V2));
    await assenta();

    expect(resumo(el)).toBe(`Retirada disponível em Norte · ${PRAZO}`);
    expect(el.dataset.variantId).toBe('3');
  });

  it('voltar para a variante da tela enquanto outra carrega invalida a outra', async () => {
    // Não há fetch para V1 — ela já está pintada. Sem invalidar o pedido de
    // V2, ele chegaria e pintaria a loja de V2 com o seletor marcando V1.
    const { contexto, el } = monta(V1);
    trocaVariante(contexto, V2);
    trocaVariante(contexto, V1);

    pendentes[0].responde(respostaDaSecao(V2));
    await assenta();

    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(resumo(el)).toBe(`Retirada disponível em Centro · ${PRAZO}`);
  });

  it('variante sem retirada: o elemento some, e volta quando a próxima tem', async () => {
    const { contexto, el } = monta(V1);

    trocaVariante(contexto, SEM_RETIRADA);
    pendentes[0].responde(respostaDaSecao(SEM_RETIRADA));
    await assenta();

    expect(el.hidden).toBe(true);
    expect(el.children).toHaveLength(0);

    trocaVariante(contexto, V3);
    pendentes[1].responde(respostaDaSecao(V3));
    await assenta();

    expect(el.hidden).toBe(false);
    expect(resumo(el)).toBe(`Retirada disponível em Norte · ${PRAZO}`);
  });

  it('combinação que não existe: some, em vez de anunciar a loja da anterior', async () => {
    const { contexto, el } = monta(V1);
    trocaVariante(contexto, V2);
    trocaVariante(contexto, undefined);

    // E o pedido de V2, que estava em voo, também não pinta mais.
    pendentes[0].responde(respostaDaSecao(V2));
    await assenta();

    expect(el.hidden).toBe(true);
    expect(el.children).toHaveLength(0);
  });

  it('falha de rede: some, e a próxima troca para a mesma variante tenta de novo', async () => {
    const { contexto, el } = monta(V1);
    trocaVariante(contexto, V2);
    pendentes[0].falha();
    await assenta();

    expect(el.hidden).toBe(true);

    trocaVariante(contexto, V2);
    expect(window.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('o diálogo das lojas', () => {
  const partes = (el) => ({
    abrir: el.querySelector('[data-pickup-abrir]'),
    dialogo: el.querySelector('dialog'),
    fechar: el.querySelector('[data-pickup-fechar]'),
  });

  it('abre com o foco dentro dele', () => {
    const { el } = monta(V2);
    const { abrir, dialogo, fechar } = partes(el);

    abrir.focus();
    abrir.click();

    expect(dialogo.open).toBe(true);
    expect(document.activeElement).toBe(fechar);
  });

  it('fechar pelo botão devolve o foco ao gatilho', () => {
    const { el } = monta(V2);
    const { abrir, dialogo, fechar } = partes(el);

    abrir.click();
    fechar.click();

    expect(dialogo.open).toBe(false);
    expect(document.activeElement).toBe(abrir);
  });

  it('o Esc, que o navegador trata sozinho, também devolve o foco', () => {
    // O Esc de um diálogo modal não passa pelo nosso código: o navegador
    // fecha e dispara `close`. É nesse evento que o foco precisa voltar.
    const { el } = monta(V2);
    const { abrir, dialogo } = partes(el);

    abrir.click();
    dialogo.close();

    expect(document.activeElement).toBe(abrir);
  });

  it('clique no véu fecha; clique dentro do conteúdo, não', () => {
    const { el } = monta(V2);
    const { abrir, dialogo } = partes(el);

    abrir.click();
    dialogo.querySelector('h3').click();
    expect(dialogo.open).toBe(true);

    dialogo.click();
    expect(dialogo.open).toBe(false);
  });

  it('o Tab dá a volta dentro do diálogo, nos dois sentidos', () => {
    const { el } = monta(V2);
    const { abrir, dialogo, fechar } = partes(el);
    abrir.click();

    const focaveis = dialogo.querySelectorAll('button, a[href]');
    const ultimo = focaveis[focaveis.length - 1];
    expect(ultimo).not.toBe(fechar);

    const tab = (alvo, shiftKey = false) => {
      const evento = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      alvo.dispatchEvent(evento);
      return evento;
    };

    ultimo.focus();
    expect(tab(ultimo).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(fechar);

    expect(tab(fechar, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ultimo);
  });

  it('o Tab no meio da lista segue o caminho normal', () => {
    const { el } = monta(V2);
    const { abrir, dialogo } = partes(el);
    abrir.click();

    const meio = dialogo.querySelector('a[href^="tel:"]');
    meio.focus();
    const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    meio.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(meio);
  });

  it('depois da troca de variante, o gatilho novo abre o diálogo novo', async () => {
    // O conteúdo é substituído inteiro. Ouvinte preso ao botão antigo morreria
    // com ele; o clique é tratado no hospedeiro, que fica.
    const { contexto, el } = monta(V1);
    trocaVariante(contexto, V2);
    pendentes[0].responde(respostaDaSecao(V2));
    await assenta();

    const { abrir, dialogo } = partes(el);
    abrir.click();

    expect(dialogo.open).toBe(true);
    expect(dialogo.querySelectorAll('li')).toHaveLength(2);
  });
});
