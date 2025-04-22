class VariantSelects extends HTMLElement {
    constructor() {
        super();
        this.addEventListener('change', this.onVariantChange);
    }

    onVariantChange(event) {
        this.updateOptions();
        console.log(event, this.options, 'options')
    }

    updateOptions() {
        this.options = Array.from(this.querySelectorAll('select, fieldset'), (element) => {
            if (element.tagName === 'SELECT') {
                return element.value;
            }
            if (element.tagName === 'FIELDSET') {
                return Array.from(element.querySelectorAll('input')).find((radio) => radio.checked)?.value;
            }
        });
    }
}

customElements.define('variant-selects', VariantSelects);