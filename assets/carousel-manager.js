// assets/carousel-manager.js
document.addEventListener('DOMContentLoaded', function () {
    // Inicializar Owl Carousels
    function initializeOwl() {
        // Itera sobre cada .image-slider-container
        $(".image-slider-container").each(function () {
            // Aqui, `this` refere-se ao .image-slider-container atual na iteração
            const $container = $(this); // Guarda o jQuery object do container atual

            // Captura os dados do owl-carousel dentro deste image-slider-container
            const loop = $container.find('.owl-carousel').data("loop");
            const qtyDesk = $container.find('.owl-carousel').data("qty-desk");
            const qtyTab = $container.find('.owl-carousel').data("qty-tab");
            const qtyMob = $container.find('.owl-carousel').data("qty-mob");
            const autoplay = $container.find('.owl-carousel').data("autoplay");
            const playTime = $container.find('.owl-carousel').data("ap-time") * 1000;
            const pauseHover = $container.find('.owl-carousel').data("pause-hover");
            const dot = $container.find('.owl-carousel').data("dot");

            // Inicializa o Owl Carousel no owl-carousel dentro deste image-slider-container
            $container.find('.owl-carousel').owlCarousel({
                loop: loop,
                margin: 10,
                dots: dot,
                autoplayHoverPause: pauseHover,
                autoplay: autoplay,
                autoplayTimeout: playTime,
                responsive: {
                    0: {
                        items: qtyMob
                    },
                    500: {
                        items: qtyTab
                    },
                    1024: {
                        items: qtyDesk
                    }
                }
            });

            // Evento de clique para navegar para o próximo slide
            $container.find('.custom-next-slide').on('click', function () {
                $container.find('.owl-carousel').trigger('next.owl.carousel');
            });

            // Evento de clique para navegar para o slide anterior
            $container.find('.custom-prev-slide').on('click', function () {
                $container.find('.owl-carousel').trigger('prev.owl.carousel');
            });
        });

        $(".product-slider-container").each(function () {
            // Aqui, `this` refere-se ao .image-slider-container atual na iteração
            const $container = $(this); // Guarda o jQuery object do container atual

            // Captura os dados do owl-carousel dentro deste image-slider-container
            const loop = $container.find('.owl-carousel').data("loop");
            const qtyDesk = $container.find('.owl-carousel').data("qty-desk");
            const qtyTab = $container.find('.owl-carousel').data("qty-tab");
            const qtyMob = $container.find('.owl-carousel').data("qty-mob");
            const autoplay = $container.find('.owl-carousel').data("autoplay");
            const playTime = $container.find('.owl-carousel').data("ap-time") * 1000;
            const pauseHover = $container.find('.owl-carousel').data("pause-hover");
            const dot = $container.find('.owl-carousel').data("dot");

            // Inicializa o Owl Carousel no owl-carousel dentro deste image-slider-container
            $container.find('.owl-carousel').owlCarousel({
                loop: loop,
                margin: 10,
                dots: dot,
                autoplayHoverPause: pauseHover,
                autoplay: autoplay,
                autoplayTimeout: playTime,
                responsive: {
                    0: {
                        items: qtyMob
                    },
                    500: {
                        items: qtyTab
                    },
                    1024: {
                        items: qtyDesk
                    }
                }
            });

            // Evento de clique para navegar para o próximo slide
            $container.find('.custom-next-slide').on('click', function () {
                $container.find('.owl-carousel').trigger('next.owl.carousel');
            });

            // Evento de clique para navegar para o slide anterior
            $container.find('.custom-prev-slide').on('click', function () {
                $container.find('.owl-carousel').trigger('prev.owl.carousel');
            });
        });
    }

    initializeOwl();

    // Eventos Shopify
    $(document).on("shopify:section:load", initializeOwl)
        .on("shopify:section:unload", initializeOwl)
        .on("shopify:section:select", initializeOwl)
        .on("shopify:section:deselect", initializeOwl)
        .on("shopify:block:select", initializeOwl)
        .on("shopify:block:deselect", initializeOwl);
});

class MySlider extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        if (typeof jQuery === 'undefined' || typeof jQuery.fn.owlCarousel === 'undefined') {
            console.warn('Não encontrou jQuery ou Owl Carousel');
            return;
        }

        // Pega o container que terá o slider
        this.$container = jQuery(this).find('.my-slider__container');
        if (!this.$container.length) {
            console.warn('MySlider: .my-slider__container não encontrado dentro do elemento!');
            return;
        }

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
