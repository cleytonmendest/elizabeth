// @vitest-environment node
/**
 * A regra `refs` consegue reprovar um bloco ou um setting que o código não tem?
 *
 * Até o ADR 0018 ela não conseguia, e isso foi medido: com
 * `templates/product.json` apontando um bloco `bloco_que_nao_existe` e um
 * setting `setting_que_nao_existe`, `npm run lint -- --rules=themecheck,refs,templates`
 * saía limpo. Só section inexistente reprovava.
 *
 * Com uma loja por branch, essa é a quebra mais provável: a `main` renomeia um
 * setting ou remove um bloco, e o JSON de uma `loja/*` continua apontando o
 * nome velho. Os defeitos plantados aqui são esses dois, no formato em que o
 * editor da Shopify os grava.
 */
import { describe, it, expect } from 'vitest';
import {
  ESTRUTURA_DO_SETTINGS_DATA,
  referenciasDoSettingsData,
  referenciasDoTemplate,
} from '../scripts/lint/rules/refs.mjs';

/** Um schema de section mínimo, no formato do `{% schema %}`. */
const SCHEMAS = {
  'main-product': {
    settings: [{ type: 'header', content: 'sem id' }, { type: 'checkbox', id: 'mostrar_zoom' }],
    blocks: [
      { type: 'title', name: 'Título', settings: [] },
      { type: 'price', name: 'Preço', settings: [{ type: 'checkbox', id: 'mostrar_parcelas' }] },
      { type: '@app' },
    ],
  },
  'rich-text': {
    settings: [{ type: 'text', id: 'heading' }],
    blocks: [{ type: 'text', settings: [{ type: 'richtext', id: 'text' }] }],
  },
  'sem-schema': null,
};

/** `undefined` = o arquivo não existe; `null` = existe, sem schema legível. */
const schemaDe = (tipo) => (tipo in SCHEMAS ? SCHEMAS[tipo] : undefined);

const produto = (mexe = (s) => s) => ({
  sections: {
    main: mexe({
      type: 'main-product',
      settings: { mostrar_zoom: true },
      blocks: {
        title_1: { type: 'title', settings: {} },
        price_1: { type: 'price', settings: { mostrar_parcelas: false } },
      },
      block_order: ['title_1', 'price_1'],
    }),
  },
  order: ['main'],
});

const codigos = (achados) => achados.map((a) => a.code);

describe('template que aponta só o que o código tem', () => {
  it('passa limpo', () => {
    expect(referenciasDoTemplate(produto(), schemaDe)).toEqual([]);
  });

  it('bloco de app passa quando a section aceita "@app"', () => {
    const json = produto((s) => ({
      ...s,
      blocks: { ...s.blocks, app_1: { type: 'shopify://apps/judge-me/blocks/review/abc', settings: {} } },
    }));
    expect(referenciasDoTemplate(json, schemaDe)).toEqual([]);
  });
});

describe('os dois defeitos medidos', () => {
  it('REPROVA o bloco que não existe no schema', () => {
    const json = produto((s) => ({
      ...s,
      blocks: { ...s.blocks, title_1: { type: 'bloco_que_nao_existe', settings: {} } },
    }));
    const achados = referenciasDoTemplate(json, schemaDe);

    expect(codigos(achados)).toEqual(['missing-block:main-product/bloco_que_nao_existe']);
    expect(achados[0].message).toContain('title_1');
    expect(achados[0].message).toContain('sections/main-product.liquid');
  });

  it('REPROVA o setting de bloco que não existe no schema', () => {
    const json = produto((s) => ({
      ...s,
      blocks: { ...s.blocks, price_1: { type: 'price', settings: { setting_que_nao_existe: true } } },
    }));
    expect(codigos(referenciasDoTemplate(json, schemaDe))).toEqual([
      'missing-block-setting:main-product/price.setting_que_nao_existe',
    ]);
  });

  it('REPROVA o setting de section renomeado: a loja guardou o nome velho', () => {
    // O caso que motivou o ADR 0018: a `main` renomeia `mostrar_zoom` e o JSON
    // da loja continua com a chave antiga. Sem erro, a loja perde o valor.
    const json = produto((s) => ({ ...s, settings: { zoom_antigo: true } }));
    const achados = referenciasDoTemplate(json, schemaDe);

    expect(codigos(achados)).toEqual(['missing-setting:main-product.zoom_antigo']);
    expect(achados[0].message).toContain('ignorado');
  });

  it('bloco de app numa section sem "@app" reprova', () => {
    const json = {
      sections: {
        texto: {
          type: 'rich-text',
          blocks: { app_1: { type: 'shopify://apps/x/blocks/y/z', settings: {} } },
        },
      },
    };
    expect(codigos(referenciasDoTemplate(json, schemaDe))).toEqual(['app-block-sem-app:rich-text']);
  });

  it('um bloco limpo não salva o vizinho quebrado', () => {
    const json = produto((s) => ({
      ...s,
      blocks: {
        ...s.blocks,
        velho: { type: 'removido', settings: {} },
      },
    }));
    expect(codigos(referenciasDoTemplate(json, schemaDe))).toEqual(['missing-block:main-product/removido']);
  });
});

describe('o que já existia continua igual', () => {
  it('section que não existe reprova com o código de antes', () => {
    const json = { sections: { x: { type: 'section-que-nao-existe' } } };
    expect(codigos(referenciasDoTemplate(json, schemaDe))).toEqual([
      'missing-section:section-que-nao-existe',
    ]);
  });

  it('section sem schema legível não gera ruído aqui — outra regra reprova isso', () => {
    const json = { sections: { x: { type: 'sem-schema', settings: { qualquer: 1 } } } };
    expect(referenciasDoTemplate(json, schemaDe)).toEqual([]);
  });

  it('JSON sem sections não explode', () => {
    expect(referenciasDoTemplate({}, schemaDe)).toEqual([]);
    expect(referenciasDoTemplate(null, schemaDe)).toEqual([]);
  });
});

describe('settings_data contra o settings_schema', () => {
  const schema = [
    { name: 'theme_info' },
    { name: 'Cores', settings: [{ type: 'color_scheme_group', id: 'color_schemes' }] },
    { name: 'Layout', settings: [{ type: 'header', content: 'x' }, { type: 'range', id: 'page_width' }] },
  ];

  it('os settings declarados e a estrutura da Shopify passam', () => {
    const dados = {
      current: { page_width: 1200, color_schemes: {}, content_for_index: [], blocks: {} },
      presets: { Elizabeth: { page_width: 1400, content_for_index: [] } },
    };
    expect(referenciasDoSettingsData(dados, schema)).toEqual([]);
  });

  it('REPROVA o setting global renomeado, no current e no preset', () => {
    const dados = {
      current: { largura_antiga: 1200 },
      presets: { Noir: { largura_antiga: 1400 } },
    };
    const achados = referenciasDoSettingsData(dados, schema);

    expect(codigos(achados)).toEqual([
      'missing-global-setting:largura_antiga',
      'missing-global-setting:largura_antiga',
    ]);
    expect(achados[1].message).toContain('Noir');
  });

  it('a estrutura aceita é só a que a Shopify grava', () => {
    // Uma lista que crescesse para silenciar um achado viraria um baseline
    // escrito à mão. São três chaves, e cada uma tem motivo no código.
    expect([...ESTRUTURA_DO_SETTINGS_DATA].sort()).toEqual(['blocks', 'content_for_index', 'sections']);
  });

  it('current como nome de preset (string) não explode', () => {
    expect(referenciasDoSettingsData({ current: 'Elizabeth' }, schema)).toEqual([]);
  });
});
