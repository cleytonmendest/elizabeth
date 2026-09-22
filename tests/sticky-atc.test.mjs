/**
 * assets/sticky-atc.js — a barra fixa de comprar.
 *
 * ── O defeito que este arquivo trava ───────────────────────────────────────
 *
 * A barra é `fixed bottom-0` e ocupa a faixa inteira do rodapé. O botão
 * "voltar ao topo" é `fixed bottom-6 right-6`. Os dois estão em `z-overlay`,
 * o mesmo degrau — então quem aparecia por cima dependia da ORDEM NO DOM, e
 * não de decisão de ninguém (issue #46, item 3).
 *
 * Subir o z-index de um deles não resolveria: o choque é de POSIÇÃO. Um botão
 * redondo por cima do botão de comprar continua tapando o botão de comprar,
 * esteja ele acima ou abaixo na pilha. A correção é afastar.
 *
 * ── Por que a altura é medida, e não cravada ───────────────────────────────
 *
 * A altura da barra muda com `settings.font_scale` (a lojista escolhe de 0,9 a
 * 1,2), com o tamanho do preço e com a largura da tela. Qualquer número escrito
 * no CSS estaria errado para alguém. Então a barra MEDE a si mesma e publica o
 * valor; o `back-to-top` soma a folga em `calc()`.
 *
 * O que o jsdom NÃO consegue provar: que os dois de fato não se sobrepõem na
 * tela. Ele não calcula layout — `offsetHeight` é sempre 0 aqui. O que se
 * verifica é o CONTRATO entre os dois: a barra publica estado e altura ao
 * aparecer, e retira ao sumir. A sobreposição real é trabalho de navegador,
 * e está registrada na issue #89 (regressão visual de `position: fixed`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

/**
 * O jsdom não traz `IntersectionObserver`, e o componente inteiro pendura
 * nele. O dublê guarda a callback para que o teste possa DIRIGIR a entrada e
 * a saída do botão principal — que é o gatilho real da barra, e não um método
 * que só o teste chama.
 */
let dispararIntersecao;
globalThis.IntersectionObserver = class {
  constructor(callback) {
    dispararIntersecao = (isIntersecting) => callback([{ isIntersecting }]);
  }
  observe() {}
  disconnect() {}
};

const { StickyAddToCart } = loadAsset('sticky-atc.js', ['StickyAddToCart']);

/** O par que convive no rodapé: a barra e o botão principal que ela observa. */
function monta({ comBarra = true, comBotao = true } = {}) {
  document.documentElement.removeAttribute('data-sticky-atc-visivel');
  document.documentElement.style.removeProperty('--sticky-atc-height');
  document.body.innerHTML = `
    ${comBotao ? '<add-to-cart><button type="submit">Adicionar</button></add-to-cart>' : ''}
    ${comBarra ? '<div data-sticky-atc><p>barra</p></div>' : ''}
    <button data-back-to-top>topo</button>
  `;
  return new StickyAddToCart();
}

const raiz = () => document.documentElement;

describe('a barra avisa quem flutua no rodapé', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-sticky-atc-visivel');
  });

  it('em repouso, nada é publicado', () => {
    monta();
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(false);
  });

  it('ao aparecer, marca o estado na raiz', () => {
    // É esse atributo que o CSS do back-to-top observa. Sem ele o botão fica
    // em `bottom-6`, em cima da barra — o defeito da #46.
    const barra = monta();
    barra.show();
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(true);
  });

  it('ao sumir, retira o estado', () => {
    // Sem isto o botão ficaria afastado para sempre, flutuando no vazio depois
    // que a barra recolhe.
    const barra = monta();
    barra.show();
    barra.hide();
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(false);
  });

  it('publica a altura MEDIDA da barra, não um número escrito', () => {
    const barra = monta();
    // jsdom não faz layout, então `offsetHeight` é 0. Forçamos um valor para
    // provar que o que vai para a variável é o que a barra mediu — um teste
    // contra `'64px'` literal passaria com a medição arrancada.
    Object.defineProperty(barra.stickyBar, 'offsetHeight', { value: 73, configurable: true });
    barra.show();
    expect(raiz().style.getPropertyValue('--sticky-atc-height')).toBe('73px');
  });

  it('a altura acompanha quando a barra muda de tamanho', () => {
    // Acontece de verdade: trocar de variante troca o preço, e o preço muda a
    // altura da linha. Publicar só na primeira vez deixaria a folga errada.
    const barra = monta();
    Object.defineProperty(barra.stickyBar, 'offsetHeight', { value: 73, configurable: true });
    barra.show();
    Object.defineProperty(barra.stickyBar, 'offsetHeight', { value: 96, configurable: true });
    barra.show();
    expect(raiz().style.getPropertyValue('--sticky-atc-height')).toBe('96px');
  });
});

describe('o gatilho é o botão principal sair da tela', () => {
  it('botão fora da tela → a barra aparece e publica; de volta → recolhe', () => {
    // Este é o caminho que a cliente percorre. Os testes acima chamam
    // `show()`/`hide()` direto; se o observer parasse de ligar os dois, eles
    // continuariam verdes e a barra nunca apareceria na loja.
    const barra = monta();
    Object.defineProperty(barra.stickyBar, 'offsetHeight', { value: 80, configurable: true });

    dispararIntersecao(false);
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(true);
    expect(barra.stickyBar.classList.contains('visible')).toBe(true);

    dispararIntersecao(true);
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(false);
    expect(barra.stickyBar.classList.contains('visible')).toBe(false);
  });
});

describe('a barra não quebra a página quando não tem o que observar', () => {
  it('sem a barra no documento, o componente desiste em silêncio', () => {
    // Toda página que não é PDP. Um erro aqui apareceria no console de TODA
    // navegação, e é o tipo de ruído que a revisão da Theme Store nota.
    expect(() => monta({ comBarra: false })).not.toThrow();
    expect(raiz().hasAttribute('data-sticky-atc-visivel')).toBe(false);
  });

  it('sem o botão principal, também', () => {
    // Produto esgotado renderiza a barra, e o botão principal fica desabilitado
    // ou ausente conforme o template.
    expect(() => monta({ comBotao: false })).not.toThrow();
  });
});
