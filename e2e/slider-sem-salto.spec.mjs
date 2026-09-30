/**
 * O carrossel não salta quando o Swiper chega (#161).
 *
 * Não precisa de loja. O Swiper é baixado pelo próprio `<my-slider>`, depois do
 * HTML (ADR 0011), e até ele chegar quem desenha o carrossel é a regra de
 * pré-inicialização de `src/carousel-style.css`. Sem ela os slides apareciam
 * EMPILHADOS, e quando o Swiper inicializava a página inteira subia: CLS 0,206
 * no slider do topo, no celular. Isso só acontecia quando a página aparecia
 * antes do Swiper — e é por isso que o Lighthouse mobile da home oscilava de 50
 * a 90 no mesmo tema: cada execução caía de um lado dessa corrida.
 *
 * Aqui a corrida deixa de ser sorte. O servidor SEGURA o `swiper-bundle.min.js`
 * até o teste mandar soltar: a página aparece, o teste confere que o carrossel
 * ainda não inicializou, solta o Swiper e mede o CLS depois que ele assume.
 *
 * ── O que é do tema e o que é do teste ─────────────────────────────────────
 *
 * As sections são as de `sections/`, renderizadas pelo liquidjs com os filtros
 * da loja (`tests/helpers/liquid-loja.mjs`) mais `image_url` e `image_tag`; o
 * CSS e o JS são os de `assets/`, os que a cliente baixa. Do teste são só as
 * fotos (SVG do tamanho declarado) e o que vem depois do carrossel, que é o
 * que salta.
 *
 * E cada medição planta o defeito antes de confiar no número: a mesma página
 * sem a regra de pré-inicialização precisa saltar, senão o observador de
 * layout-shift não estaria vendo nada, e o zero abaixo seria o silêncio de um
 * medidor quebrado.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motorDaLoja } from '../tests/helpers/liquid-loja.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── As sections, pelo Liquid real ─────────────────────────────────────────

function motor() {
  const engine = motorDaLoja();
  // A foto é um objeto com `src`, `width` e `height`, como o da Shopify; a URL
  // leva a largura pedida, para o `srcset` ser legível no teste.
  engine.registerFilter('image_url', (imagem, ...args) => {
    if (!imagem?.src) return '';
    const largura = Object.fromEntries(args.filter(Array.isArray)).width;
    return largura ? `${imagem.src}?width=${largura}` : imagem.src;
  });
  engine.registerFilter('image_tag', (url, ...args) => {
    const attrs = Object.fromEntries(args.filter(Array.isArray));
    return `<img src="${url}" alt="${attrs.alt ?? ''}" class="${attrs.class ?? ''}" loading="${attrs.loading ?? 'eager'}" width="600" height="800">`;
  });
  return engine;
}

function renderizaSection(arquivo, section) {
  // Dois ajustes ao que o liquidjs aceita, nenhum no que a section desenha:
  // o `schema` não é Liquid de vitrine, e o bloco `comment … endcomment` DENTRO
  // de `{% liquid %}` é texto livre, que a Shopify aceita e o liquidjs não.
  const fonte = fs
    .readFileSync(path.join(RAIZ, 'sections', arquivo), 'utf8')
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/, '')
    .replace(/^[ \t]*comment[ \t]*\n[\s\S]*?^[ \t]*endcomment[ \t]*\n/gm, '');
  return motor().parseAndRenderSync(fonte, { section });
}

// O arquivo servido tem as dimensões declaradas, como na loja: uma foto de
// proporção diferente da declarada troca de altura quando carrega, e o salto
// medido seria o dela, não o do carrossel.
const foto = (n, largura, altura) => ({ src: `/foto-${n}-${largura}x${altura}.svg`, width: largura, height: altura });

/** O slider do topo com duas fotos, um slide por vez em toda faixa. */
const HEROI = () =>
  renderizaSection('slider-image.liquid', {
    id: 'heroi',
    settings: {
      color_scheme: 'scheme-1', fullwidth: true, loop: true, nav: true, dot: false,
      'qty-desk': 1, 'qty-tablet': 1, 'qty-mob': 1, autoplay: false, 'play-time': 5, 'pause-hover': true,
    },
    blocks: [1, 2].map((n) => ({
      settings: {
        imgMob: foto(n, 500, 540), imgMobWidth: 500, imgMobHeight: 540,
        imgTablet: foto(n, 1024, 540), imgTabletWidth: 1024, imgTabletHeight: 540,
        imgDesktop: foto(n, 1920, 540), imgDesktopWidth: 1920, imgDesktopHeight: 540,
        alt_text: `Foto ${n}`,
      },
    })),
  });

/** Um carrossel de cards com `peek`: 1, 2 e 3 por vez, e a borda do próximo aparecendo. */
const CARDS = () =>
  renderizaSection('slider-cards.liquid', {
    id: 'cards',
    settings: {
      color_scheme: 'scheme-1', title: 'Coleções', loop: true, nav: false, dot: false, peek: true,
      'qty-desk': 3, 'qty-tablet': 2, 'qty-mob': 1, autoplay: false, 'play-time': 5, 'pause-hover': true,
    },
    blocks: [1, 2, 3, 4, 5].map((n) => ({
      settings: { image: foto(n, 600, 800), title: `Coleção ${n}`, link: `/collections/${n}` },
    })),
  });

