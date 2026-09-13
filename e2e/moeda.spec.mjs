/**
 * Em que unidade a Shopify devolve dinheiro por JSON?
 *
 * A issue #39 encontrou três formatadores de preço em JS e uma DISCORDÂNCIA
 * entre eles: dois dividiam por 100, o terceiro não — e o terceiro trazia um
 * comentário afirmando que "a API retorna o preço já em centavos (17990 =
 * R$ 179,90)", o que, formatado direto, dá R$ 17.990,00. Ou o comentário
 * estava errado, ou o código estava. Ninguém sabia, porque a resposta não
 * estava em lugar nenhum que pudesse ficar vermelho.
 *
 * Este arquivo é essa resposta, e ele não a afirma: ele a MEDE, contra a loja.
 *
 * ── Por que o `| money` do Liquid é a régua ───────────────────────────────
 *
 * Comparar um JSON com outro JSON só provaria que os dois concordam, não em
 * que unidade estão. O que decide é o número que a própria Shopify IMPRIME na
 * página a partir do mesmo campo: `{{ product.price | money }}` e
 * `{{ cart.total_price | money }}`. Se os dígitos do texto renderizado forem
 * iguais ao inteiro do JSON, o inteiro conta a menor unidade da moeda — e
 * dividir por 100 antes de formatar é o certo.
 *
 * A comparação é feita só sobre os DÍGITOS: símbolo, separador de milhar e
 * posição da vírgula mudam com a moeda e com o idioma, e nada disso é o que
 * está sob teste aqui.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO, abrePaginaDoTema, clicaNoTema } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

/** "R$ 1.799,90" → "179990". O que sobra é a quantia na menor unidade da moeda. */
const digitos = (texto) => String(texto).replace(/\D/g, '');

/** O JSON de um produto da loja, buscado de dentro da página (com a sessão dela). */
const produtoJson = (page, handle) =>
  page.evaluate(
    (h) => fetch(`${window.Shopify.routes.root}products/${h}.js`).then((r) => r.json()),
    handle
  );

/** Abre a PDP do primeiro produto da coleção e devolve o handle dele. */
async function abrePDP(page) {
  await abrePaginaDoTema(page, '/collections/all');
  await clicaNoTema(page, page.locator('a[href*="/products/"]').first(), 'o primeiro produto');
  await expect(page).toHaveURL(/\/products\//);
  return new URL(page.url()).pathname.split('/products/')[1].split('?')[0];
}

test('o JSON de produto está em centavos — e o `| money` da página prova', async ({ page }) => {
  const handle = await abrePDP(page);
  const produto = await produtoJson(page, handle);

  const precoNaTela = await page.locator('.selling-price').first().innerText();
  const precosEmJson = produto.variants.map((v) => String(v.price));

  // Contra QUALQUER variante, e não contra a primeira: a PDP mostra a
  // selecionada, que nem sempre é `variants[0]`. O que se afirma é a UNIDADE,
  // e para isso basta o número impresso ser um dos preços do JSON.
  expect(
    precosEmJson,
    `A tela imprimiu "${precoNaTela}" (dígitos ${digitos(precoNaTela)}) e o JSON traz ` +
      `${precosEmJson.join(', ')}. Se o JSON estivesse em unidades da moeda, os dois ` +
      'não bateriam — e `formatMoney` (assets/money.js) não poderia dividir por 100.'
  ).toContain(digitos(precoNaTela));
});

test('/cart.js está na mesma unidade que o carrinho renderizado', async ({ page }) => {
  await abrePDP(page);
  // Clique CRU: adicionar ao carrinho é fetch, não navegação.
  await page.locator('add-to-cart button[name="add"]').first().click();
  await expect(page.locator('cart-drawer')).toHaveClass(/active/);

  await abrePaginaDoTema(page, '/cart');

  // `[data-cart-total]` é `{{ cart.total_price | money }}` (sections/main-cart.liquid),
  // e é o MESMO campo que o JSON devolve — por isso a comparação vale.
  const totalNaTela = await page.locator('[data-cart-total]').first().innerText();
  const carrinho = await page.evaluate(() =>
    fetch(`${window.Shopify.routes.root}cart.js`).then((r) => r.json())
  );

  expect(
    digitos(totalNaTela),
    `A página imprimiu "${totalNaTela}" e /cart.js devolveu ${carrinho.total_price}. ` +
      'É esta igualdade que autoriza o `cents / 100` de assets/money.js.'
  ).toBe(String(carrinho.total_price));
});

test('/search/suggest.json devolve o preço em UNIDADES da moeda, não em centavos', async ({
  page,
}) => {
  // A divergência da #39, resolvida por evidência: `search-component.js`
  // formatava este valor direto, sem dividir, enquanto o carrinho dividia. Os
  // dois só podem estar certos se os dois endpoints responderem em unidades
  // diferentes — e é isso que este teste verifica.
  const handle = await abrePDP(page);
  const produto = await produtoJson(page, handle);

  // O termo sai do título do produto que a loja REALMENTE tem: inventar uma
  // palavra mede o catálogo, não o formato da resposta (ver a nota da busca
  // preditiva em fluxos.spec.mjs).
  const termo = produto.title
    .split(/\s+/)
    .filter((p) => p.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  test.skip(!termo, `produto "${produto.title}" não tem palavra longa o bastante para buscar`);

  const sugestoes = await page.evaluate(
    (q) =>
      fetch(
        `${window.Shopify.routes.root}search/suggest.json?q=${encodeURIComponent(q)}&resources[limit]=10`
      ).then((r) => r.json()),
    termo
  );

  const achado = (sugestoes.resources?.results?.products ?? []).find((p) => p.handle === handle);
  // O índice de busca da loja é propriedade do CATÁLOGO, não do tema: ele pode
  // demorar a indexar um produto novo. Sem resultado o teste diz isso, alto, em
  // vez de afrouxar a asserção até passar.
  test.skip(
    !achado,
    `o índice de busca não devolveu "${handle}" para o termo "${termo}" — nada a medir`
  );

  expect(
    typeof achado.price,
    `suggest.json devolveu ${JSON.stringify(achado.price)}. O TIPO é o que ` +
      '`moneyToCents` (assets/money.js) usa para decidir a unidade.'
  ).toBe('string');

  expect(
    Math.round(parseFloat(achado.price) * 100),
    `suggest.json devolveu "${achado.price}" e /products/${handle}.js devolveu ` +
      `${produto.price} centavos. Se estes dois forem IGUAIS sem o ×100, então a busca ` +
      'também responde em centavos e `moneyToCents` está multiplicando o que não devia.'
  ).toBe(produto.price);
});
