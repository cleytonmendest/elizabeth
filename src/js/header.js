/**
 * O cabeçalho: sombra ao rolar, altura publicada, e o modo transparente.
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
 * consome no token `max-h-below-header`. É o mesmo arranjo que `sticky-atc.js`
 * usa para afastar o botão de voltar ao topo. O modo transparente usa a mesma
 * medida para puxar o herói para debaixo do cabeçalho.
 *
 * ── O modo transparente (issue 121) ─────────────────────────────────────────────
 *
 * Ele exige DUAS coisas verdadeiras, e a segunda não é escolha da lojista:
 *
 *   1. ela ligou `transparent_header`;
 *   2. a primeira section da página tem mídia atrás (`[data-hero-media]`).
 *
 * Sem a segunda, o cabeçalho fica sólido MESMO com o toggle ligado. É o que
 * impede o defeito clássico dessa feature: link claro sobre fundo branco na
 * coleção, no produto, no carrinho, ou numa home que começa com texto.
 *
 * ── A cor é HERDADA, não detectada ─────────────────────────────────────────
 *
 * A saída intuitiva seria medir o brilho da imagem e escolher claro ou escuro.
 * É frágil: a imagem com `loading="lazy"` ainda não chegou quando a medição
 * roda, o resultado pisca na troca, e foto de contraste misto não tem resposta
 * certa.
 *
 * A informação já existe. A lojista escolheu um color scheme para a primeira
 * section porque foi o que deixou o título do herói legível sobre aquela foto.
 * O cabeçalho adota a MESMA decisão: copia a classe `color-scheme-N` dela.
 * Não há setting de cor novo, e não há como divergir do herói.
 *
 * ── O estado sólido é o padrão, e é de onde se parte ───────────────────────
 *
 * Nada aqui roda sem JavaScript, e é por isso que o transparente é o estado
 * ADICIONADO. Um cabeçalho que só fica legível depois que o script carrega
 * seria pior que um cabeçalho sólido sempre.
 */
class MainHeader extends HTMLElement {
  constructor() {
    super();
    this.onScroll = this.onScroll.bind(this);
    this.publicaAltura = this.publicaAltura.bind(this);
  }

  /**
   * O contêiner, resolvido na hora do uso e não no construtor.
   *
   * O asset é co-locado e carregado com `async`: ele pode chegar no meio do
   * parse, definir o elemento, e o `connectedCallback` disparar quando
   * `<main-header>` ainda não tem filho nenhum. Guardar o resultado do
   * `querySelector` no construtor congelava um `null` para sempre — e a partir
   * dali nada mais media a altura nem trocava o estado.
   */
  get container() {
    if (!this._container || !this.contains(this._container)) {
      this._container = this.querySelector('#main-header-container');
    }
    return this._container;
  }

  connectedCallback() {
    this.publicaAltura();
    this.decideTransparenciaQuandoDerPara();
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.publicaAltura);
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.publicaAltura);
  }

  /**
   * Marca o cabeçalho quando a página é rolada, e decide a transparência.
   *
   * Os dois estados são o mesmo interruptor invertido: transparente só no topo
   * absoluto, `is-scrolling` só fora dele. Por construção eles nunca coexistem
   * — que é o que impede a sombra do `is-scrolling` de aparecer como um risco
   * flutuando sobre a imagem do herói.
   */
  onScroll() {
    const alvo = this.container;
    if (!alvo) return;
    const noTopo = window.scrollY === 0;

    alvo.classList.toggle('is-scrolling', !noTopo);
    if (this.podeSerTransparente) {
      alvo.toggleAttribute('data-transparente', noTopo);
    }
  }

  /**
   * Adia a decisão até o documento ter o que ela precisa ler.
   *
   * ── O defeito que isto corrige ─────────────────────────────────────────
   *
   * `{% sections 'header-group' %}` vem ANTES de `<main>` no layout, e o
   * `connectedCallback` dispara durante o parse do cabeçalho. Nesse instante
   * `#MainContent` ainda não existe: a busca pela primeira section devolvia
   * `null`, a decisão saía "sem herói", e o cabeçalho ficava sólido em TODA
   * página — inclusive nas que deviam ficar transparentes.
   *
   * O sintoma era a feature inteira não funcionar com o toggle ligado, e
   * nenhum teste via porque todos montavam o `<main>` antes do cabeçalho — a
   * ordem inversa da real.
   *
   * `readyState` e não um `setTimeout`: o que falta é o resto do documento,
   * e `DOMContentLoaded` é exatamente o evento que diz que ele chegou. Se o
   * script for injetado depois (re-render no editor), o documento já está
   * pronto e a decisão é imediata.
   */
  decideTransparenciaQuandoDerPara() {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          // A altura é REMEDIDA aqui, e não só na conexão. O
          // `connectedCallback` dispara no meio do parse do próprio cabeçalho,
          // quando nem todos os filhos dele existem — a medida de lá sai menor
          // que a real. Medido: o herói subia 24px a menos, e o mesmo valor
          // encurtava o teto do painel do mega menu.
          this.publicaAltura();
          this.preparaTransparencia();
          this.onScroll();
        },
        { once: true }
      );
      return;
    }
    this.preparaTransparencia();
  }

  /**
   * Decide se esta página aceita cabeçalho transparente, e prepara o que ela
   * precisa: a classe de cor herdada do herói e a marca que o CSS lê para
   * puxá-lo para cima.
   */
  preparaTransparencia() {
    this.podeSerTransparente = false;
    if (!this.container) return;
    if (this.dataset.transparente !== 'true') return;

    const primeira = document.querySelector('#MainContent > .shopify-section:first-child');
    const heroi = primeira?.querySelector('[data-hero-media]');
    if (!heroi) return;

    // A classe de cor do HERÓI, e não a do cabeçalho: é a que a lojista já
    // escolheu para o título dele ficar legível sobre aquela foto.
    this.esquemaDoHeroi = [...heroi.classList].find((c) => c.startsWith('color-'));
    if (!this.esquemaDoHeroi) return;

    this.podeSerTransparente = true;
    this.container.classList.add(this.esquemaDoHeroi);
    document.documentElement.setAttribute('data-heroi-sob-cabecalho', '');
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
