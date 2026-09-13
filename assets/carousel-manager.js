/**
 * Sliders e announcement bar sem jQuery / Owl / jQuery.marquee.
 *
 * <my-slider>       -> Swiper (vanilla). Normaliza o markup legado
 *                      (.my-slider__container + .item/.carousel-item) para a
 *                      estrutura do Swiper de forma programática, sem mudar os
 *                      ~6 templates consumidores.
 * <announcement-bar> -> marquee em CSS, com um preenchimento via JS que clona
 *                      o conteúdo até preencher a viewport (evita o "buraco"
 *                      quando o conteúdo é menor que a tela).
 *
 * ── O Swiper é buscado sob demanda (issue #32) ─────────────────────────────
 *
 * O bundle são 151 KB de JS e 18 KB de CSS, e o `theme.liquid` os carregava em
 * TODA página — carrinho, conta, políticas, 404, PDP. Nenhuma tem carrossel.
 * Agora quem pede o download é o próprio <my-slider>, no `connectedCallback`:
 * página sem slider não baixa byte nenhum, e página com seis sliders baixa uma
 * vez só.
 */

/**
 * O cache do download mora no `window`, e não numa variável deste arquivo,
 * porque o que ele impede é o bundle ser baixado duas vezes — e duas cópias
 * deste arquivo na mesma página (uma section co-locando o que o layout já
 * carrega) teriam duas variáveis, cada uma se achando a primeira.
 */
function carregarSwiper() {
  if (typeof window.Swiper !== 'undefined') return Promise.resolve();
  if (window.swiperCarregando) return window.swiperCarregando;

  const { js, css } = urlsDoSwiper();
  if (!js) {
    return Promise.reject(
      new Error('MySlider: a tag de carousel-manager.js não trouxe data-swiper-js — o Swiper não tem de onde vir.')
    );
  }

  // A folha vai para a página ANTES do bundle, e sem ser esperada: os dois
  // downloads começam no mesmo instante, e o CSS (18 KB) chega muito antes do
  // JS (151 KB) da mesma origem. Esperar o `load` do <link> trocaria um salto
  // que na prática não acontece por um carrossel que nunca inicializa se a
  // folha for bloqueada sem disparar `error`.
  injetarCss(css);

  window.swiperCarregando = new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = js;
    tag.addEventListener('load', () => resolve());
    tag.addEventListener('error', () => {
      // Deixa uma próxima tentativa acontecer em vez de congelar o cache num erro.
      window.swiperCarregando = null;
      reject(new Error(`MySlider: falha ao carregar ${js}.`));
    });
    document.head.appendChild(tag);
  });

  return window.swiperCarregando;
}

/**
 * As URLs vêm do Liquid, por data-attribute na tag que carrega este arquivo:
 * um asset `.js` não tem como resolver `asset_url` da CDN da Shopify, e
 * hardcodar o caminho quebraria no primeiro deploy.
 *
 * A busca é pelo ATRIBUTO e não por `document.currentScript` porque
 * `currentScript` só existe durante a avaliação do arquivo — aqui a leitura
 * acontece depois, quando um <my-slider> conecta.
 */
function urlsDoSwiper() {
  const tag = document.querySelector('script[data-swiper-js]');
  return { js: tag?.dataset.swiperJs || '', css: tag?.dataset.swiperCss || '' };
}

