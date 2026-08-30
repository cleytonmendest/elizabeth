/**
 * i18n — nenhuma string voltada ao usuário fica hardcoded, e os locales
 * PT/EN nunca divergem.
 *
 * Cobre os cinco modos de falha que a Theme Store reprova:
 *   1. `label`/`info`/`content`/`name` de schema escritos literalmente
 *   2. chave usada no código que não existe no locale ("translation missing")
 *   3. chave presente em um idioma e ausente no outro
 *   4. chave órfã acumulando no locale (aviso — não quebra a loja)
 *   5. frase cravada num `| default:` do Liquid
 *
 * O que NÃO é violação, por decisão: `default` de setting e blocos `presets`
 * são conteúdo do lojista (texto literal é o correto — é lá que o texto do
 * modo 5 deve morar), e labels puramente numéricos (dia, hora, minuto) são
 * independentes de idioma.
 */
import {
  allLiquid,
  extractSchema,
  flatten,
  lineAt,
  list,
  offense,
  read,
  readJSONC,
  stripInert,
  walkSchema,
} from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'i18n',
  title: 'Internacionalização',
  description: 'Schemas 100% em chaves `t:`, locales PT/EN em paridade, nenhuma chave faltante.',
  ratchet: true,
};

const TRANSLATABLE = new Set(['label', 'info', 'content', 'name']);
const NUMERIC = /^\d+$/;

