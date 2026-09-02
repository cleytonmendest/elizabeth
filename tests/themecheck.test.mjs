/**
 * A regra `themecheck` sabe o que é arquivo do tema?
 *
 * O Theme Check devolve offense de tudo que ele varreu, e ele varre a raiz
 * inteira. Descartar `node_modules` é trabalho do `ignore` do config —
 * `node_modules/**` no preset `recommended` — só que o descarte usa minimatch,
 * e `**` não atravessa segmento que começa com ponto.
 *
 * O resultado era um gate que dependia do CAMINHO do clone: verde em
 * `/home/runner/work/elizabeth/elizabeth` (o CI), vermelho em
 * `.claude/worktrees/<nome>` (o worktree onde este repositório é editado), no
 * mesmo commit. Os 8 erros vinham de `@shopify/theme-graph`, que publica um
 * tema de mentira em `fixtures/` — com `layout/`, `sections/` e `snippets/`
 * dentro, exatamente a forma que engana um filtro ingênuo.
 *
 * Por isso os casos abaixo não testam "tem node_modules no nome": testam que
 * um `sections/x.liquid` NOSSO passa e que o `sections/x.liquid` de dentro de
 * uma dependência não passa. É a distinção que estava faltando.
 */
import { describe, it, expect } from 'vitest';
import { ehDoTema } from '../scripts/lint/rules/themecheck.mjs';

describe('o arquivo faz parte do tema publicado?', () => {
  it('as pastas que a Shopify publica passam', () => {
    for (const file of [
      'sections/main-cart.liquid',
      'snippets/cart-drawer.liquid',
      'templates/cart.json',
      'templates/customers/login.liquid',
      'layout/theme.liquid',
      'locales/pt-BR.json',
      'config/settings_schema.json',
      'assets/cart.js',
      'blocks/text.liquid',
    ]) {
      expect(ehDoTema(file), file).toBe(true);
    }
  });

  it('o defeito original: os fixtures de @shopify/theme-graph', () => {
    for (const file of [
      'node_modules/@shopify/theme-graph/fixtures/skeleton/layout/theme.liquid',
      'node_modules/@shopify/theme-graph/fixtures/skeleton/sections/custom-section.liquid',
      'node_modules/@shopify/theme-graph/fixtures/skeleton/snippets/parent.liquid',
      'node_modules/@shopify/theme-graph/fixtures/theme-app-extension/blocks/app-block.liquid',
    ]) {
      expect(ehDoTema(file), file).toBe(false);
    }
  });

  it('o que está no repositório mas não é tema também fica de fora', () => {
    for (const file of ['scripts/lint/index.mjs', 'e2e/a11y.spec.mjs', 'docs/adr/0003.md', 'package.json']) {
      expect(ehDoTema(file), file).toBe(false);
    }
  });

  /**
   * O nome da pasta tem que ser a pasta inteira. Sem isto, `templates-antigos/`
   * ou `assetsx/` entrariam por prefixo — e um diretório de dependência
   * chamado `configuracao/` viraria arquivo de tema.
   */
  it('casa o segmento inteiro, não o prefixo', () => {
    expect(ehDoTema('assetsx/foo.liquid')).toBe(false);
    expect(ehDoTema('templates-antigos/cart.liquid')).toBe(false);
    expect(ehDoTema('vendor/sections/x.liquid')).toBe(false);
  });

  it('não quebra com entrada vazia', () => {
    expect(ehDoTema('')).toBe(false);
    expect(ehDoTema(undefined)).toBe(false);
    expect(ehDoTema(null)).toBe(false);
  });
});
