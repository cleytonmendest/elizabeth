/*
 * cart-extras.js — complementa o cart.js SEM modificá-lo.
 * Escuta os eventos que o cart.js já dispara (cart-update / quantity-update,
 * ambos com o objeto cart completo no detail) e:
 *   1. Atualiza todas as barras de frete grátis ([data-free-shipping-bar]).
 *   2. Na página de carrinho ([data-cart-page]), reflete linhas/resumo/estado-vazio
 *      sem depender da DOM do drawer.
 *   3. Pede ao servidor as sections que seguem o carrinho ([data-cart-section],
 *      a gaveta e a página) e troca as regiões [data-cart-live] — descontos,
 *      preço riscado, preço unitário. Ver `redesenhaPeloServidor`.
 * Carregado globalmente junto do cart.js (via cart-drawer.liquid).
 *
 * `formatMoney` é global e vem de `assets/money.js` — a única formatação de
 * moeda do tema (fronteira `money-format`). Este arquivo tinha a sua, chamada
 * `formatBRL`, que cravava real e português. Ver issue #39.
 */
(function () {
  const EVENTS = ['cart-update', 'quantity-update'];

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
          //
          // Sem fallback: o texto tem dono (`cart_free_shipping_success`, com
          // default no schema) e o snippet sempre emite o atributo. Uma cópia
          // aqui seria uma terceira versão — e a que existia já dizia outra
          // coisa ("Frete grátis!" contra "Você ganhou frete grátis!").
          msg.innerHTML = bar.dataset.msgSuccess ?? '';
        } else {
          const tmpl = bar.dataset.msgProgress ?? '';
          msg.innerHTML = tmpl.replace('{valor}', '<strong>' + formatMoney(remaining) + '</strong>');
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
      if (price) price.textContent = formatMoney(item.final_line_price);
    });

    // Resumo: os dois números que o JSON já traz mudam na hora. Os descontos
    // não — o nome de cada um vem do servidor, logo abaixo.
    const sub = page.querySelector('[data-cart-subtotal]');
    const total = page.querySelector('[data-cart-total]');
    if (sub) sub.textContent = formatMoney(cart.items_subtotal_price);
    if (total) total.textContent = formatMoney(cart.total_price);
  }

  // ---- O que só o servidor sabe desenhar (#144) ------------------------------
  /**
   * Um desconto automático liga ou desliga com a quantidade ("leve 2, pague
   * menos"), e quando liga ele tem NOME, alcance (um item, ou o pedido) e
   * valor. O JSON do carrinho traz tudo isso, mas desenhar a partir dele seria
   * escrever em JS uma segunda cópia do markup de `cart-drawer-item` e do
   * resumo — com as classes, os rótulos acessíveis e a regra de quando cada
   * coisa aparece. Duas cópias divergem; a primeira divergência seria um
   * desconto que o Liquid mostra no carregamento e o JS some na primeira
   * mudança.
   *
   * Então quem desenha é o Liquid, sempre. Depois de cada mudança, as
   * sections marcadas com `[data-cart-section]` (a gaveta e, na página do
   * carrinho, a página) são pedidas de volta à Section Rendering API, num
   * pedido só — `?sections=` aceita várias —, e só as regiões
   * `[data-cart-live]` são trocadas. O seletor de quantidade fica fora delas:
   * trocar o HTML dele tiraria o foco de quem está clicando no +.
   *
   * A lista de linhas inteira só é trocada quando o conjunto de itens mudou
   * (um brinde que o desconto pôs no carrinho, um item que outra aba tirou):
   * aí não há região correspondente onde encaixar o HTML novo.
   *
   * A fronteira `section-rendering` (scripts/lint/config/boundaries.json)
   * procura `section_id=` e não enxerga este `sections=`. Este é mais um
   * consumidor da API, e está dito aqui para ninguém achar que não é.
   */
  let ultimoPedido = 0;

  const chavesDe = (lista) => [...lista.querySelectorAll('.cart-item')].map((el) => el.dataset.key).join();

  function aplicaSecao(raiz, fresca) {
    const itens = raiz.querySelector('[data-cart-items]');
    const itensFrescos = fresca.querySelector('[data-cart-items]');
    if (itens && itensFrescos && chavesDe(itens) !== chavesDe(itensFrescos)) {
      itens.innerHTML = itensFrescos.innerHTML;
    }

    const regioes = {};
    fresca.querySelectorAll('[data-cart-live]').forEach((el) => {
      regioes[el.dataset.cartLive] = el;
    });
    raiz.querySelectorAll('[data-cart-live]').forEach((el) => {
      const nova = regioes[el.dataset.cartLive];
      if (nova) el.innerHTML = nova.innerHTML;
    });
  }

  function redesenhaPeloServidor() {
    const raizes = [...document.querySelectorAll('[data-cart-section]')];
    if (!raizes.length || !window.routes) return;

    // Duas mudanças seguidas fazem dois pedidos, e a resposta do primeiro pode
    // chegar DEPOIS da do segundo. Sem esta guarda, o carrinho de antes da
    // segunda mudança sobrescreveria o de depois — e ficaria assim.
    const pedido = ++ultimoPedido;
    const ids = raizes.map((raiz) => raiz.dataset.cartSection).join(',');

    return fetch(`${window.routes.cart_url}?sections=${ids}`)
      .then((resposta) => resposta.json())
      .then((secoes) => {
        if (pedido !== ultimoPedido) return;
        const parser = new DOMParser();
        raizes.forEach((raiz) => {
          const html = secoes[raiz.dataset.cartSection];
          if (html) aplicaSecao(raiz, parser.parseFromString(html, 'text/html'));
        });
      })
      .catch((erro) => console.error('Erro ao redesenhar o carrinho:', erro));
  }

  /**
   * Um carrinho da Shopify tem `items` (array) e `item_count` (número). Um
   * item de linha não tem nenhum dos dois.
   *
   * O `cart.js` agora só publica carrinho no `cart-update` (issue #4), mas
   * este arquivo não é dono desse evento: `cart-update` é um nome genérico, e
   * num tema da Theme Store apps de terceiro convivem na mesma página. Se
   * chegar outra coisa, a conta de frete vira NaN e a cliente lê "Faltam
   * R$ NaN para frete grátis". Ignorar é melhor que exibir isso.
   */
  function ehCarrinho(cart) {
    return Boolean(cart) && Array.isArray(cart.items) && typeof cart.item_count === 'number';
  }

  function onCart(cart) {
    if (!ehCarrinho(cart)) return;
    updateFreeShippingBars(cart);
    updateCartPage(cart);
    // Carrinho vazio: a página recarrega (acima) e a gaveta mostra o estado
    // vazio dela — não há linha nem desconto para redesenhar.
    if (cart.item_count > 0) redesenhaPeloServidor();
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

  // ---- Observações do pedido (cart notes) -----------------------------------
  // Salva a nota via /cart/update.js. Na página do carrinho o <textarea name="note">
  // também é enviado no submit nativo do form; aqui garantimos persistência ao
  // digitar e antes do checkout do drawer (que é um link, sem form).
  function initCartNotes() {
    const notes = document.querySelectorAll('[data-cart-note]');
    if (!notes.length || !window.routes || !window.routes.cart_update_url) return;

    let lastSaved = notes[0].value;
    let pending = null;

    const save = (value) => {
      lastSaved = value;
      return fetch(`${window.routes.cart_update_url}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ note: value }),
      }).catch((e) => console.error('Erro ao salvar observações do pedido:', e));
    };

    const syncOthers = (source) => {
      notes.forEach((n) => { if (n !== source) n.value = source.value; });
    };

    notes.forEach((note) => {
      note.addEventListener('input', () => {
        syncOthers(note);
        clearTimeout(pending);
        const value = note.value;
        pending = setTimeout(() => save(value), 500);
      });
      note.addEventListener('blur', () => {
        clearTimeout(pending);
        if (note.value !== lastSaved) save(note.value);
      });
    });

    // Drawer: garante a gravação antes de navegar ao checkout.
    document.querySelectorAll('[data-cart-checkout]').forEach((link) => {
      link.addEventListener('click', async (e) => {
        const note = document.querySelector('[data-cart-note]');
        if (!note || note.value === lastSaved) return;
        e.preventDefault();
        clearTimeout(pending);
        await save(note.value);
        window.location.href = link.getAttribute('href');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceDrawerA11y();
      initCartNotes();
    });
  } else {
    enhanceDrawerA11y();
    initCartNotes();
  }
})();
