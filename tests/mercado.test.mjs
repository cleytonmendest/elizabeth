/**
 * A regra `mercado` consegue reprovar?
 *
 * Ela nasce com o tema já corrigido, então `npm run lint` dá "tudo limpo" —
 * que é exatamente a cara de uma regra quebrada. A regra `remotes` passou
 * verde por três commits com a alternância do regex montada errado; a lição
 * foi que "não achou nada" e "não consegue achar nada" são indistinguíveis
 * sem um defeito plantado de propósito.
 *
 * Então aqui estão plantados os dois defeitos reais que a issue #25 descreve,
 * no formato exato em que estavam no tema — e, do outro lado, os vizinhos que
 * a regra NÃO pode acusar, porque regra que grita demais é desligada tão
 * rápido quanto regra que não grita.
 */
import { describe, it, expect } from 'vitest';
import { analisar } from '../scripts/lint/rules/mercado.mjs';

const tipos = (src) => analisar(src).map((a) => `${a.tipo}:${a.campo}`);

describe('lista de país ou estado escrita no markup', () => {
  it('acha o select de país com um único país fixo — o defeito original', () => {
    const era = `
      <select id="address_country_new" name="address[country]" required>
        <option value="Brazil" selected>Brasil</option>
      </select>`;
    expect(tipos(era)).toEqual(['lista-fixa:country']);
  });

  it('acha a lista de estados, e conta quantos são', () => {
    const era = `
      <select name="address[province]" required>
        <option value="">Selecione</option>
        <option value="AC">Acre</option>
        <option value="SP">São Paulo</option>
      </select>`;
    const [achado] = analisar(era);
    expect(achado.tipo).toBe('lista-fixa');
    expect(achado.valores).toEqual(['AC', 'SP']);
  });

  it('acha os DOIS formulários, não só o primeiro', () => {
    const dois = `
      <select name="address[province]"><option value="SP">x</option></select>
      <select name="address[province]"><option value="RJ">y</option></select>`;
    expect(analisar(dois)).toHaveLength(2);
  });

  it('cala no select que vem do Liquid — que é a correção', () => {
    const certo = `
      <select name="address[country]" data-address-country>{{ all_country_option_tags }}</select>
      <select name="address[province]" data-address-province>
        <option value="">{{ 'customer.addresses.select_placeholder' | t }}</option>
      </select>`;
    expect(analisar(certo)).toEqual([]);
  });

  /** A placeholder é markup legítimo e obrigatório: acusá-la mataria a regra. */
  it('a option vazia sozinha não é violação', () => {
    expect(analisar('<select name="address[province]"><option value="">Selecione</option></select>')).toEqual([]);
  });

  it('não se mete com select que não é de endereço', () => {
    expect(analisar('<select name="sort_by"><option value="price">Preço</option></select>')).toEqual([]);
  });
});

describe('país ou idioma afirmado no JSON-LD', () => {
  it('acha os três campos que estavam no tema', () => {
    expect(tipos('"areaServed": "BR",')).toEqual(['jsonld-fixo:areaServed']);
    expect(tipos('"addressCountry": "BR"')).toEqual(['jsonld-fixo:addressCountry']);
    expect(tipos('"inLanguage": "pt-BR"')).toEqual(['jsonld-fixo:inLanguage']);
  });

  it('acha também dentro de array — availableLanguage vinha assim', () => {
    expect(tipos('"availableLanguage": ["Portuguese"]')).toEqual(['jsonld-fixo:availableLanguage']);
  });

  it('cala quando o valor vem da loja — que é a correção', () => {
    const certo = `
      "addressCountry": {{ shop.address.country_code | json }},
      "inLanguage": {{ request.locale.iso_code | json }},
      "availableLanguage": [{{ request.locale.iso_code | json }}]`;
    expect(analisar(certo)).toEqual([]);
  });

  it('não confunde com outros campos de JSON-LD que são texto mesmo', () => {
    expect(analisar('"contactType": "Customer Service", "name": "Loja BR"')).toEqual([]);
  });
});

describe('o que não conta', () => {
  /**
   * `stripInert` tira comentário e schema. Sem isso, o comentário que este PR
   * deixou em schema-organization.liquid — explicando que "BR" saiu de lá —
   * seria acusado pela própria regra, citando o texto que a documenta.
   */
  it('defeito dentro de comentário Liquid não é violação', () => {
    const doc = `{%- comment -%} antes era "inLanguage": "pt-BR" {%- endcomment -%}`;
    expect(analisar(doc)).toEqual([]);
  });

  it('fonte vazia não inventa violação', () => {
    expect(analisar('')).toEqual([]);
  });
});
