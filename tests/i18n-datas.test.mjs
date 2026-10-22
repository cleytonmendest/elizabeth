/**
 * Formato de data com palavra cravada — a porta que ninguém guardava.
 *
 * `{{ order.created_at | date: "%d de %B de %Y às %H:%M" }}` parece neutro: a
 * data vem do pedido, o formato é só forma. Mas "de" e "às" são português, e a
 * loja em inglês os exibia no meio da data. Cinco ocorrências (artigo,
 * comentário, conta, dois pontos do pedido) passaram pelo `i18n`, pelo
 * `jsstrings` e pelo Theme Check sem que nenhum deles olhasse o formato.
 *
 * A saída é a que a Shopify documenta: o formato mora em `date_formats`, no
 * locale, e o Liquid o chama pelo nome — `date: format: 'long_date'`. A regra
 * guarda os dois lados: reprova a palavra cravada, e exige que o nome exista
 * nos dois locales (a Shopify renderiza erro de Liquid quando falta).
 */
import { describe, it, expect } from 'vitest';
import { formatosDeData } from '../scripts/lint/rules/i18n.mjs';

const achados = (src) => formatosDeData('snippets/x.liquid', src);

describe('acusa o formato literal com palavra', () => {
  it.each([
    ["{{ a.published_at | date: '%d de %B de %Y' }}", '%d de %B de %Y'],
    ['{{ o.created_at | date: "%d/%m/%Y às %H:%M" }}', '%d/%m/%Y às %H:%M'],
    ["{{ o.created_at | date: '%B %d, %Y at %H:%M' }}", '%B %d, %Y at %H:%M'],
    ["{{ a.published_at | time_tag: '%d de %B' }}", '%d de %B'],
  ])('%s', (src, formato) => {
    const { literais } = achados(src);

    expect(literais.map((o) => o.code)).toEqual([`date-literal:${formato}`]);
  });

  it('o recado diz o que fazer', () => {
    const [{ message }] = achados("{{ x | date: '%d de %B' }}").literais;

    expect(message).toContain('date_formats');
    expect(message).toContain("date: format: 'nome'");
  });

  it('acusa cada ocorrência, na sua linha', () => {
    const src = ["{{ a | date: '%d de %B' }}", '{{ b }}', "{{ c | date: '%d às %H' }}"].join('\n');

    expect(achados(src).literais.map((o) => o.line)).toEqual([1, 3]);
  });
});

describe('fica quieto', () => {
  it.each([
    ['numérico, só ordem de dia e mês', "{{ a | date: '%d/%m/%Y' }}"],
    ['ISO, o T é uma letra só', "{{ a | date: '%Y-%m-%dT%H:%M:%S%z' }}"],
    ['época', "{{ 'now' | date: '%s' }}"],
    ['fuso', "{{ 'now' | date: '%z' }}"],
    ['modificador de diretiva (%-d, %e)', "{{ a | date: '%-d/%-m/%Y' }}"],
    ['formato de variável, que a regra não enxerga', '{{ a | date: formato }}'],
    ['nada de data', "{{ 'x.y' | t }}"],
  ])('%s', (_, src) => {
    const { literais, nomes } = achados(src);

    expect(literais).toEqual([]);
    expect(nomes).toEqual([]);
  });
});

describe('formato nomeado', () => {
  it('devolve o nome e a linha, para o locale conferir', () => {
    const src = ['{{ a | date: format: "long_date" }}', "{{ b | date: format: 'short_date_time' }}"].join('\n');

    expect(achados(src).nomes).toEqual([
      { nome: 'long_date', line: 1 },
      { nome: 'short_date_time', line: 2 },
    ]);
  });

  it('time_tag também', () => {
    expect(achados("{{ a | time_tag: format: 'long_date' }}").nomes).toEqual([
      { nome: 'long_date', line: 1 },
    ]);
  });

  it.each(['abbreviated_date', 'basic', 'date', 'date_at_time', 'default', 'on_date'])(
    'o nome nativo da Shopify (%s) não cobra chave no nosso locale',
    (nome) => {
      expect(achados(`{{ a | date: format: '${nome}' }}`).nomes).toEqual([]);
    }
  );

  it('formato nomeado não é lido como literal — o nome tem letras de sobra', () => {
    expect(achados("{{ a | date: format: 'long_date' }}").literais).toEqual([]);
  });
});
