/**
 * Product Gallery Interactive Features (vanilla, sem jQuery)
 * - Navegação por thumbnails
 * - Zoom / Lightbox modal
 * - Navegação por teclado
 * - Sincronização com a troca de variante (galeria mobile via Swiper)
 */

class ProductGallery {
  constructor() {
    this.gallery = document.querySelector('[data-product-gallery]');
    if (!this.gallery) return;

    this.currentIndex = 0;
    this.images = Array.from(this.gallery.querySelectorAll('.product-gallery__image'));
    this.thumbnails = Array.from(this.gallery.querySelectorAll('.product-gallery__thumbnail'));
    this.lightbox = document.getElementById('product-lightbox');

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
   * Mostra imagem específica e marca o thumbnail ativo via classe `is-active`
   * (estilizada em product-gallery.css com token scheme-aware).
   */
  showImage(index) {
    this.images.forEach((img) => img.classList.add('hidden'));

    if (this.images[index]) {
      this.images[index].classList.remove('hidden');
      this.currentIndex = index;
    }

    this.thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === index);
    });
  }

  /**
   * Lightbox modal (dark intencional)
   */
  setupLightbox() {
    if (!this.lightbox) return;

    const closeBtn = this.lightbox.querySelector('[data-lightbox-close]');
    const prevBtn = this.lightbox.querySelector('[data-lightbox-prev]');
    const nextBtn = this.lightbox.querySelector('[data-lightbox-next]');

    // Clique na imagem principal abre o lightbox
    this.images.forEach((imageContainer, index) => {
      const img = imageContainer.querySelector('img[data-zoom-image]');
      if (!img) return;

      img.addEventListener('click', () => this.openLightbox(index));
      img.style.cursor = 'zoom-in';
    });

    closeBtn?.addEventListener('click', () => this.closeLightbox());
    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox) this.closeLightbox();
    });

    prevBtn?.addEventListener('click', () => this.lightboxNav('prev'));
    nextBtn?.addEventListener('click', () => this.lightboxNav('next'));

    document.addEventListener('keydown', (e) => {
      if (this.lightbox.classList.contains('hidden')) return;

      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.lightboxNav('prev');
      if (e.key === 'ArrowRight') this.lightboxNav('next');
    });
  }

  openLightbox(index) {
    const lightboxImage = this.lightbox.querySelector('#lightbox-image');
    const currentSpan = this.lightbox.querySelector('[data-lightbox-current]');

    const img = this.images[index]?.querySelector('img[data-zoom-image]');
    if (!img || !lightboxImage) return;

    lightboxImage.src = img.dataset.zoomImage;
    lightboxImage.alt = img.alt;
    if (currentSpan) currentSpan.textContent = index + 1;

    this.currentIndex = index;
    this.lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }

  lightboxNav(direction) {
    const total = this.images.length;
    const newIndex =
      direction === 'next'
        ? (this.currentIndex + 1) % total
        : (this.currentIndex - 1 + total) % total;

    this.openLightbox(newIndex);
  }

  /**
   * Atualiza a galeria quando a variante muda.
   * Sincroniza a galeria mobile (Swiper) com a mídia da variante.
   */
  setupVariantChange() {
    document.addEventListener('variant:change', (event) => {
      const variant = event.detail.variant;
      if (!variant || !variant.featured_media) return;

      const mediaId = variant.featured_media.id;
      const index = this.images.findIndex((img) => img.dataset.mediaId == mediaId);
      if (index === -1) return;

      this.showImage(index);

      // Sincroniza o slider mobile (Swiper) com a mídia da variante.
      if (window.innerWidth < 1024) {
        const sliderContainer = this.gallery.querySelector('my-slider .my-slider__container');
        const swiper = sliderContainer?.swiper;
        if (swiper) {
          if (typeof swiper.slideToLoop === 'function' && swiper.params.loop) {
            swiper.slideToLoop(index, 300);
          } else {
            swiper.slideTo(index, 300);
          }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ProductGallery();
});
