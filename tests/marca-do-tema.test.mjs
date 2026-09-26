/**
 * `window.shopUrl` é a MARCA do tema, e os três layouts precisam emiti-la.
 *
 * ── Por que isto importa mais do que parece ────────────────────────────────
 *
 * O CLAUDE.md explica o papel dela:
 *
 *   "`window.shopUrl` sai de `snippets/theme-head.liquid` — é a MARCA do tema,
 *    e os três layouts a emitem, porque é por ela que a sonda e o Playwright
 *    distinguem nossa página da tela de senha da Shopify."
 *
 * A afirmação era verdadeira e não era verificada (issue #130). O jeito de
 * quebrá-la é mundano: alguém tira o `{% render 'theme-head' %}` de um layout
 * ao reorganizar o `<head>`, ou cria um quarto layout e esquece de incluí-lo.
 *
 * E o sintoma não é erro. `e2e/global-setup.mjs` e a sonda passam a não
 * reconhecer a página como sendo do tema — o que aparece como suíte confusa,
 * teste pulando por motivo errado, ou pior: medindo a tela de senha da Shopify
 * e achando que mediu o tema. É o defeito da #71, que custou semanas.
 *
 * O teste é de ESTRUTURA, não de comportamento, e por isso mora aqui e não em
 * `e2e/`: a pergunta é "todo layout puxa a marca?", e essa resposta está no
 * disco. Medir no navegador exigiria a loja, e o defeito é justamente o que
 * faz a medição no navegador mentir.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (relativo) => fs.readFileSync(path.join(RAIZ, relativo), 'utf8');

/** Os layouts do tema, lidos do disco — nunca uma lista escrita à mão. */
const LAYOUTS = fs
  .readdirSync(path.join(RAIZ, 'layout'))
  .filter((f) => f.endsWith('.liquid'))
  .sort();

/** O layout emite a marca, direto ou pelo snippet que a contém? */
const emiteAMarca = (arquivo) => {
  const src = ler(path.join('layout', arquivo));
  return /window\.shopUrl/.test(src) || /\{%-?\s*render\s+'theme-head'/.test(src);
};

describe('a marca do tema', () => {
  it('o snippet que a define existe e a define de verdade', () => {
    // Se a marca sair do snippet, os três layouts abaixo continuam
    // renderizando-o e este arquivo inteiro fica verde sobre nada.
    expect(ler('snippets/theme-head.liquid')).toMatch(/window\.shopUrl\s*=/);
  });

  it.each(LAYOUTS)('%s emite window.shopUrl', (arquivo) => {
    expect(
      emiteAMarca(arquivo),
      `${arquivo} não emite window.shopUrl nem renderiza theme-head — a sonda e o Playwright ` +
        'deixam de distinguir esta página da tela de senha da Shopify'
    ).toBe(true);
  });

  it('a lista vem do disco, e um layout novo entra sozinho', () => {
    // A guarda do `it.each` acima. Se `LAYOUTS` viesse vazia — pasta renomeada,
    // extensão mudada —, o `it.each` não geraria caso nenhum e o arquivo
    // ficaria verde sem medir layout algum.
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(3);
    expect(LAYOUTS).toContain('theme.liquid');
  });
});
