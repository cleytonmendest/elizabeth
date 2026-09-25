/**
 * O mini-carrinho lê a fonte certa — e não a primeira que aparecer.
 *
 * ── O que mudou na #117 ────────────────────────────────────────────────────
 *
 * Até aqui, `updateCartDrawer()` baixava a PÁGINA do carrinho inteira — com
 * `<head>`, cabeçalho, rodapé, o drawer de novo e as tags de todo o CSS e JS
 * do tema — para extrair o `innerHTML` de uma `<div>`. A cada adição.
 *
 * Agora pede só o fragmento da section, pela Section Rendering API. E isso
 * MUDA A FORMA DO DEFEITO que este arquivo vigia, em vez de aposentá-lo.
 *
 * ── O defeito, nas duas encarnações ────────────────────────────────────────
 *
 * Até a #68, drawer e página do carrinho usavam o MESMO id. Dois elementos com
 * o mesmo id no mesmo documento é HTML inválido, e `querySelector` devolve o
 * primeiro na ordem do documento — que era o do drawer só porque o layout o
 * renderiza antes do `content_for_layout`. Funcionava por ORDENAÇÃO.
 *
 * O fragmento que chega agora é o PRÓPRIO drawer re-renderizado. Então origem
 * e destino voltam a ter o mesmo `#cart-drawer-items` — um no documento
 * baixado, outro no vivo. Ler no documento errado faz o drawer copiar a si
 * mesmo: sem erro no console, sem aviso no lint, e com o carrinho congelado no
 * estado anterior à adição.
 *
 * ── O que este arquivo prova ───────────────────────────────────────────────
 *
 * Que a escolha não depende da ordem nem do acaso. Os dois lados carregam
 * conteúdos DIFERENTES — se fossem iguais, ler o errado daria o mesmo
 * resultado e o teste ficaria verde do mesmo jeito.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';

loadGlobalAsset('money.js', ['formatMoney']);
const { AddToCart } = loadAsset('cart.js', ['AddToCart']);

/** O que o servidor devolve, e o que o drawer já tem na tela. */
const DO_SERVIDOR = '<div class="cart-item" data-key="do-servidor">item recém-adicionado</div>';
const DO_DRAWER = '<div class="cart-item" data-key="do-drawer">item velho do drawer</div>';
const DA_PAGINA = '<div class="cart-item" data-key="da-pagina">item da página</div>';

/**
 * O fragmento que a Section Rendering API devolve: a section inteira, com o
 * wrapper que o Liquid emite. Não é uma `<div>` solta — o `?section_id=` traz
 * o markup da section, e é nele que o `#cart-drawer-items` do servidor mora.
 */
const fragmentoDaSection = (itens = DO_SERVIDOR) => `
  <div data-section-id="cart-drawer">
    <cart-drawer>
      <div id="cart-container">
        <div id="cart-drawer-items">${itens}</div>
      </div>
    </cart-drawer>
  </div>`;

/** A página viva onde o drawer mora, com o mínimo que o custom element exige. */
function montaPaginaViva({ comSectionId = true } = {}) {
    const drawer = `
    <cart-drawer>
      <div id="minicart-overlay"></div>
      <div id="cart-empty" class="flex"></div>
      <div id="cart-container" class="hidden">
        <div id="cart-drawer-items">${DO_DRAWER}</div>
      </div>
    </cart-drawer>`;

    document.body.innerHTML = `
    <a id="minicart-button"><span id="qtd-bubble" class="hidden">0</span></a>
    ${comSectionId ? `<div data-section-id="cart-drawer">${drawer}</div>` : drawer}`;
}

/** Um fetch que registra a URL pedida e devolve o fragmento. */
function servidorQueDevolve(corpo) {
    return vi.fn().mockResolvedValue({ text: async () => corpo });
}

beforeEach(() => {
    // `<add-to-cart>` pergunta a largura da tela no construtor para escolher o
    // rótulo do botão; o jsdom não traz `matchMedia`.
    installMatchMedia(false);
    globalThis.routes = { cart_url: '/cart' };
    montaPaginaViva();
});

