/**
 * <product-recommendations> — carrega as recomendações nativas do Shopify
 * (Product Recommendations API) sob demanda, quando a seção entra na viewport.
 *
 * Na primeira renderização da PDP, `recommendations.performed` é false e o
 * elemento vem vazio com um `data-url`. Aqui buscamos esse endpoint (que devolve
 * a própria seção já com os produtos) e injetamos só o conteúdo interno.
 */
if (!customElements.get('product-recommendations')) {
  customElements.define(
    'product-recommendations',
    class ProductRecommendations extends HTMLElement {
      connectedCallback() {
        if (this.dataset.loaded === 'true' || !this.dataset.url) return;

        const onIntersect = (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this);
          this.dataset.loaded = 'true';

          fetch(this.dataset.url)
            .then((res) => res.text())
            .then((text) => {
              const parsed = new DOMParser().parseFromString(text, 'text/html');
              const incoming = parsed.querySelector('product-recommendations');
              if (incoming && incoming.innerHTML.trim().length) {
                this.innerHTML = incoming.innerHTML;
              }
            })
            .catch((e) => console.error('product-recommendations:', e));
        };

        new IntersectionObserver(onIntersect.bind(this), {
          rootMargin: '0px 0px 400px 0px',
        }).observe(this);
      }
    }
  );
}
