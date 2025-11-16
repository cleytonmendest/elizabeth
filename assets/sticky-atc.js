/**
 * Sticky Add to Cart (Mobile)
 * - Aparece quando usuário rola para baixo
 * - Esconde quando rola para cima ou está no topo
 * - Atualiza com mudanças de variante
 */

class StickyAddToCart {
  constructor() {
    this.stickyBar = document.querySelector('[data-sticky-atc]');
    if (!this.stickyBar) return;

    this.button = this.stickyBar.querySelector('[data-sticky-add-to-cart]');
    this.qtyInput = this.stickyBar.querySelector('[data-sticky-qty-input]');
    this.qtyDecrease = this.stickyBar.querySelector('[data-sticky-qty-decrease]');
    this.qtyIncrease = this.stickyBar.querySelector('[data-sticky-qty-increase]');
    this.lastScrollY = window.scrollY;
    this.threshold = 300; // Pixels para mostrar
    this.isVisible = false;
    this.currentVariant = null;

    this.init();
  }

  init() {
    this.setupScrollBehavior();
    this.setupQuantityButtons();
    this.setupButtonClick();
    this.setupVariantChange();
  }

  /**
   * Botões de quantidade
   */
  setupQuantityButtons() {
    if (!this.qtyInput || !this.qtyDecrease || !this.qtyIncrease) return;

    this.qtyDecrease.addEventListener('click', () => {
      const currentQty = parseInt(this.qtyInput.value) || 1;
      if (currentQty > 1) {
        this.qtyInput.value = currentQty - 1;
      }
    });

    this.qtyIncrease.addEventListener('click', () => {
      const currentQty = parseInt(this.qtyInput.value) || 1;
      this.qtyInput.value = currentQty + 1;
    });
  }

  /**
   * Scroll behavior - mostra/esconde baseado em scroll
   */
  setupScrollBehavior() {
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  handleScroll() {
    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > this.lastScrollY;

    // Mostra quando:
    // - Rolou mais que threshold
    // - Rolando para baixo
    // - Não está no botão de adicionar ao carrinho original
    const shouldShow = currentScrollY > this.threshold && scrollingDown;

    if (shouldShow && !this.isVisible) {
      this.show();
    } else if (!shouldShow && this.isVisible) {
      this.hide();
    }

    this.lastScrollY = currentScrollY;
  }

  show() {
    this.stickyBar.classList.add('visible');
    this.isVisible = true;
  }

  hide() {
    this.stickyBar.classList.remove('visible');
    this.isVisible = false;
  }

  /**
   * Clique no botão
   */
  setupButtonClick() {
    if (!this.button) return;

    this.button.addEventListener('click', async () => {
      // Busca o formulário principal do produto
      const productForm = document.querySelector('[product-context] form[action*="/cart/add"]');
      if (!productForm) {
        console.error('Product form not found');
        return;
      }

      // Pega o variant ID do input hidden
      const variantInput = productForm.querySelector('input[name="id"]');
      if (!variantInput || !variantInput.value) {
        console.error('Variant ID not found');
        return;
      }

      // Quantidade
      const quantity = parseInt(this.qtyInput?.value) || 1;

      // Loading state
      this.button.classList.add('loading');
      this.button.disabled = true;

      try {
        // Adiciona ao carrinho
        const formData = new FormData();
        formData.append('id', variantInput.value);
        formData.append('quantity', quantity);

        const response = await fetch(window.routes.cart_add_url, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.description || 'Erro ao adicionar ao carrinho');
        }

        // Sucesso - dispara evento para atualizar carrinho
        document.dispatchEvent(new CustomEvent('cart:item-added', {
          detail: { item: data }
        }));

        // Abre o cart drawer se existir
        const cartDrawer = document.querySelector('cart-drawer');
        if (cartDrawer && typeof cartDrawer.open === 'function') {
          cartDrawer.open();
        }

        // Reseta quantidade para 1
        if (this.qtyInput) {
          this.qtyInput.value = 1;
        }

      } catch (error) {
        console.error('Error adding to cart:', error);
        alert(error.message || 'Erro ao adicionar ao carrinho');
      } finally {
        // Remove loading state
        this.button.classList.remove('loading');
        this.button.disabled = false;
      }
    });
  }

  /**
   * Atualiza quando variante muda
   */
  setupVariantChange() {
    const productContext = document.querySelector('[product-context]');
    if (!productContext) return;

    productContext.addEventListener('variant:change', (event) => {
      const variant = event.detail.variant;
      if (!variant) return;

      this.currentVariant = variant;

      // Atualiza imagem
      const stickyImage = this.stickyBar.querySelector('[data-sticky-image]');
      if (stickyImage && variant.featured_media) {
        stickyImage.src = variant.featured_media.preview_image.src.replace(/\.(jpg|png|gif|jpeg|webp).*/, '_80x.$1');
      }

      // Atualiza preço
      const stickyPrice = this.stickyBar.querySelector('[data-sticky-price]');
      if (stickyPrice) {
        stickyPrice.textContent = this.formatMoney(variant.price);
      }

      // Atualiza compare price
      const stickyComparePrice = this.stickyBar.querySelector('[data-sticky-compare-price]');
      if (stickyComparePrice) {
        if (variant.compare_at_price > variant.price) {
          stickyComparePrice.textContent = this.formatMoney(variant.compare_at_price);
          stickyComparePrice.classList.remove('hidden');
        } else {
          stickyComparePrice.classList.add('hidden');
        }
      }

      // Atualiza disponibilidade
      const buttonText = this.stickyBar.querySelector('[data-sticky-button-text]');
      if (variant.available) {
        this.button.disabled = false;
        if (buttonText) buttonText.textContent = 'Adicionar';
      } else {
        this.button.disabled = true;
        if (buttonText) buttonText.textContent = 'Esgotado';
      }
    });
  }

  /**
   * Formata preço
   */
  formatMoney(cents) {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new StickyAddToCart();
});
