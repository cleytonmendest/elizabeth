/**
 * Slider baseado em Swiper (sem jQuery / Owl).
 *
 * <my-slider> normaliza o markup legado (.my-slider__container + .item/.carousel-item)
 * para a estrutura que o Swiper espera (.swiper > .swiper-wrapper > .swiper-slide),
 * de forma programática — assim as ~6 sections consumidoras não precisam mudar de markup.
 *
 * A barra de avisos (<announcement-bar>) agora é 100% CSS (ver carousel-style.css),
 * portanto não há mais custom element para ela.
 */

class MySlider extends HTMLElement {
  connectedCallback() {
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

    this._normalizeMarkup(dots);

    const config = {
      slidesPerView: itemsMob,
      loop: loop,
      // Recalcula quando o container muda de visibilidade (ex.: slider mobile dentro de lg:hidden).
      observer: true,
      observeParents: true,
      breakpoints: {
        768: { slidesPerView: itemsTab },
        1024: { slidesPerView: itemsDesk },
      },
    };

    if (dots) {
      config.pagination = {
        el: this.paginationEl,
        clickable: true,
      };
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
          spanActive.textContent = swiper.realIndex + 1;
        },
      };
    }

    this.swiper = new Swiper(this.container, config);
  }

  /**
   * Converte o markup legado para a estrutura do Swiper sem alterar os templates:
   *   .my-slider__container  ->  + classe .swiper
   *   filhos diretos (.item) ->  envolvidos em .swiper-wrapper e marcados com .swiper-slide
   */
  _normalizeMarkup(dots) {
    const container = this.container;
    if (container.classList.contains('swiper')) return;

    container.classList.add('swiper');

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    while (container.firstChild) {
      wrapper.appendChild(container.firstChild);
    }
    container.appendChild(wrapper);

    wrapper.querySelectorAll(':scope > *').forEach((slide) => {
      slide.classList.add('swiper-slide');
    });

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
