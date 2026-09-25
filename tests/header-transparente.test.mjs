/**
 * O cabeçalho transparente exige DUAS condições, e uma delas não é da lojista.
 *
 * ── Por que o teste importa mais aqui que no resto ─────────────────────────
 *
 * Esta feature já foi tentada e removida por bugs. O risco real dela é
 * contraste — texto claro sobre foto clara — e é exatamente o que o portão
 * automático NÃO alcança: o axe reporta texto sobre `background-image` como
 * *incomplete*, não como falha, porque não amostra pixel de imagem.
 *
 * Então o que dá para provar por código é a MÁQUINA DE ESTADOS: quando ligar,
 * quando não ligar, e de onde a cor vem. É o que este arquivo cobre. O
 * contraste em si continua sendo olho humano sobre screenshot, e isso está
 * escrito na issue em vez de fingido aqui.
 *
 * ── O estado sólido é o padrão ─────────────────────────────────────────────
 *
 * Nada disto roda sem JavaScript. O transparente é o estado ADICIONADO, e o
 * sólido é de onde se parte — um cabeçalho que só fica legível depois que o
 * script carrega seria pior que um cabeçalho sólido sempre.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('header.js');

const ESQUEMA_DO_HEROI = 'color-scheme-3';

/**
 * Monta a página e conecta o cabeçalho.
 *
 * Destacado e só então anexado: pela via direta o elemento é atualizado no
 * mesmo instante do `innerHTML`, e o `connectedCallback` roda antes de a
 * altura falsa existir.
 */
function monta({ toggle = true, heroi = true, alturaDoHeader = 96 } = {}) {
  document.documentElement.removeAttribute('data-heroi-sob-cabecalho');
  document.documentElement.style.removeProperty('--header-height');
  window.scrollY = 0;

  const primeira = heroi
    ? `<section class="${ESQUEMA_DO_HEROI} bg-background" data-hero-media>herói</section>`
    : '<section class="color-scheme-1">só texto</section>';

  document.body.innerHTML = `<main id="MainContent"><div class="shopify-section">${primeira}</div></main>`;

  const fora = document.createElement('div');
  fora.innerHTML = `<main-header data-transparente="${toggle}">
      <div id="main-header-container" class="color-background color-text"></div>
    </main-header>`;
  const container = fora.querySelector('#main-header-container');
  Object.defineProperty(container, 'offsetHeight', { value: alturaDoHeader, configurable: true });

  document.body.prepend(fora.firstElementChild);
  return container;
}

const rolaAte = (y) => {
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('as duas condições', () => {
  it('toggle ligado E primeira section com mídia → transparente no topo', () => {
    const c = monta({ toggle: true, heroi: true });

    expect(c.hasAttribute('data-transparente')).toBe(true);
  });

  it('toggle DESLIGADO → sólido, mesmo com herói', () => {
    const c = monta({ toggle: false, heroi: true });

    expect(c.hasAttribute('data-transparente')).toBe(false);
  });

  it('toggle ligado e primeira section SEM mídia → sólido', () => {
    // O defeito clássico da feature: link claro sobre fundo branco na coleção,
    // no produto, ou numa home que começa com texto. A lojista não precisa
    // lembrar de desligar por template.
    const c = monta({ toggle: true, heroi: false });

    expect(c.hasAttribute('data-transparente')).toBe(false);
  });

  it('e nesse caso o herói também não é puxado para cima', () => {
    monta({ toggle: true, heroi: false });

    expect(document.documentElement.hasAttribute('data-heroi-sob-cabecalho')).toBe(false);
  });
});

describe('a cor vem do herói, não de um setting novo', () => {
  it('o cabeçalho ganha a classe de esquema da primeira section', () => {
    // A lojista já escolheu esse esquema para o título do herói ficar legível
    // sobre aquela foto. O cabeçalho adota a mesma decisão — não há como
    // divergir dela, e não há setting de cor para manter.
    const c = monta({ toggle: true, heroi: true });

    expect([...c.classList]).toContain(ESQUEMA_DO_HEROI);
  });

  it('e não inventa cor quando a section não declara esquema', () => {
    document.body.innerHTML = '';
    const fora = document.createElement('div');
    document.body.innerHTML =
      '<main id="MainContent"><div class="shopify-section"><section data-hero-media>sem esquema</section></div></main>';
    fora.innerHTML = '<main-header data-transparente="true"><div id="main-header-container"></div></main-header>';
    Object.defineProperty(fora.querySelector('#main-header-container'), 'offsetHeight', {
      value: 96,
      configurable: true,
    });
    document.body.prepend(fora.firstElementChild);

    expect(document.getElementById('main-header-container').hasAttribute('data-transparente')).toBe(false);
  });
});

describe('transparente só no topo', () => {
  it('rolar tira a transparência e põe a sombra', () => {
    const c = monta();
    expect(c.hasAttribute('data-transparente')).toBe(true);

    rolaAte(120);

    expect(c.hasAttribute('data-transparente')).toBe(false);
    expect(c.classList.contains('is-scrolling')).toBe(true);
  });

  it('voltar ao topo devolve a transparência', () => {
    const c = monta();
    rolaAte(120);
    rolaAte(0);

    expect(c.hasAttribute('data-transparente')).toBe(true);
    expect(c.classList.contains('is-scrolling')).toBe(false);
  });

  it('os dois estados nunca coexistem — é o que tira a sombra de cima da foto', () => {
    // Um dos cinco defeitos que derrubaram a primeira tentativa: a sombra do
    // `is-scrolling` virava um risco flutuando sobre a imagem. Aqui ela não
    // precisa ser desligada, porque os dois são o mesmo interruptor invertido.
    const c = monta();

    for (const y of [0, 1, 50, 0, 300, 0]) {
      rolaAte(y);
      expect(
        c.hasAttribute('data-transparente') && c.classList.contains('is-scrolling'),
        `em scrollY=${y} o cabeçalho ficou transparente COM sombra`
      ).toBe(false);
    }
  });

  it('e com o toggle desligado, rolar não passa a ligar nada', () => {
    const c = monta({ toggle: false });
    rolaAte(0);

    expect(c.hasAttribute('data-transparente')).toBe(false);
  });
});

describe('o herói sobe pela altura MEDIDA', () => {
  it('a marca só aparece quando a transparência foi habilitada', () => {
    monta({ toggle: true, heroi: true });

    expect(document.documentElement.hasAttribute('data-heroi-sob-cabecalho')).toBe(true);
  });

  it('e a altura publicada é a do cabeçalho, não um número cravado', () => {
    monta({ toggle: true, heroi: true, alturaDoHeader: 140 });

    expect(document.documentElement.style.getPropertyValue('--header-height')).toBe('140px');
  });
});
