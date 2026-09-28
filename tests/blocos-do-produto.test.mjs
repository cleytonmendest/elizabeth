// @vitest-environment node
//
// Sem DOM: o que se mede aqui é o schema contra o `case block.type`, e o
// Liquid dos ramos novos, que quem executa é o `liquidjs`.

/**
 * O que o editor oferece é o que a section desenha — e vice-versa.
 *
 * ── O defeito que este arquivo trava ───────────────────────────────────────
 *
 * Até a #133, `snippets/main-product-right.liquid` e
 * `sections/highlighted-product.liquid` tinham um ramo `when '@app'`, e nenhum
 * dos dois schemas declarava `{"type": "@app"}`. O render existia; o editor
 * não oferecia a aba "Apps" em "Adicionar bloco". O ramo era código que nada
 * alcançava, e a coluna de compra — onde app de avaliação, de assinatura e de
 * tabela de medidas precisa entrar — não aceitava app nenhum.
 *
 * Nenhum verificador via, porque a pergunta nunca tinha sido feita nos dois
 * sentidos. A `refs` confere que o que é referenciado existe; aqui é o
 * inverso. Então este arquivo cruza as duas listas:
 *
 *   `when` sem bloco declarado   → ramo morto (o defeito da #133)
 *   bloco declarado sem `when`   → a lojista adiciona e nada aparece
 *
 * O cruzamento cobre toda section que despacha por `case block.type`, no
 * próprio arquivo ou num snippet que recebe `section.blocks`. A section nova
 * que nascer assim entra sozinha.
 *
 * ── E o requisito, que o cruzamento sozinho não prende ─────────────────────
 *
 * Tirar o `@app` do schema E do `case` deixaria as duas listas concordando —
 * e a loja de volta sem app block. A Theme Store exige `@app` e um bloco de
 * Liquid personalizado na seção principal do produto e na de produto em
 * destaque (#133, #145). Isso é requisito, não preferência, e por isso é uma
 * lista escrita.
 */
import { describe, it, expect } from 'vitest';
import { Liquid } from 'liquidjs';
import { extractSchema, list, read, stripInert } from '../scripts/lint/lib.mjs';

/** As tags `case`/`when`/`endcase` de um fonte, na ordem. */
const TAG = /\{%-?\s*(case|when|endcase)\b([^%]*?)-?%\}/g;

