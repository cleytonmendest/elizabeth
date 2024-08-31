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
        headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
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

            return result
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    static async updateQuantity(line, quantity) {
        const body = JSON.stringify({
            line,
            quantity
        });

        const response = await fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
        const responseJson = await response.json()

        return responseJson
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

        try {
            await CartManager.addToCart(this.form);
        } catch (error) {
            console.error(error);
        } finally {
            document.querySelector('cart-drawer').open()
        }
    }
}

customElements.define('add-to-cart', AddToCart);

class RemoveFromCart extends HTMLElement {
    constructor() {
        super();
        this.addEventListener('click', this.removeHandler.bind(this));
    }

    async removeHandler(event) {
        event.preventDefault();

        try {
            await CartManager.updateQuantity(this.dataset.index, 0);

        } catch (error) {
            console.error(error);
        } finally {
             //ff
        }
    }
}

customElements.define('remove-from-cart', RemoveFromCart);

class QuantityInput extends HTMLElement {
    constructor(){
        super()
        this.plus = this.querySelector('#quantity-plus')
        this.minus = this.querySelector('#quantity-minus')
        this.input = this.querySelector('#quantity-input')
        this.debounceTimer = null; // Armazena o ID do timeout

        this.plus.addEventListener('click', this.changeQuantity.bind(this, 1));
        this.minus.addEventListener('click', this.changeQuantity.bind(this, -1));
    }

    changeQuantity(change) {
        const newQuantity = parseInt(this.input.value) + change;
        if (newQuantity < 1) return;

        this.input.value = newQuantity;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.updateCartQuantity(newQuantity);
        }, ON_CHANGE_DEBOUNCE_TIMER);
    }

    async updateCartQuantity(newQuantity) {
        const itemIndex = this.dataset.index;
        try {
            await CartManager.updateQuantity(itemIndex, newQuantity);
        } catch (error) {
            console.error('Erro ao atualizar a quantidade no carrinho:', error);
        }
    }
}

customElements.define('quantity-input', QuantityInput);