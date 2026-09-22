/**
 * Sticky Add to Cart (desktop e mobile)
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

  /**
   * A barra é `fixed bottom-0` e ocupa a faixa onde o botão "voltar ao topo"
   * mora (`bottom-6`). Os dois estão em `z-overlay`, então quem fica por cima
   * dependia da ordem no DOM — não de decisão. E empilhar não resolveria: o
   * problema é de POSIÇÃO, não de camada.
   *
   * Por isso a barra publica a própria altura e o próprio estado no elemento
   * raiz, e quem flutua no rodapé se afasta. A altura é MEDIDA, não cravada:
   * ela muda com `settings.font_scale`, com o tamanho do preço e com a largura
   * da tela.
   */
  show() {
    this.stickyBar.classList.add('visible');
    document.documentElement.style.setProperty(
      '--sticky-atc-height',
      `${this.stickyBar.offsetHeight}px`,
    );
    document.documentElement.setAttribute('data-sticky-atc-visivel', '');
  }

  hide() {
    this.stickyBar.classList.remove('visible');
    document.documentElement.removeAttribute('data-sticky-atc-visivel');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new StickyAddToCart();
});