// ── O servidor que segura o Swiper ────────────────────────────────────────

const ASSETS = {
  '/application.css': 'text/css',
  '/color-scheme.css': 'text/css',
  '/carousel-style.css': 'text/css',
  '/swiper-bundle.min.css': 'text/css',
  '/carousel-manager.js': 'text/javascript',
};

const SVG = (largura, altura) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><rect width="100%" height="100%" fill="#999"/></svg>`;

/**
 * `defeito` planta o estado de antes da #161: a regra de pré-inicialização
 * anulada, e os slides voltam a nascer empilhados.
 */
function pagina(section, { defeito = false } = {}) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--color-background:255 255 255;--color-text:18 18 18;--color-foreground:18 18 18;--color-button:18 18 18;
--color-button-text:255 255 255;--color-border:220 220 220;--color-shadow:0 0 0;--font-scale:1;--radius:8px;--page-width:1200px}</style>
<link rel="stylesheet" href="/application.css"><link rel="stylesheet" href="/color-scheme.css"><link rel="stylesheet" href="/carousel-style.css">
${defeito ? '<style>my-slider .my-slider__container:not(.swiper){display:block!important}</style>' : ''}
<script>
  window.__cls = 0;
  new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
</script>
<script src="/carousel-manager.js" defer data-swiper-js="/swiper-bundle.min.js" data-swiper-css="/swiper-bundle.min.css"></script>
</head><body style="margin:0">
<header style="height:64px">cabeçalho</header>
${section}
<section id="depois" style="height:1200px">o que vem depois do carrossel</section>
</body></html>`;
}

/** Sobe o servidor; `soltar()` libera o Swiper, que fica preso até lá. */
async function servidor(html) {
  let soltar;
  const preso = new Promise((ok) => (soltar = ok));
  const srv = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    const manda = (tipo, corpo) => {
      res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-store' });
      res.end(corpo);
    };
    if (url === '/') return manda('text/html', html);
    if (ASSETS[url]) return manda(ASSETS[url], fs.readFileSync(path.join(RAIZ, 'assets', url)));
    if (url === '/swiper-bundle.min.js') {
      await preso;
      return manda('text/javascript', fs.readFileSync(path.join(RAIZ, 'assets/swiper-bundle.min.js')));
    }
    const svg = url.match(/^\/foto-\d+-(\d+)x(\d+)\.svg$/);
    if (svg) return manda('image/svg+xml', SVG(svg[1], svg[2]));
    res.writeHead(404);
    res.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}/`, soltar, fechar: () => srv.close() };
}

/**
 * Abre a página com o Swiper preso, espera o primeiro paint COM as fotos,
 * solta o Swiper e devolve o CLS acumulado depois que ele assumiu.
 */
async function saltoQuandoOSwiperChega(page, section, opcoes) {
  const s = await servidor(pagina(section, opcoes));
  try {
    await page.goto(s.url, { waitUntil: 'domcontentloaded' });
    // As fotos VISÍVEIS já estão na tela. As de fora ficam com `loading=lazy`
    // e nunca carregam, então esperar por todas seria esperar para sempre.
    await page.waitForFunction(() =>
      [...document.images]
        .filter((img) => {
          const r = img.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        })
        .every((img) => img.complete && img.naturalWidth > 0)
    );
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));

    // A corrida está armada: a página apareceu e o carrossel ainda não é Swiper.
    expect(await page.$$eval('my-slider', (els) => els.every((el) => !el.swiper))).toBe(true);

    s.soltar();
    await page.waitForFunction(() => [...document.querySelectorAll('my-slider')].every((el) => el.swiper));
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    return await page.evaluate(() => window.__cls);
  } finally {
    s.fechar();
  }
}

const FAIXAS = [
  ['celular', 412, 823],
  ['tablet', 800, 1024],
  ['desktop', 1280, 800],
];

for (const [nome, montar] of [
  ['slider do topo', HEROI],
  ['carrossel de cards com peek', CARDS],
]) {
  for (const [faixa, largura, altura] of FAIXAS) {
    test(`${nome}, ${faixa}: a página não salta quando o Swiper chega`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      const section = montar();

      const semARegra = await saltoQuandoOSwiperChega(page, section, { defeito: true });
      expect(semARegra, 'sem a regra de pré-inicialização a página tinha que saltar — o medidor não está vendo').toBeGreaterThan(0.02);

      const comARegra = await saltoQuandoOSwiperChega(page, section);
      expect(comARegra, `CLS quando o Swiper chegou (sem a regra: ${semARegra.toFixed(3)})`).toBeLessThanOrEqual(0.001);
    });
  }
}

test('sem JS os slides continuam alcançáveis: a trilha rola, em vez de cortar', async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 412, height: 823 } });
  const page = await contexto.newPage();
  const s = await servidor(pagina(CARDS()));
  try {
    await page.goto(s.url);
    const trilha = await page.$eval('my-slider .my-slider__container', (el) => ({
      overflow: getComputedStyle(el).overflowX,
      rola: el.scrollWidth > el.clientWidth,
      slides: el.children.length,
    }));
    expect(trilha).toEqual({ overflow: 'auto', rola: true, slides: 5 });
  } finally {
    s.fechar();
    await contexto.close();
  }
});
