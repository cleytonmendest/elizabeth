class QuantitySelector extends HTMLElement {
    constructor() {
        super();

        this.input = this.querySelector('input[name="quantity"]');
        this.minusButton = this.querySelector('button[name="minus"]');
        this.plusButton = this.querySelector('button[name="plus"]');
    }

    connectedCallback() {

        this.input.addEventListener('change', this._onChange.bind(this));
    }

    _getCurrentValue() {
        const value = parseInt(this.input.value || '1', 10);
        return isNaN(value) ? 1 : Math.max(1, value);
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