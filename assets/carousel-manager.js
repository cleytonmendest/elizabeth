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
 */

class MySlider extends HTMLElement {
  connectedCallback() {
    if (this.swiper) return; // evita dupla inicialização se reconectado
    if (typeof Swiper === 'undefined') {
      console.warn('MySlider: Swiper não encontrado.');
      return;
    }

    this.container = this.querySelector('.my-slider__container');
    if (!this.container) {
      console.warn('MySlider: .my-slider__container não encontrado dentro do elemento!');
      return;
    }

    const items = parseInt(this.dataset.items, 10) || 0;
    // Não inicia o slider se não houver itens suficientes.
    if (items < 2) return;

    const loop = this.dataset.loop === 'true';
    const dots = this.dataset.dot === 'true';
    const autoplay = this.dataset.autoplay === 'true';
    const pauseHover = this.dataset.pauseHover === 'true';
    const autoplayDelay = parseInt(this.dataset.apTime, 10) * 1000 || 5000;

    const itemsDesk = parseInt(this.dataset.qtyDesk, 10) || 4;
    const itemsTab = parseInt(this.dataset.qtyTab, 10) || 2;
    const itemsMob = parseInt(this.dataset.qtyMob, 10) || 1;
    const maxPerView = Math.max(itemsDesk, itemsTab, itemsMob);

    this._normalizeMarkup({ dots, loop, maxPerView });

    const config = {
      slidesPerView: itemsMob,
      loop: loop,
      breakpoints: {
        768: { slidesPerView: itemsTab },
        1024: { slidesPerView: itemsDesk },
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
    if (spanActive) {
      config.on = {
        slideChange: (swiper) => {
          // módulo pelos slides originais (caso tenham sido duplicados para o loop)
          spanActive.textContent = (swiper.realIndex % items) + 1;
        },
      };
    }

    this.swiper = new Swiper(this.container, config);
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
