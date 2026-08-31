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

  // `card-quick-add` só renderiza <add-to-cart> para produto de UMA variante;
  // com mais de uma, o card vira um link para a PDP. Num catálogo onde todo
  // produto tem variante — como o desta loja — não há quick-add para testar,
  // e o teste diz isso em vez de falhar por ausência.
  const temQuickAdd = (await page.locator('add-to-cart').count()) > 0;
  test.skip(!temQuickAdd, 'catálogo sem produto de variante única — não há quick-add nesta coleção');

  // O quick-add mora num overlay `opacity-0 group-hover:opacity-100` sobre a
  // imagem do card: ele existe no DOM desde o começo, mas só fica visível
  // quando o mouse entra no card. A primeira versão deste teste procurava o
  // ícone sem passar o mouse — e o Playwright, corretamente, não achou.
  const card = page.locator('add-to-cart').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();

  const quickAdd = card.locator('button[name="add"]');
  await expect(quickAdd).toBeVisible();
  await expect(quickAdd.locator('svg')).toBeVisible();
  await quickAdd.click();

  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await expect(quickAdd.locator('svg')).toBeAttached();
  await expect(page).toHaveURL(/\/collections\//);
});

test('trocar de variante muda preço e URL juntos', async ({ page }) => {
  await abrePDP(page);
  const radios = page.locator('variant-selects fieldset input[type="radio"]');
  test.skip((await radios.count()) < 2, 'produto sem variante para trocar');

  const precoAntes = await page.locator('.selling-price').first().textContent();

  // O radio é `class="sr-only peer"` — invisível por CSS, com o swatch
  // desenhado no <label>. Clicar no input direto não funciona: outro elemento
  // intercepta o ponteiro. Quem a cliente clica é o label, e é o que o teste
  // tem que clicar também.
  const alvo = radios.nth(1);
  await page.locator(`label[for="${await alvo.getAttribute('id')}"]`).click();

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

  // `search-component` é renderizado quatro vezes — três no header, uma por
  // breakpoint, e uma no menu mobile. Todas existem no DOM ao mesmo tempo e
  // apenas uma está visível, então o seletor precisa dizer qual.
  const busca = page.locator('search-component:visible').first();

  // Dois detalhes que só o código do componente conta: ele ignora consulta com
  // menos de 2 caracteres (`if (query.length < 2) return`), e espera 300ms de
  // debounce antes de buscar. Digitar "a" e olhar na hora não abre nada — foi
  // o que a primeira versão deste teste fez.
  await busca.locator('input[name="q"]').fill('ve');

  await expect(busca.locator('.search-results')).toBeVisible({ timeout: 10_000 });
  await expect(busca.locator('.search-result-item').first()).toBeVisible();
});
