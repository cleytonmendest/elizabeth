class MainHeader extends HTMLElement {
    constructor() {
        super();
        this.container = this.querySelector('#main-header-container');
        this.onScroll = this.onScroll.bind(this);
    }

    connectedCallback() {
        this.onScroll();
        window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    disconnectedCallback() {
        window.removeEventListener('scroll', this.onScroll);
    }

    // Marca o header quando a página é rolada (usado para reforçar a sombra)
    onScroll() {
        if (window.scrollY > 0) {
            this.container.classList.add('is-scrolling');
        } else {
            this.container.classList.remove('is-scrolling');
        }
    }
}

customElements.define('main-header', MainHeader);
