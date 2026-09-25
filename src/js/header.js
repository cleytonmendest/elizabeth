/**
 * O cabeçalho: sombra ao rolar, e a altura publicada para quem abre embaixo.
 *
 * ── Por que a altura vira variável de CSS ──────────────────────────────────
 *
 * O painel do mega menu abre em `top-full` — logo abaixo do cabeçalho — e não
 * tinha limite de altura nenhum. Um menu com muitos grupos gerava um painel
 * mais alto que a janela, e a parte de baixo ficava INALCANÇÁVEL: para chegar
 * nela a cliente precisaria rolar a página, e tirar o mouse do painel o fecha.
 *
 * O limite certo é "o que sobra da janela abaixo do cabeçalho", e isso depende
 * de uma altura que o CSS não conhece: ela muda com o logo que a lojista subiu,
 * com `font_scale`, e com a barra de anúncio estar ligada ou não. Cravar um
 * valor daria o mesmo defeito em outra loja.
 *
 * Então a altura é MEDIDA e publicada em `--header-height`, e o Tailwind a
 * consome no token `max-h-menu-panel`. É o mesmo arranjo que `sticky-atc.js`
 * usa para afastar o botão de voltar ao topo.
 */
class MainHeader extends HTMLElement {
  constructor() {
    super();
    this.container = this.querySelector('#main-header-container');
    this.onScroll = this.onScroll.bind(this);
    this.publicaAltura = this.publicaAltura.bind(this);
  }

  connectedCallback() {
    this.onScroll();
    this.publicaAltura();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.publicaAltura);
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.publicaAltura);
  }

  // Marca o header quando a página é rolada (usado para reforçar a sombra)
  onScroll() {
    if (window.scrollY > 0) {
      this.container.classList.add('is-scrolling');
    } else {
      this.container.classList.remove('is-scrolling');
    }
  }

  /**
   * Publica a altura do cabeçalho para o CSS.
   *
   * No `:root` e não no elemento: quem lê é o painel do menu, que está dentro
   * do cabeçalho, mas também qualquer coisa futura que precise se posicionar
   * abaixo dele. Medida que só existe onde foi tirada não serve para ninguém.
   */
  publicaAltura() {
    if (!this.container) return;
    const altura = this.container.offsetHeight;
    if (!altura) return;
    document.documentElement.style.setProperty('--header-height', `${altura}px`);
  }
}

if (!customElements.get('main-header')) {
  customElements.define('main-header', MainHeader);
}
