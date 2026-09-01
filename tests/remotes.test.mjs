/**
 * A regra `remotes` consegue reprovar?
 *
 * Mesma pergunta de `tests/catraca.test.mjs` e de `e2e/gate.spec.mjs`, e aqui
 * ela não é hipotética: a regra nasceu com a alternância do regex montada a
 * partir do Map inteiro (`[...tipos]` dá pares `[chave, valor]`), procurou por
 * `settings.(logo_svg,textarea)`, não achou nada em lugar nenhum e imprimiu
 * "tudo limpo". Um verificador quebrado é indistinguível de um tema limpo.
 *
 * O que está plantado aqui são as duas metades do defeito que a regra existe
 * para pegar — o valor que guarda markup e o site que o imprime cru — mais os
 * casos vizinhos que ela NÃO pode reprovar, porque regra que grita demais é
 * desligada tão rápido quanto regra que não grita.
 */
import { describe, it, expect } from 'vitest';
import { markupEm, cruNoLiquid } from '../scripts/lint/rules/remotes.mjs';

describe('markupEm — o valor guardado em config', () => {
  it('acha o <link> exato que os presets carregavam', () => {
    const era =
      "<link href='https://fonts.googleapis.com/css2?family=Work+Sans&display=swap' rel='stylesheet'>";
    expect(markupEm(era)).toBe('link');
  });

  it('acha <script>, <iframe> e <style> — cada um é uma porta diferente', () => {
    expect(markupEm('<script src="https://cdn.exemplo/x.js"></script>')).toBe('script');
    expect(markupEm('<iframe src="https://exemplo"></iframe>')).toBe('iframe');
    expect(markupEm('<style>body{color:red}</style>')).toBe('style');
  });

  it('não se importa com espaço nem com caixa — <  LINK  também é <link', () => {
    expect(markupEm('<  LINK rel="stylesheet">')).toBe('link');
  });

  it('cala em texto de lojista, que é a maioria do arquivo', () => {
    expect(markupEm('Faltam {valor} para o frete grátis')).toBe(null);
    expect(markupEm('https://instagram.com/loja')).toBe(null);
    expect(markupEm('shopify://shop_images/logo.png')).toBe(null);
  });

  it('cala no <svg> do logo — desenho não busca recurso de terceiro', () => {
    expect(markupEm('<svg viewbox="0 0 10 10"><path d="M0 0"/></svg>')).toBe(null);
  });
});

describe('cruNoLiquid — o site que imprime', () => {
  const textarea = new Map([['logo_svg', 'textarea']]);

  it('pega o setting de texto livre impresso sem filtro', () => {
    const achados = cruNoLiquid('<div>{{ settings.logo_svg }}</div>', textarea);
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({ id: 'logo_svg', tipo: 'textarea' });
  });

  it('pega também com os hífens de whitespace do Liquid', () => {
    expect(cruNoLiquid('{{- settings.logo_svg -}}', textarea)).toHaveLength(1);
  });

  it('cala quando um filtro neutraliza o valor', () => {
    expect(cruNoLiquid('{{ settings.logo_svg | escape }}', textarea)).toHaveLength(0);
    expect(cruNoLiquid('{{ settings.logo_svg | strip_html }}', textarea)).toHaveLength(0);
  });

  it('cala em setting que não é de texto livre — não é a superfície', () => {
    expect(cruNoLiquid('{{ settings.logo_width }}', textarea)).toHaveLength(0);
  });

  it('não confunde prefixo: logo_svg_extra não é logo_svg', () => {
    expect(cruNoLiquid('{{ settings.logo_svg_extra }}', textarea)).toHaveLength(0);
  });

  /**
   * O defeito original. Com a alternância montada do Map inteiro o regex vira
   * `settings.(a,textarea|b,html)` e este caso volta zero.
   */
  it('acha os DOIS settings quando o Map tem mais de uma entrada', () => {
    const varios = new Map([
      ['a', 'textarea'],
      ['b', 'html'],
    ]);
    const achados = cruNoLiquid('{{ settings.a }} e {{ settings.b }}', varios);
    expect(achados.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('Map vazio não vira regex vazia que casa com tudo', () => {
    expect(cruNoLiquid('{{ settings.qualquer }}', new Map())).toHaveLength(0);
  });
});
