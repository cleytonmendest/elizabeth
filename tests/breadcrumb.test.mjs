// @vitest-environment node

/**
 * Onde o breadcrumb mora, e o que deixa o respiro dele existir.
 *
 * Até aqui o layout o renderizava fora de qualquer section. Sem color scheme,
 * ele ficava branco sobre uma PDP escura, e o `gap` do <main> abria uma faixa
 * da cor da página entre ele e o produto. Agora ele é da section principal de
 * cada template, dentro da cor dela — e isso é uma lista de onze arquivos que
 * alguém precisa lembrar ao criar o décimo segundo. Este teste é o lembrete.
 *
 * O `py-4` dele também não existia: o `.page-width` de `theme-styles` declarava
 * `padding: 0 16px` depois do application.css e zerava todo `py-*` posto ao
 * lado dele.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stripInert } from '../scripts/lint/lib.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
const lerJson = (arquivo) => JSON.parse(ler(arquivo).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const RENDER = /\{%-?\s*render\s+'breadcrumb'/g;

/** Os templates JSON que o layout da vitrine serve com breadcrumb. */
const SEM_BREADCRUMB = new Set(['index.json', 'password.json']);
const templates = fs
  .readdirSync(path.join(RAIZ, 'templates'))
  .filter((f) => f.endsWith('.json') && !SEM_BREADCRUMB.has(f));

const secaoPrincipal = (template) => {
  const { sections, order } = lerJson(`templates/${template}`);
  return order.map((chave) => sections[chave].type).find((tipo) => tipo.startsWith('main-'));
};

describe('o breadcrumb é da section principal', () => {
  it.each(templates)('%s: a section principal o renderiza uma vez, dentro da cor dela', (template) => {
    const tipo = secaoPrincipal(template);
    expect(tipo, `${template} sem section main-*`).toBeTruthy();

    const fonte = stripInert(ler(`sections/${tipo}.liquid`));
    const renders = [...fonte.matchAll(RENDER)];
    expect(renders, `sections/${tipo}.liquid`).toHaveLength(1);

    const cor = fonte.indexOf('color-{{ section.settings.color_scheme }}');
    expect(cor, 'o wrapper de cor da section').toBeGreaterThan(-1);
    expect(renders[0].index, 'o breadcrumb vem depois de abrir o wrapper de cor').toBeGreaterThan(cor);
  });

  it('o layout só o renderiza para as páginas de conta, que não têm section', () => {
    const layout = stripInert(ler('layout/theme.liquid'));
    const renders = [...layout.matchAll(RENDER)];
    expect(renders).toHaveLength(1);

    const ramo = layout.slice(layout.indexOf("template.directory == 'customers'"), renders[0].index);
    expect(ramo, 'o render fica dentro do ramo das páginas de conta').toContain('settings.customer_color_scheme');
  });
});

describe('o `.page-width` não zera o padding vertical', () => {
  it('declara só o eixo horizontal', () => {
    const [regra] = /\.page-width\s*\{[^}]*\}/.exec(ler('snippets/theme-styles.liquid'));
    expect(regra).toContain('padding-inline');
    expect(regra).not.toMatch(/\bpadding\s*:/);
  });
});
