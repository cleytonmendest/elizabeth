/**
 * Os CSS gerados pelo Tailwind: fonte → artefato.
 *
 * A lista mora aqui, e não em `scripts/lint/rules/build.mjs`, porque duas
 * regras precisam dela — `build` compara cada par, `tokens` lê o fonte e pula
 * o artefato — e a regra `build` importa o esbuild, que se recusa a carregar
 * sob jsdom. O `build` do package.json gera exatamente estes pares, e
 * `tests/build-css.test.mjs` confere.
 *
 * O segundo par é co-locado: só a PDP o carrega (`snippets/add-to-cart.liquid`).
 * Ele passa pelo Tailwind, e não é escrito à mão, por causa do `@apply`.
 */
export const CSS = [
  ['src/tailwind.css', 'assets/application.css'],
  ['src/checkout-acelerado.css', 'assets/checkout-acelerado.css'],
];
