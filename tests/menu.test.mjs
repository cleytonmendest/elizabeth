/**
 * O menu mobile, que rodava em toda página sem um teste sequer.
 *
 * A #36 diz que o mega menu "nunca foi validado de ponta a ponta" e está em
 * produção há duas versões. A causa mecânica disso não é falta de QA humano —
 * é que `theme.js`, o arquivo que abre a gaveta e os submenus, tinha ZERO
 * testes e ZERO mutantes. Nada nunca mediu.
 *
 * Medir achou três defeitos, e nenhum deles aparece na tela de quem usa mouse
 * numa loja publicada. Os três aparecem no EDITOR ou no TECLADO, que são
 * exatamente os dois lugares onde ninguém tinha olhado.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAsset } from './helpers/load-asset.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MARCACAO = `
  <button id="mobile-menu-open" aria-expanded="false"><span>abrir</span></button>
  <div id="mobile-menu" aria-hidden="true" inert class="-translate-x-full">
    <button id="mobile-menu-close">fechar</button>
    <button class="submenu-toggle" aria-expanded="false">Vestidos <span></span></button>
    <ul class="submenu" style="height: 0;" aria-hidden="true" inert>
      <li><a href="/curtos">Curtos</a></li>
      <li><a href="/longos">Longos</a></li>
    </ul>
  </div>
  <div id="mobile-menu-overlay" class="hidden"></div>
`;

// `theme.js` liga os ouvintes no `document`, uma vez. Carregar o asset mais de
// uma vez empilharia ouvintes e faria o segundo clique desfazer o primeiro.
loadAsset('theme.js');
loadAsset('header.js');

const gaveta = () => document.getElementById('mobile-menu');
const submenu = () => document.querySelector('.submenu');
const toggle = () => document.querySelector('.submenu-toggle');

beforeEach(() => {
  document.body.innerHTML = MARCACAO;
  document.body.classList.remove('overflow-hidden');
});

describe('a gaveta abre e fecha', () => {
  it('abre no clique do botão', () => {
    document.getElementById('mobile-menu-open').click();

    expect(gaveta().getAttribute('aria-hidden')).toBe('false');
    expect(gaveta().hasAttribute('inert')).toBe(false);
    expect(document.getElementById('mobile-menu-open').getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('mobile-menu-overlay').classList.contains('hidden')).toBe(false);
  });

  it('fecha no overlay, e devolve a rolagem da página', () => {
    document.getElementById('mobile-menu-open').click();
    document.getElementById('mobile-menu-overlay').click();

    expect(gaveta().getAttribute('aria-hidden')).toBe('true');
    expect(gaveta().hasAttribute('inert')).toBe(true);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('fecha no Escape', () => {
    document.getElementById('mobile-menu-open').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(gaveta().getAttribute('aria-hidden')).toBe('true');
  });

  it('e o Escape com a gaveta fechada não mexe em nada', () => {
    // Sem a checagem, o Escape de qualquer outro componente (modal, drawer de
    // carrinho) reescreveria o estado do menu pelas costas dele.
    document.body.classList.add('overflow-hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
  });
});

describe('o submenu não deixa foco em link invisível', () => {
  it('nasce inert — aria-hidden sozinho não tira da ordem de tabulação', () => {
    // O defeito original: `height: 0` esconde dos olhos, `aria-hidden` esconde
    // do leitor de tela, e o Tab continuava entrando. WCAG 4.1.2.
    expect(submenu().hasAttribute('inert')).toBe(true);
    expect(submenu().getAttribute('aria-hidden')).toBe('true');
  });

  it('ao abrir, sai o inert e sai o aria-hidden juntos', () => {
    toggle().click();

    expect(submenu().hasAttribute('inert')).toBe(false);
    expect(submenu().getAttribute('aria-hidden')).toBe('false');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('ao fechar, os dois voltam juntos', () => {
    toggle().click();
    toggle().click();

    expect(submenu().hasAttribute('inert')).toBe(true);
    expect(submenu().getAttribute('aria-hidden')).toBe('true');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('nenhum submenu fechado fica com link alcançável pelo Tab', () => {
    // A asserção que descreve o defeito em vez do conserto: qualquer link sob
    // aria-hidden tem que estar sob inert também.
    toggle().click();
    toggle().click();

    for (const link of document.querySelectorAll('a')) {
      const escondido = link.closest('[aria-hidden="true"]');
      if (!escondido) continue;
      expect(link.closest('[inert]'), `${link.textContent.trim()} é aria-hidden e focável`).toBeTruthy();
    }
  });
});

describe('o editor re-renderiza a section, e o menu continua vivo', () => {
  it('botões injetados depois do carregamento respondem ao clique', () => {
    // Era `querySelectorAll` dentro de `DOMContentLoaded`: os botões novos que
    // a Shopify injeta a cada mudança de setting não tinham ouvinte nenhum, e
    // o menu parava de abrir DENTRO DO EDITOR — o único lugar onde a lojista
    // monta a loja.
    document.body.innerHTML = MARCACAO;

    document.getElementById('mobile-menu-open').click();
    expect(gaveta().getAttribute('aria-hidden'), 'a gaveta não abriu após o re-render').toBe('false');

    toggle().click();
    expect(submenu().getAttribute('aria-hidden'), 'o submenu não abriu após o re-render').toBe('false');
  });

  it('clique dentro do botão (no ícone) conta como clique no botão', () => {
    // O ícone é um <span> dentro do <button>; o alvo do evento é ele.
    toggle().querySelector('span').click();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
});

/**
 * O que abre abaixo do cabeçalho não pode passar da janela.
 *
 * ── O defeito, medido no markup ────────────────────────────────────────────
 *
 * O painel do mega menu era `absolute top-full w-full` e mais nada: nenhum
 * `max-h`, nenhum `overflow`. Um menu com muitos grupos gera um painel mais
 * alto que a janela, e a parte de baixo fica INALCANÇÁVEL — para chegar nela a
 * cliente rolaria a página, e tirar o mouse do painel o fecha.
 *
 * A gaveta mobile tinha o mesmo buraco com um agravante: menu de loja é longo
 * por natureza no celular, então lá o defeito não depende de um menu grande.
 *
 * O teto não pode ser um número cravado. Ele depende da altura do cabeçalho,
 * que muda com o logo que a lojista subiu, com `font_scale` e com a barra de
 * anúncio — nenhum desses o CSS conhece. Por isso a altura é medida por
 * `header.js` e publicada em `--header-height`.
 */
