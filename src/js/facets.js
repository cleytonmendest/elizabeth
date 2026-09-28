/**
 * <facet-filters> — o form de filtros e ordenação da coleção e da busca.
 *
 * Envolve o `<form data-filter-form>` que as duas sections renderizam em volta
 * de `snippets/facets.liquid`. Três trabalhos:
 *
 *   gaveta       no celular os filtros moram numa gaveta off-canvas:
 *                [data-filters-open] abre; [data-filters-close], o véu e o
 *                Escape fecham; cruzar para o desktop também fecha
 *   auto-envio   no desktop, marcar um filtro envia o form; no celular a
 *                cliente marca vários e aperta "Aplicar". A ordenação envia
 *                sempre — ela não tem botão
 *   aviso        o <select> de ordenação aponta `aria-describedby` para
 *                #a11y-refresh-page-message: quem usa leitor de tela fica
 *                sabendo que trocar a ordem recarrega a página
 *
 * ── De onde veio ───────────────────────────────────────────────────────────
 *
 * Era um `<script>` inline em `sections/main-collection.liquid`. Com a busca
 * ganhando o mesmo filtro (#141), inline viraria duas cópias — e inline não é
 * carregável por `tests/helpers/load-asset.mjs`, então nenhuma das duas era
 * testada.
 *
 * Virar custom element também conserta o editor: o script inline procurava os
 * botões uma vez, e a Shopify troca o HTML da section a cada setting mexido. O
 * `connectedCallback` roda de novo para cada cópia nova.
 *
 * ── O Escape só fecha o que está aberto ────────────────────────────────────
 *
 * O inline fechava em todo Escape, aberto ou não, e fechar tira o
 * `overflow-hidden` do <body>. Numa coleção com o carrinho aberto, o Escape
 * destravava a rolagem que o DRAWER do carrinho tinha travado. Mesma coisa ao
 * cruzar o breakpoint. Aqui os dois perguntam antes se a gaveta está aberta —
 * a mesma checagem que `tests/menu.test.mjs` cobra do menu mobile.
 *
 * ── Sem JS ─────────────────────────────────────────────────────────────────
 *
 * O form é GET: sem este arquivo ele continua funcionando pelo botão de
 * aplicar, que o `<noscript>` do snippet mostra em qualquer largura.
 */

if (!customElements.get('facet-filters')) {
  const DESKTOP = '(min-width: 1024px)';
  const AVISO_ID = 'a11y-refresh-page-message';

  class FacetFilters extends HTMLElement {
    constructor() {
      super();

      this.aoClicar = (event) => {
        const alvo = event.target;
        if (!(alvo instanceof Element)) return;
        if (alvo.closest('[data-filters-open]')) this.abre();
        else if (alvo.closest('[data-filters-close], [data-filters-overlay]')) this.fecha();
      };

      this.aoTeclar = (event) => {
        if (event.key === 'Escape' && this.aberta) this.fecha();
      };

      this.aoCruzar = (event) => {
        if (event.matches && this.aberta) this.fecha();
      };

      this.aoMudar = (event) => {
        if (!this.form) return;
        if (event.target.name === 'sort_by') {
          this.form.submit();
          return;
        }
        if (this.desktop && this.desktop.matches) this.form.submit();
      };
    }

    connectedCallback() {
      this.form = this.querySelector('[data-filter-form]');
      this.painel = this.querySelector('[data-filters-panel]');
      this.veu = this.querySelector('[data-filters-overlay]');
      this.desktop = window.matchMedia(DESKTOP);

      this.addEventListener('click', this.aoClicar);
      if (this.form) this.form.addEventListener('change', this.aoMudar);
      document.addEventListener('keydown', this.aoTeclar);
      this.desktop.addEventListener('change', this.aoCruzar);

      this.publicaAviso();
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.aoTeclar);
      if (this.desktop) this.desktop.removeEventListener('change', this.aoCruzar);
      // O editor troca a section inteira: se a gaveta estava aberta, a trava
      // de rolagem ficaria no <body> sem ninguém para tirá-la.
      if (this.aberta) document.body.classList.remove('overflow-hidden');
    }

    get aberta() {
      return Boolean(this.painel && this.painel.classList.contains('is-open'));
    }

    abre() {
      if (!this.painel) return;
      this.painel.classList.add('is-open');
      if (this.veu) this.veu.classList.add('is-open');
      document.body.classList.add('overflow-hidden');
    }

    fecha() {
      if (!this.painel) return;
      this.painel.classList.remove('is-open');
      if (this.veu) this.veu.classList.remove('is-open');
      document.body.classList.remove('overflow-hidden');
    }

    /**
     * Um aviso por página, e o texto vem do Liquid (`data-reload-message`): a
     * frase é da loja, traduzida, e não deste arquivo.
     */
    publicaAviso() {
      const texto = this.dataset.reloadMessage;
      if (!texto || document.getElementById(AVISO_ID)) return;

      const aviso = document.createElement('span');
      aviso.id = AVISO_ID;
      aviso.className = 'sr-only';
      aviso.setAttribute('role', 'status');
      aviso.setAttribute('aria-live', 'polite');
      aviso.textContent = texto;
      document.body.appendChild(aviso);
    }
  }

  customElements.define('facet-filters', FacetFilters);
}
