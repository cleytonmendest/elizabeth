/**
 * A regra `neutra` consegue reprovar?
 *
 * Ela nasce para manter verdadeiras duas frases do ADR 0018 sobre a `main`:
 * o conteúdo não aponta recurso de loja, e a home usa toda section que pode
 * entrar numa home. Quando a regra foi escrita, a `main` violava as duas em
 * 51 pontos. Os defeitos plantados aqui estão no formato exato em que estavam
 * lá: a foto do banner, a coleção "new-in", o menu "menu-principal", o logo
 * nos presets, o app embed do Discounty.
 *
 * E o outro lado também é plantado: o que toda loja tem (os menus que a
 * Shopify cria com ela, um link relativo, um campo vazio) não pode reprovar.
 * Uma regra que reprova o correto é desligada, e aí não verifica mais nada.
 */
import { describe, it, expect } from 'vitest';
import {
  FORA_DA_HOME,
  IDENTIDADE_DA_LOJA,
  MENUS_DE_TODA_LOJA,
  apontaRecursoDeLoja,
  contabilidadeDaHome,
  enderecosDeLoja,
  podeIrNaHome,
  recursosDeLoja,
  recursosDoArquivo,
  run,
} from '../scripts/lint/rules/neutra.mjs';

const SCHEMAS = {
  'slider-image': {
    settings: [{ id: 'color_scheme', type: 'color_scheme' }],
    blocks: [
      {
        type: 'test',
        settings: [
          { id: 'link', type: 'url' },
          { id: 'imgDesktop', type: 'image_picker' },
          { id: 'heading', type: 'text' },
        ],
      },
    ],
  },
  'featured-collection': {
    settings: [
      { id: 'collection', type: 'collection' },
      { id: 'title', type: 'text' },
    ],
  },
  header: { settings: [{ id: 'menu', type: 'link_list' }] },
  footer: { blocks: [{ type: 'links', settings: [{ id: 'linklist', type: 'link_list' }] }] },
  'highlighted-product': { settings: [{ id: 'product', type: 'product' }] },
  // Um setting de TEXTO chamado "collection": o tipo vem do schema, não do nome.
  'rich-text': { settings: [{ id: 'collection', type: 'text' }] },
};
const schemaDe = (tipo) => SCHEMAS[tipo];

const codigos = (achados) => achados.map((a) => a.code).sort();

