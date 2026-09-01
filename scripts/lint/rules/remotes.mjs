/**
 * remotes — o `<head>` do tema não recebe markup vindo do admin.
 *
 * ── O buraco que esta regra fecha ──────────────────────────────────────────
 *
 * O Theme Check tem a regra `RemoteAsset`, feita exatamente para isto: nenhum
 * asset servido por domínio de terceiro. Ela nunca disparou aqui, e o motivo é
 * mecânico — ela lê o MARKUP, e a tag não estava no markup:
 *
 *     config/settings_schema.json   "type": "textarea", "id": "custom_font_head",
 *                                   "default": "<link href='fonts.googleapis…'>"
 *     layout/theme.liquid           {{ settings.custom_font_head }}
 *
 * O valor morava num setting. Para o Theme Check, `theme.liquid` só imprimia
 * uma variável; para o navegador, quatro presets baixavam fonte do Google em
 * toda página. Um verificador que olha só onde a string está escrita não vê
 * uma string que chega em tempo de render.
 *
 * Daí a forma da regra: ela olha os DOIS lados, porque o defeito precisa dos
 * dois para existir.
 *
 *   A. `config/*.json` não guarda markup. É o lado do valor — pega o `<link>`
 *      de volta no default de um setting, ou dentro de um preset, que é onde
 *      ele estava e onde o Theme Check não olha.
 *
 *   B. Setting global de texto livre não é impresso cru. É o lado do site —
 *      `textarea`, `html` e `liquid` são os tipos em que o lojista digita o
 *      que quiser, e `{{ }}` no Liquid não escapa nada. Imprimir um desses
 *      sem filtro é dar ao admin uma porta para markup arbitrário em toda
 *      página. Com `| escape` (ou `strip_html`, `json`) o valor vira texto e
 *      a porta fecha.
 *
 * Sozinho, nenhum dos lados é suficiente: o A não vê o setting que o lojista
 * preenche depois do deploy, e o B não vê a URL externa que já vem no preset.
 *
 * ── Escopo: settings GLOBAIS ───────────────────────────────────────────────
 *
 * A regra cobre `config/settings_schema.json` × o tema, não o `{% schema %}`
 * das sections. A diferença não é de gravidade, é de superfície: setting
 * global aparece na tela de configurações do tema, vale para a loja inteira e
 * — como neste caso — alcança o `<head>` de toda página. Os 5 `textarea` de
 * section que existem hoje são campos de conteúdo de um bloco, e entram numa
 * regra própria se um dia justificarem uma.
 *
 * Ver ADR 0006.
 */
import { allLiquid, lineAt, list, offense, read, readJSONC, stripInert } from '../lib.mjs';

export const meta = {
  name: 'remotes',
  title: 'Markup vindo do admin',
  description: 'Config não guarda markup, e setting de texto livre não é impresso cru.',
  ratchet: true,
};

const SCHEMA = 'config/settings_schema.json';

/** Tags que fazem o navegador buscar ou executar alguma coisa. */
const SUBRECURSO = /<\s*(link|script|style|iframe|embed|object|base|meta)\b/i;

/** Tipos de setting em que o lojista digita texto livre — inclusive markup. */
const TEXTO_LIVRE = new Set(['textarea', 'html', 'liquid']);

/** Filtros que transformam o valor em texto inerte antes de ele virar HTML. */
const NEUTRALIZA = /\|\s*(escape|escape_once|strip_html|json|url_encode)\b/;

/**
 * A tag de subrecurso que um valor guarda, ou null. Pura de propósito: é o
 * lado da regra que o teste consegue plantar defeito sem tocar no disco.
 */
export function markupEm(valor) {
  if (typeof valor !== 'string') return null;
  const achou = valor.match(SUBRECURSO);
  return achou ? achou[1].toLowerCase() : null;
}

/**
 * Onde `src` imprime, sem filtro que neutralize, um dos settings de `tipos`
 * (Map de id → tipo). Devolve `{ id, tipo, index }` por ocorrência.
 *
 * `tipos.keys()` e não `tipos`: espalhar um Map dá pares `[chave, valor]`, e a
 * alternância do regex sai com o tipo dentro dela. A regra nasceu com esse
 * defeito e passou verde — é o mutante `alternância montada do Map inteiro`.
 */
export function cruNoLiquid(src, tipos) {
  if (!tipos || tipos.size === 0) return [];

  const ids = [...tipos.keys()].join('|');
  const alvo = new RegExp(`\\{\\{-?\\s*settings\\.(${ids})\\b([^}]*)\\}\\}`, 'g');

  const achados = [];
  for (const match of src.matchAll(alvo)) {
    const [, id, resto] = match;
    if (NEUTRALIZA.test(resto)) continue;
    achados.push({ id, tipo: tipos.get(id), index: match.index });
  }
  return achados;
}

export function run() {
  const offenses = [];

  // ── A. Nenhum markup guardado em config/*.json ───────────────────────────
  for (const file of list('config', '.json')) {
    const src = read(file);
    let json;
    try {
      json = readJSONC(file);
    } catch {
      continue; // JSON quebrado é problema de outra regra.
    }

    for (const { caminho, valor, chave } of strings(json)) {
      const tag = markupEm(valor);
      if (!tag) continue;

      offenses.push(
        offense({
          rule: 'remotes',
          file,
          line: lineAt(src, Math.max(0, src.indexOf(`"${chave}"`))),
          code: `markup-em-config:${caminho}`,
          message:
            `\`${caminho}\` guarda um \`<${tag}>\`. Markup em config vira ` +
            `HTML no render sem passar por nenhum verificador de markup — e se apontar ` +
            `para domínio externo, reprova na Theme Store. Use o setting tipado ` +
            `(\`font_picker\`, \`image_picker\`, \`url\`) em vez de HTML digitado.`,
        })
      );
    }
  }

  // ── B. Setting global de texto livre não sai cru no Liquid ───────────────
  const livres = settingsDeTextoLivre();
  if (livres.size === 0) return offenses;

  for (const file of allLiquid()) {
    const src = stripInert(read(file));

    for (const { id, tipo, index } of cruNoLiquid(src, livres)) {
      offenses.push(
        offense({
          rule: 'remotes',
          file,
          line: lineAt(src, index),
          code: `injecao-crua:${id}`,
          message:
            `\`settings.${id}\` é \`${tipo}\` — texto livre do admin — e sai sem ` +
            `filtro. \`{{ }}\` não escapa no Liquid, então o que for digitado ali vira markup. ` +
            `Imprima com \`| escape\`, ou troque por um setting tipado.`,
        })
      );
    }
  }

  return offenses;
}

/** Os ids de setting global cujo tipo aceita markup, mapeados para o tipo. */
function settingsDeTextoLivre() {
  const encontrados = new Map();
  let schema;
  try {
    schema = readJSONC(SCHEMA);
  } catch {
    return encontrados;
  }

  for (const grupo of Array.isArray(schema) ? schema : []) {
    for (const setting of grupo?.settings ?? []) {
      if (setting?.id && TEXTO_LIVRE.has(setting.type)) encontrados.set(setting.id, setting.type);
    }
  }
  return encontrados;
}

/** Toda string do JSON, com o caminho até ela e a chave que a segura. */
function* strings(node, caminho = '', chave = '') {
  if (typeof node === 'string') {
    yield { caminho: caminho || '(raiz)', valor: node, chave };
    return;
  }
  if (!node || typeof node !== 'object') return;

  for (const [k, v] of Object.entries(node)) {
    yield* strings(v, caminho ? `${caminho}.${k}` : k, Array.isArray(node) ? chave : k);
  }
}
