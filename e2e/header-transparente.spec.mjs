/**
 * O cabeçalho transparente, medido num navegador.
 *
 * Irmão de `menu-desktop.spec.mjs`: não precisa de loja, e mede o que o jsdom
 * não tem — cor computada, posição do herói, e o efeito do CSS que mora dentro
 * de `sections/header.liquid`.
 *
 * `tests/header-transparente.test.mjs` cobre a máquina de estados (quando
 * ligar, quando não ligar, de onde a cor vem). O que falta ali, e está aqui, é
 * a consequência VISUAL: o fundo some de verdade, e o herói realmente sobe para
 * debaixo do cabeçalho.
 *
 * ── O que nem isto alcança ─────────────────────────────────────────────────
 *
 * Contraste. O axe reporta texto sobre `background-image` como *incomplete*,
 * porque não amostra pixel de imagem — então a feature cujo único risco real é
 * texto claro sobre foto clara é justamente a que a varredura não vê. Esse
 * pedaço é olho humano sobre screenshot, e está escrito na issue em vez de
 * fingido aqui.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = new Liquid();

/**
 * O `<style>` do cabeçalho, renderizado a partir do fonte.
 *
 * Copiá-lo para cá seria a mesma armadilha que a fixture do menu caiu três
 * vezes: a cópia diverge e o teste passa a medir outro CSS. Se o bloco sumir
 * do arquivo, isto estoura.
 */
function estiloDoCabecalho() {
  const src = fs.readFileSync(path.join(RAIZ, 'sections/header.liquid'), 'utf8');
  const bloco = src.match(/<style>[\s\S]*?<\/style>/);
  if (!bloco) throw new Error('sections/header.liquid não tem mais um <style> — o teste perdeu o alvo.');
  return engine.parseAndRenderSync(bloco[0], { section: { id: 'teste' }, fixed: true });
}

const ESQUEMA_HEROI = 'color-scheme-3';

async function monta(page, { toggle = true, heroi = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 900 });

  const primeira = heroi
    ? `<section class="${ESQUEMA_HEROI} bg-background" data-hero-media style="height:500px">herói</section>`
    : '<section class="color-scheme-1" style="height:500px">só texto</section>';

  await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>:root,.color-scheme-1{--color-background:255 255 255;--color-text:20 20 20;--color-foreground:20 20 20;
--color-border:220 220 220;--color-shadow:0 0 0;--page-width:1200px;--radius:8px;--font-scale:1}
/* O herói é escuro: se o cabeçalho mantivesse o esquema dele, o texto sairia
   quase preto sobre a foto. A variável que a classe color-text lê é
   --color-text; --color-foreground é outra, e trocar uma pela outra faz o
   teste medir o fallback do navegador em vez do esquema. */
.${ESQUEMA_HEROI}{--color-background:20 20 20;--color-text:255 255 255;--color-foreground:255 255 255}</style>
${estiloDoCabecalho()}
</head><body>
<div id="shopify-section-teste">
  <main-header class="w-full block relative" data-transparente="${toggle}">
    <div id="main-header-container" class="color-background color-text w-full group relative">
      <div class="!py-3 page-width w-full"><div class="flex justify-between" style="height:60px">
        <span>LOGO</span><nav class="flex items-center"><div class="menu-desk"></div></nav><span>ÍCONES</span>
      </div></div>
    </div>
  </main-header>
</div>
<main id="MainContent" class="flex flex-col"><div class="shopify-section">${primeira}</div></main>
<div style="height:2000px"></div>
</body></html>`);

  // As DUAS folhas. `color-background` e `color-text` vivem em
  // `color-scheme.css`, não no `application.css` — carregar só a segunda deixa
  // o cabeçalho sem fundo e faz o teste concluir que ele já era transparente.
  await page.addStyleTag({ path: path.join(RAIZ, 'assets/application.css') });
  await page.addStyleTag({ path: path.join(RAIZ, 'assets/color-scheme.css') });
  await page.addScriptTag({ path: path.join(RAIZ, 'assets/header.js') });
  await page.waitForTimeout(50);
}

const fundo = (page) =>
  page.locator('#main-header-container').evaluate((e) => getComputedStyle(e).backgroundColor);

const TRANSPARENTE = 'rgba(0, 0, 0, 0)';

test('no topo, com herói: o fundo some e o herói sobe para debaixo do cabeçalho', async ({ page }) => {
  await monta(page);

  expect(await fundo(page), 'o cabeçalho continuou com fundo sólido').toBe(TRANSPARENTE);

  const heroi = await page.locator('[data-hero-media]').boundingBox();
  expect(heroi.y, 'o herói não subiu: sobra uma faixa entre o cabeçalho e a imagem').toBe(0);
});

test('a cor do texto é a do herói, não a do cabeçalho', async ({ page }) => {
  // O herói aqui é escuro (`--color-foreground: 255 255 255`). Se o cabeçalho
  // tivesse mantido o esquema dele, o texto sairia quase preto sobre a foto.
  await monta(page);

  const cor = await page.locator('#main-header-container').evaluate((e) => getComputedStyle(e).color);

  expect(cor, 'o cabeçalho manteve a própria cor de texto sobre a imagem do herói').toBe('rgb(255, 255, 255)');
});

test('rolar devolve o fundo sólido', async ({ page }) => {
  await monta(page);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(50);

  expect(await fundo(page), 'o cabeçalho continuou transparente fora do topo').not.toBe(TRANSPARENTE);
});

test('sem herói na primeira section, o cabeçalho fica sólido e nada sobe', async ({ page }) => {
  await monta(page, { heroi: false });

  expect(await fundo(page)).not.toBe(TRANSPARENTE);

  const primeira = await page.locator('#MainContent section').boundingBox();
  expect(primeira.y, 'a página sem herói foi puxada para cima assim mesmo').toBeGreaterThan(0);
});

test('com o toggle desligado, o cabeçalho fica sólido mesmo com herói', async ({ page }) => {
  await monta(page, { toggle: false });

  expect(await fundo(page)).not.toBe(TRANSPARENTE);
});

test('sem JavaScript o cabeçalho é sólido — o transparente é o estado adicionado', async ({ page }) => {
  // A regra de degradação. Um cabeçalho que só fica legível depois que o
  // script carrega é pior que um sólido sempre, então sólido é de onde se
  // parte. Aqui o asset simplesmente não é injetado.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<style>:root{--color-background:255 255 255;--color-text:20 20 20;--color-foreground:20 20 20;--page-width:1200px;--radius:8px;--font-scale:1}</style>
${estiloDoCabecalho()}</head><body>
<main-header data-transparente="true"><div id="main-header-container" class="color-background color-text"
  ><div style="height:60px">cabeçalho</div></div></main-header>
<main id="MainContent"><div class="shopify-section">
  <section class="color-scheme-3" data-hero-media style="height:400px">herói</section>
</div></main></body></html>`);
  await page.addStyleTag({ path: path.join(RAIZ, 'assets/application.css') });
  await page.addStyleTag({ path: path.join(RAIZ, 'assets/color-scheme.css') });

  expect(await fundo(page), 'sem JS o cabeçalho já nasceu transparente').not.toBe(TRANSPARENTE);

  const heroi = await page.locator('[data-hero-media]').boundingBox();
  expect(heroi.y, 'sem JS o herói foi puxado para cima e sumiu sob o cabeçalho').toBeGreaterThan(0);
});
