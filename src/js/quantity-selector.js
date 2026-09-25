class QuantitySelector extends HTMLElement {
    constructor() {
        super();
        this.input = this.querySelector('input[name="quantity"]');
        this.minusButton = this.querySelector('button[name="minus"]');
        this.plusButton = this.querySelector('button[name="plus"]');

        this.boundOnChange = this._onChange.bind(this);
        this.boundDecrement = this._decrement.bind(this);
        this.boundIncrement = this._increment.bind(this);
    }

    connectedCallback() {
        if (!this.input || !this.minusButton || !this.plusButton) {
            console.warn('QuantitySelector: Elementos internos (input, button minus, button plus) não encontrados.');
            return;
        }

        this.productContext = this.closest('[product-context]');
        if (!this.productContext) {
            console.warn('QuantitySelector: Elemento [product-context] não encontrado. Eventos de quantidade podem não ser disparados corretamente para outros componentes.');
        }

        this.minusButton.addEventListener('click', this.boundDecrement);
        this.plusButton.addEventListener('click', this.boundIncrement);
        this.input.addEventListener('change', this.boundOnChange);

        this._updateButtonStates();
    }

    disconnectedCallback() {
        // Remove os listeners (importante se o elemento for removido dinamicamente)
        if (this.minusButton) this.minusButton.removeEventListener('click', this.boundDecrement);
        if (this.plusButton) this.plusButton.removeEventListener('click', this.boundIncrement);
        if (this.input) this.input.removeEventListener('change', this.boundOnChange);
    }

    _getCurrentValue() {
        const value = parseInt(this.input.value || '1', 10);
        return isNaN(value) ? 1 : Math.max(1, value); // Garante >= 1 e trata NaN
    }

    _setValue(value) {
        const newValue = Math.max(1, parseInt(value || '1', 10)); // Garante >= 1
        if (isNaN(newValue)) {
            this.input.value = '1';
        } else {
            this.input.value = newValue;
        }

        this.input.dispatchEvent(new Event('change', { bubbles: true }));

        if (this.productContext) {
            this.productContext.dispatchEvent(new CustomEvent('quantity:change', {
                detail: { quantity: parseInt(this.input.value, 10) },
                bubbles: true,
                composed: true
            }));
        } else {
            console.warn('QuantitySelector: productContext não encontrado, evento quantity:change não foi disparado no contexto esperado.');
        }
    }

    _decrement() {
        const currentValue = this._getCurrentValue();
        if (currentValue > 1) {
            this._setValue(currentValue - 1);
        }
    }

    _increment() {
        const currentValue = this._getCurrentValue();
        this._setValue(currentValue + 1);
    }

    _onChange() {
        const currentValue = this._getCurrentValue();
        if (currentValue !== parseInt(this.input.value, 10)) {
            this.input.value = currentValue;
        }
        this._updateButtonStates();
    }

    _updateButtonStates() {
        const currentValue = this._getCurrentValue();
        this.minusButton.disabled = currentValue <= 1;
    }
}
if (!customElements.get('quantity-selector')) customElements.define('quantity-selector', QuantitySelector)