/**
 * <pickup-availability> — retirada na loja, na PDP (issue #137).
 *
 * O servidor já pinta o resumo da variante inicial
 * (`snippets/pickup-availability.liquid`), então sem JS a cliente vê onde
 * retirar. Este componente faz o que o HTML estático não alcança:
 *
 *   1. Na troca de variante, pede o fragmento da variante nova à Section
 *      Rendering API (`sections/pickup-availability.liquid`) e troca o
 *      conteúdo.
 *   2. Abre e fecha o <dialog> com as lojas: o foco entra, fica preso e volta
 *      ao gatilho.
 *
 * ── A resposta atrasada ────────────────────────────────────────────────────
 *
 * A cliente clica em P, depois em M. Se a resposta de P chegar DEPOIS da de M,
 * a tela anuncia a loja de P com o seletor marcando M — e nada no console avisa.
 * Cada troca leva um número, e só a resposta da troca mais recente pinta.
 *
 * O número sobe em TODA troca, inclusive nas que não buscam nada: voltar para a
 * variante que já está na tela enquanto outra carrega precisa invalidar a
 * outra, senão ela chega e pinta por cima.
 *
 * ── De onde vem a URL ──────────────────────────────────────────────────────
 *
 * O prefixo é `window.Shopify.routes.root`, que a vitrine escreve em toda
 * página e que carrega o idioma e o mercado (`/en/`). Um `/variants/` cravado
 * devolveria o fragmento no idioma padrão para quem navega em outro.
 *
 * ── Por que escuta o [product-context] ─────────────────────────────────────
 *
 * É lá que `<variant-selects>` dispara `variant:change` — sem `bubbles` na
 * troca. É o contrato de eventos do tema (CLAUDE.md): este componente não
 * pergunta nada a outro componente, só escuta.
 */
const SECAO = 'pickup-availability';

const FOCAVEIS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

class PickupAvailability extends HTMLElement {
    constructor() {
        super();
        this.pedido = 0;
        this.gatilho = null;
        this.aoTrocarVariante = this.aoTrocarVariante.bind(this);
        this.aoClicar = this.aoClicar.bind(this);
        this.aoTeclar = this.aoTeclar.bind(this);
        this.aoFechar = this.aoFechar.bind(this);
    }

    connectedCallback() {
        this.contexto = this.closest('[product-context]');
        if (this.contexto) this.contexto.addEventListener('variant:change', this.aoTrocarVariante);
        this.addEventListener('click', this.aoClicar);
        this.addEventListener('keydown', this.aoTeclar);
        // `close` não borbulha: só a fase de captura o traz até aqui.
        this.addEventListener('close', this.aoFechar, true);
    }

    disconnectedCallback() {
        if (this.contexto) this.contexto.removeEventListener('variant:change', this.aoTrocarVariante);
        this.removeEventListener('click', this.aoClicar);
        this.removeEventListener('keydown', this.aoTeclar);
        this.removeEventListener('close', this.aoFechar, true);
    }

    // ── Troca de variante ──────────────────────────────────────────────────

    aoTrocarVariante(event) {
        const variante = event.detail && event.detail.variant;
        const id = variante ? String(variante.id) : '';
        const pedido = ++this.pedido;
        if (id && id === this.dataset.variantId) return;

        // Combinação que não existe: o que está na tela é da variante anterior,
        // e anunciar a loja dela seria mentir sobre a atual.
        if (!id) {
            this.pinta(null, '');
            return;
        }
        this.busca(id, pedido);
    }

    async busca(id, pedido) {
        const raiz = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
        let html = null;
        if (raiz) {
            try {
                const resposta = await fetch(`${raiz}variants/${id}/?section_id=${SECAO}`);
                if (resposta.ok) html = await resposta.text();
            } catch (erro) {
                html = null;
            }
        }

        if (pedido !== this.pedido) return;

        const doc = html ? new DOMParser().parseFromString(html, 'text/html') : null;
        const conteudo = doc && doc.querySelector('[data-pickup-conteudo]');
        // Falha de rede não é "sem retirada": o id fica em branco para que a
        // próxima troca para esta variante tente de novo.
        this.pinta(conteudo, html === null ? '' : id);
    }

    /**
     * Troca o conteúdo. Sem conteúdo o elemento some: vazio, ele ainda seria
     * um item do flex da coluna, e o `gap` abriria um vão.
     */
    pinta(conteudo, id) {
        if (conteudo) this.replaceChildren(document.importNode(conteudo, true));
        else this.replaceChildren();
        this.hidden = !conteudo;
        this.dataset.variantId = id;
    }

    // ── Diálogo ────────────────────────────────────────────────────────────

    aoClicar(event) {
        const alvo = event.target;
        const abrir = alvo.closest('[data-pickup-abrir]');
        if (abrir) {
            // O botão também sabe abrir sozinho (`command="show-modal"`); o
            // `preventDefault` evita que o navegador repita o que fazemos aqui.
            event.preventDefault();
            this.abre(abrir);
            return;
        }

        if (alvo.closest('[data-pickup-fechar]')) {
            event.preventDefault();
            this.fecha();
            return;
        }

        // O conteúdo preenche o diálogo, então um clique no PRÓPRIO <dialog>
        // só pode ter vindo do véu em volta dele.
        if (alvo.tagName === 'DIALOG') this.fecha();
    }

    abre(gatilho) {
        const dialogo = this.querySelector('dialog');
        if (!dialogo || dialogo.open) return;

        this.gatilho = gatilho;
        dialogo.showModal();
        const fechar = dialogo.querySelector('[data-pickup-fechar]');
        if (fechar) fechar.focus();
    }

    fecha() {
        const dialogo = this.querySelector('dialog[open]');
        if (dialogo) dialogo.close();
    }

    /** Todo fechamento passa aqui — botão, véu e Esc, que o navegador trata. */
    aoFechar(event) {
        if (event.target.tagName !== 'DIALOG') return;
        const gatilho = this.gatilho && this.gatilho.isConnected
            ? this.gatilho
            : this.querySelector('[data-pickup-abrir]');
        this.gatilho = null;
        if (gatilho) gatilho.focus();
    }

    /**
     * O foco não sai do diálogo pelo Tab. O modal nativo já torna a página
     * inerte, mas deixa o Tab escapar para a barra do navegador; aqui ele dá a
     * volta dentro do diálogo, que é o que quem navega por teclado espera.
     */
    aoTeclar(event) {
        if (event.key !== 'Tab') return;
        const dialogo = this.querySelector('dialog[open]');
        if (!dialogo) return;

        const focaveis = Array.from(dialogo.querySelectorAll(FOCAVEIS));
        if (!focaveis.length) return;

        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const atual = document.activeElement;

        if (event.shiftKey && (atual === primeiro || !dialogo.contains(atual))) {
            event.preventDefault();
            ultimo.focus();
        } else if (!event.shiftKey && (atual === ultimo || !dialogo.contains(atual))) {
            event.preventDefault();
            primeiro.focus();
        }
    }
}

if (!customElements.get('pickup-availability')) {
    customElements.define('pickup-availability', PickupAvailability);
}
