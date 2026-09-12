/*
 * money.js — a única formatação de moeda em JS do tema (fronteira
 * `money-format`, em scripts/lint/config/boundaries.json).
 *
 * Havia três cópias disto, com três nomes, discordando sobre dividir por 100 e
 * cravando `pt-BR`/`BRL` — enquanto o `| money` do Liquid acompanhava o
 * seletor de moeda do rodapé. Issue #39; o porquê da forma está na ADR 0009.
 *
 * Este arquivo é curto de propósito: ele vai para o navegador em TODA página e
 * conta no teto de `npm run lint -- --rules=budget`.
 */

/** O idioma da sessão. `documentElement.lang` é o `request.locale.iso_code` do layout. */
function moneyLocale() {
  const shopify = window.Shopify || {};
  return shopify.locale || document.documentElement.lang || undefined;
}

/** A moeda ATIVA (`BRL`, `USD`…), escrita pela Shopify no `content_for_header`. */
function moneyCurrency() {
  const shopify = window.Shopify || {};
  return (shopify.currency && shopify.currency.active) || null;
}

/**
 * Centavos → texto para a tela.
 *
 * Sem moeda conhecida o número sai sem símbolo: inventar uma é o defeito que
 * este arquivo remove. Que os JSONs da Shopify vêm mesmo em centavos não é
 * leitura da documentação — `e2e/moeda.spec.mjs` compara com o `| money`.
 */
function formatMoney(cents) {
  const currency = moneyCurrency();
  const options = currency
    ? { style: 'currency', currency: currency }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return new Intl.NumberFormat(moneyLocale(), options).format(cents / 100);
}

/**
 * Valor de um JSON da Shopify → centavos. Os endpoints não concordam:
 *
 *   número  já em centavos        `/cart.js`, `/products/<handle>.js`
 *   string  em unidades da moeda  `/search/suggest.json` ("179.90")
 *
 * O TIPO é o discriminador; o valor não serve — nada separa 17990 centavos de
 * 17990 unidades. Qual endpoint devolve o quê está medido em `e2e/moeda.spec.mjs`.
 */
function moneyToCents(value) {
  if (typeof value === 'number') return value;
  return Math.round(parseFloat(value) * 100);
}
