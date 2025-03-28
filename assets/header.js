class MainHeader extends HTMLElement {
    constructor() {
        super();
        this.container = this.querySelector('#main-header-container');
        this.headerType = this.dataset.type;
        this.initialized = false;
    }

    connectedCallback() {
        this.initHeader();
        window.addEventListener('scroll', this.onScroll.bind(this));
        window.addEventListener('resize', this.updateHeight.bind(this));
    }

    disconnectedCallback() {
        window.removeEventListener('scroll', this.onScroll.bind(this));
        window.removeEventListener('resize', this.updateHeight.bind(this));
    }

    initHeader() {
        if (this.initialized) return;

        this.classList.add('main-header');
        this.updateHeight();

        switch (this.headerType) {
            case 'fixed':
                this.classList.add('main-header__fixed');
                break;
            case 'transparent':
                this.container.classList.add('main-header__transparent');
                break;
            case 'fixed-transparent':
                this.classList.add('main-header__fixed-transparent');
                break;
            case 'basic':
            default:
                // Não faz nada para 'basic'
                break;
        }
        this.initialized = true;
    }

    updateHeight() {
        if (this.headerType === 'fixed') {
            const headerHeight = this.container.offsetHeight;
            this.style.height = `${headerHeight}px`;
        }
    }

    onScroll() {
        if (this.headerType === 'fixed-transparent' || this.headerType === 'fixed') {
            const scrollY = window.scrollY;
            if (scrollY > 0) {
                this.classList.add('is-scrolling');
                this.container.classList.add('is-scrolling');
            } else {
                this.classList.remove('is-scrolling');
                this.container.classList.remove('is-scrolling');
            }
        }
    }
}

customElements.define('main-header', MainHeader);