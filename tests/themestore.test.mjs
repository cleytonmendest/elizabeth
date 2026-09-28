/**
 * A regra `themestore` consegue acusar — e consegue ficar quieta?
 *
 * No repositório de hoje ela só percorre o caminho que acusa: os doze
 * requisitos estão ausentes. Uma varredura real nunca exercitaria o caminho
 * que CUMPRE, e é nele que os dois defeitos caros moram:
 *
 *   · um comentário cumprindo o requisito — `{% comment %}payment_button{%
 *     endcomment %}` e a regra verde com o botão ausente. A quarta forma de
 *     comentário da #106 é o precedente de que isso acontece;
 *   · o requisito cumprido num snippet e a regra sem ver, por ler um nível
 *     só — o defeito que fez a regra `budget` subir o teto três vezes.
 *
 * Por isso o disco é INJETADO: cada caso planta os arquivos de que precisa,
 * e a pergunta é sempre "o requisito aparece em markup ativo da árvore?".
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  ativo,
  contagem,
  expandir,
  padrao,
  run,
  validar,
  verificar,
} from '../scripts/lint/rules/themestore.mjs';
import { readConfig } from '../scripts/lint/exceptions.mjs';

/** Um "disco" de mentira: caminho → conteúdo. */
const discoDe = (arquivos) => ({
  ler: (arquivo) => {
    if (!(arquivo in arquivos)) throw new Error(`não existe: ${arquivo}`);
    return arquivos[arquivo];
  },
  listar: (dir) => Object.keys(arquivos).filter((arquivo) => path.posix.dirname(arquivo) === dir),
});

/** Uma tabela de uma linha só, válida — cada caso muda o que precisa. */
const linha = (verificacoes, extra = {}) => ({
  requisitos: [
    {
      id: 'checkout-acelerado',
      requisito: 'Botões de checkout acelerado',
      link: 'https://shopify.dev/docs/storefronts/themes/store/requirements',
      issue: 134,
      verificacoes,
      ...extra,
    },
  ],
});

const FORM = [{ onde: ['sections/main-product.liquid'], precisa: ['payment_button'] }];

const codigos = (tabela, arquivos) => verificar(tabela, discoDe(arquivos)).map((a) => a.code);

describe('o requisito precisa estar em markup ATIVO', () => {
  it('ausente: acusa, no arquivo de entrada', () => {
    const achados = verificar(linha(FORM), discoDe({ 'sections/main-product.liquid': '<form></form>' }));
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({
      rule: 'themestore',
      file: 'sections/main-product.liquid',
      code: 'checkout-acelerado:payment_button',
    });
    expect(achados[0].message).toContain('#134');
  });

  it('presente na própria section: cala', () => {
    const disco = { 'sections/main-product.liquid': '{% form "product" %}{{ form | payment_button }}{% endform %}' };
    expect(codigos(linha(FORM), disco)).toEqual([]);
  });

  it('dentro de {% comment %} NÃO cumpre', () => {
    const disco = {
      'sections/main-product.liquid': '{% comment %}{{ form | payment_button }}{% endcomment %}',
    };
    expect(codigos(linha(FORM), disco)).toEqual(['checkout-acelerado:payment_button']);
  });

  it.each([
    ['comentário de HTML', '<!-- {{ form | payment_button }} -->'],
    ['linha de # dentro de {% liquid %}', '{%- liquid\n  # payment_button\n  assign x = 1\n-%}'],
    ['tag de comentário inline {% # %}', '{% # payment_button %}'],
    ['o próprio {% schema %}', '{% schema %}{"name":"payment_button"}{% endschema %}'],
  ])('%s também não cumpre', (_, src) => {
    expect(codigos(linha(FORM), { 'sections/main-product.liquid': src })).toEqual([
      'checkout-acelerado:payment_button',
    ]);
  });
});

