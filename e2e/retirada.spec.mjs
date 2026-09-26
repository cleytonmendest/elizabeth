/**
 * A retirada na loja num navegador — e sem loja (#137).
 *
 * Irmão de `menu-desktop.spec.mjs` e `header-transparente.spec.mjs`: a
 * marcação é a SAÍDA dos snippets, renderizada pelo `liquidjs` em
 * `tests/helpers/retirada.mjs`, e o que se mede é o que o jsdom não tem —
 * contraste calculado, foco movido pelo próprio navegador, `showModal` de
 * verdade e o botão que abre o diálogo sem JS nenhum.
 *
 * ── As cores são as dos presets, lidas de `config/settings_data.json` ─────
 *
 * "Legível nos 4 presets" é critério da issue, e contraste só existe com a
 * cor de verdade. As variáveis são montadas com a mesma conta de
 * `snippets/theme-styles.liquid` — o texto secundário é o texto misturado a
 * 70% com o fundo (#105). Se um preset mudar de cor, este arquivo mede a cor
 * nova sem ninguém editá-lo.
 *
 * O que ele NÃO mede: a resposta da Shopify. Os objetos de loja são montados
 * à mão; o fragmento real, com um local com retirada ativa, é pergunta para a
 * metade que roda contra `THEME_URL`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { violacoes, relatorio } from './helpers/axe.mjs';
import { RAIZ, local, variante, hospedeiro } from '../tests/helpers/retirada.mjs';

const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');

const CSS_DO_TEMA = ['assets/application.css', 'assets/color-scheme.css'].map(ler).join('\n');
const JS = ler('assets/pickup-availability.js');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `color_mix` da Shopify: o peso vale para a PRIMEIRA cor. */
const mistura = (a, b, peso) => a.map((c, i) => Math.round((c * peso + b[i] * (100 - peso)) / 100));

/** As variáveis de um scheme, com a conta de `snippets/theme-styles.liquid`. */
function variaveis({ background, text, border, shadow }) {
  const fundo = rgb(background);
  const texto = rgb(text);
  return [
    `--color-background:${fundo.join(' ')}`,
    `--color-foreground:${texto.join(' ')}`,
    `--color-text:${texto.join(' ')}`,
    `--color-foreground-muted:${mistura(texto, fundo, 70).join(' ')}`,
    `--color-border:${rgb(border).join(' ')}`,
    `--color-shadow:${rgb(shadow).join(' ')}`,
  ].join(';');
}

/** Todo par preset × scheme que a lojista pode escolher. */
function esquemas() {
  const dados = JSON.parse(ler('config/settings_data.json').replace(/\/\*[\s\S]*?\*\//g, ''));
  return Object.entries(dados.presets).flatMap(([preset, config]) =>
    Object.entries(config.color_schemes).map(([id, { settings }]) => ({ preset, id, settings }))
  );
}

const ESQUEMAS = esquemas();

// Principal disponível (o resumo tem o prazo em texto secundário) e a outra
// loja indisponível, com telefone: os dois estados da lista e um link, que é o
// que dá ao Tab um caminho para percorrer.
const COM_RETIRADA = variante(11, [
  local('Centro', { telefone: '(11) 4444-0000' }),
  local('Shopping', { disponivel: false, telefone: '(11) 5555-0000' }),
]);

/**
 * A coluna da PDP: `flex flex-col gap-5`, como em `main-product-right`, com o
 * scheme aplicado no portador como `main-product` faz.
 */
async function monta(page, { host = hospedeiro(COM_RETIRADA), esquema = ESQUEMAS[0], comJs = true } = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>PDP</title>
<style>:root{--radius-theme:8px;--radius-theme-sm:4px;--radius-theme-lg:12px;--font-scale:1;--page-width:1200px}
.color-${esquema.id}{${variaveis(esquema.settings)}}</style>
<style>${CSS_DO_TEMA}</style></head>
<body><main class="color-${esquema.id} color-background color-text">
  <div class="flex flex-col gap-5" product-context>
    <h1 data-antes>Vestido Midi</h1>
    ${host}
    <p data-depois>Descrição</p>
  </div>
</main>${comJs ? `<script>${JS}</script>` : ''}</body></html>`);
}

const gatilho = (page) => page.locator('[data-pickup-abrir]');
const dialogo = (page) => page.locator('pickup-availability dialog');

/** O elemento focado está dentro do diálogo aberto? */
const focoNoDialogo = (page) =>
  page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('dialog[open]')));

for (const esquema of ESQUEMAS) {
  test(`legível no preset ${esquema.preset}, ${esquema.id}: resumo e diálogo passam no axe`, async ({ page }) => {
    await monta(page, { esquema });

    const fechado = await violacoes(page);
    expect(fechado, `resumo:\n${relatorio(fechado)}`).toEqual([]);

    await gatilho(page).click();
    await expect(dialogo(page)).toHaveJSProperty('open', true);

    const aberto = await violacoes(page);
    expect(aberto, `diálogo aberto:\n${relatorio(aberto)}`).toEqual([]);
  });
}

test('o foco entra, fica preso e volta ao gatilho', async ({ page }) => {
  await monta(page);

  await gatilho(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialogo(page)).toHaveJSProperty('open', true);
  expect(await focoNoDialogo(page), 'o diálogo abriu com o foco fora dele').toBe(true);

  // Três focáveis (fechar e dois telefones): oito Tabs dão a volta mais de
  // duas vezes, nos dois sentidos, e o foco não pode sair em nenhum.
  for (const tecla of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(tecla);
    expect(await focoNoDialogo(page), `o foco escapou do diálogo no ${tecla}`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveJSProperty('open', false);
  await expect(gatilho(page)).toBeFocused();
});

test('sem JS, o botão abre o diálogo nativo e o Esc devolve o foco', async ({ page }) => {
  // `command="show-modal"` é o que faz o botão funcionar antes do script:
  // sem ele, a cliente sem JS veria o resumo e um botão morto.
  await monta(page, { comJs: false });

  await gatilho(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialogo(page)).toHaveJSProperty('open', true);
  expect(await focoNoDialogo(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveJSProperty('open', false);
  await expect(gatilho(page)).toBeFocused();
});

test('variante sem retirada não deixa vão entre os blocos da coluna', async ({ page }) => {
  // O vão é o `gap-5` a mais que um elemento vazio abriria: medido pela
  // distância entre os vizinhos, que é o que a cliente vê.
  const distancia = async () => {
    const antes = await page.locator('[data-antes]').boundingBox();
    const depois = await page.locator('[data-depois]').boundingBox();
    return depois.y - (antes.y + antes.height);
  };

  await monta(page, { host: '' });
  const semNada = await distancia();

  await monta(page, { host: hospedeiro(variante(12, [])) });
  expect(await distancia(), 'o elemento vazio abriu um vão na coluna').toBe(semNada);
});