/** `algo.x | default: 'valor'` — captura a origem junto, para saber quem é "x". */
const LIQUID_DEFAULT = /([a-zA-Z_][\w.]*)\s*\|\s*default:\s*(['"])([^'"]*)\2/g;

/**
 * `| default:` recebe frase E valor de código no mesmo lugar, então a posição
 * não separa os dois — diferente de todo o resto desta regra. E "tem palavra"
 * também não separa: `'center'`, `'slider'`, `'grid-2'`, `'check-circle'`,
 * `'general.see_more'` e `'/pages/terms'` têm todos uma palavra dentro.
 *
 * O que separa é a FORMA de uma frase escrita para gente ler, e nenhum dos três
 * sinais é dicionário:
 *
 *   letra ESPAÇO letra   "Formas de Pagamento"
 *   maiúscula inicial    "Descrição"
 *   letra fora do ASCII  "grátis"
 *
 * Medido no tema quando a checagem nasceu: 7 acusados, 24 calados, sem erro dos
 * dois lados. Valor de código é minúsculo, sem espaço e ASCII — e o que passa
 * perto (chave `t:`, caminho, cor hex) sai por forma, não por sorte.
 */
const CODE_SHAPE = /^([a-z][\w-]*)(\.[\w-]+)+$|^\/[\w/-]*$|^#[0-9a-fA-F]{3,8}$/;

const looksLikePhrase = (value) =>
  Boolean(value) &&
  !CODE_SHAPE.test(value) &&
  (/\p{L}\s+\p{L}/u.test(value) || /^\p{Lu}/u.test(value) || /[^\x00-\x7F]/.test(value));

const STOREFRONT = { 'pt-BR': 'locales/pt-BR.json', en: 'locales/en.default.json' };
const SCHEMA = { 'pt-BR': 'locales/pt-BR.schema.json', en: 'locales/en.default.schema.json' };

export function run() {
  const offenses = [];

  const storefront = loadPair(STOREFRONT, offenses);
  const schema = loadPair(SCHEMA, offenses);
  if (!storefront || !schema) return offenses;

  checkParity(storefront, STOREFRONT, offenses);
  checkParity(schema, SCHEMA, offenses);

  const usedSchemaKeys = new Set();
  const usedStorefrontKeys = new Set();

  // --- Schemas de section: tudo traduzível precisa ser `t:` ---
  for (const file of list('sections')) {
    const src = read(file);
    const parsed = extractSchema(src);
    if (!parsed) continue;
    if (!parsed.json) {
      offenses.push(
        offense({
          rule: 'i18n',
          file,
          line: parsed.line,
          code: 'invalid-schema',
          message: `Bloco {% schema %} com JSON inválido: ${parsed.error}`,
        })
      );
      continue;
    }

    // `presets` e `default` são conteúdo do lojista: o texto literal ali é o
    // correto, então não exigimos `t:`. Mas as chaves `t:` que aparecem dentro
    // deles (o nome do preset, por exemplo) ESTÃO em uso — precisam ser
    // coletadas, senão o relatório de órfãs acusa falso positivo.
    const { presets, default: _default, ...auditable } = parsed.json;
    walkSchema(presets ?? {}, (_key, value) => {
      if (value.startsWith('t:')) usedSchemaKeys.add(value.slice(2));
    });

    walkSchema(auditable, (key, value, keyPath) => {
      if (!TRANSLATABLE.has(key)) return;
      if (value.startsWith('t:')) {
        usedSchemaKeys.add(value.slice(2));
        return;
      }
      if (NUMERIC.test(value)) return;
      offenses.push(
        offense({
          rule: 'i18n',
          file,
          line: parsed.line,
          code: `hardcoded-schema:${keyPath}.${key}`,
          message: `Schema com texto literal em ${keyPath}.${key}: ${JSON.stringify(value)} — use uma chave t:.`,
        })
      );
    });
  }

  // --- settings_schema.json: mesma regra, settings globais do tema ---
  //
  // A identidade da violação é o ID do setting, nunca a posição no array. Um
  // fingerprint posicional (`[5].settings[0].label`) muda toda vez que alguém
  // insere um grupo antes, e a catraca acusa como "novas" 28 violações que são
  // as mesmas de sempre — foi o que aconteceu ao adicionar o grupo Design.
  const settingsFile = 'config/settings_schema.json';
  try {
    const groups = readJSONC(settingsFile);

    const check = (value, code, where) => {
      if (typeof value !== 'string') return;
      if (value.startsWith('t:')) {
        usedSchemaKeys.add(value.slice(2));
        return;
      }
      if (NUMERIC.test(value)) return;
      offenses.push(
        offense({
          rule: 'i18n',
          file: settingsFile,
          code: `hardcoded-settings:${code}`,
          message: `${where} com texto literal: ${JSON.stringify(value)} — use uma chave t:.`,
        })
      );
    };

    groups.forEach((group, index) => {
      // O primeiro bloco é metadado do tema (theme_name, theme_author), não
      // texto de interface.
      if (index === 0) return;

      const groupId = group.name?.replace(/^t:/, '') ?? `grupo-${index}`;
      check(group.name, `group:${groupId}`, `Grupo "${groupId}"`);

      for (const setting of group.settings ?? []) {
        // `header` e `paragraph` não têm id; a própria chave os identifica.
        const id = setting.id ?? `${setting.type}:${(setting.content ?? '').slice(0, 40)}`;
        for (const field of ['label', 'info', 'content', 'placeholder']) {
          check(setting[field], `${id}.${field}`, `Setting "${id}" (${field})`);
        }
        for (const option of setting.options ?? []) {
          check(option.label, `${id}.option:${option.value}`, `Opção "${option.value}" de "${id}"`);
        }

        // `color_scheme_group` guarda os campos de cada esquema num `definition`
        // aninhado. Iterar só o nível de cima perde os 16 labels que vivem ali
        // (Fundo, Texto, Botão primário…) — e perder cobertura em silêncio é
        // pior que não ter a regra.
        for (const field of setting.definition ?? []) {
          const fieldId = `${id}.definition:${field.id ?? field.type}`;
          check(field.label, `${fieldId}.label`, `Campo "${field.id ?? field.type}" de "${id}"`);
          check(field.info, `${fieldId}.info`, `Campo "${field.id ?? field.type}" de "${id}" (info)`);
        }
      }
    });
  } catch (error) {
    offenses.push(
      offense({ rule: 'i18n', file: settingsFile, code: 'invalid-json', message: error.message })
    );
  }

  // --- Storefront: toda chave usada com o filtro `t` precisa existir ---
  const declaredDefaults = collectDeclaredDefaults();
  const T_FILTER = /'([a-z][a-zA-Z0-9_.]*)'\s*\|\s*t\b/g;
  for (const file of allLiquid()) {
    const src = stripInert(read(file));
    for (const match of src.matchAll(T_FILTER)) {
      const key = match[1];
      usedStorefrontKeys.add(key);
      for (const [locale, keys] of Object.entries(storefront)) {
        if (!hasKey(keys, key)) {
          offenses.push(
            offense({
              rule: 'i18n',
              file,
              line: lineAt(src, match.index),
              code: `missing-key:${locale}:${key}`,
              message: `Chave "${key}" não existe em ${STOREFRONT[locale]} — renderiza "translation missing".`,
            })
          );
        }
      }
    }

    // `| default: 'frase'` — a última porta por onde português entra no
    // storefront sem passar por locale nenhum.
    for (const match of src.matchAll(LIQUID_DEFAULT)) {
      const [, from, , value] = match;
      if (!looksLikePhrase(value)) continue;

      const id = from.split('.').pop();
      const redundant = declaredDefaults.get(id)?.has(value);
      if (isAllowed('i18n', file, `liquid-default:${from}`)) continue;

      offenses.push(
        offense({
          rule: 'i18n',
          file,
          line: lineAt(src, match.index),
          code: `liquid-default:${from}`,
          message: redundant
            ? `\`| default: ${JSON.stringify(value)}\` é redundante — o setting "${id}" já declara esse mesmo texto como \`default\` no schema, que é de onde o lojista o edita. Uma segunda cópia aqui só pode divergir; remova o filtro.`
            : `Texto ${JSON.stringify(value)} cravado num \`| default:\` — não passa por locale, então a loja em outro idioma mostra isto em português. Use o \`default\` do setting (que é conteúdo do lojista) ou uma chave \`t:\`.`,
        })
      );
    }
  }

  // --- Chaves t: de schema apontando para lugar nenhum ---
  for (const key of usedSchemaKeys) {
    for (const [locale, keys] of Object.entries(schema)) {
      if (!hasKey(keys, key)) {
        offenses.push(
          offense({
            rule: 'i18n',
            file: SCHEMA[locale],
            code: `missing-schema-key:${key}`,
            message: `Chave de schema "${key}" é usada mas não existe em ${SCHEMA[locale]}.`,
          })
        );
      }
    }
  }

  // --- Órfãs: aviso, não erro. Não quebram a loja, mas incham o locale. ---
  reportOrphans(storefront['pt-BR'], usedStorefrontKeys, STOREFRONT['pt-BR'], offenses);
  reportOrphans(schema['pt-BR'], usedSchemaKeys, SCHEMA['pt-BR'], offenses);

  return offenses;
}

function loadPair(files, offenses) {
  const out = {};
  for (const [locale, file] of Object.entries(files)) {
    try {
      out[locale] = flatten(readJSONC(file));
    } catch (error) {
      offenses.push(
        offense({ rule: 'i18n', file, code: 'invalid-json', message: error.message })
      );
      return null;
    }
  }
  return out;
}

/**
 * Uma chave é válida se existe exatamente, ou se é um nó de pluralização
 * (`orders.items_count` cobrindo `.one`/`.other`).
 */
function hasKey(flatKeys, key) {
  return key in flatKeys || Object.keys(flatKeys).some((k) => k.startsWith(`${key}.`));
}

function checkParity(pair, files, offenses) {
  const [a, b] = Object.keys(pair);
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    for (const key of Object.keys(pair[from])) {
      if (!(key in pair[to])) {
        offenses.push(
          offense({
            rule: 'i18n',
            file: files[to],
            code: `parity:${key}`,
            message: `Chave "${key}" existe em ${files[from]} mas falta em ${files[to]}.`,
          })
        );
      }
    }
  }
}

function reportOrphans(flatKeys, used, file, offenses) {
  for (const key of Object.keys(flatKeys)) {
    // Normaliza sufixos de pluralização antes de comparar com o uso.
    const base = key.replace(/\.(one|other|zero|two|few|many)$/, '');
    if (used.has(key) || used.has(base)) continue;
    offenses.push(
      offense({
        rule: 'i18n',
        file,
        severity: 'warn',
        code: `orphan:${key}`,
        message: `Chave "${key}" não é usada em lugar nenhum do tema.`,
      })
    );
  }
}

/**
 * Todo `default` declarado em schema, indexado por id do setting:
 * `id -> Set(valores)`. Serve para distinguir um `| default:` que é cópia
 * redundante de um que é a única fonte do texto — os dois são violação, mas a
 * correção é diferente: um se apaga, o outro precisa ganhar dono antes.
 *
 * O índice é por id e não por arquivo porque um snippet lê
 * `block.settings.installment_text` sem saber de que section o bloco veio. Casar
 * também o VALOR evita que dois settings homônimos se confundam.
 */
function collectDeclaredDefaults() {
  const byId = new Map();
  const add = (id, value) => {
    if (!id || typeof value !== 'string') return;
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(value);
  };

  try {
    for (const group of readJSONC('config/settings_schema.json')) {
      for (const setting of group.settings ?? []) add(setting.id, setting.default);
    }
  } catch {
    // JSON inválido já é reportado acima; aqui só não há o que indexar.
  }

  for (const file of list('sections')) {
    const parsed = extractSchema(read(file));
    if (!parsed?.json) continue;
    for (const setting of parsed.json.settings ?? []) add(setting.id, setting.default);
    for (const block of parsed.json.blocks ?? []) {
      for (const setting of block.settings ?? []) add(setting.id, setting.default);
    }
  }

  return byId;
}
