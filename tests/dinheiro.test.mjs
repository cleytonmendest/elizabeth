/**
 * A regra `dinheiro` consegue reprovar?
 *
 * Ela nasce com o tema já corrigido — a #80 removeu o parcelamento antes de a
 * regra existir —, então `npm run lint -- --rules=dinheiro` diz "tudo limpo",
 * que é exatamente a cara de uma regra quebrada. A regra `remotes` passou verde
 * por três commits com a alternância do regex montada errado.
 *
 * Então o defeito está plantado aqui no formato EXATO em que estava no tema,
 * copiado de `snippets/price-v2.liquid` no commit anterior a `3e2cd8a`. E do
 * outro lado estão os vizinhos que a regra não pode acusar — os treze
 * `divided_by` que o tema usa hoje, e a barra de frete grátis, que deriva
 * dinheiro de um setting e está CERTA.
 */
import { describe, it, expect } from 'vitest';
import { analisar, partirExpressao, identificadores } from '../scripts/lint/rules/dinheiro.mjs';

const acha = (src) => analisar(src).map((a) => `${a.variavel}|${a.filtro}`);

describe('o parcelamento removido — a regressão que a regra existe para pegar', () => {
  /** Copiado de `snippets/price-v2.liquid`, commit 3e2cd8a~1, linhas 17-38. */
  const PARCELAMENTO = `
    {%- liquid
      assign price = target.price | default: 1999
      assign min_value = settings.min_value_installment | times: 100
      assign max_installment = settings.max_installments | default: 1
      assign actual_installments = 1
      assign final_installment_value = 0

      if price > 0 and max_installment > 1 and min_value >= 0
        for i in (2..max_installment) reversed
          assign installment_value_check = price | divided_by: i
          if installment_value_check >= min_value
            assign actual_installments = i
            assign final_installment_value = installment_value_check
            break
          endif
        endfor
      endif

      assign final_installment_value = price | divided_by: actual_installments
    -%}
    <span>{{ final_installment_value | money }}</span>`;

  it('reprova o bloco inteiro como ele era', () => {
    expect(analisar(PARCELAMENTO)).toHaveLength(1);
    expect(analisar(PARCELAMENTO)[0].filtro).toBe('divided_by');
  });

  it('reprova a forma curta: preço dividido direto pelo setting', () => {
    const curto = `
      {%- assign parcela = product.price | divided_by: settings.max_installments -%}
      {{ parcela | money }}`;
    expect(acha(curto)).toEqual(['parcela|divided_by']);
  });

  it('reprova sem passar por variável — o money na mesma linha da divisão', () => {
    const direto = '{{ product.price | divided_by: settings.max_installments | money }}';
    expect(analisar(direto)).toHaveLength(1);
  });

  it('atravessa o `for`: o divisor é `i`, e `i` só é sujo por causa do range', () => {
    const viaLoop = `
      {%- liquid
        assign teto = settings.max_installments
        for i in (2..teto)
          assign parcela = price | divided_by: i
        endfor
      -%}
      {{ parcela | money }}`;
    expect(acha(viaLoop)).toEqual(['parcela|divided_by']);
  });

  it('não depende de o filtro ser divisão — multiplicar por setting é a mesma coisa', () => {
    const vezes = `
      {%- assign inflado = product.price | times: settings.markup -%}
      {{ inflado | money }}`;
    expect(acha(vezes)).toEqual(['inflado|times']);
  });

  it('pega as variantes do filtro money, não só `money`', () => {
    for (const filtro of ['money', 'money_with_currency', 'money_without_currency']) {
      const src = `{%- assign p = price | divided_by: settings.n -%}{{ p | ${filtro} }}`;
      expect(analisar(src), filtro).toHaveLength(1);
    }
  });
});

