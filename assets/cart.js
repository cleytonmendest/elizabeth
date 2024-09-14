const ON_CHANGE_DEBOUNCE_TIMER = 300;

const PUB_SUB_EVENTS = {
    cartUpdate: 'cart-update',
    quantityUpdate: 'quantity-update',
    variantChange: 'variant-change',
    cartError: 'cart-error',
};

function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value / 100);
}

function fetchConfig(type = 'json') {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
    };
}

function publish(event, detail) {
    document.dispatchEvent(new CustomEvent(event, { detail }));
}

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

class CartManager {
    static async getCart() {
        try {
            const response = await fetch(`${routes.cart_url}.js`);
            const cart = await response.json();
            publish(PUB_SUB_EVENTS.cartUpdate, cart);
            return cart;
        } catch (error) {
            console.error('Erro ao obter o carrinho:', error);
            throw error;
        }
    }

    static async addToCart(form) {
        const formData = new FormData(form);
        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];
        config.body = formData;

        try {
            const response = await fetch(`${routes.cart_add_url}`, config);
            const result = await response.json();
            publish(PUB_SUB_EVENTS.cartUpdate, result);
            return result;
        } catch (error) {
            console.error('Erro ao adicionar ao carrinho:', error);
            throw error;
        }
    }

    static async updateQuantity(line, quantity) {
        const body = JSON.stringify({ line, quantity });

        try {
            const response = await fetch(`${routes.cart_change_url}`, { ...fetchConfig(), body });
            const cart = await response.json();
            publish(PUB_SUB_EVENTS.quantityUpdate, cart);

            return cart;
        } catch (error) {
            console.error('Erro ao atualizar a quantidade:', error);
            publish(PUB_SUB_EVENTS.cartError, error);
            throw error;
        }
    }
}

class CartDrawer extends HTMLElement {
    constructor() {
        super();
        this.setupEventListeners();
        this.setHeaderCartIconAccessibility();
        this.setupEventSubscriptions();
    }

    setupEventListeners() {
        this.addEventListener('keyup', (evt) => {
            if (evt.code === 'Escape') this.close();
        });
        this.querySelector('#minicart-overlay').addEventListener('click', this.close.bind(this));
    }

    setupEventSubscriptions() {
        document.addEventListener(PUB_SUB_EVENTS.cartUpdate, (event) => {
            this.updateCartSummary(event.detail);
            this.updateQtdBubble(event.detail.item_count)
        });

        document.addEventListener(PUB_SUB_EVENTS.quantityUpdate, (event) => {
            const cart = event.detail;

            cart.items.forEach((item, index) => {
                this.updateItemTotalPrice(index + 1, item.final_line_price);
            });
            this.updateCartSummary(cart);
            this.updateQtdBubble(cart.item_count)
        });

        document.addEventListener(PUB_SUB_EVENTS.cartError, (event) => {
            console.error('Erro detectado:', event.detail);
        });
    }

    open() {
        document.body.classList.add('overflow-hidden');
        this.classList.add('animate', 'active');
    }

    close() {
        document.body.classList.remove('overflow-hidden');
        this.classList.remove('active');
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

    updateItemIndexes() {
        this.querySelectorAll('.cart-item').forEach((item, index) => {
            item.setAttribute('data-index', index + 1);
        });
    }

    removeItem(line) {
        const itemElement = this.querySelector(`[data-index="${line}"]`);
        if (itemElement) {
            itemElement.closest('.cart-item').remove();
        }

        this.updateItemIndexes();
    }

    updateItemTotalPrice(line, newPrice) {
        const itemElement = this.querySelector(`[data-index="${line}"]`);
        const priceElement = itemElement.querySelector('.item-total-price');
        if (priceElement) {
            priceElement.textContent = formatPrice(newPrice);
        }
    }

    async updateCartSummary(cart) {
        const summaryElement = document.querySelector('#cart-summary-total');
        const itemsSubtotalPriceElement = summaryElement.querySelector('.subtotal');
        const totalDiscountElement = summaryElement.querySelector('.discounts');
        const totalPriceElement = summaryElement.querySelector('.total-price');

        const { items_subtotal_price, total_discount, total_price } = cart;

        itemsSubtotalPriceElement.textContent = formatPrice(items_subtotal_price);
        totalDiscountElement.textContent = formatPrice(total_discount);
        totalPriceElement.textContent = formatPrice(total_price);
    }

    updateQtdBubble(newQtd) {
        const qtdBubble = document.querySelector('#qtd-bubble');
        const cartEmpty = this.querySelector('#cart-empty');
        const cartContainer = this.querySelector('#cart-container');
        const isVisible = newQtd > 0;
    
        const toggleVisibility = (element, visible) => {
            element.classList.toggle('flex', visible);
            element.classList.toggle('hidden', !visible);
        };
    
        toggleVisibility(qtdBubble, isVisible);
        toggleVisibility(cartEmpty, !isVisible);
        toggleVisibility(cartContainer, isVisible);
    
        qtdBubble.textContent = newQtd;
    }
}

customElements.define('cart-drawer', CartDrawer);

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
            await this.updateCartDrawer();
            await CartManager.getCart()
        } catch (error) {
            console.error('Erro ao adicionar o produto ao carrinho:', error);
        } finally {
            document.querySelector('cart-drawer').open();
        }
    }

    async updateCartDrawer() {
        try {
            const response = await fetch('/cart');
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const newCartItem = doc.querySelector('.cart-item'); // Supondo que o novo item tenha a classe 'cart-item'
            
            if (newCartItem) {
                const cartContainer = document.querySelector('#cart-items-container');
                cartContainer.appendChild(newCartItem);
                document.querySelector('cart-drawer').updateItemIndexes(); // Atualiza os índices no minicart
            }
        } catch (error) {
            console.error('Erro ao atualizar o minicart:', error);
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
        const itemElement = this.closest('.cart-item');
        const itemIndex = itemElement.getAttribute('data-index');

        try {
            await CartManager.updateQuantity(itemIndex, 0);
            document.querySelector('cart-drawer').removeItem(itemIndex);
        } catch (error) {
            console.error('Erro ao remover o item do carrinho:', error);
        }
    }
}

customElements.define('remove-from-cart', RemoveFromCart);

class QuantityInput extends HTMLElement {
    constructor() {
        super();
        this.plus = this.querySelector('#quantity-plus');
        this.minus = this.querySelector('#quantity-minus');
        this.input = this.querySelector('#quantity-input');
        this.maxQtd = this.getAttribute('data-max-qtd')

        this.plus.addEventListener('click', this.changeQuantity.bind(this, 1));
        this.minus.addEventListener('click', this.changeQuantity.bind(this, -1));

        // Debounced version of the update function
        this.debouncedUpdateQuantity = debounce(this.updateCartQuantity.bind(this), ON_CHANGE_DEBOUNCE_TIMER);
    }

    changeQuantity(change) {
        const newQuantity = parseInt(this.input.value) + change;
        if (newQuantity < 1 || newQuantity > this.maxQtd) return;

        this.input.value = newQuantity;

        // Call the debounced update function
        this.debouncedUpdateQuantity();
    }

    async updateCartQuantity() {
        const newQuantity = parseInt(this.input.value);
        const itemElement = this.closest('.cart-item');
        const itemIndex = itemElement.getAttribute('data-index');

        try {
            await CartManager.updateQuantity(itemIndex, newQuantity);
        } catch (error) {
            console.error('Erro ao atualizar a quantidade no carrinho:', error);
        }
    }
}


customElements.define('quantity-input', QuantityInput);
