/**
 * A regra de `snake_case` consegue acusar — e consegue ficar quieta?
 *
 * A segunda metade é a que costuma faltar. Uma regra que acusa demais é
 * desligada na primeira semana, e o CLAUDE.md fica com mais uma linha que
 * ninguém obedece — que é exatamente o problema da issue #130, reconstruído.
 *
 * A fonte é INJETADA em vez de lida do repositório: hoje o tema não tem
 * nenhuma violação, então uma varredura real não exercitaria o caminho que
 * acusa. Teste que só percorre o caminho verde não sabe se o vermelho existe.
 */
import { describe, it, expect } from 'vitest';
import { ehSnakeCase, paraSnakeCase, violacoesEm } from '../scripts/lint/rules/snakecase.mjs';

const achados = (src) => violacoesEm('snippets/x.liquid', src);
const nomes = (src) => achados(src).map((o) => o.code);

describe('o que é snake_case', () => {
  it.each(['cor', 'cor_do_botao', 'x1', 'tem_3_niveis'])('%s passa', (nome) => {
    expect(ehSnakeCase(nome)).toBe(true);
  });

  it.each(['corDoBotao', 'CorDoBotao', 'cor-do-botao', 'COR', '_cor', '1cor'])(
    '%s não passa',
    (nome) => {
      expect(ehSnakeCase(nome)).toBe(false);
    }
  );
});

describe('o nome sugerido', () => {
  it.each([
    ['corDoBotao', 'cor_do_botao'],
    ['CorDoBotao', 'cor_do_botao'],
    ['cor-do-botao', 'cor_do_botao'],
    ['temTresNiveis', 'tem_tres_niveis'],
  ])('%s → %s', (de, para) => {
    expect(paraSnakeCase(de)).toBe(para);
  });

  it('aparece no recado — a regra diz o que escrever, não só o que está errado', () => {
    // Mesmo princípio do verificador dos ADRs e do pulo sem motivo: regra que
    // só proíbe é burlada pela primeira pessoa que precisa passar.
    expect(achados('{% assign corDoBotao = true %}')[0].message).toContain('cor_do_botao');
  });
});

describe('os três lugares onde o tema nomeia', () => {
  it('assign', () => {
    expect(nomes('{% assign temCor = true %}')).toEqual(['nome:temCor']);
  });

  it('capture', () => {
    expect(nomes('{%- capture minhaCoisa -%}x{%- endcapture -%}')).toEqual(['nome:minhaCoisa']);
  });

  it('for', () => {
    expect(nomes('{% for itemDoCarrinho in cart.items %}')).toEqual(['nome:itemDoCarrinho']);
  });

  it('o hífen de whitespace do Liquid não esconde nada', () => {
    expect(nomes('{%- assign temCor = true -%}')).toEqual(['nome:temCor']);
  });
});

describe('o que NÃO é nosso para renomear', () => {
  // Esta metade é a que decide se a regra sobrevive. Acusar o que vem da
  // Shopify ensinaria a ignorá-la.
  it.each([
    ['objeto da Shopify', '{{ product.selectedVariant.featuredImage }}'],
    ['id de setting do lojista', '{% assign x = section.settings.colorScheme %}'],
    ['propriedade lida, não criada', '{% if forloop.firstItem %}{% endif %}'],
    ['nome já correto', '{% assign cor_do_botao = true %}'],
    ['filtro com maiúscula no valor', "{% assign t = 'Olá Mundo' %}"],
  ])('%s: fica quieto', (_, src) => {
    expect(achados(src)).toEqual([]);
  });

  it('acusa o alvo, e não o valor atribuído', () => {
    // `{% assign x = produtoEmDestaque %}` cria `x` (certo) lendo uma variável
    // de nome alheio. Só o alvo é nosso.
    expect(achados('{% assign cor = produtoEmDestaque %}')).toEqual([]);
  });
});

describe('vários no mesmo arquivo', () => {
  it('acusa todos, e cada um na sua linha', () => {
    const src = ['{% assign temCor = true %}', '{{ x }}', '{% for itemDoCarrinho in y %}'].join('\n');
    const lista = achados(src);

    expect(lista.map((o) => o.code)).toEqual(['nome:temCor', 'nome:itemDoCarrinho']);
    expect(lista.map((o) => o.line)).toEqual([1, 3]);
  });
});
