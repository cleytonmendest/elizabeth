/**
 * <recently-viewed> — produtos vistos recentemente, via localStorage.
 *
 * Em uma PDP, registra o produto atual (data-product-id). Para exibir, monta uma
 * busca nativa `q=id:1 OR id:2…` e usa a Section Rendering API (data-search-url +
 * section_id) para renderizar os cards reutilizando o card Liquid (preços sempre
 * corretos). Assim não duplicamos markup/estilo de card no JS.
 */
(function () {
  const KEY = 'elizabeth:recently_viewed';
  const MAX_STORE = 20;

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v.map(String) : [];
    } catch (e) {
      return [];
    }
  }
  function write(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      /* storage cheio/indisponível — ignora */
    }
  }

  class RecentlyViewed extends HTMLElement {
    connectedCallback() {
      if (this.dataset.loaded === 'true') return;
      this.dataset.loaded = 'true';

      const current = this.dataset.productId ? String(this.dataset.productId) : '';

      // Registra o produto atual (mais recente primeiro, sem duplicar).
      if (current) {
        let list = read().filter((id) => id !== current);
        list.unshift(current);
        write(list.slice(0, MAX_STORE));
      }

      const limit = parseInt(this.dataset.limit, 10) || 4;
      const display = read()
        .filter((id) => id !== current)
        .slice(0, limit);

      if (!display.length) {
        this.remove();
        return;
      }

      const query = display.map((id) => 'id:' + id).join(' OR ');
      const url =
        this.dataset.searchUrl +
        '?section_id=' + encodeURIComponent(this.dataset.sectionId) +
        '&type=product&q=' + encodeURIComponent(query);

      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          const parsed = new DOMParser().parseFromString(text, 'text/html');
          const incoming = parsed.querySelector('recently-viewed');
          if (incoming && incoming.innerHTML.trim().length) {
            this.innerHTML = incoming.innerHTML;
          } else {
            this.remove();
          }
        })
        .catch((e) => {
          console.error('recently-viewed:', e);
          this.remove();
        });
    }
  }

  if (!customElements.get('recently-viewed')) {
    customElements.define('recently-viewed', RecentlyViewed);
  }
})();
