/**
 * assets/cart.js — <add-to-cart>: rótulo do botão e troca de variante.
 *
 * Este componente aparece em três markups diferentes, e a diferença entre eles
 * é justamente o que quase quebrou a vitrine:
 *
 *   snippets/add-to-cart.liquid         botão com os quatro data-text-*
 *   snippets/sticky-add-to-cart.liquid  idem, textos curto/longo diferentes
 *   snippets/card-quick-add.liquid      botão com SVG dentro e NENHUM data-text-*
 *
 * O terceiro é um `<add-to-cart>` legítimo. Escrever `textContent` nele apaga
 * o ícone. Todo teste aqui existe para manter essa distinção viva.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { installMatchMedia, textOf } from './helpers/dom.mjs';

loadAsset('cart.js');

let mql;

beforeEach(() => {
  mql = installMatchMedia(false); // desktop, salvo quando o teste disser o contrário
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Botão completo, como o `snippets/add-to-cart.liquid` renderiza. */
function montaPDP({ variantId = '42', texto = 'ADICIONAR AO CARRINHO', disabled = false } = {}) {
  document.body.innerHTML = `
    <div product-context>
      <add-to-cart>
        <form>
          <input type="hidden" name="id" value="${variantId}">
          <input class="hidden" type="number" name="quantity" value="1" min="1">
          <button
            type="submit"
            name="add"
            data-text-desktop="ADICIONAR AO CARRINHO"
            data-text-mobile="ADICIONAR"
            data-text-sold-out="ESGOTADO"
            data-text-unavailable="INDISPONÍVEL"
            ${disabled ? 'disabled' : ''}
          >${texto}</button>
        </form>
      </add-to-cart>
    </div>`;
  return {
    context: document.querySelector('[product-context]'),
    botao: document.querySelector('button[name="add"]'),
    input: document.querySelector('input[name="id"]'),
  };
}

/** Quick-add do card: ícone dentro do botão, nenhum data-text-*. */
function montaQuickAdd() {
  document.body.innerHTML = `
    <add-to-cart>
      <form>
        <input type="hidden" name="id" value="42">
        <input type="hidden" name="quantity" value="1">
        <button type="submit" name="add"><svg class="icon-cart"></svg> COMPRAR</button>
      </form>
    </add-to-cart>`;
  return { botao: document.querySelector('button[name="add"]') };
}

const trocaVariante = (context, variant) =>
  context.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));

describe('rótulo por largura de tela', () => {
  it('no desktop usa o texto longo', () => {
    const { botao } = montaPDP({ texto: 'placeholder' });
    expect(textOf(botao)).toBe('ADICIONAR AO CARRINHO');
  });

  it('no mobile usa o texto curto já no carregamento', () => {
    // O Liquid renderiza UM texto — ele não sabe a largura da tela. Sem o
    // ajuste no connectedCallback a barra fixa nasceria com o rótulo errado.
    mql = installMatchMedia(true);
    const { botao } = montaPDP({ texto: 'placeholder' });
    expect(textOf(botao)).toBe('ADICIONAR');
  });

  it('acompanha o resize nos dois sentidos', () => {
    const { botao } = montaPDP();

    mql.dispatch(true);
    expect(textOf(botao)).toBe('ADICIONAR');

    mql.dispatch(false);
    expect(textOf(botao)).toBe('ADICIONAR AO CARRINHO');
  });

  it('não reescreve botão desabilitado', () => {
    // Botão desabilitado mostra "ESGOTADO"; um resize não pode transformá-lo
    // de volta em "ADICIONAR AO CARRINHO" sem a variante ter mudado.
    // O `disabled` vem do servidor: o Liquid já renderiza o botão desativado
    // quando a variante inicial está esgotada.
    const { botao } = montaPDP({ texto: 'ESGOTADO', disabled: true });

    mql.dispatch(true);

    expect(textOf(botao)).toBe('ESGOTADO');
  });
});

describe('botão sem data-text-* (quick-add do card)', () => {
  it('preserva o ícone no carregamento', () => {
    // A regressão real: `_onResize()` no connectedCallback escrevia
    // textContent em TODO <add-to-cart>, apagando o SVG de cada card da
    // coleção e trocando o rótulo por um texto pt-BR cravado no JS.
    const { botao } = montaQuickAdd();

    expect(botao.querySelector('svg')).not.toBeNull();
    expect(textOf(botao)).toBe('COMPRAR');
  });

  it('preserva o ícone no resize', () => {
    const { botao } = montaQuickAdd();

    mql.dispatch(true);
    mql.dispatch(false);

    expect(botao.querySelector('svg')).not.toBeNull();
    expect(textOf(botao)).toBe('COMPRAR');
  });
});

describe('troca de variante', () => {
  it('variante disponível: atualiza o input e habilita o botão', () => {
    const { context, botao, input } = montaPDP({ variantId: '1', texto: 'ESGOTADO', disabled: true });

    trocaVariante(context, { id: 99, available: true });

    expect(input.value).toBe('99');
    expect(botao.disabled).toBe(false);
    expect(textOf(botao)).toBe('ADICIONAR AO CARRINHO');
  });

  it('variante esgotada: desabilita e usa o texto de esgotado', () => {
    const { context, botao, input } = montaPDP();

    trocaVariante(context, { id: 99, available: false });

    expect(input.value).toBe('99');
    expect(botao.disabled).toBe(true);
    expect(textOf(botao)).toBe('ESGOTADO');
  });

  it('combinação inexistente: limpa o input e usa o texto de indisponível', () => {
    // `variant` undefined é o que `variations-selector` manda quando a
    // combinação escolhida não existe. Sem limpar o input, o form ainda
    // levaria o id antigo para o carrinho.
    const { context, botao, input } = montaPDP();

    trocaVariante(context, undefined);

    expect(input.value).toBe('');
    expect(botao.disabled).toBe(true);
    expect(textOf(botao)).toBe('INDISPONÍVEL');
  });

  it('sem data-text-sold-out, mantém o texto do servidor em vez de cravar pt-BR', () => {
    // Todo texto vem do Liquid com o filtro `t`. Um fallback em português no
    // JS faria a loja em inglês mostrar "ESGOTADO".
    document.body.innerHTML = `
      <div product-context>
        <add-to-cart>
          <form>
            <input type="hidden" name="id" value="1">
            <button type="submit" name="add">Sold out</button>
          </form>
        </add-to-cart>
      </div>`;
    const context = document.querySelector('[product-context]');
    const botao = document.querySelector('button[name="add"]');

    trocaVariante(context, { id: 99, available: false });

    expect(botao.disabled).toBe(true);
    expect(textOf(botao)).toBe('Sold out');
  });

  it('a quantidade escolhida vai para o formulário', () => {
    const { context } = montaPDP();

    context.dispatchEvent(new CustomEvent('quantity:change', { detail: { quantity: 3 } }));

    expect(document.querySelector('input[name="quantity"]').value).toBe('3');
  });
});

describe('fora de um [product-context]', () => {
  it('avisa em vez de quebrar', () => {
    montaQuickAdd(); // sem [product-context] ao redor
    expect(console.warn).toHaveBeenCalledWith('AddToCart: product-context não encontrado.');
  });
});
