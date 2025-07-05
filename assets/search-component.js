class Search extends HTMLElement {
    constructor() {
        super();
        this.form = this.querySelector('form');
        this.input = this.querySelector('input[name="q"]');
        this.form.addEventListener('submit', this.submitSearch.bind(this));
        this.debounceTimeout = null;
        this.debounceDelay = 300;

        this.boundOnInput = this._onInput.bind(this);
        this.boundOnSubmit = this._onSubmit.bind(this);
    }

    connectedCallback() {
        if (this.input) {
            this.input.addEventListener('input', this.boundOnInput);
        }
        if (this.form) {
            this.form.addEventListener('submit', this.boundOnSubmit);
        }
    }

    disconnectedCallback() {
        if (this.input) {
            this.input.removeEventListener('input', this.boundOnInput);
        }
        if (this.form) {
            this.form.removeEventListener('submit', this.boundOnSubmit);
        }

        clearTimeout(this.debounceTimeout);
    }

    _onInput(event) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this._performSuggestiveSearch();
        }, this.debounceDelay);
    }

    _performSuggestiveSearch() {
        const query = this.input.value.trim();
        if (!query) {
            // Lógica para limpar resultados
            return;
        }
        console.log(`Buscando sugestões para: "${query}"`);
        // Lógica fetch futura aqui...
    }

    _onSubmit(event) {
        if (!this.input.value.trim()) {
            event.preventDefault();
        }
        // Deixa o form ser enviado para /search
    }
}

if (!customElements.get('search-component')) {
    customElements.define('search-component', Search);
}