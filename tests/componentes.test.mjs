/**
 * A guarda do `customElements.define`, que o CLAUDE.md mandava e nada media.
 *
 * `customElements.define` com um nome já registrado LANÇA, e o throw mata o
 * resto do arquivo. No navegador da cliente isso não acontece: cada script roda
 * uma vez. No EDITOR de tema acontece a cada mudança de setting, porque asset
 * co-locado é reinjetado junto com a section que o renderiza.
 *
 * Doze dos dezoito arquivos usavam a guarda. Seis não — `header.js` (o do
 * cabeçalho, co-locado e `async`), `cart.js` (quatro elementos, incluindo o
 * `<cart-drawer>`) e `video-section.js`. Convenção que só existe em prosa é
 * convenção que seis arquivos ignoram sem ninguém notar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { violacoesEm } from '../scripts/lint/rules/componentes.mjs';

// A raiz sai daqui, e não de `scripts/build-js.mjs`: aquele módulo importa o
// esbuild, que se recusa a rodar sob jsdom — e jsdom é justamente o que este
// arquivo precisa para instanciar o custom element no último teste.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const analisa = (src) => violacoesEm('src/js/exemplo.js', src);
const CLASSE = 'class Exemplo extends HTMLElement {}\n';

describe('a regra reprova o que estoura no editor', () => {
  it('define sem guarda nenhuma', () => {
    const o = analisa(`${CLASSE}customElements.define('meu-elemento', Exemplo);`);

    expect(o).toHaveLength(1);
    expect(o[0].code).toBe('define:meu-elemento');
  });

  it('e a guarda que confere OUTRO nome — que passa em qualquer busca por texto', () => {
    // O caso que motivou olhar a AST em vez de procurar a string
    // "customElements.get": a guarda existe, está logo acima, e não protege.
    const o = analisa(`${CLASSE}if (!customElements.get('vizinho')) { customElements.define('meu-elemento', Exemplo); }`);

    expect(o).toHaveLength(1);
    expect(o[0].message).toContain("confere 'vizinho'");
  });
});

describe('e aprova as formas legítimas', () => {
  it('a guarda do tema: if (!customElements.get(nome))', () => {
    expect(analisa(`${CLASSE}if (!customElements.get('meu-elemento')) { customElements.define('meu-elemento', Exemplo); }`)).toEqual([]);
  });

  it('a mesma pergunta escrita por comparação', () => {
    expect(analisa(`${CLASSE}if (customElements.get('meu-elemento') === undefined) { customElements.define('meu-elemento', Exemplo); }`)).toEqual([]);
  });

  it('arquivo que não define elemento nenhum', () => {
    expect(analisa('function formatMoney(c) { return c / 100; }')).toEqual([]);
  });
});

describe('o fonte que vai para a loja', () => {
  const fontes = fs
    .readdirSync(path.join(ROOT, 'src', 'js'))
    .filter((f) => f.endsWith('.js'))
    .sort();

  it('nenhum arquivo define sem guarda', () => {
    const sujos = fontes.flatMap((f) =>
      violacoesEm(`src/js/${f}`, fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8'))
    );

    expect(sujos.map((o) => `${o.file} ${o.code}`)).toEqual([]);
  });

  it('e os arquivos co-locados são os que mais dependem disso', () => {
    // Não é decoração: o linter cobre os 18, mas quem é reinjetado no editor é
    // o co-locado. Se algum destes perder a guarda, o editor quebra de novo.
    for (const nome of ['header.js', 'cart.js', 'video-section.js']) {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'js', nome), 'utf8');
      expect(violacoesEm(`src/js/${nome}`, src), `${nome} voltou a definir sem guarda`).toEqual([]);
      expect(src, `${nome} nem define elemento — o teste perdeu o alvo`).toContain('customElements.define');
    }
  });

  it('o segundo carregamento de um co-locado não estoura', () => {
    // A prova direta, sem intermediário: o editor injeta o mesmo arquivo duas
    // vezes, e a segunda tem que ser inofensiva.
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'header.js'), 'utf8');

    new Function(src)();
    expect(() => new Function(src)()).not.toThrow();
  });
});
