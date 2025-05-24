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
        this.productContext = this.closest('[product-context]');

        if (!variantDataElement) {
            console.error('VariantSelects: Elemento <script data-variants> não encontrado!');
            return;
        }

        try {
            this.variants = JSON.parse(variantDataElement.textContent);

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

        this._updateAvailability();

        this._updateURL();

        this.productContext.dispatchEvent(new CustomEvent('variant:change', {
            detail: {
                variant: this.currentVariant
            },
            bubbles: true,
            composed: true
        }));

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

        this._updateAvailability();

        this.productContext.dispatchEvent(new CustomEvent('variant:change', {
            detail: {
                variant: this.currentVariant
            }
        }));

        this._updateURL();
    }

    _updateURL() {
        // Só atualiza a URL se uma variante válida foi encontrada
        if (this.currentVariant) {
            // Constrói a nova URL com o parâmetro ?variant=ID
            const newUrl = `${window.location.pathname}?variant=${this.currentVariant.id}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
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

    _updateAvailability() {
        const currentSelections = [...this.options];

        const availableVariantMap = new Map();
        this.variants.forEach(variant => {
            const key = variant.options.join('|');
            availableVariantMap.set(key, variant.available);
        });

        this.querySelectorAll('select, fieldset').forEach((element, optionIndex) => {

            const inputsOrOptions = element.tagName === 'SELECT'
                ? Array.from(element.options)
                : Array.from(element.querySelectorAll('input[type="radio"]'));

            inputsOrOptions.forEach(inputOrOption => {
                const valueToCheck = inputOrOption.value;
                const potentialOptions = [...currentSelections];
                potentialOptions[optionIndex] = valueToCheck;
                const potentialKey = potentialOptions.join('|');
                const isAvailable = availableVariantMap.has(potentialKey) && availableVariantMap.get(potentialKey) === true;

                let targetElementForClass = null;
                if (element.tagName === 'FIELDSET') {
                    targetElementForClass = element.querySelector(`label[for="${inputOrOption.id}"]`);
                } else if (element.tagName === 'SELECT') {
                    targetElementForClass = inputOrOption;
                }

                if(targetElementForClass) {
                    targetElementForClass.classList.toggle('is-unavailable', !isAvailable);
                }
            });
        });
    }
}

if (!customElements.get('variant-selects')) {
    customElements.define('variant-selects', VariantSelects);
}