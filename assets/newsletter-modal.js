class NewsletterModal extends HTMLElement {
    constructor() {
        super();

        // Elements
        this.modalContent = this.querySelector('.newsletter-modal-content');
        this.closeButton = this.querySelector('.close-modal');
        this.form = this.querySelector('.newsletter-form');
        this.emailInput = this.querySelector('#newsletter-email');
        this.submitButton = this.querySelector('.submit-btn');
        this.submitText = this.querySelector('.submit-text');
        this.loadingSpinner = this.querySelector('.loading-spinner');
        this.feedbackMessage = this.querySelector('.feedback-message');
        this.dontShowAgainCheckbox = this.querySelector('.dont-show-again');

        // Settings from data attributes
        this.delay = parseInt(this.dataset.delay) || 0;
        this.scrollTrigger = parseInt(this.dataset.scrollTrigger) || 0;
        this.enableExitIntent = this.dataset.enableExitIntent === 'true';
        this.cookieDays = parseInt(this.dataset.cookieDays) || 30;

        // State
        this.hasShown = false;
        this.isSubmitting = false;

        // Cookie name
        this.cookieName = 'newsletter_modal_closed';

        // Bind methods
        this.boundOnScroll = this._onScroll.bind(this);
        this.boundOnMouseLeave = this._onMouseLeave.bind(this);
        this.boundOnClose = this._close.bind(this);
        this.boundOnSubmit = this._onSubmit.bind(this);
        this.boundOnClickOutside = this._onClickOutside.bind(this);
    }

    connectedCallback() {
        // Se já foi mostrado/fechado, não mostrar novamente
        if (this._hasSeenModal()) {
            return;
        }

        // Setup event listeners
        this.closeButton?.addEventListener('click', this.boundOnClose);
        this.addEventListener('click', this.boundOnClickOutside);
        this.form?.addEventListener('submit', this.boundOnSubmit);

        // Previne fechar ao clicar no conteúdo do modal
        this.modalContent?.addEventListener('click', (e) => e.stopPropagation());

        // Setup triggers
        this._setupTriggers();
    }

    disconnectedCallback() {
        this.closeButton?.removeEventListener('click', this.boundOnClose);
        this.removeEventListener('click', this.boundOnClickOutside);
        this.form?.removeEventListener('submit', this.boundOnSubmit);
        window.removeEventListener('scroll', this.boundOnScroll);
        document.removeEventListener('mouseleave', this.boundOnMouseLeave);
    }

    _setupTriggers() {
        // Trigger por tempo (delay)
        if (this.delay > 0) {
            setTimeout(() => {
                if (!this.hasShown) {
                    this._show();
                }
            }, this.delay * 1000);
        }

        // Trigger por scroll
        if (this.scrollTrigger > 0) {
            window.addEventListener('scroll', this.boundOnScroll);
        }

        // Trigger por exit intent
        if (this.enableExitIntent) {
            document.addEventListener('mouseleave', this.boundOnMouseLeave);
        }
    }

    _onScroll() {
        const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

        if (scrollPercent >= this.scrollTrigger && !this.hasShown) {
            this._show();
        }
    }

    _onMouseLeave(event) {
        // Só ativa se mouse sair pela parte superior
        if (event.clientY < 0 && !this.hasShown) {
            this._show();
        }
    }

    _show() {
        this.hasShown = true;
        this.classList.remove('hidden');
        this.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Animação de entrada
        setTimeout(() => {
            this.modalContent.style.transform = 'scale(1)';
            this.modalContent.style.opacity = '1';
        }, 10);

        // Remove listeners de trigger após mostrar
        window.removeEventListener('scroll', this.boundOnScroll);
        document.removeEventListener('mouseleave', this.boundOnMouseLeave);
    }

    _close() {
        // Verifica se checkbox "não mostrar novamente" está marcado
        const dontShowAgain = this.dontShowAgainCheckbox?.checked || false;

        if (dontShowAgain) {
            this._setModalCookie();
        }

        // Animação de saída
        this.modalContent.style.transform = 'scale(0.95)';
        this.modalContent.style.opacity = '0';

        setTimeout(() => {
            this.classList.add('hidden');
            this.classList.remove('flex');
            document.body.style.overflow = '';
        }, 300);
    }

    _onClickOutside(event) {
        if (event.target === this) {
            this._close();
        }
    }

    async _onSubmit(event) {
        event.preventDefault();

        if (this.isSubmitting) return;

        const email = this.emailInput.value.trim();

        if (!this._validateEmail(email)) {
            this._showFeedback('Por favor, insira um e-mail válido.', 'error');
            return;
        }

        this._setLoading(true);

        try {
            // Integração com Shopify Customer API
            const response = await fetch('/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'form_type': 'customer',
                    'utf8': '✓',
                    'contact[email]': email,
                    'contact[tags]': 'newsletter',
                })
            });

            if (response.ok) {
                // Sucesso
                const successMessage = this.form.dataset.successMessage || 'Obrigado! Você receberá nossas novidades em breve.';
                this._showFeedback(successMessage, 'success');

                // Limpa form
                this.emailInput.value = '';

                // Define cookie para não mostrar novamente
                this._setModalCookie();

                // Fecha modal após 3 segundos
                setTimeout(() => {
                    this._close();
                }, 3000);
            } else {
                throw new Error('Erro na requisição');
            }
        } catch (error) {
            console.error('Erro ao cadastrar newsletter:', error);
            const errorMessage = this.form.dataset.errorMessage || 'Ops! Algo deu errado. Tente novamente.';
            this._showFeedback(errorMessage, 'error');
        } finally {
            this._setLoading(false);
        }
    }

    _setLoading(loading) {
        this.isSubmitting = loading;
        this.submitButton.disabled = loading;

        if (loading) {
            this.submitText.classList.add('hidden');
            this.loadingSpinner.classList.remove('hidden');
        } else {
            this.submitText.classList.remove('hidden');
            this.loadingSpinner.classList.add('hidden');
        }
    }

    _showFeedback(message, type) {
        const messageElement = this.feedbackMessage.querySelector('p');

        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `text-sm text-center ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
        }

        this.feedbackMessage.classList.remove('hidden');

        // Auto-hide após 5 segundos
        setTimeout(() => {
            this.feedbackMessage.classList.add('hidden');
        }, 5000);
    }

    _validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    _hasSeenModal() {
        return this._getCookie(this.cookieName) !== null;
    }

    _setModalCookie() {
        const expires = new Date();
        expires.setTime(expires.getTime() + (this.cookieDays * 24 * 60 * 60 * 1000));
        document.cookie = `${this.cookieName}=true; expires=${expires.toUTCString()}; path=/`;
    }

    _getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    }
}

// Registra o custom element
if (!customElements.get('newsletter-modal')) {
    customElements.define('newsletter-modal', NewsletterModal);
}