describe('a árvore: o que a section renderiza conta', () => {
  it('payment_button num snippet renderizado pelo form cumpre', () => {
    // O caso real: o form de produto mora em snippets/add-to-cart.liquid,
    // e é a section que o renderiza que está na tabela.
    const disco = {
      'sections/main-product.liquid': "{% render 'main-product-right', blocks: section.blocks %}",
      'snippets/main-product-right.liquid': "{%- render 'add-to-cart', product: product -%}",
      'snippets/add-to-cart.liquid': "{% form 'product', product %}{{ form | payment_button }}{% endform %}",
    };
    expect(codigos(linha(FORM), disco)).toEqual([]);
  });

  it('um {% render %} comentado não é seguido', () => {
    // O texto que a travessia lê já é o limpo. Sem isso, o snippet de um
    // render desligado cumpriria o requisito por uma porta dos fundos.
    const disco = {
      'sections/main-product.liquid': "{% comment %}{% render 'add-to-cart' %}{% endcomment %}",
      'snippets/add-to-cart.liquid': '{{ form | payment_button }}',
    };
    expect(codigos(linha(FORM), disco)).toEqual(['checkout-acelerado:payment_button']);
  });

  it('snippet de fora da árvore não cumpre', () => {
    // O outro lado: o requisito existir EM ALGUM LUGAR não basta. Um
    // payment_button num snippet que ninguém renderiza não chega à PDP.
    const disco = {
      'sections/main-product.liquid': '<form></form>',
      'snippets/add-to-cart.liquid': '{{ form | payment_button }}',
    };
    expect(codigos(linha(FORM), disco)).toEqual(['checkout-acelerado:payment_button']);
  });

  it('segue {% section %} também', () => {
    const disco = {
      'templates/customers/order.liquid': "{% section 'order-lines' %}",
      'sections/order-lines.liquid': '{{ line_item.unit_price | money }}',
    };
    const tabela = linha([{ onde: ['templates/customers/order.liquid'], precisa: ['unit_price'] }]);
    expect(codigos(tabela, disco)).toEqual([]);
  });

  it('dois alvos somam: basta aparecer em um deles', () => {
    const tabela = linha([
      {
        onde: ['sections/main-product.liquid', 'src/js/product-recommendations.js'],
        precisa: ['/intent[^\\n]{0,40}complementary/'],
      },
    ]);
    const disco = {
      'sections/main-product.liquid': '<product-recommendations></product-recommendations>',
      'src/js/product-recommendations.js': "url.searchParams.set('intent', 'complementary');",
    };
    expect(codigos(tabela, disco)).toEqual([]);
  });
});

describe('JS: comentário não é código', () => {
  const tabela = linha([{ onde: ['src/js/price-component.js'], precisa: ['unit_price'] }]);

  it('dentro de // ou /* */ não cumpre', () => {
    const disco = { 'src/js/price-component.js': '// TODO: unit_price\n/* unit_price */\nconst a = 1;' };
    expect(codigos(tabela, disco)).toEqual(['checkout-acelerado:unit_price']);
  });

  it('no código cumpre — e `//` dentro de uma string não apaga o resto da linha', () => {
    const disco = { 'src/js/price-component.js': "const u = 'https://x'; const p = variant.unit_price;" };
    expect(codigos(tabela, disco)).toEqual([]);
  });

  it('fonte que não parseia não conta como presença', () => {
    expect(ativo('src/js/x.js', 'unit_price (((')).toBe('');
  });
});

describe('o alvo que sumiu', () => {
  it('arquivo renomeado vira achado — nunca "passa porque não achou"', () => {
    const achados = verificar(linha(FORM), discoDe({ 'sections/produto.liquid': '{{ form | payment_button }}' }));
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({
      file: 'sections/main-product.liquid',
      code: 'checkout-acelerado:alvo',
    });
    // A mensagem diz QUAL linha da tabela perdeu o alvo.
    expect(achados[0].message).toContain('"checkout-acelerado"');
  });

  it('glob que não casa nada também', () => {
    const tabela = linha([{ onde: ['sections/*pickup*.liquid'], precisa: ['store_availabilities'] }]);
    expect(codigos(tabela, { 'sections/main-product.liquid': '' })).toEqual(['checkout-acelerado:alvo']);
  });

  it('glob que casa: procura em tudo que casou', () => {
    const tabela = linha([{ onde: ['sections/*pickup*.liquid'], precisa: ['store_availabilities'] }]);
    const disco = { 'sections/pickup-availability.liquid': '{% for a in variant.store_availabilities %}{% endfor %}' };
    expect(codigos(tabela, disco)).toEqual([]);
  });

  it('o glob só casa o nome, dentro do diretório', () => {
    const disco = {
      'sections/pickup.liquid': '',
      'sections/sub/pickup.liquid': '',
      'snippets/pickup.liquid': '',
    };
    expect(expandir('sections/*pickup*.liquid', discoDe(disco))).toEqual(['sections/pickup.liquid']);
  });
});

