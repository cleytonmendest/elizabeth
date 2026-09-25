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
        this.declineButton = this.querySelector('.decline-modal');

        // Settings from data attributes
        this.delay = parseInt(this.dataset.delay) || 0;
        this.scrollTrigger = parseInt(this.dataset.scrollTrigger) || 0;
        this.enableExitIntent = this.dataset.enableExitIntent === 'true';
        this.cookieDays = parseInt(this.dataset.cookieDays) || 30;

        // State
        this.hasShown = false;
        this.isSubmitting = false;

        // Chaves de persistência
        // cookieName: dispensa de longo prazo (checkbox "não mostrar" ou cadastro), dura cookieDays.
        // sessionKey: dispensa por sessão (fechar no X/fora/ESC) — não reaparece a cada navegação,
        // mas volta numa próxima visita.
        this.cookieName = 'newsletter_modal_closed';
        this.sessionKey = 'newsletter_modal_session';

        // Bind methods
        this.boundOnScroll = this._onScroll.bind(this);
        this.boundOnMouseLeave = this._onMouseLeave.bind(this);
        this.boundOnClose = this._close.bind(this);
        this.boundOnDecline = this._decline.bind(this);
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
        this.declineButton?.addEventListener('click', this.boundOnDecline);
        this.addEventListener('click', this.boundOnClickOutside);
        this.form?.addEventListener('submit', this.boundOnSubmit);

        // Previne fechar ao clicar no conteúdo do modal
        this.modalContent?.addEventListener('click', (e) => e.stopPropagation());

        // Setup triggers
        this._setupTriggers();
    }

    disconnectedCallback() {
        this.closeButton?.removeEventListener('click', this.boundOnClose);
        this.declineButton?.removeEventListener('click', this.boundOnDecline);
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

        // Animação de entrada usando classes
        setTimeout(() => {
            this.modalContent.classList.remove('opacity-0', 'scale-95');
            this.modalContent.classList.add('opacity-100', 'scale-100');
        }, 10);

        // Remove listeners de trigger após mostrar
        window.removeEventListener('scroll', this.boundOnScroll);
        document.removeEventListener('mouseleave', this.boundOnMouseLeave);
    }

    _close() {
        // Fechamento simples (X / clique-fora): suprime só nesta sessão,
        // para não incomodar a cada navegação, mas volta numa próxima visita.
        this._setSessionDismissed();
        this._animateClose();
    }

    _decline() {
        // "Não, obrigado": um clique fecha e não mostra por cookieDays.
        this._setModalCookie();
        this._animateClose();
    }

    _animateClose() {
        this.modalContent.classList.remove('opacity-100', 'scale-100');
        this.modalContent.classList.add('opacity-0', 'scale-95');

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
            this._showFeedback(this.form.dataset.invalidMessage ?? '', 'error');
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
                this._showFeedback(this.form.dataset.successMessage ?? '', 'success');

                // Limpa form
                this.emailInput.value = '';

                // Define cookie para não mostrar novamente
                this._setModalCookie();

                // Fecha modal após 3 segundos (cookie já gravado acima)
                setTimeout(() => {
                    this._animateClose();
                }, 3000);
            } else {
                throw new Error('Erro na requisição');
            }
        } catch (error) {
            console.error('Erro ao cadastrar newsletter:', error);
            this._showFeedback(this.form.dataset.errorMessage ?? '', 'error');
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
        const messageElement = this.feedbackMessage.querySelector('.feedback-text');

        if (messageElement) {
            messageElement.textContent = message;
            // Remove classes anteriores e adiciona nova
            messageElement.classList.remove('feedback-success', 'feedback-error');
            messageElement.classList.add(`feedback-${type}`);
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
        // Não mostra se houve dispensa de longo prazo (cookie) OU dispensa nesta sessão
        return this._getCookie(this.cookieName) !== null || this._hasSessionDismissed();
    }

    _hasSessionDismissed() {
        try {
            return sessionStorage.getItem(this.sessionKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    _setSessionDismissed() {
        try {
            sessionStorage.setItem(this.sessionKey, 'true');
        } catch (e) {}
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
