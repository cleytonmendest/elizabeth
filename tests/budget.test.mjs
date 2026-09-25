/**
 * O orçamento de performance mede a página inteira?
 *
 * Ele media `layout/theme.liquid` e mais nada. Enquanto todo asset global
 * estava escrito lá, dava no mesmo — e a #27 mostrou que não dava.
 *
 * Dois achados, um de cada lado:
 *
 *   · Ao mover `application.css` e `color-scheme.css` do layout para um
 *     snippet, o CSS medido caiu de 72 KB para 21 KB sem uma linha a menos
 *     chegar ao navegador. A regra ficou VERDE por ter deixado de olhar.
 *   · Ao passar a seguir os `{% render %}`, apareceram 24 KB que estavam em
 *     toda página desde sempre — `cart.js`, `cart-extras.js` e `cart.css`,
 *     que o snippet `cart-drawer` carrega e que o CLAUDE.md já documentava
 *     como globais. O teto tinha sido calibrado contra uma medição cega.
 *
 * Orçamento que subnotifica não avisa: ele parabeniza. Por isso o que se
 * verifica aqui não é "o número está certo hoje" — é que a busca ATRAVESSA
 * o snippet.
 */
import { describe, it, expect } from 'vitest';
import { fontesGlobais, tiposDoGrupo } from '../scripts/lint/rules/budget.mjs';

/** Um "disco" de mentira: caminho → conteúdo. */
const leitorDe = (arquivos) => (file) => {
  if (!(file in arquivos)) throw new Error(`não existe: ${file}`);
  return arquivos[file];
};

describe('o que o layout puxa em toda página', () => {
  it('o defeito original: asset que saiu do layout para um snippet', () => {
    const disco = {
      'layout/theme.liquid': "<head>{% render 'theme-styles' %}</head>",
      'snippets/theme-styles.liquid': "{{ 'application.css' | asset_url | stylesheet_tag }}",
    };

    const fontes = fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n');

    expect(fontes).toContain('application.css');
  });

  it('atravessa mais de um nível', () => {
    const disco = {
      'layout/theme.liquid': "{% render 'a' %}",
      'snippets/a.liquid': "{% render 'b' %}",
      'snippets/b.liquid': "<script src=\"{{ 'fundo.js' | asset_url }}\" defer></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).toContain('fundo.js');
  });

  it('aceita o hífen de whitespace do Liquid', () => {
    const disco = {
      'layout/theme.liquid': "{%- render 'cart-drawer' -%}",
      'snippets/cart-drawer.liquid': "<script src=\"{{ 'cart.js' | asset_url }}\"></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).toContain('cart.js');
  });

  it('ciclo entre snippets não trava a regra', () => {
    const disco = {
      'layout/theme.liquid': "{% render 'a' %}",
      'snippets/a.liquid': "{% render 'b' %}",
      'snippets/b.liquid': "{% render 'a' %}",
    };

    expect(() => fontesGlobais('layout/theme.liquid', leitorDe(disco))).not.toThrow();
  });

  it('snippet inexistente é ignorado, não derruba a medição', () => {
    const disco = {
      'layout/theme.liquid': "{% render 'fantasma' %}{{ 'x.css' | asset_url | stylesheet_tag }}",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).toContain('x.css');
  });

  /**
   * ── O que "global" quer dizer, e onde fica a fronteira ──────────────────
   *
   * O critério é o que o LAYOUT carrega, não o que uma section carrega. Isso
   * não é a mesma coisa que "section nunca conta": section que o layout
   * renderiza está em toda página, e o peso dela é global por definição.
   *
   * Este bloco existia afirmando o contrário — "`{% section %}` NÃO é
   * seguido" — e passava. Passava porque o fixture não trazia o JSON do
   * grupo: `tiposDoGrupo` devolvia lista vazia e nada era atravessado. O
   * teste media a AUSÊNCIA do arquivo e reportava uma decisão de desenho.
   *
   * Medido quando isto foi corrigido: `header.js` (1,7 KB) está em toda
   * página desde sempre e nunca apareceu na conta.
   */
  it('segue `{% section %}`: section estática do layout está em toda página', () => {
    const disco = {
      'layout/theme.liquid': "{% section 'cart-drawer' %}",
      'sections/cart-drawer.liquid': "<script src=\"{{ 'cart.js' | asset_url }}\"></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).toContain('cart.js');
  });

  it('segue `{% sections %}`: o JSON do grupo diz quais tipos entram', () => {
    const disco = {
      'layout/theme.liquid': "{% sections 'header-group' %}",
      'sections/header-group.json': JSON.stringify({ sections: { cabecalho: { type: 'header' } } }),
      'sections/header.liquid': "<script src=\"{{ 'pesado.js' | asset_url }}\"></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).toContain('pesado.js');
  });

  it('a fronteira continua de pé: section que o layout não renderiza fica fora', () => {
    // O outro lado. Asset co-locado numa section de template é o PADRÃO do
    // tema, justamente para não pesar onde não é usado — contá-lo como global
    // apagaria a diferença que a arquitetura inteira preserva.
    const disco = {
      'layout/theme.liquid': '{{ content_for_layout }}',
      'sections/video-banner.liquid': "<script src=\"{{ 'pesado.js' | asset_url }}\"></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).not.toContain('pesado.js');
  });
});

describe('o JSON do grupo, quando não colabora', () => {
  // A regra roda no CI sobre o repositório inteiro. Um grupo que não parseia
  // não pode derrubar a medição do resto — subnotificar é ruim, mas não medir
  // nada é pior, e é o que um throw aqui causaria.
  it.each([
    ['arquivo que não existe', undefined],
    ['JSON quebrado', '{ isto não é json'],
    ['sem a chave sections', '{}'],
    ['entrada sem type', '{"sections":{"x":{}}}'],
  ])('%s: devolve lista vazia em vez de explodir', (_, conteudo) => {
    const disco = conteudo === undefined ? {} : { 'sections/g.json': conteudo };
    expect(tiposDoGrupo('sections/g.json', leitorDe(disco))).toEqual([]);
  });

  it('aceita o comentário que a Shopify põe no topo dos grupos', () => {
    // Os arquivos de section group nascem com um `/* ... */` de aviso. JSON
    // não tem comentário, e `JSON.parse` recusaria o arquivo REAL — a regra
    // ficaria cega para o grupo inteiro, sem erro nenhum.
    const disco = {
      'sections/g.json': '/* não edite à mão */\n{"sections":{"a":{"type":"header"}}}',
    };
    expect(tiposDoGrupo('sections/g.json', leitorDe(disco))).toEqual(['header']);
  });
});
