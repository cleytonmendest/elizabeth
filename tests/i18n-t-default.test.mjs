/**
 * `{{ 'chave' | t: default: 'frase' }}` — a porta que ninguém guardava.
 *
 * O CLAUDE.md proibia em prosa desde sempre ("Nunca `| t: default: '...'` —
 * crie a chave de verdade") e nada verificava. Ver issue #130.
 *
 * ── Por que é pior do que parece um valor de reserva ───────────────────────
 *
 * O `default` do filtro `t` é o texto que a Shopify mostra QUANDO A CHAVE NÃO
 * EXISTE. Ele não é fallback: é o "translation missing" silenciado. A chave
 * continua faltando nos dois locales, a checagem de paridade não a vê — porque
 * ela não existe para ser comparada —, e a loja em inglês exibe o português
 * que alguém escreveu ali.
 *
 * A regra `LIQUID_DEFAULT`, que já existia, NÃO alcança este caso: ela exige um
 * identificador antes do filtro, e aqui o que vem antes é uma chave entre
 * aspas. Medi antes de escrever, e é por isso que há duas.
 */
import { describe, it, expect } from 'vitest';
import { tDefault } from '../scripts/lint/rules/i18n.mjs';

const achados = (src) => tDefault('snippets/x.liquid', src);

describe('acusa', () => {
  it.each([
    ["{{ 'cart.general.title' | t: default: 'Meu carrinho' }}", 'cart.general.title'],
    ["{{ 'a.b' | t: name: shop.name, default: 'Loja' }}", 'a.b'],
    ["{{ 'x' | translate: default: 'Y' }}", 'x'],
    ['{{ "aspas.duplas" | t: default: "Texto" }}', 'aspas.duplas'],
  ])('%s', (src, chave) => {
    const [achado] = achados(src);
    expect(achado?.code).toBe(`t-default:${chave}`);
  });

  it('o recado diz o que fazer, e por que não é um fallback inocente', () => {
    const { message } = achados("{{ 'x.y' | t: default: 'Frase' }}")[0];

    expect(message, 'precisa explicar que o default mascara a chave faltando').toContain(
      'QUANDO A CHAVE NÃO EXISTE'
    );
    expect(message, 'precisa nomear o caminho certo').toContain('Crie a chave');
    expect(message).toContain('en.default');
  });

  it('acusa cada ocorrência, na sua linha', () => {
    const src = [
      "{{ 'a' | t: default: 'Um' }}",
      '{{ produto.titulo }}',
      "{{ 'b' | t: default: 'Dois' }}",
    ].join('\n');

    expect(achados(src).map((o) => o.line)).toEqual([1, 3]);
  });
});

describe('fica quieto', () => {
  it.each([
    ['o filtro t sozinho, que é o jeito certo', "{{ 'cart.general.title' | t }}"],
    ['t com outro argumento nomeado', "{{ 'x.y' | t: count: 2 }}"],
    ['default de setting, que é conteúdo do lojista', "{{ section.settings.x | default: 'Olá' }}"],
    ['nada de Liquid', '<p>texto solto</p>'],
  ])('%s', (_, src) => {
    expect(achados(src)).toEqual([]);
  });

  it('não atravessa a tag: um `t` aqui e um `default:` lá embaixo não casam', () => {
    // Sem o `[^}%]` a busca cruzaria trinta linhas e acusaria dois trechos que
    // não têm nada a ver um com o outro — a forma mais rápida de a regra ser
    // desligada na primeira semana.
    const src = ["{{ 'a.b' | t }}", '', '{{ outro | default: "x" }}'].join('\n');
    expect(achados(src)).toEqual([]);
  });

  it('o tema hoje não tem nenhuma — a regra nasce verde', async () => {
    // Se alguma existisse, ela entraria no baseline e a catraca a congelaria.
    // Zero é o estado, e este teste o trava: a próxima entra como violação NOVA.
    const { allLiquid, read, stripInert } = await import('../scripts/lint/lib.mjs');
    const todas = allLiquid().flatMap((f) => tDefault(f, stripInert(read(f))));

    expect(todas.map((o) => `${o.file}: ${o.code}`)).toEqual([]);
  });
});
