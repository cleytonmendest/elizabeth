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

        this.updateHeight();
        this.initialized = true;
    }

    updateHeight() {
        const desktopBreakpoint = 1024;
        const isDesktop = window.innerWidth >= desktopBreakpoint;

        const needsHeight =
            (this.headerType === 'fixed') ||
            (this.headerType === 'fixed-transparent' && !isDesktop);

        if (needsHeight) {
            const headerHeight = this.container.offsetHeight;
            this.style.height = `${headerHeight}px`;
        } else {
            this.style.height = '';
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