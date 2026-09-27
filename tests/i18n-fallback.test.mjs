/**
 * Modo 6 da regra `i18n`: setting que nasce preenchido na frente de um texto
 * traduzido.
 *
 * O botão de compra da PDP tinha o padrão certo no Liquid — o texto da lojista
 * quando ela escreve um, `'product.general.add_to_cart' | t` quando o campo
 * está vazio —, e o campo nascia com "ADICIONAR AO CARRINHO". O `else` nunca
 * rodava, e a loja em inglês mostrava o botão em português. Nenhuma regra via:
 * o `default` de setting é conteúdo da lojista, e texto literal ali é o
 * correto… exceto quando o próprio Liquid já tem a tradução para o vazio.
 *
 * O tema de verdade, corrigido, não tem mais ocorrência. Por isso o caminho que
 * acusa é exercitado aqui, num tema de mentira.
 */
import { describe, it, expect } from 'vitest';
import { fallbacksPreenchidos, arquivosDoTema } from '../scripts/lint/rules/i18n.mjs';

const BOTAO = `
<button>
  {%- if block.settings.button_text != blank -%}{{ block.settings.button_text }}{%- else -%}{{ 'product.general.add_to_cart' | t }}{%- endif -%}
</button>`;

const schema = (json) => `{% schema %}${JSON.stringify(json)}{% endschema %}`;

const blocoDeCompra = (setting) => ({
  blocks: [{ type: 'buy_button', settings: [{ type: 'text', id: 'button_text', label: 't:x', ...setting }] }],
});

/** A PDP em miniatura: section → snippet intermediário → snippet do botão. */
function tema({ setting = {}, template, liquidDoBotao = BOTAO, presets } = {}) {
  const arquivos = new Map([
    ['sections/main-product.liquid', `{% render 'main-product-right' %}${schema({ ...blocoDeCompra(setting), presets })}`],
    ['snippets/main-product-right.liquid', "{%- render 'add-to-cart', block: block -%}"],
    ['snippets/add-to-cart.liquid', liquidDoBotao],
    ['sections/outra.liquid', schema(blocoDeCompra({ default: 'Texto da lojista' }))],
  ]);
  if (template) arquivos.set('templates/product.json', JSON.stringify(template));
  return arquivos;
}

const codigos = (arquivos) => fallbacksPreenchidos(arquivos).map((o) => `${o.file}|${o.code}`);

const templateCom = (valor) => ({
  sections: { main: { type: 'main-product', blocks: { b1: { type: 'buy_button', settings: { button_text: valor } } } } },
  order: ['main'],
});

describe('acusa o campo que nasce preenchido', () => {
  it('`default` literal no schema da section, dois `render` acima do snippet que lê', () => {
    expect(codigos(tema({ setting: { default: 'ADICIONAR AO CARRINHO' } }))).toEqual([
      'sections/main-product.liquid|fallback-preenchido:buy_button.button_text',
    ]);
  });

  it('valor salvo no template que o tema entrega', () => {
    expect(codigos(tema({ template: templateCom('ADICIONAR AO CARRINHO') }))).toEqual([
      'templates/product.json|fallback-salvo:main-product.buy_button.button_text',
    ]);
  });

  it('preset que preenche o bloco', () => {
    const presets = [{ name: 'Produto', blocks: [{ type: 'buy_button', settings: { button_text: 'COMPRAR' } }] }];
    expect(codigos(tema({ presets }))).toEqual([
      'sections/main-product.liquid|fallback-preenchido:preset.buy_button.button_text',
    ]);
  });

  it('setting de section, lido na própria section', () => {
    const arquivos = new Map([
      [
        'sections/main-404.liquid',
        "{% if section.settings.button_label != blank %}{{ section.settings.button_label }}{% else %}{{ 'general.404.back_home' | t }}{% endif %}" +
          schema({ settings: [{ type: 'text', id: 'button_label', label: 't:x', default: 'Voltar à página inicial' }] }),
      ],
    ]);
    expect(codigos(arquivos)).toEqual(['sections/main-404.liquid|fallback-preenchido:button_label']);
  });

  it('a mensagem diz de onde vem a tradução que ficou inalcançável', () => {
    const [ofensa] = fallbacksPreenchidos(tema({ setting: { default: 'ADICIONAR AO CARRINHO' } }));
    expect(ofensa.message).toContain("'product.general.add_to_cart' | t");
    expect(ofensa.message).toContain('snippets/add-to-cart.liquid');
  });
});

describe('não acusa', () => {
  it('o campo vazio — o jeito certo, como o `checkout_label` do carrinho', () => {
    expect(codigos(tema({ template: templateCom('') }))).toEqual([]);
  });

  it('`default` literal quando o Liquid NÃO tem tradução para o vazio: aí o texto é conteúdo da lojista', () => {
    const semTraducao = "{{ block.settings.button_text | default: block.settings.outro }}";
    expect(codigos(tema({ setting: { default: 'COMPRAR' }, liquidDoBotao: semTraducao }))).toEqual([]);
  });

  it('section que declara um setting homônimo mas não renderiza o snippet', () => {
    // `sections/outra.liquid` tem `button_text` com default e não chega ao botão.
    expect(codigos(tema())).toEqual([]);
  });

  it('o tema de verdade, depois da correção', () => {
    expect(codigos(arquivosDoTema())).toEqual([]);
  });
});
