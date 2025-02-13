class Search extends HTMLElement {
    constructor() {
        super();
        this.form = this.querySelector('form');
        this.form.addEventListener('submit', this.submitSearch.bind(this));

        // console.log(this.form, 'fooooooooorm')
    }

    async submitSearch(event) {
        console.log('submit handler')
        event.preventDefault();
        try {
            const fetchs = await fetch(`/search/suggest.json?q=camisa`)
            const responses = await fetchs.json()

            console.log('entrou try', responses)
            // await CartManager.addToCart(this.form);
            // await this.updateCartDrawer();
            // await CartManager.getCart()
        } catch (error) {
            console.error('Erro ao adicionar o produto ao carrinho:', error);
        } finally {
            0
            console.log('entrou finally')
            // document.querySelector('cart-drawer').open();
        }
    }
}

customElements.define('search-component', Search);