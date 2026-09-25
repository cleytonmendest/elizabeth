/**
 * O mega menu sobrevive ao caminho do mouse, e cabe na janela?
 *
 * Irmão de `gate.spec.mjs` e `guarda-do-clique.spec.mjs`: não precisa de loja,
 * então roda em toda execução. O que ele mede é geometria e hit-testing —
 * coisas que o jsdom não tem, porque ele não calcula layout.
 *
 * ── O defeito que este arquivo nasceu para travar ──────────────────────────
 *
 * O painel abre por `group-hover`, e o gatilho fica dentro do `!py-3` do
 * cabeçalho enquanto o painel é `absolute top-full` do `#main-header-container`.
 * Isso deixa uma FAIXA MORTA entre os dois — medida: 14px. Ao descer o mouse
 * do item para o painel, a pessoa atravessa essa faixa, o `:hover` do grupo cai,
 * o painel recebe `pointer-events: none` e não dá mais para alcançá-lo.
 *
 * O resultado é um menu que abre e não deixa clicar. Relatado em QA manual, com
 * o tema empurrado; nenhum teste via, porque nenhum teste move o mouse.
 *
 * A ponte é um `::before` do painel cobrindo a faixa. E ela tem um vizinho
 * perigoso: enquanto o `overflow-y-auto` esteve no PAINEL, ele recortava o
 * próprio `::before` — a ponte existia no CSS, com a geometria certa, e não era
 * atingida. Por isso o teto de altura mora no MIOLO e a ponte no painel; os
 * dois testes abaixo existem para essa separação não ser desfeita por alguém
 * que ache que juntar é mais limpo.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * As classes saem do snippet de verdade, e não de uma cópia.
 *
 * Fixture copiada à mão diverge do fonte e passa a medir outro programa — foi o
 * que aconteceu enquanto este defeito era investigado, e custou uma rodada
 * inteira de diagnóstico errado. Se algum `class=` mudar de forma a não casar
 * mais, `classe()` estoura: o teste fica vermelho em vez de verde por não achar
 * o que mediria.
 */
function classe(padrao) {
  const src = fs.readFileSync(path.join(RAIZ, 'snippets/main-menu.liquid'), 'utf8');
  const achado = src.match(new RegExp(`class="(${padrao}[^"]*)"`));
  if (!achado) {
    throw new Error(
      `main-menu.liquid não tem mais um class="${padrao}…". O teste perdeu o alvo — ` +
        'atualize o padrão em vez de deixá-lo verde medindo nada.'
    );
  }
  return achado[1];
}

/**
 * A fixture PRECISA do logo, e ele precisa de altura.
 *
 * É o logo que define a altura da linha do cabeçalho, e a altura da linha é o
 * que determina o tamanho do vão. Sem ele, a fixture tinha uma linha rasa, o
 * vão media 14px, e o teste aprovava uma ponte que na loja real — com o grupo
 * medindo 20px dentro de uma linha de 48 — não cobria os 26px de vão.
 *
 * Isto não é detalhe de montagem: é a terceira vez nesta investigação que uma
 * fixture divergente fez o verificador medir outro programa. Por isso as
 * classes saem do snippet e a geometria é conferida aqui, com um logo de
 * verdade.
 */
const pagina = (grupos, alturaDoLogo = 48) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>:root{--color-background:255 255 255;--color-foreground:20 20 20;--color-border:220 220 220;
--color-shadow:0 0 0;--page-width:1200px;--radius:8px;--font-scale:1}</style></head>
<body><div class="w-full"><main-header class="w-full block relative">
<div id="main-header-container" class="color-background color-text w-full group relative">
  <div class="!py-3 page-width w-full"><div class="flex justify-between">
    <div class="flex-[1] justify-center items-center flex"><h1 class="w-fit"><a href="/">
      <div style="width:200px;height:${alturaDoLogo}px;background:#ddd"></div></a></h1></div>
    <nav class="${classe('flex items-center lg:justify-center')}"><div class="${classe('menu-desk')}">
      <div id="grupo" class="${classe('static flex')}">
        <a id="gatilho" href="#" class="color-text text-sm flex items-center gap-1">Mais</a>
        <div id="painel" class="${classe('mega-panel')}">
          <div id="miolo" class="${classe('page-width py-8')}">
            <div class="flex flex-wrap gap-x-12 gap-y-6 flex-1">${grupos}</div>
          </div>
        </div>
      </div>
    </div></nav><div class="flex items-center">ÍCONES</div>
  </div></div>
