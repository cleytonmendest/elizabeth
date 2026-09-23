/**
 * O mini-carrinho lê a fonte certa — e não a primeira que aparecer.
 *
 * ── O defeito, e por que ele era invisível ─────────────────────────────────
 *
 * `updateCartDrawer()` copia os itens da PÁGINA do carrinho para dentro do
 * DRAWER. Até a issue #68, os dois lados usavam o mesmo `id`:
 *
 *     snippets/cart-drawer.liquid   #cart-items-container
 *     sections/main-cart.liquid     #cart-items-container
 *
 * Dois elementos com o mesmo id no mesmo documento é HTML inválido, e
 * `querySelector` devolve o PRIMEIRO na ordem do documento. Hoje isso era o do
 * drawer, porque `layout/theme.liquid` renderiza `{% render 'cart-drawer' %}`
 * antes de `{{ content_for_layout }}`.
 *
 * Ou seja: funcionava por ORDENAÇÃO, não por desenho. Mover uma linha do
 * layout fazia o drawer copiar a página para dentro de si mesmo — sem erro no
 * console, sem aviso no lint e sem teste vermelho, porque os dois containers
 * renderizam o mesmo `cart-drawer-item` e só divergiriam depois.
 *
 * ── O que este arquivo prova ───────────────────────────────────────────────
 *
 * Que a escolha não depende mais da ordem. Cada caso monta os DOIS containers,
 * um em cada ordem, com conteúdos DIFERENTES — se fossem iguais, ler o errado
 * daria o mesmo resultado e o teste ficaria verde do mesmo jeito.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAsset, loadGlobalAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';

loadGlobalAsset('money.js', ['formatMoney']);
const { AddToCart } = loadAsset('cart.js', ['AddToCart']);

/** O que a página do carrinho devolve, e o que o drawer já tem na tela. */
const DA_PAGINA = '<div class="cart-item" data-key="da-pagina">item da página</div>';
const DO_DRAWER = '<div class="cart-item" data-key="do-drawer">item velho do drawer</div>';

/**
 * Monta o documento que o `fetch` devolve, com os dois containers na ordem
 * pedida. É o documento REAL: a página do carrinho vem dentro do layout, que
 * também renderiza o drawer.
 */
const documentoDoServidor = (ordem) => {
  const drawer = `<cart-drawer><div id="cart-drawer-items">${DO_DRAWER}</div></cart-drawer>`;
  const pagina = `<div data-cart-page><div id="cart-items-container">${DA_PAGINA}</div></div>`;
  return ordem === 'drawer-primeiro'
    ? `<html><body>${drawer}${pagina}</body></html>`
    : `<html><body>${pagina}${drawer}</body></html>`;
};

/** A página viva onde o drawer mora, com o mínimo que o custom element exige. */
function montaPaginaViva() {
  document.body.innerHTML = `
    <a id="minicart-button"><span id="qtd-bubble" class="hidden">0</span></a>
    <cart-drawer>
      <div id="minicart-overlay"></div>
      <div id="cart-empty" class="flex"></div>
      <div id="cart-container" class="hidden">
        <div id="cart-drawer-items">${DO_DRAWER}</div>
      </div>
    </cart-drawer>`;
}

beforeEach(() => {
  // `<add-to-cart>` pergunta a largura da tela no construtor para escolher o
  // rótulo do botão; o jsdom não traz `matchMedia`.
  installMatchMedia(false);
  globalThis.routes = { cart_url: '/cart' };
  montaPaginaViva();
});

describe('a origem e o destino não se confundem, em nenhuma ordem', () => {
  it.each(['drawer-primeiro', 'pagina-primeiro'])(
    'documento com o %s: o drawer recebe os itens DA PÁGINA',
    async (ordem) => {
      globalThis.fetch = vi.fn().mockResolvedValue({ text: async () => documentoDoServidor(ordem) });

      await new AddToCart().updateCartDrawer();

      const destino = document.querySelector('#cart-drawer-items');
      expect(destino.innerHTML).toContain('da-pagina');
      // A metade que pega o defeito: com o id repetido e o drawer primeiro, o
      // que entrava aqui era o conteúdo VELHO do próprio drawer.
      expect(destino.innerHTML).not.toContain('do-drawer');
    },
  );

  it('a página do carrinho nunca é o destino', async () => {
    // Se origem e destino trocassem de papel, o drawer ficaria intacto e quem
    // mudaria seria a página — e ninguém notaria, porque a página vai ser
    // recarregada de qualquer jeito.
    globalThis.fetch = vi.fn().mockResolvedValue({
      text: async () => documentoDoServidor('drawer-primeiro'),
    });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-cart-page><div id="cart-items-container">${DA_PAGINA}</div></div>`,
    );

    await new AddToCart().updateCartDrawer();

    expect(document.querySelector('#cart-items-container').innerHTML).toBe(DA_PAGINA);
  });
});

describe('a rota vem de window.routes, não de um literal', () => {
  it('usa routes.cart_url', async () => {
    // A regra `boundaries` existe por isto: loja com locale no caminho
    // (`/pt-br/cart`) quebra com `/cart` cravado.
    globalThis.routes = { cart_url: '/pt-br/cart' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      text: async () => documentoDoServidor('drawer-primeiro'),
    });

    await new AddToCart().updateCartDrawer();

    expect(globalThis.fetch).toHaveBeenCalledWith('/pt-br/cart');
  });
});

describe('quando não há o que copiar, nada quebra', () => {
  it('carrinho vazio: a página não renderiza o container, e o drawer fica como está', async () => {
    // `sections/main-cart.liquid` só renderiza `#cart-items-container` com
    // `cart.item_count > 0`. Sem a guarda, isto seria um TypeError no console
    // de toda primeira adição.
    globalThis.fetch = vi.fn().mockResolvedValue({
      text: async () => '<html><body><div data-cart-page>vazio</div></body></html>',
    });

    await expect(new AddToCart().updateCartDrawer()).resolves.not.toThrow();
    expect(document.querySelector('#cart-drawer-items').innerHTML).toBe(DO_DRAWER);
  });
});

describe('os dois lados do contrato estão no Liquid', () => {
  it.each([
    ['snippets/cart-drawer.liquid', 'id="cart-drawer-items"', 'o destino, dentro do drawer'],
    ['sections/main-cart.liquid', 'id="cart-items-container"', 'a origem, na página'],
  ])('%s emite %s — %s', async (arquivo, gancho) => {
    // Sem isto, renomear um id no Liquid deixaria os testes acima verdes
    // (eles montam a própria DOM) com o tema quebrado na loja.
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(arquivo, 'utf8')).toContain(gancho);
  });

  it('os dois ids são diferentes — é disso que o defeito era feito', async () => {
    const { readFileSync } = await import('node:fs');
    const drawer = readFileSync('snippets/cart-drawer.liquid', 'utf8');
    expect(drawer).not.toContain('id="cart-items-container"');
  });
});
