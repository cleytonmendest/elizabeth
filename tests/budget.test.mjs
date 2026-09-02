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
import { fontesGlobais } from '../scripts/lint/rules/budget.mjs';

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
   * `{% section %}` NÃO é seguido, e é decisão: o critério da regra é o que o
   * layout carrega, e section tem asset co-locado — que é o padrão do tema
   * justamente para não pesar onde não é usado.
   */
  it('não segue section: asset co-locado continua fora da conta', () => {
    const disco = {
      'layout/theme.liquid': "{% sections 'header-group' %}",
      'sections/header.liquid': "<script src=\"{{ 'pesado.js' | asset_url }}\"></script>",
    };

    expect(fontesGlobais('layout/theme.liquid', leitorDe(disco)).join('\n')).not.toContain('pesado.js');
  });
});
