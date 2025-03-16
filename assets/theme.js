// botão menu mobile
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenu = document.getElementById('mobile-menu');
    const openBtn = document.getElementById('mobile-menu-open');
    const closeBtn = document.getElementById('mobile-menu-close');
    const overlay = document.getElementById('mobile-menu-overlay');

    // Função para abrir o menu e exibir o overlay
    function openMobileMenu() {
        mobileMenu.classList.remove('-translate-x-full');
        mobileMenu.setAttribute('aria-hidden', 'false');
        document.body.classList.add('overflow-hidden');
        overlay.classList.remove('hidden');
    }

    // Função para fechar o menu e esconder o overlay
    function closeMobileMenu() {
        mobileMenu.classList.add('-translate-x-full');
        mobileMenu.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('overflow-hidden');
        overlay.classList.add('hidden');
    }

    // Atribuir eventos
    openBtn.addEventListener('click', openMobileMenu);
    closeBtn.addEventListener('click', closeMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);
});
