/**
 * i18n — nenhuma string voltada ao usuário fica hardcoded, e os locales
 * PT/EN nunca divergem.
 *
 * Cobre os quatro modos de falha que a Theme Store reprova:
 *   1. `label`/`info`/`content`/`name` de schema escritos literalmente
 *   2. chave usada no código que não existe no locale ("translation missing")
 *   3. chave presente em um idioma e ausente no outro
 *   4. chave órfã acumulando no locale (aviso — não quebra a loja)
 *
 * O que NÃO é violação, por decisão: `default` de setting e blocos `presets`
 * são conteúdo do lojista (texto literal é o correto), e labels puramente
 * numéricos (dia, hora, minuto) são independentes de idioma.
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

export const meta = {
  name: 'i18n',
  title: 'Internacionalização',
  description: 'Schemas 100% em chaves `t:`, locales PT/EN em paridade, nenhuma chave faltante.',
  ratchet: true,
};

const TRANSLATABLE = new Set(['label', 'info', 'content', 'name']);
const NUMERIC = /^\d+$/;

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
