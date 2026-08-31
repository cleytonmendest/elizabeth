/**
 * O verificador de acessibilidade, num lugar só.
 *
 * Os critérios são os do WCAG 2.1 nível AA — o mesmo alvo que a Shopify exige
 * para aprovar tema na Theme Store. As regras "best-practice" do axe ficam de
 * fora: elas são opinião, e opinião não pode reprovar PR de ninguém.
 */
import AxeBuilder from '@axe-core/playwright';

export const CRITERIOS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function violacoes(page, { criterios = CRITERIOS, excluir = [] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(criterios);
  for (const seletor of excluir) builder = builder.exclude(seletor);
  const { violations } = await builder.analyze();
  return violations;
}

/**
 * Uma violação vira UMA linha, com o seletor do primeiro nó afetado. Despejar
 * o objeto do axe inteiro no log dá um muro que ninguém lê — e relatório que
 * ninguém lê é o mesmo que não ter relatório.
 */
export function relatorio(violations) {
  return violations
    .map((v) => {
      const onde = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(', ');
      const resto = v.nodes.length > 3 ? ` (+${v.nodes.length - 3})` : '';
      return `  ${v.id} [${v.impact}] ${v.help}\n    em: ${onde}${resto}`;
    })
    .join('\n');
}

/** Os ids das regras violadas, ordenados — o que os testes do gate comparam. */
export const regras = (violations) => violations.map((v) => v.id).sort();