describe('o painel e a gaveta cabem na janela', () => {
  const menu = readFileSync(resolve(RAIZ, 'snippets/main-menu.liquid'), 'utf8');
  const classesDe = (marca) => {
    const m = menu.match(new RegExp(`class="${marca}[^"]*"`));
    return m ? m[0] : '';
  };

  it('o painel do mega menu tem teto de altura e rolagem', () => {
    const classes = classesDe('mega-panel');

    expect(classes, 'o painel perdeu o teto de altura').toContain('max-h-below-header');
    expect(classes, 'com teto e sem rolagem, o conteúdo é cortado em vez de alcançável').toContain('overflow-y-auto');
  });

  it('a gaveta mobile rola, e não arrasta a página junto', () => {
    const classes = classesDe('menu-mob');

    expect(classes).toContain('overflow-y-auto');
    // Sem `overscroll-contain`, chegar ao fim da gaveta passa a rolar a página
    // atrás dela — o efeito que faz a pessoa perder o lugar na vitrine.
    expect(classes).toContain('overscroll-contain');
  });

  it('o teto deriva da altura medida, e não de um número cravado', () => {
    const config = readFileSync(resolve(RAIZ, 'tailwind.config.js'), 'utf8');

    expect(config).toContain("'below-header': 'calc(100vh - var(--header-height");
  });
});

describe('o cabeçalho publica a própria altura', () => {
  /**
   * Monta o cabeçalho DESTACADO e só então o anexa.
   *
   * Pela via direta (`body.innerHTML = …`) o elemento é atualizado no mesmo
   * instante, e o `connectedCallback` roda antes de a altura falsa existir —
   * lendo 0, saindo cedo, e deixando o teste vermelho por causa da montagem e
   * não do código.
   */
  const comAltura = (px) => {
    const fora = document.createElement('div');
    fora.innerHTML = '<main-header><div id="main-header-container"></div></main-header>';
    const container = fora.querySelector('#main-header-container');
    Object.defineProperty(container, 'offsetHeight', { value: px, configurable: true });

    document.body.innerHTML = '';
    document.body.appendChild(fora.firstElementChild);
    return container;
  };
  const publicada = () => document.documentElement.style.getPropertyValue('--header-height');

  beforeEach(() => {
    document.documentElement.style.removeProperty('--header-height');
  });

  it('publica ao entrar no documento', () => {
    comAltura(96);

    expect(publicada()).toBe('96px');
  });

  it('republica quando a janela muda de tamanho', () => {
    const container = comAltura(96);

    Object.defineProperty(container, 'offsetHeight', { value: 64, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(publicada(), 'o teto ficaria errado depois de girar o celular').toBe('64px');
  });

  it('não publica zero — o fallback do token é melhor que um teto de 100vh', () => {
    // Medir antes do layout devolve 0, e `calc(100vh - 0px)` faria o painel
    // valer a janela inteira, escondendo a parte de baixo atrás do cabeçalho.
    comAltura(0);

    expect(publicada()).toBe('');
  });
});
