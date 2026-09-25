/**
 * O menu de desktop, medido num navegador — e renderizado pelo Liquid de verdade.
 *
 * Irmão de `gate.spec.mjs` e `guarda-do-clique.spec.mjs`: não precisa de loja,
 * então roda em toda execução. O que ele mede é geometria e hit-testing, que o
 * jsdom não tem porque não calcula layout.
 *
 * ── O defeito que este arquivo trava ───────────────────────────────────────
 *
 * O painel abre por `group-hover`, e entre a base do item e o topo do painel
 * sobra uma FAIXA MORTA. Ao descer o mouse a pessoa a atravessa, o `:hover` do
 * grupo cai, o painel recebe `pointer-events: none` e não dá mais para
 * alcançá-lo: um menu que abre e não deixa clicar.
 *
 * A ponte é um `::before` do painel cobrindo a faixa. Ela tem dois vizinhos
 * perigosos, e os dois já morderam:
 *
 *   · `overflow` no PAINEL recorta o próprio `::before` — a ponte existe no
 *     CSS, com a geometria certa, e não é atingida. Por isso o teto de altura
 *     mora no MIOLO.
 *   · a faixa CRESCE com a altura da linha do cabeçalho, que cresce com o logo
 *     da lojista. Enquanto o gatilho não acompanhava a linha (o `h-full` falhava
 *     em silêncio), nenhuma ponte fixa cobria.
 *
 * ── Por que a marcação vem do `liquidjs`, e não de uma cópia ───────────────
 *
 * Este arquivo remontava a marcação à mão a partir das classes do snippet. Essa
 * cópia divergiu do original TRÊS vezes na mesma investigação, e as três vezes
 * o teste ficou verde medindo um arranjo que a loja não tinha — a última
 * aprovou uma ponte de 16px contra um vão que na loja era 26px, porque a
 * fixture não tinha logo e a linha ficava rasa.
 *
 * Agora `snippets/menu-item-desktop.liquid` é renderizado de verdade. O que o
 * navegador mede é a saída do MESMO arquivo que a loja serve. O que sobra de
 * cópia é só a moldura do cabeçalho, e as classes dela saem dos fontes.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });

/**
 * Uma classe literal de um fonte do tema.
 *
 * Se o padrão parar de casar, estoura: o teste fica vermelho em vez de verde
 * medindo uma moldura que não existe mais.
 */
function classe(arquivo, padrao) {
  const src = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const achado = src.match(new RegExp(`class="(${padrao}[^"]*)"`));
  if (!achado) {
    throw new Error(`${arquivo} não tem mais um class="${padrao}…" — o teste perdeu o alvo.`);
  }
  return achado[1];
}

/** Um item de menu: `n` subitens, os `comFilhos` primeiros com terceiro nível. */
const item = (n, comFilhos = 0) => ({
  title: 'Mais',
  url: '/mais',
  links: Array.from({ length: n }, (_, i) => ({
    title: `Subitem ${i}`,
    url: `/s${i}`,
    links:
      i < comFilhos
        ? Array.from({ length: 8 }, (_, j) => ({ title: `Terceiro ${j}`, url: `/t${j}`, links: [] }))
        : [],
  })),
});

/**
 * A página: a moldura do cabeçalho, com o item renderizado pelo Liquid dentro.
 *
 * O logo é um bloco de altura explícita porque é ELE que define a altura da
 * linha, e a altura da linha é o que determina a faixa.
 */
