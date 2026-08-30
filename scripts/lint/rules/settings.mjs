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
 * Vale nos dois escopos, porque a falha é a mesma:
 *
 *   GLOBAL   `config/settings_schema.json` × todo o tema
 *   SECTION  o `{% schema %}` da section × o markup dela
 *
 * Esta regra existe porque `social_tiktok_link`, `social_snapchat_link`,
 * `social_tumblr_link` e `social_vimeo_link` estão declarados desde sempre e
 * nunca foram lidos por arquivo nenhum do tema. O escopo de section entrou
 * depois: `blog-posts` declarava um `background_color` que o markup nunca lia,
 * e só foi pego de raspão pela regra `designscope`, por outro motivo.
 *
 * Nota sobre o que NÃO é violação: `type: header` e `type: paragraph` não têm
 * `id` (são rótulos visuais do editor), e `config/settings_data.json` é onde os
 * valores ficam guardados — armazenar não é usar.
 */
import { allLiquid, extractSchema, lineAt, list, offense, read, readJSONC, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'settings',
  title: 'Settings declarados',
  description: 'Todo setting declarado é lido — global e de section — e todo lido é declarado.',
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

  // --- Settings de section: declarados no schema, lidos no markup ---
  //
  // Um setting de section é lido como `section.settings.x`, e um de bloco como
  // `block.settings.x` — mas o nome da variável do loop varia (`b.settings.x`),
  // então casamos `settings.x` com qualquer prefixo. Isso pode colidir com um
  // setting global de mesmo id, o que faz a regra deixar de reportar em vez de
  // reportar errado: o lado seguro.
  //
  // O escopo NÃO é só o arquivo da section. Um snippet renderizado por ela lê
  // `section.settings.x` direto (product-gallery faz isso), ou recebe o valor
  // como parâmetro. Olhar só a section acusa 70 falsos positivos — 31 no
  // main-product, que delega quase tudo a snippets. Então o escopo é o fecho
  // transitivo dos `render` a partir da section.
  for (const file of list('sections')) {
    const parsed = extractSchema(read(file));
    if (!parsed?.json) continue;

    const name = file.replace('sections/', '').replace('.liquid', '');
    // Só markup: o próprio `{% schema %}` cita todos os ids, e presets são
    // valores guardados, não uso.
    const markup = withRenderedSnippets(file);

    // Liquid permite apelidar o objeto: `assign st = section.settings` e depois
    // `st.heading`. countdown-timer faz isso com TODOS os seus 19 settings, o
    // que fazia a regra acusar a section inteira. Seguir o alias é obrigatório
    // para a regra dizer a verdade.
    const holders = ['settings'];
    for (const alias of markup.matchAll(
      /\{%-?\s*assign\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[a-zA-Z_][a-zA-Z0-9_]*\.settings\s*-?%\}|\bassign\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[a-zA-Z_][a-zA-Z0-9_]*\.settings\b/g
    )) {
      holders.push(alias[1] ?? alias[2]);
    }

    const declared = [
      ...(parsed.json.settings ?? []).map((s) => ({ s, where: 'section' })),
      ...(parsed.json.blocks ?? []).flatMap((b) =>
        (b.settings ?? []).map((s) => ({ s, where: `bloco "${b.type}"` }))
      ),
    ];

    for (const { s: setting, where } of declared) {
      if (!setting.id) continue;
      const id = setting.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const used = new RegExp(
        `(?:${holders.join('|')})\\.${id}\\b|(?:${holders.join('|')})\\[['"\`]${id}['"\`]\\]`
      ).test(markup);
      if (used) continue;
      if (isAllowed('settings', file, `unused-section:${setting.id}`)) continue;

      offenses.push(
        offense({
          rule: 'settings',
          file,
          line: parsed.line,
          code: `unused-section:${setting.id}`,
          message: `Setting "${setting.id}" (${where} de "${name}") não é lido no markup — o lojista preenche e nada acontece.`,
        })
      );
    }
  }

  return offenses;
}

/**
 * O markup da section somada ao de todo snippet que ela renderiza, direta ou
 * indiretamente. Um snippet lê `section.settings.x` como se estivesse na
 * section, então ignorá-lo faz a regra acusar settings que funcionam.
 */
function withRenderedSnippets(file, seen = new Set()) {
  if (seen.has(file)) return '';
  seen.add(file);

  let src;
  try {
    src = stripInert(read(file));
  } catch {
    return '';
  }

  let out = src;
  for (const match of src.matchAll(/\{%-?\s*(?:render|include)\s+'([a-zA-Z0-9_\/-]+)'/g)) {
    out += withRenderedSnippets(`snippets/${match[1]}.liquid`, seen);
  }
  return out;
}
