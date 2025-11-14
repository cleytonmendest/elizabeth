class Search extends HTMLElement {
    constructor() {
        super();
        this.form = this.querySelector('form');
        this.input = this.querySelector('input[name="q"]');
        this.resultsContainer = this.querySelector('.search-results');
        this.resultsContent = this.querySelector('.search-results-content');
        this.resultTemplate = this.querySelector('#search-result-template');
        this.collectionTemplate = this.querySelector('#collection-result-template');
        this.loadingState = this.querySelector('.search-loading');
        this.footer = this.querySelector('.search-footer');
        this.overlay = this.querySelector('.search-overlay');
        this.debounceTimeout = null;
        this.debounceDelay = 300;
        this.maxResults = 6; // Máximo de resultados a exibir
        this.selectedIndex = -1; // Para navegação por teclado
        this.currentResults = [];

        this.boundOnInput = this._onInput.bind(this);
        this.boundOnSubmit = this._onSubmit.bind(this);
        this.boundCloseResults = this._clearAndHideResults.bind(this);
        this.boundOnKeyDown = this._onKeyDown.bind(this);
    }

    connectedCallback() {
        if (!this.input || !this.form || !this.resultsContainer || !this.resultTemplate) {
            console.warn('Search: Elementos essenciais (input, form, results, template) não foram encontrados.');
            return;
        }

        if (this.input) {
            this.input.addEventListener('input', this.boundOnInput);
            this.input.addEventListener('keydown', this.boundOnKeyDown);
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
            this.input.removeEventListener('keydown', this.boundOnKeyDown);
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

        // Se query vazia, limpa resultados
        if (!query) {
            this._clearAndHideResults();
            return;
        }

        // Se query muito curta, mostra mensagem
        if (query.length < 2) {
            this._clearAndHideResults();
            return;
        }

        // Mostra loading state
        this._showLoading();

        try {
            const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[limit]=10`);
            const suggestions = await response.json();

            this._renderResults(suggestions.resources.results, query);

        } catch (error) {
            console.error('Erro na busca sugestiva:', error);
            this._hideLoading();
            this._clearAndHideResults();
        }
    }

    _renderResults(results, query) {
        this._hideLoading();
        this._clearResults();

        const products = results.products || [];
        const collections = results.collections || [];

        const totalResults = products.length + collections.length;

        // Se não tem resultados
        if (totalResults === 0) {
            this.resultsContent.innerHTML = `<div class="p-6 text-center text-gray-500">Nenhum resultado encontrado para "${query}".</div>`;
            this.resultsContainer.classList.remove('hidden');
            this.classList.add('is-searching');
            if (this.overlay) {
                this.overlay.classList.remove('hidden');
            }
            return;
        }

        this.currentResults = [];

        // Renderizar coleções (máximo 2)
        collections.slice(0, 2).forEach(collection => {
            const clone = this.collectionTemplate.content.cloneNode(true);
            const link = clone.querySelector('.collection-result-item');
            const title = clone.querySelector('.collection-result-title');

            if (link) {
                link.href = collection.url;
                this.currentResults.push(link);
            }
            if (title) {
                title.innerHTML = this._highlightQuery(collection.title, query);
            }

            this.resultsContent.appendChild(clone);
        });

        // Renderizar produtos (limitado a maxResults)
        products.slice(0, this.maxResults).forEach(product => {
            const clone = this.resultTemplate.content.cloneNode(true);
            const link = clone.querySelector('.search-result-item');
            const image = clone.querySelector('.search-result-image');
            const title = clone.querySelector('.search-result-title');
            const price = clone.querySelector('.search-result-price');
            const badge = clone.querySelector('.search-result-badge');

            if (link) {
                link.href = product.url;
                this.currentResults.push(link);
            }

            if (image) {
                image.src = product.image || '';
                image.alt = product.title;
            }

            if (title) {
                title.innerHTML = this._highlightQuery(product.title, query);
            }

            if (price) {
                price.textContent = this._formatPrice(product.price);
            }

            // Badge de disponibilidade
            if (badge && !product.available) {
                badge.textContent = 'Esgotado';
                badge.classList.remove('hidden');
                badge.classList.add('bg-red-100', 'text-red-700');
            } else if (badge && product.compare_at_price && product.compare_at_price > product.price) {
                const discount = Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100);
                badge.textContent = `-${discount}%`;
                badge.classList.remove('hidden');
                badge.classList.add('bg-green-100', 'text-green-700');
            }

            this.resultsContent.appendChild(clone);
        });

        // Mostrar footer "Ver todos" se tiver mais resultados
        if (totalResults > this.maxResults) {
            const footerLink = this.footer.querySelector('a');
            if (footerLink) {
                footerLink.href = `/search?q=${encodeURIComponent(query)}`;
            }
            this.footer.classList.remove('hidden');
        }

        // Mostra o dropdown
        this.resultsContainer.classList.remove('hidden');
        this.classList.add('is-searching');
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
        }
    }

    _clearResults() {
        if (this.resultsContent) {
            this.resultsContent.innerHTML = '';
        }
        if (this.footer) {
            this.footer.classList.add('hidden');
        }
        this.currentResults = [];
        this.selectedIndex = -1;
    }

    _clearAndHideResults() {
        this._hideLoading();
        this._clearResults();
        this.classList.remove('is-searching');
        if (this.resultsContainer) {
            this.resultsContainer.classList.add('hidden');
        }
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
    }

    _showLoading() {
        this._clearResults();
        if (this.loadingState) {
            this.loadingState.classList.remove('hidden');
        }
        this.resultsContainer.classList.remove('hidden');
        this.classList.add('is-searching');
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
        }
    }

    _hideLoading() {
        if (this.loadingState) {
            this.loadingState.classList.add('hidden');
        }
    }

    _formatPrice(price) {
        // A API do Shopify retorna o preço já em centavos (17990 = R$ 179,90)
        // Não dividimos por 100, apenas formatamos direto
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    }

    _highlightQuery(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-200 font-semibold">$1</mark>');
    }

    _onKeyDown(event) {
        if (!this.resultsContainer.classList.contains('hidden')) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
                this._updateSelection();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this._updateSelection();
            } else if (event.key === 'Enter' && this.selectedIndex >= 0) {
                event.preventDefault();
                this.currentResults[this.selectedIndex]?.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this._clearAndHideResults();
            }
        }
    }

    _updateSelection() {
        this.currentResults.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('bg-gray-100');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('bg-gray-100');
            }
        });
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