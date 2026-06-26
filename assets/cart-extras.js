/*
 * cart-extras.js — complementa o cart.js SEM modificá-lo.
 * Escuta os eventos que o cart.js já dispara (cart-update / quantity-update,
 * ambos com o objeto cart completo no detail) e:
 *   1. Atualiza todas as barras de frete grátis ([data-free-shipping-bar]).
 *   2. Na página de carrinho ([data-cart-page]), reflete linhas/resumo/estado-vazio
 *      sem depender da DOM do drawer.
 * Carregado globalmente junto do cart.js (via cart-drawer.liquid).
 */
(function () {
  const EVENTS = ['cart-update', 'quantity-update'];

  function formatBRL(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }

  // ---- Barra de frete grátis -------------------------------------------------
  function updateFreeShippingBars(cart) {
    document.querySelectorAll('[data-free-shipping-bar]').forEach((bar) => {
      const threshold = parseInt(bar.getAttribute('data-threshold'), 10);
      if (!threshold || threshold <= 0) return;

      const total = cart.total_price;
      const remaining = Math.max(threshold - total, 0);
      const pct = Math.min((total / threshold) * 100, 100);

      const fill = bar.querySelector('[data-fs-fill]');
      const msg = bar.querySelector('[data-fs-message]');
      if (fill) fill.style.width = pct + '%';
      if (msg) {
        if (remaining === 0) {
          // innerHTML (igual ao render do servidor) — mensagem é texto confiável de setting;
          // evita exibir tags literais se o valor contiver HTML.
          msg.innerHTML = bar.getAttribute('data-msg-success') || 'Frete grátis!';
        } else {
          const tmpl = bar.getAttribute('data-msg-progress') || 'Faltam {valor}';
          msg.innerHTML = tmpl.replace('{valor}', '<strong>' + formatBRL(remaining) + '</strong>');
        }
      }
    });
  }

  // ---- Reatividade da página de carrinho ------------------------------------
  function updateCartPage(cart) {
    const page = document.querySelector('[data-cart-page]');
    if (!page) return;

    // Carrinho ficou vazio → recarrega para renderizar o estado vazio do template.
    if (!cart.items || cart.item_count === 0) {
      window.location.reload();
      return;
    }

    // Remove da DOM os itens que saíram do carrinho; atualiza preço/índice dos demais.
    const keys = cart.items.map((i) => i.key);
    page.querySelectorAll('.cart-item').forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key && keys.indexOf(key) === -1) el.remove();
    });
    cart.items.forEach((item, idx) => {
      const el = page.querySelector('.cart-item[data-key="' + item.key + '"]');
      if (!el) return;
      el.setAttribute('data-index', idx + 1);
      const price = el.querySelector('.item-total-price');
      if (price) price.textContent = formatBRL(item.final_line_price);
    });

    // Resumo.
    const sub = page.querySelector('[data-cart-subtotal]');
    const total = page.querySelector('[data-cart-total]');
    const discount = page.querySelector('[data-cart-discount]');
    const discountRow = page.querySelector('[data-cart-discount-row]');
    if (sub) sub.textContent = formatBRL(cart.items_subtotal_price);
    if (total) total.textContent = formatBRL(cart.total_price);
    if (discount) discount.textContent = '-' + formatBRL(cart.total_discount);
    if (discountRow) discountRow.classList.toggle('hidden', cart.total_discount <= 0);
  }

  function onCart(cart) {
    if (!cart) return;
    updateFreeShippingBars(cart);
    updateCartPage(cart);
  }

  EVENTS.forEach((evt) => document.addEventListener(evt, (e) => onCart(e.detail)));

  // ---- A11y do drawer: sincroniza aria-hidden e move o foco ao abrir/fechar --
  // Observa a classe .active (alternada pelo cart.js) sem modificá-lo.
  function enhanceDrawerA11y() {
    const drawer = document.querySelector('cart-drawer');
    if (!drawer) return;
    const closeBtn = drawer.querySelector('.cart-header button');
    let lastFocus = null;

    const sync = () => {
      const isOpen = drawer.classList.contains('active');
      drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (isOpen) {
        lastFocus = document.activeElement;
        if (closeBtn) closeBtn.focus();
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
        lastFocus = null;
      }
    };

    new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ['class'] });
    drawer.setAttribute('aria-hidden', drawer.classList.contains('active') ? 'false' : 'true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceDrawerA11y);
  } else {
    enhanceDrawerA11y();
  }
})();
