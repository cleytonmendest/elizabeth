class Search extends HTMLElement {
    constructor() {
        super();
        this.form = this.querySelector('form');
        this.input = this.querySelector('input[name="q"]');
        this.resultsContainer = this.querySelector('.search-results');
        this.resultTemplate = this.querySelector('#search-result-template');
        this.overlay = this.querySelector('.search-overlay');
        this.debounceTimeout = null;
        this.debounceDelay = 300;

        this.boundOnInput = this._onInput.bind(this);
        this.boundOnSubmit = this._onSubmit.bind(this);
        this.boundCloseResults = this._clearAndHideResults.bind(this);
    }

    connectedCallback() {
        if (!this.input || !this.form || !this.resultsContainer || !this.resultTemplate) {
            console.warn('Search: Elementos essenciais (input, form, results, template) não foram encontrados.');
            return;
        }

        if (this.input) {
            this.input.addEventListener('input', this.boundOnInput);
        }
        if (this.form) {
            this.form.addEventListener('submit', this.boundOnSubmit);
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', this.boundCloseResults);
        }
    }

    disconnectedCallback() {
        if (this.input) {
            this.input.removeEventListener('input', this.boundOnInput);
        }
        if (this.form) {
            this.form.removeEventListener('submit', this.boundOnSubmit);
        }

        if (this.overlay) {
            this.overlay.removeEventListener('click', this.boundCloseResults);
        }

        clearTimeout(this.debounceTimeout);
    }

    _onInput(event) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this._performSuggestiveSearch();
        }, this.debounceDelay);
    }

    async _performSuggestiveSearch() {
        const query = this.input.value.trim();
        if (!query) {
            this._clearAndHideResults();
            return;
        }
        try {
            const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}`);
            const suggestions = await response.json();

            console.log(suggestions, 'sugeeestions')

            this._renderResults(suggestions.resources.results);

        } catch (error) {
            console.error('Erro na busca sugestiva:', error);
            this._clearAndHideResults();
        }
    }

    _renderResults(results) {
        this._clearAndHideResults();

        // A API pode retornar produtos, coleções, etc. Vamos focar nos produtos.
        const products = results.products;

        if (!products || products.length === 0) {
            // Opcional: Mostrar uma mensagem de "Nenhum resultado encontrado"
            this.resultsContainer.innerHTML = `<div class="p-4 text-center text-gray-500">Nenhum resultado encontrado.</div>`;
            this.resultsContainer.classList.remove('hidden');
            return;
        }

        // Para cada produto encontrado...
        products.forEach(item => {
            // 1. Clona o conteúdo do nosso template
            const resultClone = this.resultTemplate.content.cloneNode(true);
            const resultLink = resultClone.querySelector('.search-result-item');
            const resultImage = resultClone.querySelector('.search-result-image');
            const resultTitle = resultClone.querySelector('.search-result-title');

            // 2. Preenche o clone com os dados do item
            if (resultLink) resultLink.href = item.url;
            if (resultImage) {
                resultImage.src = item.image || 'caminho/para/imagem/placeholder.png'; // Fallback
                resultImage.alt = item.title;
            }
            if (resultTitle) resultTitle.textContent = item.title;

            // 3. Adiciona o item preenchido ao container de resultados
            this.resultsContainer.appendChild(resultClone);
        });

        // Mostra o container de resultados
        this.resultsContainer.classList.remove('hidden');

        if (this.overlay) {
            this.overlay.classList.remove('hidden');
        }
        this.classList.toggle('is-searching')
    }

    _clearAndHideResults() {
        this.classList.toggle('is-searching')
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = ''; // Limpa resultados anteriores
            this.resultsContainer.classList.add('hidden'); // Esconde o container
        }
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
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