describe('a origem e o destino não se confundem', () => {
    it('o drawer recebe os itens DO SERVIDOR, não os que já tinha', async () => {
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        const destino = document.querySelector('#cart-drawer-items');
        expect(destino.innerHTML).toContain('do-servidor');
        // A metade que pega o defeito: lendo a origem no documento VIVO em vez
        // do baixado, o drawer copia a si mesmo e isto continua aqui.
        expect(destino.innerHTML).not.toContain('do-drawer');
    });

    it('a página do carrinho nunca é o destino', async () => {
        // Se origem e destino trocassem de papel, o drawer ficaria intacto e
        // quem mudaria seria a página — e ninguém notaria, porque a página vai
        // ser recarregada de qualquer jeito.
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());
        document.body.insertAdjacentHTML(
            'beforeend',
            `<div data-cart-page><div id="cart-items-container">${DA_PAGINA}</div></div>`,
        );

        await new AddToCart().updateCartDrawer();

        expect(document.querySelector('#cart-items-container').innerHTML).toBe(DA_PAGINA);
    });

    it('os índices são recalculados depois da troca', async () => {
        // `removeItem` e `updateItemTotalPrice` encontram a linha por
        // `[data-index]`. Sem o recálculo, o markup novo chega sem o atributo e
        // o primeiro clique em remover não acha nada — silenciosamente.
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        const item = document.querySelector('#cart-drawer-items .cart-item');
        expect(item.getAttribute('data-index')).toBe('1');
    });
});

describe('o pedido é o fragmento da section, não a página', () => {
    it('a URL carrega section_id', async () => {
        // É o ponto da #117. Sem o parâmetro, a resposta volta a ser a página
        // inteira e o teste acima passaria igual — o ganho é no que trafega,
        // e o que trafega só aparece na URL.
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        expect(globalThis.fetch).toHaveBeenCalledWith('/cart?section_id=cart-drawer');
    });

    it('o id vem do Liquid, não está cravado no JS', async () => {
        // Se estivesse cravado, renomear a section quebraria em produção com o
        // teste verde. Aqui o Liquid diz outro nome e o JS tem que obedecer.
        document.querySelector('[data-section-id]').dataset.sectionId = 'outro-nome';
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        expect(globalThis.fetch).toHaveBeenCalledWith('/cart?section_id=outro-nome');
    });

    it('a rota vem de window.routes', async () => {
        // A regra `boundaries` existe por isto: loja com locale no caminho
        // (`/pt-br/cart`) quebra com `/cart` cravado.
        globalThis.routes = { cart_url: '/pt-br/cart' };
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        expect(globalThis.fetch).toHaveBeenCalledWith('/pt-br/cart?section_id=cart-drawer');
    });
});

describe('quando não há o que copiar, nada quebra', () => {
    it('resposta sem o container: o drawer fica como está, sem TypeError', async () => {
        // O Liquid renderiza `#cart-drawer-items` SEMPRE — o carrinho vazio
        // muda só as classes de `#cart-empty` e `#cart-container`, e quem
        // alterna as duas é `updateQtdBubble`, não este método. Então a guarda
        // não é para o carrinho vazio: é para a resposta que chega sem o
        // markup esperado (a Shopify devolvendo erro, uma section renomeada,
        // um app de terceiro no meio). Sem ela, um `innerHTML` em `null`.
        globalThis.fetch = servidorQueDevolve('<div data-section-id="cart-drawer">vazio</div>');

        await expect(new AddToCart().updateCartDrawer()).resolves.not.toThrow();
        expect(document.querySelector('#cart-drawer-items').innerHTML).toBe(DO_DRAWER);
    });

    it('sem data-section-id no documento, não pede NADA', async () => {
        // A página de senha e o vale-presente usam outro layout, sem drawer.
        // Pedir `?section_id=undefined` traria erro 404 a cada adição — e
        // `fetch` sem o id traria a página inteira de volta, desfazendo a #117.
        montaPaginaViva({ comSectionId: false });
        globalThis.fetch = servidorQueDevolve(fragmentoDaSection());

        await new AddToCart().updateCartDrawer();

        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(document.querySelector('#cart-drawer-items').innerHTML).toBe(DO_DRAWER);
    });
});

describe('os dois lados do contrato estão no Liquid', () => {
    it.each([
        ['sections/cart-drawer.liquid', 'id="cart-drawer-items"', 'o destino, dentro do drawer'],
        ['sections/cart-drawer.liquid', 'data-section-id="{{ section.id }}"', 'o id que o JS lê'],
        ['layout/theme.liquid', "{% section 'cart-drawer' %}", 'o drawer é section, não snippet'],
        ['sections/main-cart.liquid', 'id="cart-items-container"', 'a origem, na página'],
    ])('%s emite %s — %s', async (arquivo, gancho) => {
        // Sem isto, renomear um id no Liquid deixaria os testes acima verdes
        // (eles montam a própria DOM) com o tema quebrado na loja.
        const { readFileSync } = await import('node:fs');
        expect(readFileSync(arquivo, 'utf8')).toContain(gancho);
    });

    it('os dois ids são diferentes — é disso que o defeito era feito', async () => {
        const { readFileSync } = await import('node:fs');
        const drawer = readFileSync('sections/cart-drawer.liquid', 'utf8');
        expect(drawer).not.toContain('id="cart-items-container"');
    });
});
