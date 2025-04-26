class VariantSelects extends HTMLElement {
    constructor() {
        super();
        this.options = [];
        this.variants = [];
        this.variantMap = {};
        this.currentVariant = null;
    }

    connectedCallback() {
        const variantDataElement = this.querySelector('[data-variants]');

        if (!variantDataElement) {
            console.error('VariantSelects: Elemento <script data-variants> não encontrado!');
            return;
        }

        try {
            this.variants = JSON.parse(variantDataElement.textContent);
            // console.log('VariantSelects: Dados das variantes carregados:', this.variants); // Debug

            if (!Array.isArray(this.variants) || this.variants.length === 0) {
                console.warn('VariantSelects: Nenhum dado de variante válido encontrado no JSON.');
                return
            }

        } catch (e) {
            console.error('VariantSelects: Erro ao parsear JSON das variantes!', e);
            return;
        }

        this.updateOptions();
        this.currentVariant = this._findCurrentVariant();

        this.changeHandler = this.onVariantChange.bind(this);
        this.addEventListener('change', this.changeHandler);
    }

    disconnectedCallback() {
        // Boa prática: remover o listener quando o elemento for destruído
        if (this.changeHandler) {
            this.removeEventListener('change', this.changeHandler);
        }
    }

    onVariantChange() {
        this.updateOptions();

        this.currentVariant = this._findCurrentVariant();
        console.log('Variante atualizada encontrada:', this.currentVariant);

        this.dispatchEvent(new CustomEvent('variant:change', {
            detail: {
                variant: this.currentVariant
            },
            bubbles: true,
            composed: true
        }));
    }

    updateOptions() {
        this.options = Array.from(this.querySelectorAll('select, fieldset'), (element) => {
            if (element.tagName === 'SELECT') return element.value;

            if (element.tagName === 'FIELDSET') return Array.from(element.querySelectorAll('input')).find((radio) => radio.checked)?.value;

            return null
        });
    }

    _findCurrentVariant() {
        return this.variants.find(variant => {
            const optionsMatchLength = this.options.length === variant.options.length;
            const optionsMatchValues = this.options.every((optionValue, index) => {
                return optionValue === variant.options[index];
            });
            return optionsMatchLength && optionsMatchValues;
        });
    }
}

if (!customElements.get('variant-selects')) {
    customElements.define('variant-selects', VariantSelects);
}