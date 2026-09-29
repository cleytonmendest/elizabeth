/**
 * As bolinhas de cor do card de produto, medidas em pixel.
 *
 * Não precisa de loja, como `header-transparente.spec.mjs`. E mede o que ele
 * declarou fora de alcance: contraste sobre foto. O axe reporta texto sobre
 * gradiente e imagem como *incomplete*, porque não amostra pixel — então a
 * pergunta da #154, "bolinha clara sobre foto clara dá para ver?", ficava
 * para olho humano sobre screenshot.
 *
 * Aqui ela vira número. O navegador renderiza, o teste fotografa e lê os
 * pixels num canvas: a bolinha (o miolo, o aro branco da borda, o aro preto da
 * sombra) contra o scrim ao lado dela, e o "+N" contra o fundo do próprio chip.
 *
 * ── Os pisos ───────────────────────────────────────────────────────────────
 *
 * 3:1 para a bolinha, que é elemento gráfico (WCAG 1.4.11). Basta UMA das três
 * camadas passar: a cor clara se separa do scrim pelo aro preto, a escura
 * pelo aro branco. 4,5:1 para o "+N", que é texto.
 *
 * Medido antes da #154, sobre foto branca: bolinha clara 1,7:1 no desktop e
 * 2,1:1 no mobile, "+N" 3,1:1. O card só tinha o aro branco, que não separa
 * nada de um scrim claro.
 *
 * ── O que é do tema e o que é do teste ─────────────────────────────────────
 *
 * As bolinhas saem do bloco `capture` do snippet, renderizado pelo liquidjs; o
 * painel e o chip, das tags de abertura do snippet; o CSS, do `assets/`. A
 * foto é o que o teste escolhe: branca, creme e escura, as três pontas. Se um
 * trecho sumir do snippet, isto estoura em vez de medir outra coisa.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNIPPET = fs.readFileSync(path.join(RAIZ, 'snippets/card-product-slider.liquid'), 'utf8');

function trecho(re, oque) {
  const achado = SNIPPET.match(re);
  if (!achado) throw new Error(`snippets/card-product-slider.liquid não tem mais ${oque} — o teste perdeu o alvo.`);
  return achado;
}

const CORES = { branca: '255 255 255', creme: '245 240 230', cinza: '128 128 128', preta: '20 20 20' };

/**
 * As bolinhas e o "+N", pelo Liquid do próprio snippet. Quatro cores e sete
 * amostras, para o "+3" aparecer. Filtros da Shopify (`t`, `image_url`) passam
 * direto: o liquidjs ignora filtro que não conhece, e nenhum deles pinta.
 */
function bolinhas() {
  const [bloco] = trecho(/\{%- capture swatches_dots -%\}[\s\S]*?\{%- endcapture -%\}/, 'o capture das bolinhas');
  const values = Object.values(CORES).map((rgb) => ({ swatch: { color: { rgb } } }));
  return new Liquid().parseAndRenderSync(`${bloco}{{ swatches_dots }}`, {
    color_option: { values },
    swatch_count: values.length + 3,
  });
}

const [, CLASSE_DO_PAINEL, ESTILO_DO_PAINEL] = trecho(
  /<div\s+class="(hidden lg:flex absolute[^"]*)"\s+style="([^"]*)"\s*>/,
  'o painel de hover do desktop'
);
const [, CLASSE_DO_CHIP, ESTILO_DO_CHIP] = trecho(
  /<div class="(lg:hidden absolute[^"]*)" style="([^"]*)">/,
  'o chip do mobile'
);
const [, CLASSE_DO_BOTAO] = trecho(/button_class: '([^']*)'/, 'o botão de compra rápida');

const CSS_DO_TEMA = ['assets/application.css', 'assets/color-scheme.css']
  .map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8'))
  .join('\n');

const FOTOS = { branca: '255 255 255', creme: '243 236 226', escura: '30 26 24' };

/**
 * Um card por foto. O botão entra no painel porque é ele que empurra as
 * bolinhas para cima, onde o gradiente é mais fraco: sem ele o teste mediria
 * o caso fácil.
 */
