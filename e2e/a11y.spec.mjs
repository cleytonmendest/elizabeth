/**
 * axe nas páginas do storefront — substitui a auditoria manual de a11y por um
 * gate de PR.
 *
 * Este arquivo JÁ RODOU contra a loja: `e2e/a11y-baseline.json` só existe
 * porque uma execução o produziu (ADR 0007). Ele mede o tema empurrado, e o
 * que ele acha de novo reprova o PR.
 *
 * O aviso que estava aqui — "nenhum teste deste arquivo já rodou" — ficou
 * falso e ninguém percebeu, porque nada o verificava. É a tese da ADR 0001
 * batendo no próprio repositório: estado escrito à mão apodrece. O que vale é
 * o baseline, que é medido; se ele existe, este arquivo rodou.
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
import {
  THEME_URL,
  MOTIVO,
  STYLEGUIDE_PATH,
  abrePaginaDoTema,
  clicaNoTema,
} from './helpers/loja.mjs';
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
  ['lista de coleções', '/collections'],
  ['busca', '/search?q=vestido'],
  ['carrinho', '/cart'],
  ['404', '/esta-pagina-nao-existe-de-proposito'],
  [
    'loja protegida por senha',
    '/password',
    // ⚠ fixme — issue #71, e o defeito NÃO é de acessibilidade.
    //
    // Medido: o axe acusou `color-contrast` no `.hover\:underline`, e o
    // screenshot do artefato mostra por quê — a página veio com barra de
    // anúncio, header, menu e o breadcrumb "Início /". Ou seja, o
    // `templates/password.json` foi renderizado pelo `layout/theme.liquid`,
    // não pelo `layout/password.liquid`. O nó reprovado é o breadcrumb.
    //
    // A #64 tirou o proxy do caminho e resolveu a #51 — não esta, e não o
    // login de cliente, que nunca dependeu do proxy. Aqui o motivo mudou de
    // forma: quem atravessa a senha da vitrine agora é o
    // `e2e/global-setup.mjs`, e a sessão que ele abre vale para toda a suíte.
    // Autenticado, `/password` continua vindo pelo layout da vitrine.
    //
    // O caminho para fechar a #71 mudou de forma, e está escrito lá: um
    // contexto SEM a sessão, com `?preview_theme_id=` na própria navegação.
    // Não entrou aqui porque não dá para verificar sem a loja, e um teste
    // especulativo no lugar de um fixme honesto é troca ruim.
    //
    // Registrar isso no baseline seria pior que deixar vermelho: gravaria a
    // medição de uma página que não é a que este teste diz medir, e o dia em
    // que o layout de senha ganhasse um defeito real ninguém veria.
    'issue #71 — a sessão do global-setup atravessa a senha, e autenticado o /password ' +
      'vem pelo layout da vitrine, não pelo layout/password.liquid',
  ],
  ['style guide (todos os color schemes)', STYLEGUIDE_PATH],
];

for (const [nome, caminho, motivoFixme] of PAGINAS) {
  test(`sem violação NOVA de WCAG AA: ${nome}`, async ({ page }) => {
    // O terceiro item da tupla, quando existe, é a página que a suíte ainda não
    // alcança no estado que este teste diz medir. `fixme` e não `skip`:
    // aparece no relatório, e a asserção continua sendo a correta.
    if (motivoFixme) test.fixme(true, motivoFixme);

    await abrePaginaDoTema(page, caminho);
    await semViolacaoNova(page, nome);
  });
}

test('sem violação NOVA de WCAG AA: página de produto', async ({ page }) => {
  // O handle do produto depende do catálogo da loja, então chegamos nele pelo
  // caminho da cliente em vez de cravar uma URL que quebra quando o catálogo
  // muda.
  //
  // O clique passa pela guarda de tema (#73): sem ela, o `goto` acima provava
  // a coleção e o axe media uma PDP que podia ter vindo da vitrine PUBLICADA —
  // e uma violação de lá entraria neste baseline como se fosse nossa.
  await abrePaginaDoTema(page, '/collections/all');
  await clicaNoTema(page, page.locator('a[href*="/products/"]').first(), 'o primeiro produto da coleção');
  await expect(page).toHaveURL(/\/products\//);
  await semViolacaoNova(page, 'página de produto');
});

test('o drawer do carrinho aberto também passa', async ({ page }) => {
  // Estado que a auditoria manual esquece: o axe só vê o drawer quando ele
  // está aberto, e é ali que mora a armadilha de foco.
  await abrePaginaDoTema(page, '/');
  // Clique CRU: o mini-carrinho abre no mesmo documento, que o `goto` acima já
  // provou ser desta branch.
  await page.locator('#minicart-button').click();
  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await semViolacaoNova(page, 'drawer do carrinho');
});
