class CartDrawer extends HTMLElement {
    constructor() {
        super();

        this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
        this.querySelector('#minicart-overlay').addEventListener('click', this.close.bind(this));
        this.setHeaderCartIconAccessibility()
    }

    open() {
        this.classList.add('animate', 'active');

        document.body.classList.add('overflow-hidden');
    }

    close() {
        this.classList.remove('active');

        document.body.classList.remove('overflow-hidden');
    }

    setHeaderCartIconAccessibility() {
        const cartButton = document.querySelector('#minicart-button');
        cartButton.setAttribute('role', 'button');
        cartButton.setAttribute('aria-haspopup', 'dialog');
        cartButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.open();
        });
        cartButton.addEventListener('keydown', (event) => {
            if (event.code.toUpperCase() === 'SPACE') {
                event.preventDefault();
                this.open();
            }
        });
    }
}

customElements.define('cart-drawer', CartDrawer);