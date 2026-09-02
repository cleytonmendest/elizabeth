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
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { violacoes, regras, relatorio } from './helpers/axe.mjs';
import { THEME_URL, MOTIVO, STYLEGUIDE_PATH, abrePaginaDoTema } from './helpers/loja.mjs';
import { avaliar, resolvidas, carregar, impressao, ARQUIVO } from './helpers/baseline.mjs';

test.skip(!THEME_URL, MOTIVO);

/** Widgets de terceiro que a lojista instala e o tema não controla. */
const FORA_DO_TEMA = ['#shopify-chat', '[id^="shopify-block-"]'];

const BASELINE = carregar();

/**
 * `npm run test:e2e:baseline` regrava o arquivo a partir do que a loja mostra
 * AGORA. Roda com --workers=1 de propósito: o acumulador abaixo é de processo,
 * e dois workers escreveriam metade do resultado cada um.
 *
 * Regravar à mão seria a mesma armadilha do ROADMAP — um arquivo que depende
 * de alguém lembrar de atualizar diverge no primeiro dia corrido.
 */
const REGRAVANDO = process.env.A11Y_BASELINE_WRITE === '1';
const medido = {};

test.afterAll(() => {
  if (!REGRAVANDO) return;
  const violacoes = Object.fromEntries(Object.entries(medido).sort());
  fs.writeFileSync(
    ARQUIVO,
    JSON.stringify(
      {
        _leia: JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))._leia,
        _medido_em: new Date().toISOString().slice(0, 10),
        _total: Object.keys(violacoes).length,
        violacoes,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`\nbaseline regravado: ${Object.keys(violacoes).length} impressão(ões).`);
});

/**
 * Reprova por violação NOVA; a conhecida vira aviso no log.
 *
 * O aperto é o mesmo do lint: dívida registrada não bloqueia ninguém, mas
 * também não some de vista — e o dia em que ela for corrigida, o teste avisa
 * para regravar o baseline, senão o número nunca cai.
 */
async function semViolacaoNova(page, pagina) {
  const encontradas = await violacoes(page, { excluir: FORA_DO_TEMA });
  const { conhecidas, novas } = avaliar(pagina, encontradas, BASELINE);

  if (REGRAVANDO) {
    for (const v of encontradas) {
      medido[impressao(pagina, v.id)] = `${v.nodes.length} nó(s) — ${v.help}`;
    }
    return;
  }

  for (const v of conhecidas) {
    console.log(`  [baseline] ${pagina}: ${v.id} — dívida conhecida, ver e2e/a11y-baseline.json`);
  }
  for (const f of resolvidas(pagina, encontradas, BASELINE)) {
    console.log(`  [resolvida] ${f} não viola mais — rode "npm run test:e2e:baseline" para travar a melhoria`);
  }

  expect(regras(novas), `\nVIOLAÇÃO NOVA:\n${relatorio(novas)}\n`).toEqual([]);
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
  test(`sem violação NOVA de WCAG AA: ${nome}`, async ({ page }) => {
    await abrePaginaDoTema(page, caminho);
    await semViolacaoNova(page, nome);
  });
}

test('sem violação NOVA de WCAG AA: página de produto', async ({ page }) => {
  // O handle do produto depende do catálogo da loja, então chegamos nele pelo
  // caminho da cliente em vez de cravar uma URL que quebra quando o catálogo
  // muda.
  await abrePaginaDoTema(page, '/collections/all');
  await page.locator('a[href*="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
  await semViolacaoNova(page, 'página de produto');
});

test('o drawer do carrinho aberto também passa', async ({ page }) => {
  // Estado que a auditoria manual esquece: o axe só vê o drawer quando ele
  // está aberto, e é ali que mora a armadilha de foco.
  await abrePaginaDoTema(page, '/');
  await page.locator('#minicart-button').click();
  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await semViolacaoNova(page, 'drawer do carrinho');
});