describe('o schema', () => {
  const APP = linha([{ onde: ['sections/main-product.liquid'], schema: { bloco: '@app' } }]);
  const LIQUID = linha([{ onde: ['sections/main-product.liquid'], schema: { setting: 'liquid' } }]);
  const comSchema = (json, markup = '') => ({
    'sections/main-product.liquid': `${markup}\n{% schema %}${JSON.stringify(json)}{% endschema %}`,
  });

  it('bloco @app declarado: cala', () => {
    expect(codigos(APP, comSchema({ blocks: [{ type: 'price' }, { type: '@app' }] }))).toEqual([]);
  });

  it('sem @app nos blocos: acusa — o `when` no markup não basta', () => {
    // O estado real da #133: o `case` renderiza `@app`, o schema não declara.
    const disco = comSchema({ blocks: [{ type: 'price' }] }, "{%- when '@app' -%}{% render block %}");
    expect(codigos(APP, disco)).toEqual(['checkout-acelerado:schema:bloco=@app']);
  });

  it('setting liquid num bloco: cala', () => {
    const json = { blocks: [{ type: 'custom_liquid', settings: [{ type: 'liquid', id: 'custom_liquid' }] }] };
    expect(codigos(LIQUID, comSchema(json))).toEqual([]);
  });

  it('sem setting liquid: acusa', () => {
    const json = { settings: [{ type: 'textarea', id: 'x' }], blocks: [{ type: 'text', settings: [] }] };
    expect(codigos(LIQUID, comSchema(json))).toEqual(['checkout-acelerado:schema:setting=liquid']);
  });

  it('schema inválido não cumpre', () => {
    const disco = { 'sections/main-product.liquid': '{% schema %}{ quebrado {% endschema %}' };
    expect(codigos(APP, disco)).toEqual(['checkout-acelerado:schema:bloco=@app']);
  });
});

describe('a tabela: linha sem fonte derruba a regra', () => {
  // Não é achado — achado de regra com catraca pode ir para o baseline, e uma
  // tabela quebrada não é dívida: é o verificador desarmado.
  it('linha sem link', () => {
    expect(() => validar(linha(FORM, { link: undefined }))).toThrow(/checkout-acelerado.*shopify\.dev/s);
  });

  it('link fora de shopify.dev', () => {
    expect(() => validar(linha(FORM, { link: 'https://example.com/requisitos' }))).toThrow(/shopify\.dev/);
  });

  it('linha sem issue', () => {
    expect(() => validar(linha(FORM, { issue: undefined }))).toThrow(/issue/);
  });

  it('verificação sem o que procurar', () => {
    expect(() => validar(linha([{ onde: ['sections/main-product.liquid'] }]))).toThrow(/precisa/);
  });

  it('padrão que não compila', () => {
    expect(() => validar(linha([{ onde: ['sections/x.liquid'], precisa: ['/(/'] }]))).toThrow(/não compila/);
  });

  it('tabela vazia', () => {
    expect(() => validar({ requisitos: [] })).toThrow(/vazio/);
  });

  it('e verificar() valida antes de procurar', () => {
    expect(() => verificar(linha(FORM, { issue: 0 }), discoDe({}))).toThrow(/issue/);
  });
});

describe('o padrão', () => {
  it('texto literal é literal — ponto não é curinga', () => {
    expect(padrao('search.filters')('searchXfilters')).toBe(false);
    expect(padrao('search.filters')('{% for f in search.filters %}')).toBe(true);
  });

  it('/…/ é regex', () => {
    expect(padrao('/name=["\']selling_plan["\']/')('<input name="selling_plan">')).toBe(true);
    expect(padrao('/name=["\']selling_plan["\']/')('selling_plan_groups')).toBe(false);
  });

  it('o laço de filtros não casa a chave de tradução da coleção', () => {
    const laco = padrao('/\\bfor\\s+\\w+\\s+in\\s+[\\w.]*filters\\b/');
    expect(laco("{{ 'collection.filters.title' | t }}")).toBe(false);
    expect(laco('{%- for filter in results.filters -%}')).toBe(true);
    expect(laco('{% for filter in search.filters %}')).toBe(true);
  });
});

describe('a tabela de verdade', () => {
  const tabela = readConfig('theme-store.json');

  it('passa na própria validação', () => {
    expect(() => validar(tabela)).not.toThrow();
  });

  it('a regra roda sobre o repositório e cada achado é de uma linha da tabela', () => {
    const ids = new Set(tabela.requisitos.map((l) => l.id));
    for (const achado of run()) {
      expect(ids).toContain(achado.code.split(':')[0]);
    }
  });

  it('a contagem do painel é por requisito, não por achado', () => {
    const { total, pendentes } = contagem(tabela, [
      { code: 'descontos:line_level_discount_allocations' },
      { code: 'descontos:cart_level_discount_applications' },
      { code: 'retirada:alvo' },
    ]);
    expect(total).toBe(tabela.requisitos.length);
    expect(pendentes.map((l) => l.id).sort()).toEqual(['descontos', 'retirada']);
  });
});
