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
 * O Intl separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0) — e a versão
 * do ICU pode trocá-lo por um espaço estreito (U+202F). Comparar com um espaço
 * comum falharia por um motivo que não tem nada a ver com o tema.
 */
export const normalizeCurrency = (text) => String(text).replace(/[\u00a0\u202f]/g, ' ');

/** Texto de um elemento, com o espaço em branco do Liquid colapsado. */
export const textOf = (el) => normalizeCurrency(el.textContent).replace(/\s+/g, ' ').trim();
