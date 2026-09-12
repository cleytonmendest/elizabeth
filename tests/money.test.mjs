/**
 * assets/money.js — a única formatação de moeda em JS do tema.
 *
 * O que se verifica aqui é o que a issue #39 cobra: que o preço escrito por JS
 * acompanhe a moeda e o idioma ATIVOS da loja. Os três formatadores que este
 * arquivo substituiu passavam nos testes que existiam — porque os testes
 * também eram brasileiros. Um teste que só mede `pt-BR`/`BRL` não distingue
 * "lê a loja" de "crava o Brasil": os dois produzem `R$ 19,99`.
 *
 * Por isso quase todo caso aqui troca a loja de lugar.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { installShopify, uninstallShopify, normalizeCurrency } from './helpers/dom.mjs';

const { formatMoney, moneyToCents } = loadAsset('money.js', [
  'formatMoney',
  'moneyToCents',
  'moneyLocale',
  'moneyCurrency',
]);

const texto = (cents) => normalizeCurrency(formatMoney(cents));

afterEach(() => uninstallShopify());

describe('formatMoney', () => {
  it('converte centavos no formato da loja brasileira', () => {
    installShopify({ locale: 'pt-BR', currency: 'BRL' });
    expect(texto(1999)).toBe('R$ 19,99');
    expect(texto(99999)).toBe('R$ 999,99');
    expect(texto(0)).toBe('R$ 0,00');
  });

  it('formata desconto negativo com o sinal antes do símbolo', () => {
    // `updateCartSummary` (cart.js) ainda prefixa um "-" próprio nos descontos,
    // então um valor já negativo apareceria como "--R$". Quem chama passa
    // positivo — e este caso registra o que acontece se não passar.
    installShopify();
    expect(texto(-500)).toBe('-R$ 5,00');
  });

  it('arredonda a fração de centavo em vez de vazar decimal', () => {
    // 1999 / 3 = 666,333… centavos. Sem arredondamento sairia "R$ 6,663333".
    installShopify();
    expect(texto(1999 / 3)).toBe('R$ 6,66');
  });

  it('acompanha a moeda que a cliente escolheu no seletor do rodapé', () => {
    // O caso que motivou a issue: o Liquid trocava com `| money` e o JS não.
    installShopify({ locale: 'en-US', currency: 'USD' });
    expect(texto(1999)).toBe('$19.99');

    installShopify({ locale: 'de-DE', currency: 'EUR' });
    expect(texto(1999)).toBe('19,99 €');
  });

  it('separa moeda de idioma: a mesma moeda escrita em dois idiomas', () => {
    // Não é a mesma variável. Uma loja brasileira vendendo em dólar existe, e
    // um formatador que lê só uma das duas passaria no caso acima e erraria
    // aqui.
    installShopify({ locale: 'pt-BR', currency: 'USD' });
    expect(texto(123456)).toBe('US$ 1.234,56');

    installShopify({ locale: 'en-US', currency: 'BRL' });
    expect(texto(123456)).toBe('R$1,234.56');
  });

  it('sem Shopify na página, imprime o número — nunca uma moeda inventada', () => {
    // A vitrine sempre tem `window.Shopify`; o que não pode é o fallback
    // AFIRMAR um dinheiro que ninguém disse qual é. O símbolo some, o número
    // fica. O locale do Node varia por ambiente, então o que se afirma são os
    // dígitos e a ausência de símbolo — não um separador específico.
    expect(formatMoney(1999).replace(/\D/g, '')).toBe('1999');
    expect(formatMoney(1999)).not.toMatch(/R\$|\$|€|¥/);
  });

  it('sem Shopify, o idioma ainda vem do `lang` que o layout escreveu', () => {
    document.documentElement.setAttribute('lang', 'pt-BR');
    expect(formatMoney(1999)).toBe('19,99');
  });
});

describe('moneyToCents', () => {
  it('deixa passar o número, que já é centavos', () => {
    // `/cart.js` e `/products/<handle>.js`.
    expect(moneyToCents(17990)).toBe(17990);
    expect(moneyToCents(0)).toBe(0);
  });

  it('converte a string em unidades da moeda, que é como a busca responde', () => {
    // `/search/suggest.json` devolve "179.90". Era aqui que a terceira
    // implementação errava: ela formatava direto, e R$ 179,90 virava
    // R$ 17.990,00 se o valor viesse em centavos — ou o contrário. Qual dos
    // dois é o real está medido em `e2e/moeda.spec.mjs`, contra a loja.
    expect(moneyToCents('179.90')).toBe(17990);
    expect(moneyToCents('0.05')).toBe(5);
    expect(moneyToCents('1234.00')).toBe(123400);
  });

  it('não deixa o erro de ponto flutuante virar meio centavo', () => {
    // parseFloat('179.90') * 100 é 17990.000000000002. Sem arredondar,
    // `formatMoney` receberia um valor que não é centavo inteiro.
    expect(Number.isInteger(moneyToCents('179.90'))).toBe(true);
    expect(moneyToCents('8.09')).toBe(809);
  });

  it('o texto formatado é o mesmo pelos dois caminhos', () => {
    // A prova de que a unificação fechou: o preço da busca e o preço do
    // carrinho passam a imprimir a mesma coisa para o mesmo dinheiro.
    installShopify();
    expect(formatMoney(moneyToCents('179.90'))).toBe(formatMoney(moneyToCents(17990)));
  });
});
