/**
 * <gift-card-recipient-form> — mandar o vale-presente direto para outra pessoa.
 *
 * Mora DENTRO do `{% form 'product' %}` (ver
 * `snippets/gift-card-recipient-form.liquid`) e não envia nada sozinho: quem
 * envia é o form, pelo submit nativo ou pelo `<add-to-cart>`, que monta o
 * corpo com `new FormData(form)`. O trabalho deste componente é decidir QUAIS
 * campos o form carrega — e mostrar, ao lado de cada um, o que a Shopify
 * recusou.
 *
 * ── O HTML nasce no estado sem JavaScript ──────────────────────────────────
 *
 * Sem JS, os campos ficam visíveis, a caixa de marcar fica escondida e
 * desabilitada, e um controle oculto manda
 * `__shopify_send_gift_card_to_recipient=if_present`: a Shopify só trata como
 * envio para outra pessoa se o e-mail vier preenchido. É o desenho do Dawn, e
 * é o que deixa a compra para si mesma funcionar sem JS.
 *
 * Este componente troca para o estado com JS, e a troca é toda aqui, num
 * lugar só: a caixa aparece e passa a ser a pergunta; o controle oculto sai
 * do envio; e os campos só existem para o form ENQUANTO a caixa estiver
 * marcada. Campo `disabled` não entra no `FormData` — é isso que garante que,
 * desmarcada, nenhuma propriedade do destinatário chega ao carrinho, mesmo com
 * o que a cliente digitou antes de desistir.
 *
 * ── Por que o fuso é daqui ─────────────────────────────────────────────────
 *
 * `__shopify_offset` diz em que fuso a data de envio foi escolhida. Só o
 * navegador sabe; sem ele a Shopify usa o fuso da loja, e "enviar em 25/12"
 * pode chegar no dia 24 para quem compra de outro fuso.
 */
const CAMPO_DO_ERRO = '[data-erro-campo]';

/**
 * O pedaço da recusa que diz QUAL campo falhou — `{ email: ['…'] }`.
 *
 * A Shopify o põe em `errors`; o Dawn também procura em `description`, que em
 * outras recusas é só uma frase. Frase não é mapa de campos, e fica para o
 * aviso geral do `<add-to-cart>`.
 */
function errosPorCampo(recusa) {
    if (!recusa) return null;
    for (const candidato of [recusa.errors, recusa.description]) {
        if (candidato && typeof candidato === 'object' && !Array.isArray(candidato)) return candidato;
    }
    return null;
}

class GiftCardRecipientForm extends HTMLElement {
    connectedCallback() {
        this.caixa = this.querySelector('[data-caixa-destinatario]');
        if (!this.caixa) return;

        this.form = this.closest('form');
        this.blocoDosCampos = this.querySelector('[data-campos]');
        this.campos = Array.from(this.querySelectorAll('[data-campo]'));
        this.offset = this.querySelector('[data-offset]');

        // A troca para o estado com JS.
        this.caixa.disabled = false;
        this.querySelector('[data-caixa]')?.removeAttribute('hidden');
        this.querySelectorAll('[data-sem-js]').forEach((el) => {
            if (el.tagName === 'INPUT') el.disabled = true;
            else el.hidden = true;
        });
        if (this.offset) this.offset.value = String(new Date().getTimezoneOffset());

        this.aoMarcar = this.sincroniza.bind(this);
        this.aoRecusar = this.mostraErros.bind(this);
        this.aoEnviar = this.limpaErros.bind(this);

        this.caixa.addEventListener('change', this.aoMarcar);
        // O `<add-to-cart>` dispara `cart-error` NO FORM, e o evento sobe: é
        // escutando aqui que este componente ouve só o erro do próprio form, e
        // não o de outro produto na mesma página.
        this.form?.addEventListener('cart-error', this.aoRecusar);
        this.form?.addEventListener('submit', this.aoEnviar);

        this.sincroniza();
    }

    disconnectedCallback() {
        if (!this.caixa) return;
        this.caixa.removeEventListener('change', this.aoMarcar);
        this.form?.removeEventListener('cart-error', this.aoRecusar);
        this.form?.removeEventListener('submit', this.aoEnviar);
    }

    campo(nome) {
        return this.campos.find((el) => el.dataset.campo === nome) || null;
    }

    /** A caixa decide: marcada, os campos vão no envio; desmarcada, nenhum. */
    sincroniza() {
        const marcada = this.caixa.checked;

        if (this.blocoDosCampos) this.blocoDosCampos.hidden = !marcada;
        this.campos.forEach((el) => {
            el.disabled = !marcada;
        });
        if (this.offset) this.offset.disabled = !marcada;

        // Com JS, o e-mail é a única coisa sem a qual não há destinatário.
        // Sem JS ele é opcional — é o `if_present` —, e por isso o `required`
        // nasce aqui e não no Liquid.
        const email = this.campo('email');
        if (email) email.required = marcada;

        if (!marcada) this.limpaErros();
    }

    /**
     * Põe cada erro ao lado do campo dele e leva o foco ao primeiro.
     *
     * O `aria-describedby` de cada campo já aponta para o elemento do erro
     * desde o Liquid (vazio enquanto não há erro), então basta escrever ali: o
     * leitor de tela lê a mensagem quando o foco chega. Cancelar o evento é o
     * aviso ao `<add-to-cart>` de que o erro já foi mostrado.
     */
    mostraErros(evento) {
        const erros = errosPorCampo(evento.detail);
        if (!erros) return;

        this.limpaErros();
        let primeiro = null;

        for (const [nome, mensagens] of Object.entries(erros)) {
            const campo = this.campo(nome);
            const aviso = this.querySelector(`[data-erro-campo="${nome}"]`);
            if (!campo || !aviso) continue;

            aviso.textContent = [].concat(mensagens).join(', ');
            aviso.hidden = false;
            campo.setAttribute('aria-invalid', 'true');
            primeiro = primeiro || campo;
        }

        if (!primeiro) return;
        evento.preventDefault();
        primeiro.focus();
    }

    limpaErros() {
        this.querySelectorAll(CAMPO_DO_ERRO).forEach((aviso) => {
            aviso.textContent = '';
            aviso.hidden = true;
        });
        this.campos.forEach((el) => el.removeAttribute('aria-invalid'));
    }
}

if (!customElements.get('gift-card-recipient-form')) {
    customElements.define('gift-card-recipient-form', GiftCardRecipientForm);
}
