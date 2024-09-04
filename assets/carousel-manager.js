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
