/**
 * Product Gallery Interactive Features
 * - Thumbnail navigation
 * - Image zoom
 * - Lightbox modal
 * - Keyboard navigation
 */

class ProductGallery {
  constructor() {
    this.gallery = document.querySelector('[data-product-gallery]');
    if (!this.gallery) return;

    this.currentIndex = 0;
    this.images = Array.from(this.gallery.querySelectorAll('.product-gallery__image'));
    this.thumbnails = Array.from(this.gallery.querySelectorAll('.product-gallery__thumbnail'));
    this.lightbox = document.querySelector('[data-lightbox]');

    this.init();
  }

  init() {
    this.setupThumbnails();
    this.setupLightbox();
    this.setupVariantChange();
  }

  /**
   * Thumbnails clicáveis
   */
  setupThumbnails() {
    this.thumbnails.forEach((thumb, index) => {
      thumb.addEventListener('click', () => {
        this.showImage(index);
      });
    });
  }

  /**
   * Mostra imagem específica
   */
  showImage(index) {
    // Esconde todas as imagens
    this.images.forEach(img => img.classList.add('hidden'));

    // Mostra imagem selecionada
    if (this.images[index]) {
      this.images[index].classList.remove('hidden');
      this.currentIndex = index;
    }

    // Atualiza thumbnail ativo
    this.thumbnails.forEach((thumb, i) => {
      if (i === index) {
        thumb.classList.remove('border-gray-200', 'hover:border-gray-400');
        thumb.classList.add('border-black');
        thumb.dataset.active = 'true';
      } else {
        thumb.classList.remove('border-black');
        thumb.classList.add('border-gray-200', 'hover:border-gray-400');
        thumb.dataset.active = 'false';
      }
    });
  }

  /**
   * Lightbox modal
   */
  setupLightbox() {
    if (!this.lightbox) return;

    const lightboxImage = this.lightbox.querySelector('[data-lightbox-image]');
    const closeBtn = this.lightbox.querySelector('[data-lightbox-close]');
    const prevBtn = this.lightbox.querySelector('[data-lightbox-prev]');
    const nextBtn = this.lightbox.querySelector('[data-lightbox-next]');
    const currentSpan = this.lightbox.querySelector('[data-lightbox-current]');

    // Clique na imagem principal abre lightbox
    this.images.forEach((imageContainer, index) => {
      const img = imageContainer.querySelector('img[data-zoom-image]');
      if (!img) return;

      img.addEventListener('click', () => {
        this.openLightbox(index);
      });

      // Cursor pointer
      img.style.cursor = 'zoom-in';
    });

    // Fechar lightbox
    closeBtn?.addEventListener('click', () => this.closeLightbox());
    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox) {
        this.closeLightbox();
      }
    });

    // Navegação
    prevBtn?.addEventListener('click', () => this.lightboxNav('prev'));
    nextBtn?.addEventListener('click', () => this.lightboxNav('next'));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.lightboxNav('prev');
      if (e.key === 'ArrowRight') this.lightboxNav('next');
    });
  }

  /**
   * Abre lightbox
   */
  openLightbox(index) {
    const lightboxImage = this.lightbox.querySelector('[data-lightbox-image]');
    const currentSpan = this.lightbox.querySelector('[data-lightbox-current]');

    const img = this.images[index]?.querySelector('img[data-zoom-image]');
    if (!img) return;

    lightboxImage.src = img.dataset.zoomImage;
    lightboxImage.alt = img.alt;
    currentSpan.textContent = index + 1;

    this.currentIndex = index;
    this.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Fecha lightbox
   */
  closeLightbox() {
    this.lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Navegação no lightbox
   */
  lightboxNav(direction) {
    const newIndex = direction === 'next'
      ? (this.currentIndex + 1) % this.images.length
      : (this.currentIndex - 1 + this.images.length) % this.images.length;

    this.openLightbox(newIndex);
  }

  /**
   * Atualiza galeria quando variante muda
   */
  setupVariantChange() {
    document.addEventListener('variant:change', (event) => {
      const variant = event.detail.variant;
      if (!variant || !variant.featured_media) return;

      // Encontra index da mídia da variante
      const mediaId = variant.featured_media.id;
      const index = this.images.findIndex(img =>
        img.dataset.mediaId == mediaId
      );

      if (index !== -1) {
        this.showImage(index);

        // Scroll suave para a imagem no mobile
        if (window.innerWidth < 1024) {
          const galleryMobile = document.querySelector('.product-gallery-mobile');
          if (galleryMobile) {
            // Trigger owl carousel to go to index
            const owlCarousel = jQuery(galleryMobile).find('.my-slider__container');
            if (owlCarousel.length) {
              owlCarousel.trigger('to.owl.carousel', [index, 300]);
            }
          }
        }
      }
    });
  }
}

// Initialize quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  new ProductGallery();
});