async function monta(page, link, { alturaDoLogo = 48, largura = 1400, altura = 900 } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  const itemHtml = await engine.renderFile('menu-item-desktop', { link, promo_blocks: [] });

  await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>:root{--color-background:255 255 255;--color-foreground:20 20 20;--color-border:220 220 220;
--color-shadow:0 0 0;--page-width:1200px;--radius:8px;--font-scale:1}</style></head>
<body><div class="w-full"><main-header class="w-full block relative">
<div id="main-header-container" class="color-background color-text w-full group relative">
  <div class="!py-3 page-width w-full"><div class="flex justify-between">
    <div class="flex-[1] justify-center items-center flex"><h1 class="w-fit"><a href="/">
      <div style="width:200px;height:${alturaDoLogo}px;background:#ddd"></div></a></h1></div>
    <nav class="${classe('snippets/main-menu.liquid', 'flex items-center lg:justify-center')}">
      <div class="${classe('snippets/main-menu.liquid', 'menu-desk')}">${itemHtml}</div>
    </nav>
    <div class="flex items-center">ÍCONES</div>
  </div></div>
</div></main-header></div></body></html>`);

  await page.addStyleTag({ path: path.join(RAIZ, 'assets/application.css') });
}

const grupo = (page) => page.locator('[data-forma]');
const painel = (page) => page.locator('.mega-panel');

/** O vão entre a base da área com hover e o topo do painel. */
async function vao(page) {
  const g = await grupo(page).boundingBox();
  const p = await painel(page).boundingBox();
  return p.y - (g.y + g.height);
}

/** A altura da ponte (`::before` do painel), medida. */
const ponte = (page) =>
  painel(page).evaluate((e) => parseFloat(getComputedStyle(e, '::before').height));

/** Desce o cursor do item até o primeiro link do painel, como uma pessoa faria. */
async function desceAteOPainel(page) {
  const g = await grupo(page).boundingBox();
  const alvo = await painel(page).locator('a').first().boundingBox();
  const x = g.x + g.width / 2;
  // Passo pequeno de propósito: `hover()` direto teletransporta o cursor e
  // passa mesmo com a faixa morta presente.
  for (let y = g.y + g.height / 2; y <= alvo.y + alvo.height / 2; y += 4) {
    await page.mouse.move(x, y);
  }
}

for (const [nome, link, formaEsperada] of [
  ['lista plana (dropdown)', item(4), 'dropdown'],
  ['com terceiro nível (painel)', item(4, 4), 'painel'],
]) {
  test(`${nome}: o submenu continua aberto no caminho do mouse`, async ({ page }) => {
    await monta(page, link);

    await expect(grupo(page)).toHaveAttribute('data-forma', formaEsperada);
    await page.locator('[data-forma] > a').first().hover();
    await expect(painel(page)).toHaveCSS('opacity', '1');

    await desceAteOPainel(page);

    await expect(
      painel(page),
      'o submenu fechou enquanto o mouse atravessava a faixa entre o item e ele'
    ).toHaveCSS('opacity', '1');
    await expect(painel(page)).toHaveCSS('pointer-events', 'auto');
  });

  test(`${nome}: a faixa é coberta, ou não existe`, async ({ page }) => {
    // ── As duas formas têm ÂNCORAS diferentes, e por isso faixas diferentes ──
    //
    // O painel é `static` no item, então o `absolute` escapa para o
    // `#main-header-container`: ele começa na base do CABEÇALHO, e entre o item
    // e ele sobra o `py-3`. É a faixa morta, e é ela que a ponte cobre.
    //
    // O dropdown é `relative` no próprio item: `top-full` é a base DELE, e as
    // duas caixas se encostam. Faixa zero, ou negativa quando a animação ainda
    // está a caminho. Medir isto separado não é detalhe — foi o que mostrou que
    // as duas formas não compartilham o problema.
    await monta(page, link);
    await page.locator('[data-forma] > a').first().hover();
    await expect(painel(page)).toHaveCSS('opacity', '1');

    const faixa = await vao(page);
    const alturaDaPonte = await ponte(page);

    if (formaEsperada === 'painel') {
      expect(faixa, 'a faixa sumiu; o teste da ponte deixou de exercitar o defeito').toBeGreaterThan(0);
      expect(
        faixa,
        `a faixa (${faixa}px) ficou maior que a ponte (${alturaDaPonte}px) — ela deixa de cobrir`
      ).toBeLessThan(alturaDaPonte);
    } else {
      expect(
        faixa,
        `o dropdown deixou de encostar no item (faixa de ${faixa}px) — ele é ancorado nele e não deveria ter vão`
      ).toBeLessThanOrEqual(0);
    }
  });
}

