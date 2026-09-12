/**
 * Peças de ambiente que o jsdom não traz e o tema usa.
 *
 * Cada stub fica explícito no teste que precisa dele, em vez de num setup
 * global: um teste que depende de `matchMedia` deve DIZER que depende, senão
 * a próxima pessoa não sabe o que está sendo simulado.
 */

/**
 * `window.matchMedia` não existe no jsdom. `<add-to-cart>` usa a media query
 * `(max-width: 600px)` para escolher entre o texto curto e o longo, então o
 * teste precisa poder dizer "estou no mobile" e depois mudar de ideia.
 *
 * `dispatch(next)` simula o resize: muda `matches` e chama os listeners, que é
 * exatamente o que o navegador faz ao cruzar o breakpoint.
 */
export function installMatchMedia(matches = false) {
  const listeners = new Set();
  const mql = {
    matches,
    media: '(max-width: 600px)',
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    dispatch(next) {
      mql.matches = next;
      for (const fn of listeners) fn(mql);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
  window.matchMedia = () => mql;
  return mql;
}

/**
 * `window.Shopify` é escrito pelo `{{ content_for_header }}` em toda vitrine, e
 * não existe no jsdom. É de lá que `assets/money.js` lê a moeda e o idioma
 * ATIVOS da sessão — então um teste que compara texto de preço precisa DIZER
 * em que loja ele está, em vez de herdar um `pt-BR` que já esteve cravado no
 * código do tema (issue #39).
 */
export function installShopify({ locale = 'pt-BR', currency = 'BRL' } = {}) {
  window.Shopify = { locale, currency: { active: currency } };
  return window.Shopify;
}

/** Devolve o jsdom ao estado sem vitrine: nem `Shopify`, nem `lang` no `<html>`. */
export function uninstallShopify() {
  delete window.Shopify;
  document.documentElement.removeAttribute('lang');
}

/**
 * O Intl separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0) — e a versão
 * do ICU pode trocá-lo por um espaço estreito (U+202F). Comparar com um espaço
 * comum falharia por um motivo que não tem nada a ver com o tema.
 */
export const normalizeCurrency = (text) => String(text).replace(/[\u00a0\u202f]/g, ' ');

/** Texto de um elemento, com o espaço em branco do Liquid colapsado. */
export const textOf = (el) => normalizeCurrency(el.textContent).replace(/\s+/g, ' ').trim();