function pagina() {
  const dots = bolinhas();
  const cards = Object.entries(FOTOS)
    .map(
      ([nome, rgb]) => `
  <div data-foto="${nome}" class="group relative overflow-hidden" style="width:260px;height:340px;background:rgb(${rgb})">
    <div class="${CLASSE_DO_PAINEL}" style="${ESTILO_DO_PAINEL}">
      <div class="flex items-center gap-1.5">${dots}</div>
      <button type="button" class="${CLASSE_DO_BOTAO}">Adicionar</button>
    </div>
    <div class="${CLASSE_DO_CHIP}" style="${ESTILO_DO_CHIP}">${dots}</div>
  </div>`
    )
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>:root,.color-scheme-1{--color-background:255 255 255;--color-text:20 20 20;--color-foreground:20 20 20;
--color-border:220 220 220;--color-shadow:0 0 0;--page-width:1200px;--radius:8px;--font-scale:1}</style>
<style>${CSS_DO_TEMA}</style>
<style>*{transition:none!important}</style>
</head><body style="margin:0;display:flex;gap:16px">${cards}</body></html>`;
}

const DPR = 4;
test.use({ deviceScaleFactor: DPR });

/**
 * Lê os pixels de UM card num canvas, no próprio navegador, e devolve as
 * razões de contraste: uma por bolinha e uma para o "+N". Mede o que está
 * visível — o painel no desktop, o chip no mobile.
 */
async function mede(page, foto) {
  const png = (await page.screenshot({ fullPage: true })).toString('base64');
  const alvo = await page.$eval(`[data-foto="${foto}"]`, (card) => {
    const visivel = [...card.children].find(
      (el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity === '1'
    );
    if (!visivel) return null;
    const spans = [...visivel.querySelectorAll('span')];
    return {
      bolinhas: spans.filter((s) => !s.textContent.trim()).map((s) => s.getBoundingClientRect().toJSON()),
      mais: spans.find((s) => s.textContent.trim())?.getBoundingClientRect().toJSON(),
    };
  });
  expect(alvo, `foto ${foto}: nem o painel nem o chip estão visíveis`).not.toBeNull();
  expect(alvo.mais, `foto ${foto}: o "+N" não renderizou`).toBeDefined();

  return page.evaluate(
    async ({ png, alvo, DPR, nomes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const px = (x, y) => [...ctx.getImageData(Math.round(x * DPR), Math.round(y * DPR), 1, 1).data].slice(0, 3);
      const canal = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
      const razao = (a, b) => {
        const [claro, escuro] = [lum(a), lum(b)].sort((m, n) => n - m);
        return Math.round(((claro + 0.05) / (escuro + 0.05)) * 100) / 100;
      };

      const { bolinhas, mais } = alvo;
      const porCor = Object.fromEntries(
        bolinhas.map((b, i) => {
          const meio = b.y + b.height / 2;
          const scrim = px(b.x - 3, meio); // metade do gap-1.5 entre duas bolinhas
          const camadas = {
            miolo: razao(px(b.x + b.width / 2, meio), scrim),
            aroBranco: razao(px(b.x + 0.5, meio), scrim),
            aroPreto: razao(px(b.x - 0.6, meio), scrim),
          };
          return [nomes[i], Math.max(...Object.values(camadas))];
        })
      );

      // "+N": o fundo é o topo do chip, por dentro da borda e acima do
      // texto; o texto é o pixel mais claro do miolo do círculo.
      const cx = mais.x + mais.width / 2;
      const cy = mais.y + mais.height / 2;
      const fundo = px(cx, mais.y + 2);
      let texto = fundo;
      const raio = mais.width / 2 - 2;
      for (let dx = -raio; dx <= raio; dx += 1 / DPR) {
        for (let dy = -raio; dy <= raio; dy += 1 / DPR) {
          if (dx * dx + dy * dy > raio * raio) continue;
          const p = px(cx + dx, cy + dy);
          if (lum(p) > lum(texto)) texto = p;
        }
      }
      return { bolinhas: porCor, mais: razao(texto, fundo) };
    },
    { png, alvo, DPR, nomes: Object.keys(CORES) }
  );
}

function confere(foto, { bolinhas: porCor, mais }) {
  expect(Object.keys(porCor), `foto ${foto}: as bolinhas não renderizaram`).toEqual(Object.keys(CORES));
  for (const [cor, contraste] of Object.entries(porCor)) {
    expect(contraste, `bolinha ${cor} sobre foto ${foto}`).toBeGreaterThanOrEqual(3);
  }
  expect(mais, `"+N" sobre foto ${foto}`).toBeGreaterThanOrEqual(4.5);
}

test('desktop: as bolinhas do painel de hover se destacam de qualquer foto', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 400 });
  await page.setContent(pagina());

  for (const foto of Object.keys(FOTOS)) {
    // O painel nasce transparente e só aparece com o cursor sobre o card.
    await page.hover(`[data-foto="${foto}"]`);
    confere(foto, await mede(page, foto));
  }
});

test('mobile: as bolinhas do chip se destacam de qualquer foto', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 400 });
  await page.setContent(pagina());

  for (const foto of Object.keys(FOTOS)) confere(foto, await mede(page, foto));
});
