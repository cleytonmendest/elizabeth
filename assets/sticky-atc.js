/**
 * Sticky Add to Cart (Mobile)
 * - Controla apenas a visibilidade do sticky bar
 * - Aparece quando o botão principal não está visível na tela
 * - Toda lógica de add-to-cart é gerenciada pelo componente <add-to-cart>
 */

class StickyAddToCart {
  constructor() {
    this.stickyBar = document.querySelector('[data-sticky-atc]');
    if (!this.stickyBar) return;

    this.mainButton = document.querySelector('add-to-cart button[type="submit"]');
    if (!this.mainButton) return;

    this.init();
  }

  init() {
    this.setupVisibilityObserver();
  }

  /**
   * Observa visibilidade do botão principal de adicionar ao carrinho
   * Mostra sticky apenas quando o botão principal não está visível
   */
  setupVisibilityObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.hide();
          } else {
            this.show();
          }
        });
      },
      {
        threshold: 0,
        rootMargin: '0px'
      }
    );

    observer.observe(this.mainButton);
  }

  show() {
    this.stickyBar.classList.add('visible');
  }

  hide() {
    this.stickyBar.classList.remove('visible');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new StickyAddToCart();
});
