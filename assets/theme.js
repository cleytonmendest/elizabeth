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
        openBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('overflow-hidden');
        overlay.classList.remove('hidden');
    }

    // Função para fechar o menu e esconder o overlay
    function closeMobileMenu() {
        mobileMenu.classList.add('-translate-x-full');
        mobileMenu.setAttribute('aria-hidden', 'true');
        openBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('overflow-hidden');
        overlay.classList.add('hidden');
    }

    // Atribuir eventos
    openBtn.addEventListener('click', openMobileMenu);
    closeBtn.addEventListener('click', closeMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);

    // Fechar com tecla Escape quando o menu estiver aberto
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && mobileMenu.getAttribute('aria-hidden') === 'false') {
            closeMobileMenu();
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Seleciona todos os botões que abrem submenus
    const toggles = document.querySelectorAll('.submenu-toggle');

    toggles.forEach(toggle => {
        toggle.addEventListener('click', function () {
            // O submenu é o próximo irmão do botão
            const submenu = this.nextElementSibling;
            if (!submenu) return;

            // Verifica se o submenu está aberto (altura > 0)
            const isOpen = submenu.style.height && submenu.style.height !== '0px';

            if (isOpen) {
                // Fechar: definir altura para 0
                submenu.style.height = '0';
                submenu.setAttribute('aria-hidden', 'true');
                this.setAttribute('aria-expanded', 'false');
                // Opcional: rotacionar ícone de volta
                this.querySelector('span').style.transform = 'rotate(0deg)';
            } else {
                // Abrir: calcula a altura necessária com scrollHeight
                submenu.style.height = submenu.scrollHeight + 'px';
                submenu.setAttribute('aria-hidden', 'false');
                this.setAttribute('aria-expanded', 'true');
                // Opcional: rotacionar ícone
                this.querySelector('span').style.transform = 'rotate(180deg)';
            }
        });
    });

    // Se o conteúdo do submenu pode mudar de tamanho,
    // é interessante atualizar a altura quando a janela redimensionar
    window.addEventListener('resize', function () {
        document.querySelectorAll('.submenu').forEach(submenu => {
            if (submenu.getAttribute('aria-hidden') === 'false') {
                submenu.style.height = submenu.scrollHeight + 'px';
            }
        });
    });
});

