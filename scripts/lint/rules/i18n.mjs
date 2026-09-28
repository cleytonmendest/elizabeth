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
 *   6. setting que nasce preenchido na frente de um texto traduzido
 *
 * O que NÃO é violação, por decisão: `default` de setting e blocos `presets`
 * são conteúdo do lojista (texto literal é o correto — é lá que o texto do
 * modo 5 deve morar), e labels puramente numéricos (dia, hora, minuto) são
 * independentes de idioma. A exceção é o modo 6: quando o próprio Liquid já
 * tem um texto traduzido para o setting vazio, o literal não é conteúdo — é o
 * que impede a tradução de aparecer.
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
 * `{{ 'chave' | t: default: 'frase' }}` — a porta que o `LIQUID_DEFAULT` acima
 * NÃO alcança, e por construção: ele exige um identificador antes do filtro, e
 * aqui o que vem antes é uma chave entre aspas.
 *
 * O CLAUDE.md proibia isto em prosa desde sempre ("Nunca `| t: default: '...'`
 * — crie a chave de verdade") e nada verificava. Ver issue #130.
 *
 * Por que é pior que parece: o `default:` do filtro `t` é o texto que a Shopify
 * mostra QUANDO A CHAVE NÃO EXISTE. Ou seja, ele não é um valor de reserva —
 * ele é o "translation missing" silenciado. A chave continua faltando nos dois
 * locales, o linter de paridade não a vê (porque ela não existe para ser
 * comparada), e a loja em inglês exibe o português que alguém escreveu aqui.
 *
 * Sem filtro de "parece frase", ao contrário do outro: `| default:` recebe
 * frase e valor de código no mesmo lugar, e precisa separar os dois. Aqui não —
 * qualquer `t: default:` é uma chave que deveria existir e não existe.
 *
 * `[^}%]` mantém a busca dentro da mesma tag: sem isso, um `| t }}` numa linha
 * e um `default:` trinta linhas abaixo casariam como se fossem o mesmo.
 */
const T_COM_DEFAULT =
  /(['"])([^'"]*)\1\s*\|\s*t(?:ranslate)?\s*:[^}%]*?\bdefault:\s*(['"])([^'"]*)\3/g;

/**
 * As violações de `| t: default:` de uma fonte. Exportada para o teste injetar
 * o Liquid: o tema não tem nenhuma ocorrência hoje, então uma varredura real
 * não exercitaria o caminho que acusa — e teste que só percorre o caminho
 * verde não sabe se o vermelho existe.
 */
export function tDefault(file, src) {
  return [...src.matchAll(T_COM_DEFAULT)].map((match) => {
    const [, , chave, , texto] = match;
    return offense({
      rule: 'i18n',
      file,
      line: lineAt(src, match.index),
      code: `t-default:${chave}`,
      message:
        `\`| t: default: ${JSON.stringify(texto)}\` na chave "${chave}" — o \`default\` do ` +
        'filtro `t` é o que a Shopify mostra QUANDO A CHAVE NÃO EXISTE, então ele silencia o ' +
        '"translation missing" em vez de resolvê-lo: a chave continua faltando nos dois ' +
        'locales, e a loja em outro idioma exibe este texto em português. Crie a chave de ' +
        'verdade em pt-BR e en.default.',
    });
  });
}

/**
 * Modo 6. `{% if block.settings.button_text != blank %}{{ block.settings.button_text }}{% else %}{{ 'product.general.add_to_cart' | t }}{% endif %}`
 * é o padrão certo: o texto é da lojista quando ela escreve um, e do locale
 * quando o campo está vazio. O defeito é o campo NASCER preenchido — por um
 * `default` no schema, por um preset ou pelo valor salvo nos templates que o
 * tema entrega. Aí o `else` nunca roda, e a loja em inglês mostra
 * "ADICIONAR AO CARRINHO": foi assim no botão de compra da PDP e no da 404,
 * enquanto o `checkout_label` do carrinho, vazio, sempre acompanhou o idioma.
 *
 * O setting é lido num snippet, mas declarado na section que o renderiza —
 * às vezes dois níveis acima (`main-product` → `main-product-right` →
 * `add-to-cart`). Por isso a busca segue os `{% render %}` até as sections.
 */
const FALLBACK_TRADUZIDO =
  /\b(block|section)\.settings\.(\w+)\s*!=\s*blank\s*-?%\}[\s\S]{0,400}?\{%-?\s*else\s*-?%\}[\s\S]{0,200}?'([\w.]+)'\s*\|\s*t\b/g;

const RENDER = /\{%-?\s*(?:render|include)\s+'([\w-]+)'/g;

const preenchido = (valor) => typeof valor === 'string' && valor.trim() !== '';

const lerJson = (src) => JSON.parse(src.replace(/^\s*\/\*[\s\S]*?\*\//, ''));

/**
 * As violações do modo 6 num tema dado como `Map(caminho → conteúdo)`, com
 * `sections/`, `snippets/` e os JSON de `templates/` e dos grupos de section.
 * Pura para o teste montar um tema de mentira: no tema de verdade, depois da
 * correção, não sobra ocorrência para exercitar o caminho que acusa.
 */
export function fallbacksPreenchidos(arquivos) {
  const liquid = [...arquivos.keys()].filter((f) => /^(sections|snippets)\/[^/]+\.liquid$/.test(f));
  const renderiza = new Map(
    liquid.map((f) => [
      f,
      [...stripInert(arquivos.get(f)).matchAll(RENDER)].map((m) => `snippets/${m[1]}.liquid`),
    ])
  );
  const alcanca = (de, alvo, vistos = new Set()) => {
    if (de === alvo) return true;
    if (vistos.has(de)) return false;
    vistos.add(de);
    return (renderiza.get(de) ?? []).some((proximo) => alcanca(proximo, alvo, vistos));
  };
  const tipoDa = (section) => section.replace(/^sections\/|\.liquid$/g, '');
  const jsons = [...arquivos.keys()].filter((f) => /^(templates\/.+|sections\/[^/]+)\.json$/.test(f));

  const achados = new Map();
  const acusa = (file, code, message, line) => {
    const chave = `${file}|${code}`;
    if (!achados.has(chave)) achados.set(chave, offense({ rule: 'i18n', file, line, code, message }));
  };
  const porque = (id, chave, onde) =>
    `o Liquid (${onde}) usa '${chave}' | t quando "${id}" está vazio, mas o campo nasce preenchido — ` +
    'então o texto traduzido nunca aparece, e a loja em outro idioma mostra este literal. Deixe o ' +
    'campo vazio e diga no `info` que vazio usa o texto traduzido (como `checkout_label` do carrinho).';

  for (const onde of liquid) {
    for (const match of stripInert(arquivos.get(onde)).matchAll(FALLBACK_TRADUZIDO)) {
      const [, escopo, id, chave] = match;
      const sections = liquid.filter((f) => f.startsWith('sections/') && alcanca(f, onde));

      for (const section of sections) {
        const parsed = extractSchema(arquivos.get(section));
        if (!parsed?.json) continue;
        const { settings = [], blocks = [], presets = [] } = parsed.json;

        const donos = escopo === 'section' ? [{ tipo: null, settings }] : blocks.map((b) => ({ tipo: b.type, settings: b.settings ?? [] }));
        for (const dono of donos) {
          const setting = dono.settings.find((s) => s.id === id);
          if (!preenchido(setting?.default)) continue;
          const nome = dono.tipo ? `${dono.tipo}.${id}` : id;
          acusa(section, `fallback-preenchido:${nome}`, `\`default\` ${JSON.stringify(setting.default)} em "${nome}": ${porque(id, chave, onde)}`, parsed.line);
        }

        for (const preset of presets) {
          const valores =
            escopo === 'section'
              ? [[null, preset.settings?.[id]]]
              : (preset.blocks ?? []).map((b) => [b.type, b.settings?.[id]]);
          for (const [tipo, valor] of valores) {
            if (!preenchido(valor)) continue;
            const nome = tipo ? `${tipo}.${id}` : id;
            acusa(section, `fallback-preenchido:preset.${nome}`, `Preset "${preset.name}" preenche "${nome}" com ${JSON.stringify(valor)}: ${porque(id, chave, onde)}`, parsed.line);
          }
        }

        for (const json of jsons) {
          let dados;
          try {
            dados = lerJson(arquivos.get(json));
          } catch {
            continue; // JSON inválido é assunto de outra checagem.
          }
          for (const entrada of Object.values(dados.sections ?? {})) {
            if (entrada?.type !== tipoDa(section)) continue;
            const valores =
              escopo === 'section'
                ? [[null, entrada.settings?.[id]]]
                : Object.values(entrada.blocks ?? {}).map((b) => [b.type, b.settings?.[id]]);
            for (const [tipo, valor] of valores) {
              if (!preenchido(valor)) continue;
              const nome = [entrada.type, tipo, id].filter(Boolean).join('.');
              acusa(json, `fallback-salvo:${nome}`, `O template salva "${nome}" = ${JSON.stringify(valor)}: ${porque(id, chave, onde)}`);
            }
          }
        }
      }
    }
  }

  return [...achados.values()];
}

/** O tema do disco no formato que `fallbacksPreenchidos` recebe. */
export function arquivosDoTema() {
  const caminhos = [
    ...list('sections'),
    ...list('snippets'),
    ...list('sections', '.json'),
    ...list('templates', '.json', { recursive: true }),
  ];
  return new Map(caminhos.map((f) => [f, read(f)]));
}

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

    // `{{ 'chave' | t: default: 'frase' }}` — ver `tDefault`.
    for (const achado of tDefault(file, src)) {
      if (isAllowed('i18n', file, achado.code)) continue;
      offenses.push(achado);
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

  // --- Modo 6: setting que nasce preenchido na frente de um texto traduzido ---
  for (const achado of fallbacksPreenchidos(arquivosDoTema())) {
    if (isAllowed('i18n', achado.file, achado.code)) continue;
    offenses.push(achado);
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
