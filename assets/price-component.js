class Price extends HTMLElement{
    constructor(){
        super()
        this.productContext = null
        this.listing_price = null
        this.selling_price = null
        this.installment = null
        this.installmentValue = null
    }

    connectedCallback(){
        this.productContext = this.closest('[product-context]')
        this.listing_price = this.querySelector('.listing-price')
        this.selling_price = this.querySelector('.selling-price')
        this.installment = this.querySelector('.installment-value')
        this.installmentValue = this.querySelector('.installment-price-value')

        console.log('componente iniciado')
        if(this.productContext) this.productContext.addEventListener('variant:change', this.onVariantChange.bind(this))
    }

    disconnectedCallback(){
        if(this.productContext) this.productContext.removeEventListener('variant:change')
    }

    onVariantChange(event){
        const variant = event.detail.variant;

        console.log(variant, 'variant aqui')
    }

}

customElements.define('price-component', Price)