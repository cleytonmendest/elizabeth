/**
 * mercado — o tema não escreve em qual país ou idioma ele está.
 *
 * ── As duas formas do mesmo defeito ────────────────────────────────────────
 *
 * `templates/customers/addresses.liquid` oferecia UM país (`Brasil`, num
 * `<option>` fixo) e os 27 estados brasileiros escritos à mão, duplicados nos
 * dois formulários. Uma loja fora do Brasil não conseguia cadastrar endereço
 * nenhum, e os estados ficavam em português mesmo com a loja em inglês.
 *
 * Ao mesmo tempo, e sem nenhuma relação aparente, os snippets de JSON-LD
 * afirmavam `"addressCountry": "BR"` e `"inLanguage": "pt-BR"` — dizendo ao
 * Google que a loja é brasileira e o conteúdo é português, em toda página,
 * independentemente do que a lojista publicou.
 *
 * Os dois são a mesma coisa escrita em lugares diferentes: o tema decidindo
 * por conta própria onde está. Um trava a cliente; o outro mente para o
 * buscador — e o segundo é pior porque não quebra nada visível.
 *
 * ── O que a regra verifica, e o que ela evita verificar ────────────────────
 *
 * Procurar a string "BR" ou "Brasil" pelo tema inteiro daria uma regra que
 * grita em toda linha inocente e é desligada na primeira semana. Então ela
 * mira dois lugares onde o valor certo NUNCA é literal:
 *
 *   A. `<select name="address[country]">` e `[province]` só podem ter option
 *      vazia. País e estado vêm de `all_country_option_tags` e do
 *      `data-provinces` que ele carrega — nomes já traduzidos pela Shopify.
 *
 *   B. Os campos de JSON-LD que declaram país ou idioma (`addressCountry`,
 *      `areaServed`, `inLanguage`, `availableLanguage`) vêm de
 *      `shop.address.country_code` e `request.locale.iso_code`.
 *
 * Ver issue #25.
 */
import { allLiquid, lineAt, offense, read, stripInert } from '../lib.mjs';

export const meta = {
  name: 'mercado',
  title: 'Mercado escrito à mão',
  description: 'País, estado e idioma vêm da loja — nunca de uma lista no markup.',
  ratchet: true,
};

/** Um `<select>` de país ou estado, com o miolo dele. */
const SELECT_ENDERECO = /<select\b[^>]*\bname\s*=\s*(['"])address\[(country|province)\]\1[^>]*>([\s\S]*?)<\/select>/gi;

/** `<option value="X">`, ignorando a vazia — que é a placeholder legítima. */
const OPTION_COM_VALOR = /<option\b[^>]*\bvalue\s*=\s*(['"])(?!\1)([^'"]*)\1/gi;

/** Campos de JSON-LD cujo valor declara país ou idioma. */
const CAMPOS_JSONLD = ['addressCountry', 'areaServed', 'inLanguage', 'availableLanguage'];

/**
 * O que há de errado num fonte Liquid. Pura de propósito: `run()` só varre
 * arquivos e traduz para offense. A regra `remotes` nasceu verde com um regex
 * quebrado porque não havia como plantar defeito nela sem tocar no tema —
 * aqui dá, e `tests/mercado.test.mjs` planta.
 *
 * @returns {{tipo: 'lista-fixa'|'jsonld-fixo', campo: string, valores: string[], index: number}[]}
 */
export function analisar(fonte) {
  const src = stripInert(fonte);
  const achados = [];

  for (const match of src.matchAll(SELECT_ENDERECO)) {
    const [, , campo, miolo] = match;
    const valores = [...miolo.matchAll(OPTION_COM_VALOR)].map((o) => o[2]);
    if (valores.length === 0) continue;
    achados.push({ tipo: 'lista-fixa', campo, valores, index: match.index });
  }

  for (const campo of CAMPOS_JSONLD) {
    const alvo = new RegExp(`"${campo}"\\s*:\\s*(\\[\\s*)?"([^"]*)"`, 'g');
    for (const match of src.matchAll(alvo)) {
      achados.push({ tipo: 'jsonld-fixo', campo, valores: [match[2]], index: match.index });
    }
  }

  return achados;
}

export function run() {
  const ofensas = [];

  for (const file of allLiquid()) {
    const src = stripInert(read(file));

    for (const achado of analisar(src)) {
      const { tipo, campo, valores, index } = achado;

      const message =
        tipo === 'lista-fixa'
          ? `O select de \`address[${campo}]\` traz ${valores.length} option(s) escrita(s) à mão ` +
            `(${valores.slice(0, 3).join(', ')}${valores.length > 3 ? '…' : ''}). ` +
            'Use `{{ all_country_option_tags }}` para o país e deixe o estado vir do ' +
            '`data-provinces` dele — a Shopify já manda os nomes no idioma da loja. ' +
            'Só a option vazia (placeholder) pode ficar.'
          : `\`"${campo}": "${valores[0]}"\` afirma ao buscador onde a loja está, em toda ` +
            'página, independentemente do que a lojista publicou. Use ' +
            '`shop.address.country_code` (país) ou `request.locale.iso_code` (idioma).';

      ofensas.push(
        offense({
          rule: 'mercado',
          file,
          line: lineAt(src, index),
          code: `${tipo}:${campo}`,
          message,
        })
      );
    }
  }

  return ofensas;
}
