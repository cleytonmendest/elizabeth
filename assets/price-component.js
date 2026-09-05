class PriceComponent extends HTMLElement {
    constructor() {
        super()
        this.productContext = null
        this.ListingPriceElement = null
        this.sellingPriceElement = null
    }

    connectedCallback() {
        // Seleciona os elementos internos uma vez
        this.listingPriceElement = this.querySelector('.listing-price');
        this.sellingPriceElement = this.querySelector('.selling-price');

        // Encontra o contexto para escutar o evento
        this.productContext = this.closest('[product-context]');

        // Adiciona o listener
        if (this.productContext) {
            this.productContext.addEventListener('variant:change', this._onVariantChange.bind(this));
        } else {
            console.warn('PriceComponent: Contexto do produto [product-context] não encontrado.');
        }
    };

    disconnectedCallback() {
        if (this.productContext) this.productContext.removeEventListener('variant:change', this._onVariantChange.bind(this));
    };

    _onVariantChange(event) {
        const variant = event.detail.variant;

        this._updatePriceDisplay(variant.price, variant.compare_at_price);
    };

    _updatePriceDisplay(price, compare_at_price) {
        //Altera preço
        if (!this.sellingPriceElement) return;
        this.sellingPriceElement.textContent = formatPrice(price);

        //Altera compare_at_price
        if (!this.listingPriceElement) return;
        const listingPrice = compare_at_price > price
        this.listingPriceElement.classList.toggle('hidden', !listingPrice)
        this.listingPriceElement.textContent = formatPrice(compare_at_price);
    };
}

if (!customElements.get('price-component')) {
    customElements.define('price-component', PriceComponent);
}
