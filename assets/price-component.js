class PriceComponent extends HTMLElement {
    constructor() {
        super()
        this.config = { maxInstallments: 1, minValue: 0 };
        this.productContext = null
        this.ListingPriceElement = null
        this.sellingPriceElement = null
        this.installmentElement = null
        this.installmentValueElement = null
    }

    connectedCallback() {
        // Lê configurações e estado inicial dos atributos data-*
        this.config.maxInstallments = parseInt(this.dataset.mi, 10) || 1;
        this.config.minValue = parseFloat(this.dataset.mv) || 0;

        // Seleciona os elementos internos uma vez
        this.listingPriceElement = this.querySelector('.listing-price');
        this.sellingPriceElement = this.querySelector('.selling-price');
        this.installmentElement = this.querySelector('.installment-value');
        this.installmentValueElement = this.querySelector('.installment-price-value');

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

        //Altera Installments (Parcelamento)
        if (this.installmentElement && this.installmentValueElement) {
            this._updateInstallmentDisplay(variant.price)
        }
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

    _updateInstallmentDisplay(price) {
        let actualInstallments = 1;
        let finalInstallmentValue = 0;

        const maxInstallments = this.config.maxInstallments;
        const minValueCents = this.config.minValue;

        // `Math.floor`, e não `Math.ceil`: o servidor pinta esta mesma linha
        // com `price | divided_by: i` (snippets/price-v2.liquid e
        // snippets/card-product-slider.liquid), e `divided_by` é divisão
        // INTEIRA. Com ceil, R$ 99,99 dava 1x no HTML e 2x depois do JS, no
        // mesmo carregamento — e as parcelas de R$ 49,995 ficavam abaixo do
        // mínimo que a lojista configurou, escondidas pelo arredondamento do
        // formatPrice. Issue #48.
        if (price > 0 && maxInstallments > 1 && minValueCents >= 0) {
            for (let i = maxInstallments; i >= 2; i--) {
                const installmentValueCheck = Math.floor(price / i)

                if (installmentValueCheck >= minValueCents) {
                    actualInstallments = i;
                    break;
                }
            }
        }

        // O mesmo `floor` no VALOR, pelo mesmo motivo: o Liquid imprime
        // `final_installment_value | money` a partir de centavos inteiros. Sem
        // isto, R$ 59,99 em 2x virava R$ 29,99 no servidor e R$ 30,00 no JS —
        // um centavo, no mesmo texto, trocando sozinho depois do carregamento.
        finalInstallmentValue = Math.floor(price / actualInstallments);

        this.installmentElement.textContent = `${actualInstallments}x`;
        this.installmentValueElement.textContent = formatPrice(finalInstallmentValue);
    };
}

if (!customElements.get('price-component')) {
    customElements.define('price-component', PriceComponent);
}