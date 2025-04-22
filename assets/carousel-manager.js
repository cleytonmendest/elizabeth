class AnnouncementBar extends HTMLElement {
    constructor() {
        super()
        this._initialized = false
    }

    connectedCallback() {
        if (this._initialized) return;
        this._initialized = true

        if (typeof jQuery === 'undefined' || typeof jQuery.fn.marquee === 'undefined') {
            console.warn('jQuery ou jQuery.Marquee não encontrado!');
            return;
        }

        const $marquee = jQuery(this).find('.announcement-content');
        if (!$marquee.length) {
            console.warn('Não encontrou .announcement-content dentro de <my-marquee>!');
            return;
        }

        const duration = parseInt(this.dataset.duration) * 1000 || 15000;
        const gap = parseInt(this.dataset.gap) || 0;
        const direction = this.dataset.direction || 'left';
        const pauseOnHover = this.dataset.pauseHover !== 'false';

        $marquee.marquee({
            duration: duration,
            gap: gap,
            direction: direction,
            duplicated: true,
            pauseOnHover: pauseOnHover,
            startVisible: true,
            duplicateCount: 5
        });
    }
    disconnectedCallback() {
        this._initialized = false;

        const $marquee = jQuery(this).find('.announcement-content');
        if ($marquee.length) {
            $marquee.marquee('destroy');
        }
    }
}

customElements.define('announcement-bar', AnnouncementBar);

class MySlider extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        if (typeof jQuery === 'undefined' || typeof jQuery.fn.owlCarousel === 'undefined') {
            console.warn('Não encontrou jQuery ou Owl Carousel')
            return;
        }

        // Pega o container que terá o slider
        this.$container = jQuery(this).find('.my-slider__container')
        if (!this.$container.length) {
            console.warn('MySlider: .my-slider__container não encontrado dentro do elemento!')
            return;
        }
        const items = parseInt(this.dataset.items) || 0

        //Não inicia o Owl se não houver itens suficientes para o slider
        if (items < 2) return

        const loop = this.dataset.loop === 'true';
        // const nav = this.dataset.navArrows === 'true';
        const dots = this.dataset.dot === 'true';
        const autoplay = this.dataset.autoplay === 'true';
        const pauseHover = this.dataset.pauseHover === 'true';

        const autoplayTimeout = parseInt(this.dataset.apTime) * 1000 || 5000;

        // Itens por breakpoint
        const itemsDesk = parseInt(this.dataset.qtyDesk) || 4;
        const itemsTab = parseInt(this.dataset.qtyTab) || 2;
        const itemsMob = parseInt(this.dataset.qtyMob) || 1;

        // Monta o owlOptions
        const owlOptions = {
            loop: loop,
            nav: false,
            dots: dots,
            autoplay: autoplay,
            autoplayHoverPause: pauseHover,
            autoplayTimeout: autoplayTimeout,
            // Responsivo
            responsive: {
                0: {
                    items: itemsMob
                },
                768: {
                    items: itemsTab
                },
                1024: {
                    items: itemsDesk
                }
            }
        };

        this.$container.owlCarousel(owlOptions);

        // Lógica para alteração de span para casos de exibição de index do slider ativo
        const spanActive = this.querySelector('.index-active');
        if (spanActive) {
            this.$container.on('translated.owl.carousel', (event) => {
                const total = event.item.count;

                const cloneCount = event.relatedTarget._clones.length / 2;

                let realIndex = event.item.index - cloneCount;

                realIndex = ((realIndex % total) + total) % total;

                realIndex += 1;

                spanActive.textContent = realIndex;
            });
        }
    }

    disconnectedCallback() {
        if (this.$container && this.$container.data('owl.carousel')) {
            this.$container.owlCarousel('destroy');
        }
    }

    nextSlide() {
        if (this.$container && this.$container.data('owl.carousel')) {
            this.$container.trigger('next.owl.carousel');
        }
    }

    prevSlide() {
        if (this.$container && this.$container.data('owl.carousel')) {
            this.$container.trigger('prev.owl.carousel');
        }
    }
}

customElements.define('my-slider', MySlider);

// FUNÇÕES AUXILIARES PARA EXECUTAR O SLIDER
function sliderPrev(sectionId) {
    // Monta o seletor com aspas no valor do atributo
    const sliderEl = document.querySelector(`my-slider[data-section-id="${sectionId}"]`);

    // Chama o método .prevSlide()
    sliderEl?.prevSlide?.();
}

function sliderNext(sectionId) {
    // Monta o seletor com aspas no valor do atributo
    const sliderEl = document.querySelector(`my-slider[data-section-id="${sectionId}"]`);

    // Chama o método .nextSlide()
    sliderEl?.nextSlide?.()
}
