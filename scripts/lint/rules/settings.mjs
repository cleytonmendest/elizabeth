/**
 * settings — o contrato entre `settings_schema.json` e o tema, nos dois sentidos.
 *
 * Duas falhas silenciosas, espelhadas:
 *
 *   1. Setting DECLARADO que ninguém lê. O lojista preenche o campo no admin,
 *      salva, e não acontece nada em lugar nenhum. É pior do que não ter o
 *      campo: promete controle e não entrega — o oposto exato do princípio
 *      "tudo que aparece, o lojista edita".
 *
 *   2. Setting LIDO que ninguém declara. `settings.foo` resolve para nil, e o
 *      Liquid renderiza vazio sem erro. Um `{% if %}` sobre ele é sempre falso,
 *      então o bloco inteiro some da loja e nada indica o porquê.
 *
 * Esta regra existe porque `social_tiktok_link`, `social_snapchat_link`,
 * `social_tumblr_link` e `social_vimeo_link` estão declarados desde sempre e
 * nunca foram lidos por arquivo nenhum do tema.
 *
 * Nota sobre o que NÃO é violação: `type: header` e `type: paragraph` não têm
 * `id` (são rótulos visuais do editor), e `config/settings_data.json` é onde os
 * valores ficam guardados — armazenar não é usar.
 */
import { allLiquid, lineAt, offense, read, readJSONC, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'settings',
  title: 'Settings globais',
  description: 'Todo setting declarado é lido, e todo setting lido é declarado.',
  ratchet: true,
};

const SCHEMA = 'config/settings_schema.json';

/**
 * Casa `settings.foo`, mas não `block.settings.foo`, `section.settings.foo`
 * nem `scheme.settings.foo` — esses são outro escopo e têm outro contrato.
 */
const USAGE = /(?<![.\w])settings\.([a-zA-Z_][a-zA-Z0-9_]*)/g;

export function run() {
  const offenses = [];

  let groups;
  try {
    groups = readJSONC(SCHEMA);
  } catch (error) {
    return [
      offense({ rule: 'settings', file: SCHEMA, code: 'invalid-json', message: error.message }),
    ];
  }

  // Declarados: id → o grupo em que vive, para a mensagem dizer onde procurar.
  const declared = new Map();
  for (const group of groups) {
    for (const setting of group.settings ?? []) {
      if (setting.id) declared.set(setting.id, group.name ?? 'sem grupo');
    }
  }

  // Lidos: id → primeiro lugar onde aparece.
  const used = new Map();
  for (const file of allLiquid()) {
    const src = stripInert(read(file));
    for (const match of src.matchAll(USAGE)) {
      const id = match[1];
      if (!used.has(id)) used.set(id, { file, line: lineAt(src, match.index) });
    }
  }

  // 1. Declarado e nunca lido.
  for (const [id, group] of declared) {
    if (used.has(id)) continue;
    if (isAllowed('settings', SCHEMA, `unused:${id}`)) continue;
    offenses.push(
      offense({
        rule: 'settings',
        file: SCHEMA,
        code: `unused:${id}`,
        message: `Setting "${id}" (grupo "${group}") não é lido por nenhum arquivo do tema — o lojista preenche e nada acontece.`,
      })
    );
  }

  // 2. Lido e nunca declarado.
  for (const [id, where] of used) {
    if (declared.has(id)) continue;
    if (isAllowed('settings', where.file, `undeclared:${id}`)) continue;
    offenses.push(
      offense({
        rule: 'settings',
        file: where.file,
        line: where.line,
        code: `undeclared:${id}`,
        message: `settings.${id} não existe em ${SCHEMA} — resolve para nil e renderiza vazio, sem erro.`,
      })
    );
  }

  return offenses;
}