describe('o que a regra NÃO pode acusar', () => {
  /**
   * `snippets/cart-free-shipping.liquid`, como está hoje. Deriva dinheiro de um
   * setting e está certo: o valor exibido é o que a lojista digitou, menos um
   * total real. O parcelamento exibia um número que ninguém digitou.
   */
  it('a barra de frete grátis passa — o setting é a coisa, não o ajuste', () => {
    const frete = `
      {%- liquid
        assign fs_threshold = settings.cart_free_shipping_threshold | default: 0 | times: 100
      -%}
      {%- assign fs_total = cart.total_price -%}
      {%- assign fs_remaining = fs_threshold | minus: fs_total -%}
      {%- capture fs_amount -%}<strong>{{ fs_remaining | money }}</strong>{%- endcapture -%}`;
    expect(analisar(frete)).toEqual([]);
  });

  it('preço da Shopify impresso direto passa', () => {
    expect(analisar('{{ product.price | money }}')).toEqual([]);
    expect(analisar('{{ cart.total_price | money }}')).toEqual([]);
    expect(analisar('{{ item.final_line_price | money }}')).toEqual([]);
  });

  it('um setting exibido como dinheiro passa — o valor é o que a lojista digitou', () => {
    expect(analisar('{{ settings.cart_free_shipping_threshold | money }}')).toEqual([]);
  });

  /** O falso positivo previsto na issue #82: settings no `if`, não no valor. */
  it('`if settings.foo` escolhendo entre dois preços não contamina preço nenhum', () => {
    const escolha = `
      {%- if settings.mostrar_de_por -%}
        {%- assign exibido = product.compare_at_price -%}
      {%- else -%}
        {%- assign exibido = product.price -%}
      {%- endif -%}
      {{ exibido | money }}`;
    expect(analisar(escolha)).toEqual([]);
  });

  it('`| default:` é fallback, não aritmética', () => {
    expect(analisar('{%- assign p = product.price | default: settings.fallback -%}{{ p | money }}')).toEqual([]);
  });

  it('conversão por constante literal passa — mesma grandeza, outra unidade', () => {
    expect(analisar('{{ selected_variant.price | divided_by: 100.0 | money }}')).toEqual([]);
    expect(analisar('{%- assign c = price | times: 100 -%}{{ c | money }}')).toEqual([]);
  });

  describe('os treze `divided_by` do tema — nenhum é dinheiro derivado de setting', () => {
    it('opacidade do scrim: divide setting por literal, e não vira money', () => {
      expect(analisar('{%- assign o = section.settings.scrim_opacity | divided_by: 100.0 -%}')).toEqual([]);
    });

    it('tempo de leitura: palavras por minuto', () => {
      expect(analisar('{%- assign m = article.content | number_of_words | divided_by: 200 -%}')).toEqual([]);
    });

    it('proporção de imagem: layout, não dinheiro', () => {
      expect(analisar('{%- assign h = 100 | divided_by: image.aspect_ratio -%}')).toEqual([]);
    });

    it('percentual de desconto: preço ÷ preço dá razão adimensional', () => {
      const desconto = `
        {%- assign discount = compare_at_price | minus: price | times: 100 | divided_by: compare_at_price -%}
        <span>-{{ discount }}%</span>`;
      expect(analisar(desconto)).toEqual([]);
    });

    it('percentual da barra de frete: total ÷ limiar, impresso como largura', () => {
      const barra = `
        {%- assign fs_threshold = settings.cart_free_shipping_threshold | times: 100 -%}
        {%- assign fs_pct = cart.total_price | times: 100 | divided_by: fs_threshold -%}
        <div style="width: {{ fs_pct }}%"></div>`;
      expect(analisar(barra)).toEqual([]);
    });

    it('centavos do JSON-LD: sai por `| json`, não por `| money`', () => {
      expect(analisar('{{ selected_variant.price | divided_by: 100.0 | json }}')).toEqual([]);
    });
  });
});

describe('o parser de expressão', () => {
  it('separa sujeito e filtros', () => {
    const { sujeito, filtros } = partirExpressao('price | divided_by: i | money');
    expect(sujeito).toBe('price');
    expect(filtros.map((f) => f.nome)).toEqual(['divided_by', 'money']);
    expect(filtros[0].args).toBe('i');
  });

  /** `replace: '.', ''` e afins: um `|` dentro de string não abre filtro. */
  it('não quebra filtro dentro de string', () => {
    const { filtros } = partirExpressao("msg | replace: '|', '-' | money");
    expect(filtros.map((f) => f.nome)).toEqual(['replace', 'money']);
  });

  it('identificadores ignoram strings e números', () => {
    expect(identificadores("price | replace: 'settings.x', 200")).toEqual(['price', 'replace']);
  });
});