</div></main-header></div></body></html>`;

/**
 * Um grupo do painel: título (2º nível) e os itens dele (3º nível).
 *
 * Os itens não são enfeite. Com grupos de UMA linha, 120 deles ainda cabiam
 * abaixo do teto e o miolo não rolava — o teste passava sem exercitar nada.
 * Menu que transborda de verdade é menu com terceiro nível, que é exatamente
 * o caso em que o painel full-bleed se justifica.
 */
const grupo = (i, itens = 0) =>
  `<div class="min-w-menu-col">
     <a id="alvo-${i}" href="/g${i}" class="color-text block text-sm font-medium mb-3">Grupo ${i}</a>
     <ul class="flex flex-col gap-2">${
       Array.from({ length: itens }, (_, j) => `<li><a href="/g${i}/i${j}" class="text-sm">Item ${j}</a></li>`).join('')
     }</ul>
   </div>`;

async function monta(page, quantos, itens = 0, alturaDoLogo = 48) {
  await page.setContent(
    pagina(Array.from({ length: quantos }, (_, i) => grupo(i, itens)).join(''), alturaDoLogo)
  );
  await page.addStyleTag({ path: path.join(RAIZ, 'assets/application.css') });
}

/** O vão entre a base da área com hover e o topo do painel. */
async function vao(page) {
  const grupoBox = await page.locator('#grupo').boundingBox();
  const painel = await page.locator('#painel').boundingBox();
  return painel.y - (grupoBox.y + grupoBox.height);
}

/** A altura da ponte (`::before` do painel), em px. */
const ponte = (page) =>
  page.locator('#painel').evaluate((e) => parseFloat(getComputedStyle(e, '::before').height));

test('o painel continua aberto no caminho do gatilho até o item', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await monta(page, 4);

  const gatilho = await page.locator('#gatilho').boundingBox();
  await page.locator('#gatilho').hover();
  await expect(page.locator('#painel')).toHaveCSS('opacity', '1');

  const alvo = await page.locator('#alvo-0').boundingBox();
  const x = gatilho.x + gatilho.width / 2;

  // Passo pequeno de propósito: é o movimento de uma pessoa, e é ele que
  // atravessa a faixa morta. Um `hover()` direto no alvo teletransporta o
  // cursor e passa mesmo com o defeito presente.
  for (let y = gatilho.y + gatilho.height / 2; y <= alvo.y + alvo.height / 2; y += 4) {
    await page.mouse.move(x, y);
  }

  await expect(
    page.locator('#painel'),
    'o painel fechou enquanto o mouse atravessava a faixa entre o item e ele'
  ).toHaveCSS('opacity', '1');
  await expect(page.locator('#painel')).toHaveCSS('pointer-events', 'auto');
});

test('a faixa entre o gatilho e o painel existe — e é ela que a ponte cobre', async ({ page }) => {
  // Sem esta medição o teste acima ficaria verde no dia em que a faixa
  // desaparecesse por outro motivo, sem provar nada sobre a ponte.
  await page.setViewportSize({ width: 1400, height: 900 });
  await monta(page, 4);
  await page.locator('#gatilho').hover();

  const faixa = await vao(page);
  const alturaDaPonte = await ponte(page);

  expect(faixa, 'a faixa sumiu; o teste da ponte deixou de exercitar o defeito').toBeGreaterThan(0);
  expect(
    faixa,
    `a faixa (${faixa}px) ficou maior que a ponte (${alturaDaPonte}px) — ela deixa de cobrir`
  ).toBeLessThan(alturaDaPonte);
});

test('painel com muitos grupos cabe na janela, e o miolo é que rola', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await monta(page, 40, 8);
  await page.locator('#gatilho').hover();

  const painel = await page.locator('#painel').boundingBox();
  expect(
    painel.y + painel.height,
    'o painel passou da janela: a parte de baixo fica inalcançável, porque sair com o mouse o fecha'
  ).toBeLessThanOrEqual(800);

  const rola = await page.locator('#miolo').evaluate((e) => e.scrollHeight > e.clientHeight);
  expect(rola, 'o conteúdo foi cortado em vez de ficar alcançável por rolagem').toBe(true);
});

test('o teto de altura não volta para o painel — lá ele recorta a ponte', async ({ page }) => {
  // A regressão exata que custou uma rodada de diagnóstico: com `overflow` no
  // painel, o `::before` da ponte é recortado. Ela continua no CSS, com a
  // geometria certa, e simplesmente não é atingida pelo cursor.
  await page.setViewportSize({ width: 1400, height: 900 });
  await monta(page, 4);

  const overflowDoPainel = await page.locator('#painel').evaluate((e) => getComputedStyle(e).overflow);

  expect(
    overflowDoPainel,
    'o painel voltou a recortar: a ponte contra a faixa morta para de funcionar'
  ).toBe('visible');
});

test('o vão não cresce com o logo da lojista', async ({ page }) => {
  // ── A propriedade que decide a correção ──────────────────────────────────
  //
  // Aumentar a ponte até cobrir o vão seria número cravado, e o vão NÃO é
  // constante: ele nasce da altura da linha do cabeçalho, que nasce do logo,
  // que é setting da lojista (`logo_width`). Medido antes da correção: com um
  // logo de 48px o vão era 26px; com 160px passaria de 100px. Nenhuma ponte
  // fixa cobre isso.
  //
  // A correção foi na raiz. O gatilho já pedia `h-full`, e falhava em silêncio:
  // `nav` é `items-center`, então `menu-desk` ficava com altura de CONTEÚDO
  // (20px, como o devtools da loja mostrou) e o `100%` do gatilho resolvia
  // contra ela. Com `self-stretch` no `menu-desk` a cadeia volta a ter altura
  // definida, o gatilho preenche a linha, e o que sobra é só o `py-3` do
  // cabeçalho — que não depende de setting nenhum.
  //
  // É isto que este teste trava: não o número, a INDEPENDÊNCIA dele.
  await page.setViewportSize({ width: 1400, height: 900 });

  const medidas = [];
  for (const alturaDoLogo of [32, 80, 160]) {
    await monta(page, 4, 0, alturaDoLogo);
    await page.locator('#gatilho').hover();
    await expect(page.locator('#painel')).toHaveCSS('opacity', '1');

    const grupoBox = await page.locator('#grupo').boundingBox();
    medidas.push({ alturaDoLogo, linha: grupoBox.height, faixa: await vao(page), ponte: await ponte(page) });
  }

  for (const m of medidas) {
    expect(
      m.faixa,
      `logo de ${m.alturaDoLogo}px: a linha ficou com ${m.linha}px e o vão com ${m.faixa}px, ` +
        `acima da ponte de ${m.ponte}px — o gatilho voltou a não acompanhar a altura da linha`
    ).toBeLessThan(m.ponte);
  }

  // E a prova de que o logo REALMENTE mudou a linha: sem isto, o laço acima
  // ficaria verde no dia em que a fixture parasse de variar a altura.
  const alturas = [...new Set(medidas.map((m) => m.linha))];
  expect(alturas.length, 'o logo parou de afetar a altura da linha; o teste deixou de variar nada').toBeGreaterThan(1);
});
