/**
 * Os caminhos que a cliente percorre — os que, quebrados, custam venda.
 *
 * ⚠ NENHUM TESTE DESTE ARQUIVO JÁ RODOU (ver o cabeçalho de a11y.spec.mjs).
 *
 * O que o Vitest cobre é o componente isolado: dado um evento, o que ele
 * escreve no DOM. O que falta é a costura — o Liquid renderizou o markup que o
 * componente espera? O evento chega de um componente ao outro numa página de
 * verdade? Nenhum teste de jsdom responde isso, porque em jsdom fui EU quem
 * escreveu o markup.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

async function abrePDP(page) {
  await page.goto('/collections/all');
  await page.locator('a[href*="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
}

test('adicionar ao carrinho abre o drawer e atualiza a bolha', async ({ page }) => {
  await abrePDP(page);

  await page.locator('add-to-cart button[name="add"]').first().click();

  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await expect(page.locator('#cart-items-container .cart-item')).toHaveCount(1);
  await expect(page.locator('#qtd-bubble')).toHaveText('1');
  // A prova de que o drawer trocou de estado, e não só ganhou um item.
  await expect(page.locator('#cart-empty')).toHaveClass(/hidden/);
});

test('quick-add do card mantém o ícone e adiciona sem sair da coleção', async ({ page }) => {
  // A regressão que quase foi para produção: `_onResize` escrevia textContent
  // em TODO <add-to-cart>, apagando o SVG de cada card. tests/add-to-cart cobre
  // a lógica; só o navegador prova que o ícone continua desenhado na tela.
  await page.goto('/collections/all');
  const quickAdd = page.locator('add-to-cart button[name="add"]').first();

  await expect(quickAdd.locator('svg')).toBeVisible();
  await quickAdd.click();

  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await expect(quickAdd.locator('svg')).toBeVisible();
  await expect(page).toHaveURL(/\/collections\//);
});

test('trocar de variante muda preço e URL juntos', async ({ page }) => {
  await abrePDP(page);
  const radios = page.locator('variant-selects fieldset input[type="radio"]');
  test.skip((await radios.count()) < 2, 'produto sem variante para trocar');

  const precoAntes = await page.locator('.selling-price').first().textContent();
  await radios.nth(1).check();

  // A URL tem que acompanhar: é o que faz o link compartilhado abrir na
  // variante certa.
  await expect(page).toHaveURL(/[?&]variant=\d+/);
  await expect(page.locator('#add-to-cart-form input[name="id"], input[name="id"]').first()).not.toHaveValue('');
  // O preço pode ou não mudar (variantes podem custar igual); o que não pode é
  // sumir.
  await expect(page.locator('.selling-price').first()).not.toBeEmpty();
  expect(precoAntes).not.toBeNull();
});

test('filtrar a coleção mantém a lista utilizável', async ({ page }) => {
  await page.goto('/collections/all');
  const filtros = page.locator('[data-filters-panel] input[type="checkbox"]');
  test.skip((await filtros.count()) === 0, 'coleção sem filtros configurados');

  await filtros.first().check();

  await expect(page).toHaveURL(/[?&]filter\./);
  await expect(page.locator('a[href*="/products/"]').first()).toBeVisible();
});

test('carregar mais acrescenta produtos sem recarregar a página', async ({ page }) => {
  await page.goto('/collections/all');
  const botao = page.locator('[data-load-more]');
  test.skip(!(await botao.isVisible().catch(() => false)), 'coleção cabe numa página só');

  const antes = await page.locator('a[href*="/products/"]').count();
  await botao.click();

  await expect(page.locator('a[href*="/products/"]')).not.toHaveCount(antes);
  await expect(page).toHaveURL(/\/collections\/all\/?$/);
});

test('busca preditiva mostra resultado enquanto digita', async ({ page }) => {
  await page.goto('/');
  await page.locator('search-component input[name="q"]').fill('a');

  await expect(page.locator('search-component .search-results')).toBeVisible();
  await expect(page.locator('.search-result-item').first()).toBeVisible();
});