/** Os tipos que os `when` de todo `case block.type` do fonte despacham. */
function despachados(fonte) {
  const tipos = new Set();
  let profundidade = 0;
  let dentro = null; // profundidade do `case block.type` em curso

  for (const [, tag, resto] of stripInert(fonte).matchAll(TAG)) {
    if (tag === 'case') {
      profundidade++;
      if (dentro === null && /^\s*block\.type\s*$/.test(resto)) dentro = profundidade;
    } else if (tag === 'endcase') {
      if (dentro === profundidade) dentro = null;
      profundidade--;
    } else if (dentro === profundidade) {
      for (const valor of resto.split(/,|\bor\b/)) {
        const tipo = valor.trim().replace(/^['"]|['"]$/g, '');
        if (tipo) tipos.add(tipo);
      }
    }
  }
  return tipos;
}

/** Os snippets que uma section chama entregando `section.blocks`. */
const snippetsDosBlocos = (fonte) =>
  [...stripInert(fonte).matchAll(/\{%-?\s*render\s+'([\w-]+)'[^%]*?section\.blocks/g)].map(
    ([, nome]) => `snippets/${nome}.liquid`,
  );

/** Cada section que despacha blocos por `case block.type`, com as duas listas. */
const DESPACHOS = list('sections')
  .map((secao) => {
    const fonte = read(secao);
    const schema = extractSchema(fonte)?.json;
    const arquivos = [secao, ...snippetsDosBlocos(fonte)].filter((a) =>
      /case\s+block\.type/.test(read(a)),
    );
    if (!schema || arquivos.length === 0) return null;

    const renderizados = new Set(arquivos.flatMap((a) => [...despachados(read(a))]));
    const declarados = new Set((schema.blocks ?? []).map((b) => b.type));
    return { secao, arquivos: arquivos.join(' + '), declarados, renderizados };
  })
  .filter(Boolean);

describe('o schema e o `case block.type` concordam', () => {
  it('há o que medir — senão este arquivo mede o vazio', () => {
    // Se o extrator parar de casar (o `case` mudou de forma, o snippet foi
    // renomeado), as duas asserções abaixo passam a percorrer lista vazia e
    // ficam verdes sem olhar nada.
    const secoes = DESPACHOS.map((d) => d.secao);
    expect(secoes).toContain('sections/main-product.liquid');
    expect(secoes).toContain('sections/highlighted-product.liquid');
    for (const { renderizados } of DESPACHOS) expect(renderizados.size).toBeGreaterThan(0);
  });

  it.each(DESPACHOS)('$secao: todo `when` é um bloco que o editor oferece', ({ arquivos, declarados, renderizados }) => {
    // O defeito da #133, exatamente como ele era: `when '@app'` em
    // main-product-right, e nenhum `@app` no schema de main-product.
    const mortos = [...renderizados].filter((tipo) => !declarados.has(tipo));
    expect(
      mortos,
      `${arquivos} desenha ${mortos.join(', ')}, que o schema não declara — o editor não oferece o bloco, e o ramo é código que nada alcança.`,
    ).toEqual([]);
  });

  it.each(DESPACHOS)('$secao: todo bloco que o editor oferece é desenhado', ({ arquivos, declarados, renderizados }) => {
    // A direção contrária: a lojista adiciona o bloco, configura, salva — e a
    // página não muda. Sem erro, sem aviso.
    const mudos = [...declarados].filter((tipo) => !renderizados.has(tipo));
    expect(
      mudos,
      `o schema declara ${mudos.join(', ')}, e ${arquivos} não tem \`when\` para ${mudos.length > 1 ? 'eles' : 'ele'}.`,
    ).toEqual([]);
  });
});

/**
 * A exigência da Theme Store ("Block and app block support requirements"):
 * app block e Liquid personalizado onde a cliente decide a compra.
 */
const EXIGIDOS = ['sections/main-product.liquid', 'sections/highlighted-product.liquid'].flatMap(
  (secao) => ['@app', 'custom_liquid'].map((tipo) => ({ secao, tipo })),
);

describe('a coluna de compra aceita app e Liquid da lojista', () => {
  it.each(EXIGIDOS)('$secao: $tipo é oferecido E desenhado', ({ secao, tipo }) => {
    const despacho = DESPACHOS.find((d) => d.secao === secao);
    expect(despacho, `${secao} deixou de despachar blocos por \`case block.type\``).toBeTruthy();
    expect(despacho.declarados.has(tipo), `o schema de ${secao} não declara "${tipo}"`).toBe(true);
    expect(despacho.renderizados.has(tipo), `${despacho.arquivos} não desenha "${tipo}"`).toBe(true);
  });
});

// ── O ramo `custom_liquid`, renderizado ────────────────────────────────────
//
// O `liquidjs` não é o Liquid da Shopify (ADR 0014): ele devolve o texto do
// setting `liquid` como está, sem avaliá-lo. O que se mede aqui não é a
// avaliação — é a decisão do tema em volta dela: preenchido aparece, marcado
// para o editor; vazio não deixa rastro. Só o ramo em teste é executado; os
// `render` dos outros ramos nunca são alcançados com um bloco só.

const semSchema = (arquivo) => read(arquivo).replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/, '');

const engine = new Liquid({
  // O único partial alcançado é a galeria do produto em destaque, que usa
  // filtros da Shopify. Ele não é o que está em teste — fica vazio.
  templates: { 'product-page-slider': '' },
});

const bloco = (valor) => ({
  type: 'custom_liquid',
  id: 'custom_1',
  shopify_attributes: 'data-shopify-editor-block="custom_1"',
  settings: { custom_liquid: valor },
});

const COLUNAS = [
  {
    nome: 'produto (main-product-right)',
    render: (blocks) =>
      engine.parseAndRenderSync(semSchema('snippets/main-product-right.liquid'), { blocks, section: { id: 'main' } }),
  },
  {
    nome: 'produto em destaque (highlighted-product)',
    render: (blocks) =>
      engine.parseAndRenderSync(semSchema('sections/highlighted-product.liquid'), {
        section: { id: 'destaque', blocks, settings: { product: { title: 'Vestido' }, color_scheme: 'scheme-1' } },
      }),
  },
];

/** O miolo da coluna, sem espaço: o que sobra é o que a cliente veria. */
const miolo = (html) => html.replace(/\s+/g, '');

describe.each(COLUNAS)('bloco Liquid personalizado na coluna do $nome', ({ render }) => {
  it('desenha o que a lojista escreveu, marcado para o editor', () => {
    const html = render([bloco('<p class="aviso">Pixel e metafield</p>')]);
    expect(html).toContain('<p class="aviso">Pixel e metafield</p>');
    // Sem o atributo, o editor não consegue destacar nem selecionar o bloco
    // na pré-visualização.
    expect(html).toMatch(/<div data-shopify-editor-block="custom_1">\s*<p class="aviso">/);
  });

  it.each([
    ['vazio', ''],
    ['nunca preenchido', undefined],
  ])('%s, não deixa rastro — nem o wrapper', (_caso, valor) => {
    // A coluna do produto é `flex flex-col gap-5`: um div vazio ali ainda é
    // item flex, e abre um vão de gap dos dois lados. Bloco recém-adicionado,
    // ainda sem conteúdo, não pode empurrar o botão de comprar.
    const vazio = miolo(render([]));
    expect(miolo(render([bloco(valor)]))).toBe(vazio);
  });
});

describe('a section Apps', () => {
  // O `{% render block %}` de um app block é da Shopify: aqui ele vira um
  // marcador, e o que se mede é a casca em volta dele.
  const secao = (blocks) =>
    engine.parseAndRenderSync(
      semSchema('sections/apps.liquid').replace(/\{%-?\s*render block\s*-?%\}/, '<div data-app="{{ block.type }}"></div>'),
      { section: { id: 'apps', blocks, settings: { color_scheme: 'scheme-1', padding_top: 24, padding_bottom: 24 } } }
    );

  it('sem app, não desenha nada — nem fundo, nem padding', () => {
    // Ela desenhava 48px de faixa vazia no topo da PDP, entre o cabeçalho e o
    // breadcrumb, em toda loja sem app de avaliações ou de assinatura.
    expect(secao([]).trim()).toBe('');
  });

  it('com app, o bloco fica dentro do esquema e do padding da section', () => {
    const html = secao([{ type: '@app', id: 'app_1' }]);
    expect(html).toContain('color-scheme-1 color-background color-text');
    expect(html).toContain('padding-top: 24px; padding-bottom: 24px;');
    expect(html).toContain('data-app="@app"');
  });
});

describe('a section Liquid personalizado', () => {
  const secao = (settings) =>
    engine.parseAndRenderSync(semSchema('sections/custom-liquid.liquid'), {
      section: {
        id: 'custom',
        settings: { color_scheme: 'scheme-3', padding_top: 40, padding_bottom: 24, ...settings },
      },
    });

  it.each([
    ['vazia', ''],
    ['nunca preenchida', undefined],
  ])('%s, não desenha nada — nem fundo, nem padding', (_caso, valor) => {
    // Section adicionada e ainda não preenchida abriria uma faixa colorida
    // vazia no meio da página.
    expect(secao({ custom_liquid: valor }).trim()).toBe('');
  });

  it('preenchida, o conteúdo fica sobre o fundo e o texto do esquema escolhido', () => {
    const html = secao({ custom_liquid: '<p>oi</p>' });
    // O portador do scheme pinta fundo E texto — pintar só o fundo deixaria o
    // texto da lojista na cor do esquema de fora (CLAUDE.md, princípio 1).
    const portador = html.match(/<div class="([^"]*color-scheme-3[^"]*)"/);
    expect(portador, 'o esquema escolhido não chegou ao markup').toBeTruthy();
    expect(portador[1].split(' ')).toEqual(expect.arrayContaining(['color-background', 'color-text']));
    expect(html).toContain('padding-top: 40px; padding-bottom: 24px;');
    expect(html).toContain('<p>oi</p>');
  });
});