test('a forma segue o conteúdo, e não a contagem', async ({ page }) => {
  // O sintoma que motivou a matriz: um item com 5 subitens planos abria um
  // painel de largura inteira com cinco links soltos numa faixa.
  await monta(page, item(5));
  await page.locator('[data-forma] > a').first().hover();
  const estreito = await painel(page).boundingBox();

  await monta(page, item(5, 5));
  await page.locator('[data-forma] > a').first().hover();
  const largo = await painel(page).boundingBox();

  expect(estreito.width, 'a lista plana abriu com a largura da janela').toBeLessThan(1400 / 2);
  expect(largo.width, 'o conteúdo em grupos deixou de usar a largura inteira').toBe(1400);
});

test('lista longa continua dropdown, em duas colunas', async ({ page }) => {
  // Contagem não muda a FORMA — muda quantas colunas ela tem.
  await monta(page, item(12));

  await expect(grupo(page)).toHaveAttribute('data-forma', 'dropdown');
  await page.locator('[data-forma] > a').first().hover();

  const colunas = await painel(page)
    .locator('div > div')
    .first()
    .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);

  expect(colunas, 'a lista longa ficou em uma coluna só e estica para fora da tela').toBe(2);
});

test('painel com muitos grupos cabe na janela, e o miolo é que rola', async ({ page }) => {
  await monta(page, item(40, 40), { altura: 800 });
  await page.locator('[data-forma] > a').first().hover();

  const p = await painel(page).boundingBox();
  expect(
    p.y + p.height,
    'o painel passou da janela: a parte de baixo fica inalcançável, porque sair com o mouse o fecha'
  ).toBeLessThanOrEqual(800);

  const rola = await painel(page)
    .locator('> div')
    .evaluate((e) => e.scrollHeight > e.clientHeight);
  expect(rola, 'o conteúdo foi cortado em vez de ficar alcançável por rolagem').toBe(true);
});

test('o teto de altura não volta para o painel — lá ele recorta a ponte', async ({ page }) => {
  await monta(page, item(4, 4));

  expect(
    await painel(page).evaluate((e) => getComputedStyle(e).overflow),
    'o painel voltou a recortar: a ponte contra a faixa morta para de funcionar'
  ).toBe('visible');
});

test('o vão não cresce com o logo da lojista', async ({ page }) => {
  // A propriedade que decide a correção. Aumentar a ponte até cobrir seria
  // número cravado, e o vão NÃO é constante: ele nasce da altura da linha, que
  // nasce do logo, que é `logo_width` — setting da lojista. Medido antes:
  // com logo de 48px o vão era 26px; com 160px passaria de 100px.
  //
  // `self-stretch` no `menu-desk` devolve altura definida à cadeia, o gatilho
  // preenche a linha, e sobra só o `py-3` do cabeçalho. É a INDEPENDÊNCIA que
  // este teste trava, não o número.
  const medidas = [];
  for (const alturaDoLogo of [32, 80, 160]) {
    await monta(page, item(4, 4), { alturaDoLogo });
    await page.locator('[data-forma] > a').first().hover();
    const g = await grupo(page).boundingBox();
    medidas.push({ alturaDoLogo, linha: g.height, faixa: await vao(page), ponte: await ponte(page) });
  }

  for (const m of medidas) {
    expect(
      m.faixa,
      `logo de ${m.alturaDoLogo}px: a linha ficou com ${m.linha}px e o vão com ${m.faixa}px, ` +
        `acima da ponte de ${m.ponte}px — o gatilho voltou a não acompanhar a altura da linha`
    ).toBeLessThan(m.ponte);
  }

  const alturas = [...new Set(medidas.map((m) => m.linha))];
  expect(alturas.length, 'o logo parou de afetar a altura da linha; o teste deixou de variar nada').toBeGreaterThan(1);
});