function injetarCss(href) {
  if (!href || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

class MySlider extends HTMLElement {
  connectedCallback() {
    if (this.swiper || this.carregando) return; // evita dupla inicialização se reconectado

    this.container = this.querySelector('.my-slider__container');
    if (!this.container) {
      console.warn('MySlider: .my-slider__container não encontrado dentro do elemento!');
      return;
    }

    const items = parseInt(this.dataset.items, 10) || 0;
    // Não inicia o slider se não houver itens suficientes — e, por isso mesmo,
    // não baixa o Swiper.
    if (items < 2) return;

    this.carregando = carregarSwiper()
      .then(() => {
        this.carregando = null;
        if (this.isConnected) this.iniciar(items);
      })
      .catch((error) => {
        this.carregando = null;
        console.warn(error.message);
      });
  }

  /** Só roda com `window.Swiper` já na página. */
  iniciar(items) {
    const loop = this.dataset.loop === 'true';
    const dots = this.dataset.dot === 'true';
    const autoplay = this.dataset.autoplay === 'true';
    const pauseHover = this.dataset.pauseHover === 'true';
    const autoplayDelay = parseInt(this.dataset.apTime, 10) * 1000 || 5000;

    const itemsDesk = parseFloat(this.dataset.qtyDesk) || 4;
    const itemsTab = parseFloat(this.dataset.qtyTab) || 2;
    const itemsMob = parseFloat(this.dataset.qtyMob) || 1;
    // "peek": mostra uma fração do próximo slide na borda, sinalizando que há mais
    // itens para deslizar. Só ativa quando o consumidor passa data-peek="true".
    const peek = this.dataset.peek === 'true' ? 0.28 : 0;
    const maxPerView = Math.ceil(Math.max(itemsDesk, itemsTab, itemsMob) + peek);

    this._normalizeMarkup({ dots, loop, maxPerView });

    const config = {
      slidesPerView: itemsMob + peek,
      loop: loop,
      breakpoints: {
        768: { slidesPerView: itemsTab + peek },
        1024: { slidesPerView: itemsDesk + peek },
      },
    };

    if (dots) {
      config.pagination = { el: this.paginationEl, clickable: true };
    }

    if (autoplay) {
      config.autoplay = {
        delay: autoplayDelay,
        pauseOnMouseEnter: pauseHover,
        disableOnInteraction: false,
      };
    }

    const spanActive = this.querySelector('.index-active');
    const syncA11y = (swiper) => this._syncSlideA11y(swiper);
    config.on = {
      // Slides fora de tela recebem aria-hidden="true" (Swiper a11y) mas seus
      // links continuam focáveis -> falha "aria-hidden-focus". Espelhamos com
      // `inert` para tirá-los da ordem de foco enquanto ocultos.
      afterInit: syncA11y,
      slideChangeTransitionEnd: syncA11y,
      breakpoint: syncA11y,
      update: syncA11y,
      slideChange: (swiper) => {
        if (spanActive) {
          // módulo pelos slides originais (caso tenham sido duplicados para o loop)
          spanActive.textContent = (swiper.realIndex % items) + 1;
        }
      },
    };

    this.swiper = new window.Swiper(this.container, config);
  }

  /** Mantém `inert` em sincronia com aria-hidden nos slides (acessibilidade). */
  _syncSlideA11y(swiper) {
    (swiper.slides || []).forEach((slide) => {
      if (slide.getAttribute('aria-hidden') === 'true') {
        slide.setAttribute('inert', '');
      } else {
        slide.removeAttribute('inert');
      }
    });
  }

  /**
   * Converte o markup legado para a estrutura do Swiper sem alterar os templates:
   *   .my-slider__container  ->  + classe .swiper
   *   filhos diretos (.item) ->  envolvidos em .swiper-wrapper e marcados com .swiper-slide
   *
   * Quando o loop está ligado mas há poucos slides para o slidesPerView,
   * duplica os slides (como o Owl fazia) para o loop funcionar de fato.
   */
  _normalizeMarkup({ dots, loop, maxPerView }) {
    const container = this.container;
    if (container.classList.contains('swiper')) return;

    container.classList.add('swiper');

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    while (container.firstChild) {
      wrapper.appendChild(container.firstChild);
    }
    container.appendChild(wrapper);

    const slides = wrapper.querySelectorAll(':scope > *');
    slides.forEach((slide) => slide.classList.add('swiper-slide'));

    // Swiper exige slides suficientes para o loop (>= slidesPerView * 2), senão
    // ele desabilita o loop e a navegação trava. Duplica conjuntos inteiros (como o
    // Owl fazia) até ter o bastante. O contador "X de N" usa módulo dos originais.
    const minForLoop = maxPerView * 2;
    if (loop && slides.length < minForLoop) {
      const originals = Array.from(slides);
      let guard = 0;
      while (wrapper.children.length < minForLoop && guard < 20) {
        originals.forEach((original) => {
          const clone = original.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          wrapper.appendChild(clone);
        });
        guard += 1;
      }
    }

    if (dots) {
      this.paginationEl = document.createElement('div');
      this.paginationEl.className = 'swiper-pagination';
      container.appendChild(this.paginationEl);
    }
  }

  disconnectedCallback() {
    if (this.swiper) {
      this.swiper.destroy(true, true);
      this.swiper = null;
    }
  }

  nextSlide() {
    this.swiper?.slideNext();
  }

  prevSlide() {
    this.swiper?.slidePrev();
  }
}

if (!customElements.get('my-slider')) {
  customElements.define('my-slider', MySlider);
}

// FUNÇÕES AUXILIARES (chamadas pelos onclick inline das sections — não alterar assinatura)
function sliderPrev(sectionId) {
  const sliderEl = document.querySelector(`my-slider[data-section-id="${sectionId}"]`);
  sliderEl?.prevSlide?.();
}

function sliderNext(sectionId) {
  const sliderEl = document.querySelector(`my-slider[data-section-id="${sectionId}"]`);
  sliderEl?.nextSlide?.();
}

/**
 * Marquee da barra de avisos: a animação é CSS, mas o conteúdo é clonado aqui
 * até preencher a largura da viewport. Assim a trilha (e sua duplicata) nunca
 * fica menor que a tela e o loop translateX(0 -> -50%) não deixa "buraco".
 */
class AnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.marquee = this.querySelector('.announcement-marquee');
    this.track = this.marquee && this.marquee.querySelector('.announcement-track');
    if (!this.marquee || !this.track) return;

    this._originalHTML = this.track.innerHTML;
    this._build();

    this._onResize = this._debounce(() => this._build(), 200);
    window.addEventListener('resize', this._onResize);
  }

  _build() {
    const baseDuration = parseFloat(this.dataset.duration) || 40;

    // Reset para o estado original (uma trilha com o conteúdo renderizado pelo Liquid).
    this.marquee.querySelectorAll('.announcement-track').forEach((t, i) => {
      if (i === 0) {
        t.innerHTML = this._originalHTML;
      } else {
        t.remove();
      }
    });

    const viewport = this.getBoundingClientRect().width || window.innerWidth;
    if (!viewport || this.track.scrollWidth === 0) return;

    // Preenche a trilha clonando o conteúdo até passar da largura da viewport.
    let copies = 1;
    let guard = 0;
    while (this.track.scrollWidth < viewport && guard < 50) {
      this.track.insertAdjacentHTML('beforeend', this._originalHTML);
      copies += 1;
      guard += 1;
    }

    // Duplica a trilha inteira para o loop contínuo (translateX -> -50%).
    const clone = this.track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    this.marquee.appendChild(clone);

    // Mantém a velocidade (px/s) constante independente de quantas cópias couberam.
    this.marquee.style.animationDuration = baseDuration * copies + 's';
  }

  _debounce(fn, wait) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }
}

if (!customElements.get('announcement-bar')) {
  customElements.define('announcement-bar', AnnouncementBar);
}