describe('recurso de loja no conteúdo da main', () => {
  it('a foto do banner, como estava no index.json', () => {
    const home = {
      sections: {
        slider_image_9WNq4K: {
          type: 'slider-image',
          blocks: {
            test_eTDrLU: {
              type: 'test',
              settings: { imgDesktop: 'shopify://shop_images/Banner_1_desktop.png', heading: 'Nova coleção' },
            },
          },
        },
      },
    };
    expect(codigos(recursosDeLoja(home, { schemaDe }))).toEqual([
      'shopify:sections.slider_image_9WNq4K.blocks.test_eTDrLU.settings.imgDesktop',
    ]);
  });

  it('o link para uma coleção da loja, que é url e também é `shopify://`', () => {
    const home = {
      sections: {
        s: { type: 'slider-image', blocks: { b: { type: 'test', settings: { link: 'shopify://collections/calcas' } } } },
      },
    };
    expect(recursosDeLoja(home, { schemaDe })).toHaveLength(1);
  });

  it('a coleção "new-in": handle sem `shopify://`, que numa loja nova aponta o nada', () => {
    const home = { sections: { f: { type: 'featured-collection', settings: { collection: 'new-in' } } } };
    expect(codigos(recursosDeLoja(home, { schemaDe }))).toEqual(['collection:sections.f.settings.collection']);
  });

  it('o produto escolhido, pelo handle', () => {
    const home = { sections: { p: { type: 'highlighted-product', settings: { product: 'camisa-social' } } } };
    expect(recursosDeLoja(home, { schemaDe })).toHaveLength(1);
  });

  it('o menu "menu-principal" do cabeçalho e os do rodapé', () => {
    const cabecalho = { sections: { header: { type: 'header', settings: { menu: 'menu-principal' } } } };
    expect(codigos(recursosDeLoja(cabecalho, { schemaDe }))).toEqual(['link_list:sections.header.settings.menu']);

    const rodape = {
      sections: {
        footer: {
          type: 'footer',
          blocks: { l: { type: 'links', settings: { linklist: 'institucional' } } },
        },
      },
    };
    expect(recursosDeLoja(rodape, { schemaDe })).toHaveLength(1);
  });

  it('os menus que a Shopify cria com toda loja passam', () => {
    expect(MENUS_DE_TODA_LOJA).toEqual(['main-menu', 'footer']);
    for (const menu of MENUS_DE_TODA_LOJA) {
      const grupo = {
        sections: {
          header: { type: 'header', settings: { menu } },
          footer: { type: 'footer', blocks: { l: { type: 'links', settings: { linklist: menu } } } },
        },
      };
      expect(recursosDeLoja(grupo, { schemaDe })).toEqual([]);
    }
  });

  it('campo vazio, link relativo e texto passam', () => {
    const home = {
      sections: {
        s: {
          type: 'slider-image',
          blocks: { b: { type: 'test', settings: { link: '/collections/all', imgDesktop: '', heading: 'Olá' } } },
        },
        f: { type: 'featured-collection', settings: { collection: '', title: 'new-in' } },
        r: { type: 'rich-text', settings: { collection: 'new-in' } },
      },
    };
    expect(recursosDeLoja(home, { schemaDe })).toEqual([]);
  });

  it('o logo, o favicon e o app embed do settings_data, no current e nos presets', () => {
    const settingsSchema = [
      { name: 'theme_info' },
      {
        name: 'logo',
        settings: [
          { id: 'logo', type: 'image_picker' },
          { id: 'favicon', type: 'image_picker' },
        ],
      },
      { name: 'cart', settings: [{ id: 'free_shipping_collection', type: 'collection' }] },
    ];
    const settingsData = {
      current: {
        logo: 'shopify://shop_images/logo.png',
        blocks: {
          '14826766009936288847': { type: 'shopify://apps/discounty/blocks/sdk/d65eb522', disabled: false },
        },
      },
      presets: {
        Noir: { favicon: 'shopify://shop_images/favicon.png', free_shipping_collection: 'promo' },
      },
    };
    expect(codigos(recursosDeLoja(settingsData, { settingsSchema }))).toEqual([
      'collection:presets.Noir.free_shipping_collection',
      'shopify:current.blocks.14826766009936288847.type',
      'shopify:current.logo',
      'shopify:presets.Noir.favicon',
    ]);
  });

  it('o logotipo em SVG, que não é `shopify://` e é a loja do mesmo jeito', () => {
    const settingsSchema = [{ name: 'logo', settings: [{ id: 'logo_svg', type: 'html' }] }];
    const svg = '<svg viewbox="0 0 400 111"><path d="M351.869 81.1982"/></svg>';
    const settingsData = { current: { logo_svg: svg }, presets: { Rosé: { logo_svg: svg } } };
    expect(codigos(recursosDeLoja(settingsData, { settingsSchema }))).toEqual([
      'identidade:current.logo_svg',
      'identidade:presets.Rosé.logo_svg',
    ]);
  });

  it('o logo `shopify://` sai uma vez só, e não duas', () => {
    const settingsSchema = [{ name: 'logo', settings: [{ id: 'logo', type: 'image_picker' }] }];
    const settingsData = { current: { logo: 'shopify://shop_images/logo.png' } };
    expect(codigos(recursosDeLoja(settingsData, { settingsSchema }))).toEqual(['shopify:current.logo']);
  });

  it('a identidade só vale no settings_data: um `logo` de section é outra coisa', () => {
    const home = { sections: { s: { type: 'rich-text', settings: { logo_svg: '<svg/>' } } } };
    expect(recursosDeLoja(home, { schemaDe })).toEqual([]);
  });

  it('o settings_data neutro passa', () => {
    expect(IDENTIDADE_DA_LOJA).toEqual(['logo', 'logo_svg', 'favicon']);
    const settingsSchema = [{ name: 'logo', settings: [{ id: 'logo', type: 'image_picker' }] }];
    const neutro = { logo: '', logo_svg: '', logo_width: 200 };
    expect(recursosDeLoja({ current: neutro, presets: { Noir: {} } }, { settingsSchema })).toEqual([]);
  });

  it('acha `shopify://` em qualquer profundidade', () => {
    expect(enderecosDeLoja({ a: [{ b: 'shopify://x' }], c: 'https://exemplo.com', d: 3 })).toEqual([
      { caminho: 'a.0.b', valor: 'shopify://x' },
    ]);
  });

  it('e dentro do texto rico, onde o editor grava o link no meio do HTML', () => {
    const texto = '<p>Veja a <a href="shopify://collections/calcas" title="Calças">coleção</a></p>';
    const achados = recursosDeLoja({ sections: { r: { type: 'rich-text', settings: { text: texto } } } });
    expect(codigos(achados)).toEqual(['shopify:sections.r.settings.text']);
    expect(achados[0].message).toContain('aponta shopify://collections/calcas, que');
  });

  it('o tipo decide, campo por campo', () => {
    expect(apontaRecursoDeLoja('collection', 'new-in')).toBe(true);
    expect(apontaRecursoDeLoja('product_list', ['a'])).toBe(true);
    expect(apontaRecursoDeLoja('product_list', [])).toBe(false);
    expect(apontaRecursoDeLoja('blog', 'news')).toBe(true);
    expect(apontaRecursoDeLoja('text', 'new-in')).toBe(false);
    expect(apontaRecursoDeLoja(undefined, 'new-in')).toBe(false);
    expect(apontaRecursoDeLoja('link_list', 'menu-principal')).toBe(true);
    expect(apontaRecursoDeLoja('link_list', 'main-menu')).toBe(false);
    expect(apontaRecursoDeLoja('collection', null)).toBe(false);
  });
});

