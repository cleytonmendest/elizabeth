const ON_CHANGE_DEBOUNCE_TIMER = 300;

const PUB_SUB_EVENTS = {
    cartUpdate: 'cart-update',
    quantityUpdate: 'quantity-update',
    variantChange: 'variant-change',
    cartError: 'cart-error',
};

// Função utilitária para configuração de fetch
function fetchConfig(type = 'json') {
    return {
        method: 'POST',
        headers: {
            'Content-Type': type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
    };
}

// Publicação de eventos
function publish(event, detail) {
    document.dispatchEvent(new CustomEvent(event, { detail }));
}

// Classe principal para gerenciar o carrinho
class CartManager {
    static async addToCart(form) {
        const formData = new FormData(form);
        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];
        config.body = formData;

        try {
            const response = await fetch(`${routes.cart_add_url}`, config);
            const result = await response.json();
            if (result.status) {
                publish(PUB_SUB_EVENTS.cartError, {
                    source: 'add-to-cart',
                    productVariantId: formData.get('id'),
                    errors: result.errors || result.description,
                    message: result.message,
                });
                throw new Error(result.message);
            } else {
                publish(PUB_SUB_EVENTS.cartUpdate, {
                    source: 'add-to-cart',
                    productVariantId: formData.get('id'),
                    cartData: result,
                });
                return result;
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    static async removeFromCart(line) {
        const body = JSON.stringify({ line, quantity: 0 });
        const response = await fetch(`${routes.cart_change_url}`, { ...fetchConfig(), body });
        return response.json();
    }

    static async updateCart(line, quantity) {
        const body = JSON.stringify({ line, quantity });
        const response = await fetch(`${routes.cart_change_url}`, { ...fetchConfig(), body });
        return response.json();
    }
}

// Classe para o drawer do carrinho
class CartDrawer extends HTMLElement {
    constructor() {
        super();
        this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
        this.querySelector('#minicart-overlay').addEventListener('click', this.close.bind(this));
        this.setHeaderCartIconAccessibility();
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

    renderContents(cartData) {
        // Renderizar o conteúdo do carrinho aqui
    }
}

customElements.define('cart-drawer', CartDrawer);

// Classe para adicionar produtos ao carrinho
class AddToCart extends HTMLElement {
    constructor() {
        super();
        this.form = this.querySelector('form');
        this.form.addEventListener('submit', this.submitHandler.bind(this));
    }

    async submitHandler(event) {
        event.preventDefault();
        const submitButton = this.form.querySelector('[type="submit"]');
        submitButton.setAttribute('aria-disabled', true);
        submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        try {
            const response = await CartManager.addToCart(this.form);
            const cartDrawer = document.querySelector('cart-drawer');
            if (cartDrawer) {
                cartDrawer.renderContents(response);
                cartDrawer.open();
            } else {
                window.location = window.routes.cart_url;
            }
        } catch (error) {
            console.error(error);
            // Tratar erros aqui
        } finally {
            submitButton.classList.remove('loading');
            submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');
        }
    }
}

customElements.define('add-to-cart', AddToCart);
