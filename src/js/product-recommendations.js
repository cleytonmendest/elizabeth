/**
 * <product-recommendations> — carrega as recomendações nativas do Shopify
 * (Product Recommendations API) sob demanda, quando a seção entra na viewport.
 *
 * Na primeira renderização da PDP, `recommendations.performed` é false e o
 * elemento vem vazio com um `data-url`. Aqui buscamos esse endpoint (que devolve
 * a própria seção já com os produtos) e injetamos só o conteúdo interno.
 *
 * ── O intent é parâmetro, não constante ────────────────────────────────────
 *
 * A mesma API responde duas perguntas diferentes (issue #140):
 *
 *   related        "parecidos com este" — a Shopify gera sozinha
 *   complementary  "combina com este"   — a lojista monta no app Search &
 *                                         Discovery; sem isso, vem vazio
 *
 * Até a #140 o Liquid cravava `intent=related` na URL, e o tema não tinha como
 * mostrar a segunda. O intent agora chega por `data-intent` e é este
 * componente que o põe na URL — um componente só para os dois, em vez de uma
 * cópia por intent (a regra `similarity` reprovaria a cópia, e com razão).
 * Valor desconhecido cai em `related`, que é também o padrão da própria API.
 *
 * ── Vazio ou erro: a seção some inteira ────────────────────────────────────
 *
 * Produto sem complementares configurados é o caso NORMAL, não exceção: a
 * lojista liga a seção uma vez e cadastra os pares aos poucos. O título mora
 * dentro do ramo com produtos, então nunca fica órfão; mas a section vazia
 * continuaria no fluxo do `<main>`, e o `gap` entre sections (setting
 * `spacing_sections`) cercaria um vão sem nada dentro. Por isso o que se
 * esconde é o contêiner da section, e não só este elemento.
 *
 * Sem JS: nada aparece. O conteúdo só existe depois da resposta — que é
 * também o que evita reservar altura para uma lista que pode nem vir.
 */
const INTENCOES = ['related', 'complementary'];

/** O intent pedido, se a API o conhece; senão o padrão dela. */
const intencao = (valor) => (INTENCOES.includes(valor) ? valor : INTENCOES[0]);

if (!customElements.get('product-recommendations')) {
  customElements.define(
    'product-recommendations',
    class ProductRecommendations extends HTMLElement {
      connectedCallback() {
        if (this.dataset.loaded === 'true' || !this.dataset.url) return;

        const onIntersect = (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this);
          this.carrega();
        };

        new IntersectionObserver(onIntersect, {
          rootMargin: '0px 0px 400px 0px',
        }).observe(this);
      }

      /** A base que o Liquid montou (seção, produto, limite) + o intent deste elemento. */
      get url() {
        const url = new URL(this.dataset.url, window.location.href);
        url.searchParams.set('intent', intencao(this.dataset.intent));
        return `${url.pathname}${url.search}`;
      }

      carrega() {
        this.dataset.loaded = 'true';

        return fetch(this.url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          })
          .then((text) => {
            const parsed = new DOMParser().parseFromString(text, 'text/html');
            const incoming = parsed.querySelector('product-recommendations');
            if (incoming && incoming.innerHTML.trim().length) {
              this.innerHTML = incoming.innerHTML;
            } else {
              this.esconde();
            }
          })
          .catch((e) => {
            console.error('product-recommendations:', e);
            this.esconde();
          });
      }

      esconde() {
        (this.closest('.shopify-section') || this).hidden = true;
      }
    }
  );
}