describe('pode ir na home?', () => {
  const preset = [{ name: 'x' }];

  it('sem preset, o editor não a oferece', () => {
    expect(podeIrNaHome({})).toBe(false);
    expect(podeIrNaHome({ presets: [] })).toBe(false);
  });

  it('com preset e sem restrição, pode', () => {
    expect(podeIrNaHome({ presets: preset })).toBe(true);
  });

  it('`disabled_on` só de grupos não a barra da home', () => {
    expect(podeIrNaHome({ presets: preset, disabled_on: { groups: ['header', 'footer'] } })).toBe(true);
  });

  it('`disabled_on` do index, ou de todo template, barra', () => {
    expect(podeIrNaHome({ presets: preset, disabled_on: { templates: ['index'] } })).toBe(false);
    expect(podeIrNaHome({ presets: preset, disabled_on: { templates: ['*'] } })).toBe(false);
  });

  it('`enabled_on` de outro template barra: as recomendações de produto', () => {
    expect(podeIrNaHome({ presets: preset, enabled_on: { templates: ['product'] } })).toBe(false);
  });

  it('`enabled_on` só de grupos barra: a section é do grupo, não de template', () => {
    expect(podeIrNaHome({ presets: preset, enabled_on: { groups: ['header'] } })).toBe(false);
  });

  it('`enabled_on` do index, ou de todo template, deixa', () => {
    expect(podeIrNaHome({ presets: preset, enabled_on: { templates: ['index', 'product'] } })).toBe(true);
    expect(podeIrNaHome({ presets: preset, enabled_on: { templates: ['*'] } })).toBe(true);
  });
});

describe('a contabilidade da home', () => {
  const motivo = 'um motivo de verdade, escrito por extenso';

  it('section que pode ir na home e não está nela, nem na lista, reprova', () => {
    const conta = contabilidadeDaHome({ elegiveis: ['video', 'rich-text'], usadas: ['rich-text'], foraDaHome: {} });
    expect(conta.esquecidas).toEqual(['video']);
  });

  it('a que está na lista, com motivo, passa', () => {
    const conta = contabilidadeDaHome({ elegiveis: ['apps'], usadas: [], foraDaHome: { apps: motivo } });
    expect(conta).toEqual({ esquecidas: [], naHomeENaLista: [], quePodemIr: [], semMotivo: [] });
  });

  it('a que está na home e na lista ao mesmo tempo reprova: a lista venceu', () => {
    const conta = contabilidadeDaHome({ elegiveis: ['apps'], usadas: ['apps'], foraDaHome: { apps: motivo } });
    expect(conta.naHomeENaLista).toEqual(['apps']);
  });

  it('a que está na lista e não pode ir na home reprova: renomeada, apagada ou barrada', () => {
    const conta = contabilidadeDaHome({ elegiveis: [], usadas: [], foraDaHome: { 'nao-existe': motivo } });
    expect(conta.quePodemIr).toEqual(['nao-existe']);
  });

  it('motivo vazio, ou de uma palavra, reprova', () => {
    const conta = contabilidadeDaHome({
      elegiveis: ['a', 'b'],
      usadas: [],
      foraDaHome: { a: '', b: 'feio' },
    });
    expect(conta.semMotivo).toEqual(['a', 'b']);
  });

  it('todo motivo da lista real tem pelo menos uma frase', () => {
    for (const [tipo, texto] of Object.entries(FORA_DA_HOME)) {
      expect(texto.length, tipo).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('cada arquivo com a sua leitura', () => {
  const settingsSchema = [{ name: 'logo', settings: [{ id: 'logo_svg', type: 'html' }] }];
  const svg = '<svg viewbox="0 0 400 111"></svg>';

  it('o settings_data é lido pelo schema global, e a identidade da loja aparece', () => {
    const achados = recursosDoArquivo('config/settings_data.json', { current: { logo_svg: svg } }, {
      schemaDe,
      settingsSchema,
    });
    expect(codigos(achados)).toEqual(['identidade:current.logo_svg']);
  });

  it('um template é lido pelo schema das sections, e não pelo global', () => {
    const home = { sections: { f: { type: 'featured-collection', settings: { collection: 'new-in' } } } };
    const achados = recursosDoArquivo('templates/index.json', home, { schemaDe, settingsSchema });
    expect(codigos(achados)).toEqual(['collection:sections.f.settings.collection']);
  });
});

describe('a main de hoje', () => {
  // A regra roda no disco. Sem este teste, um defeito no `run()` (o grupo do
  // cabeçalho fora da conta, o settings_data lido como template) só
  // apareceria no `npm run lint`, e nenhum mutante o pegaria.
  it('não aponta recurso de loja, e a home usa toda section que pode', () => {
    expect(run().map((o) => `${o.file}: ${o.code}`)).toEqual([]);
  });
});
