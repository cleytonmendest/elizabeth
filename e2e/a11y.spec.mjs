/**
 * axe nas páginas do storefront — substitui a auditoria manual de a11y por um
 * gate de PR.
 *
 * ⚠ NENHUM TESTE DESTE ARQUIVO JÁ RODOU. Falta a loja (THEME_URL). Os
 * seletores e caminhos vieram do Liquid deste repositório, não de adivinhação,
 * mas só a primeira execução real diz se estão certos — espere ajustes nela, e
 * não trate este arquivo como cobertura até ele ter ficado verde uma vez.
 *
 * Sobre os color schemes: o esquema de uma página é escolhido pela lojista no
 * admin, então não dá para alterná-lo pela URL. Quem cobre claro E escuro numa
 * página só é a página de style guide, que renderiza TODOS os esquemes de
 * `settings.color_schemes` lado a lado — foi exatamente para isso que ela
 * existe (issue #30).
 */
import { test, expect } from '@playwright/test';
import { violacoes, regras, relatorio } from './helpers/axe.mjs';
import { THEME_URL, MOTIVO, STYLEGUIDE_PATH } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

/** Widgets de terceiro que a lojista instala e o tema não controla. */
const FORA_DO_TEMA = ['#shopify-chat', '[id^="shopify-block-"]'];

async function semViolacao(page) {
  const encontradas = await violacoes(page, { excluir: FORA_DO_TEMA });
  expect(regras(encontradas), `\n${relatorio(encontradas)}\n`).toEqual([]);
}

const PAGINAS = [
  ['home', '/'],
  ['coleção', '/collections/all'],
  ['busca', '/search?q=vestido'],
  ['carrinho', '/cart'],
  ['404', '/esta-pagina-nao-existe-de-proposito'],
  ['style guide (todos os color schemes)', STYLEGUIDE_PATH],
];

for (const [nome, caminho] of PAGINAS) {
  test(`sem violação de WCAG AA: ${nome}`, async ({ page }) => {
    await page.goto(caminho);
    await semViolacao(page);
  });
}

test('sem violação de WCAG AA: página de produto', async ({ page }) => {
  // O handle do produto depende do catálogo da loja, então chegamos nele pelo
  // caminho da cliente em vez de cravar uma URL que quebra quando o catálogo
  // muda.
  await page.goto('/collections/all');
  await page.locator('a[href*="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
  await semViolacao(page);
});

test('o drawer do carrinho aberto também passa', async ({ page }) => {
  // Estado que a auditoria manual esquece: o axe só vê o drawer quando ele
  // está aberto, e é ali que mora a armadilha de foco.
  await page.goto('/');
  await page.locator('#minicart-button').click();
  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await semViolacao(page);
});
