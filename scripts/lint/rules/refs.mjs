/**
 * refs — integridade referencial do tema.
 *
 * Pega o tipo de bug que não quebra no editor mas quebra na loja: um template
 * JSON apontando para uma section que não existe, um `render` de snippet
 * ausente, um `asset_url` de arquivo que ninguém subiu.
 *
 * Esta regra existe porque `templates/product.json` referencia a section `apps`
 * sem que `sections/apps.liquid` exista no repositório.
 *
 * ── Bloco e setting, desde o ADR 0018 ──────────────────────────────────────
 *
 * Section inexistente era a única referência de template conferida, e isso
 * foi medido antes de mudar: com `templates/product.json` apontando um bloco
 * `bloco_que_nao_existe` e um setting `setting_que_nao_existe`, esta regra, a
 * `templates` e o Theme Check saíam limpos. Só a section inexistente reprovava.
 *
 * Com uma loja por branch, isso deixou de ser detalhe. Renomear um setting ou
 * remover um bloco na `main` é a quebra mais provável de uma loja, e as duas
 * passavam: o JSON da loja continua apontando o nome velho, e ela perde a
 * customização sem erro nenhum. Por isso a conferência virou função pura —
 * `referenciasDoTemplate` —, que o `scripts/lojas.mjs` roda sobre o JSON de
 * cada `loja/*`, lido de outra branch, contra o código do PR.
 *
 * A primeira execução achou cinco settings órfãos nos templates da própria
 * `main` (`show_breadcrumb` no artigo, três `newsletter_*` no blog,
 * `enable_price_filter` na coleção): settings que saíram do schema e ficaram
 * no JSON. Foram removidos no mesmo PR, e é por isso que esta regra continua
 * sem baseline.
 */
import {
  allJsonTemplates,
  allLiquid,
  exists,
  extractSchema,
  lineAt,
  offense,
  read,
  readJSONC,
  stripInert,
} from '../lib.mjs';

export const meta = {
  name: 'refs',
  title: 'Integridade referencial',
  description:
    'Sections, blocos, settings, snippets e assets referenciados existem no repositório.',
  ratchet: false,
};

/**
 * Chaves de `settings_data.json` que não são setting do `settings_schema`: é
 * a estrutura que a própria Shopify grava ali. `blocks` guarda os app embeds;
 * `content_for_index` e `sections` são herança dos temas anteriores ao OS 2.0.
 */
export const ESTRUTURA_DO_SETTINGS_DATA = new Set(['blocks', 'content_for_index', 'sections']);

/** Bloco de app: o tipo é uma URL da Shopify, e o schema dele mora no app. */
const ehBlocoDeApp = (tipo) => typeof tipo === 'string' && tipo.startsWith('shopify://apps/');

const idsDe = (settings) => new Set((settings ?? []).map((s) => s?.id).filter(Boolean));

/**
 * O que um template JSON (ou section group) aponta e o código não tem.
 *
 * Pura: recebe o JSON já lido e `schemaDe(tipo)`, que devolve o schema da
 * section, `null` se o arquivo existe sem schema legível (outras regras
 * reprovam isso), ou `undefined` se o arquivo não existe.
 *
 * @param {object} json
 * @param {(tipo: string) => object | null | undefined} schemaDe
 * @returns {{ code: string, message: string }[]}
 */
export function referenciasDoTemplate(json, schemaDe) {
  const achados = [];

  for (const [id, section] of Object.entries(json?.sections ?? {})) {
    const type = section?.type;
    if (!type) continue;

    const schema = schemaDe(type);
    if (schema === undefined) {
      achados.push({
        code: `missing-section:${type}`,
        message: `Section "${type}" (id "${id}") não existe em sections/${type}.liquid — a página falha ao renderizar.`,
      });
      continue;
    }
    if (schema === null) continue;

    const settingsDaSection = idsDe(schema.settings);
    for (const chave of Object.keys(section.settings ?? {})) {
      if (settingsDaSection.has(chave)) continue;
      achados.push({
        code: `missing-setting:${type}.${chave}`,
        message:
          `Setting "${chave}" (section "${type}", id "${id}") não existe no schema de ` +
          `sections/${type}.liquid — o valor salvo é ignorado, e a section mostra o padrão.`,
      });
    }

    const blocosDoSchema = new Map((schema.blocks ?? []).map((b) => [b?.type, b]));
    for (const [idDoBloco, bloco] of Object.entries(section.blocks ?? {})) {
      const tipo = bloco?.type;
      if (!tipo) continue;

      if (ehBlocoDeApp(tipo)) {
        if (blocosDoSchema.has('@app')) continue;
        achados.push({
          code: `app-block-sem-app:${type}`,
          message:
            `Bloco de app "${tipo}" (id "${idDoBloco}") numa section cujo schema não aceita ` +
            `"@app" (sections/${type}.liquid).`,
        });
        continue;
      }

      const doSchema = blocosDoSchema.get(tipo);
      if (!doSchema) {
        achados.push({
          code: `missing-block:${type}/${tipo}`,
          message:
            `Bloco "${tipo}" (id "${idDoBloco}", section "${type}") não existe no schema de ` +
            `sections/${type}.liquid — o template aponta um bloco que o código não tem.`,
        });
        continue;
      }

      const settingsDoBloco = idsDe(doSchema.settings);
      for (const chave of Object.keys(bloco.settings ?? {})) {
        if (settingsDoBloco.has(chave)) continue;
        achados.push({
          code: `missing-block-setting:${type}/${tipo}.${chave}`,
          message:
            `Setting "${chave}" do bloco "${tipo}" (id "${idDoBloco}", section "${type}") não ` +
            `existe no schema — o valor salvo é ignorado, e o bloco mostra o padrão.`,
        });
      }
    }
  }

  return achados;
}

/**
 * O que o `settings_data.json` guarda e o `settings_schema.json` não declara,
 * no `current` e em cada preset. Mesma consequência do setting de section: um
 * setting global renomeado faz a loja perder o valor em silêncio.
 *
 * @param {object} settingsData  o `settings_data.json` já lido
 * @param {object[]} settingsSchema  o `settings_schema.json` já lido
 * @returns {{ code: string, message: string }[]}
 */
export function referenciasDoSettingsData(settingsData, settingsSchema) {
  const declarados = new Set(
    (settingsSchema ?? []).flatMap((grupo) => [...idsDe(grupo?.settings)])
  );
  const achados = [];

  const confere = (onde, valores) => {
    if (!valores || typeof valores !== 'object') return;
    for (const chave of Object.keys(valores)) {
      if (declarados.has(chave) || ESTRUTURA_DO_SETTINGS_DATA.has(chave)) continue;
      achados.push({
        code: `missing-global-setting:${chave}`,
        message:
          `"${chave}" (${onde}) não existe em config/settings_schema.json — o valor salvo é ` +
          'ignorado, e o tema usa o padrão.',
      });
    }
  };

  confere('current', settingsData?.current);
  for (const [nome, valores] of Object.entries(settingsData?.presets ?? {})) {
    confere(`preset "${nome}"`, valores);
  }
  return achados;
}

/** O schema de uma section do disco, no contrato de `referenciasDoTemplate`. */
export function schemaDoDisco(tipo) {
  const arquivo = `sections/${tipo}.liquid`;
  if (!exists(arquivo)) return undefined;
  return extractSchema(read(arquivo))?.json ?? null;
}

export function run() {
  const offenses = [];

  // 1. Sections, blocos e settings referenciados em templates JSON e section
  //    groups, e os settings globais do settings_data.
  for (const file of allJsonTemplates()) {
    let json;
    try {
      json = readJSONC(file);
    } catch (error) {
      offenses.push(
        offense({
          rule: 'refs',
          file,
          code: 'invalid-json',
          message: `JSON inválido: ${error.message}`,
        })
      );
      continue;
    }
    for (const { code, message } of referenciasDoTemplate(json, schemaDoDisco)) {
      offenses.push(offense({ rule: 'refs', file, code, message }));
    }
  }

  if (exists('config/settings_data.json') && exists('config/settings_schema.json')) {
    const file = 'config/settings_data.json';
    for (const { code, message } of referenciasDoSettingsData(
      readJSONC(file),
      readJSONC('config/settings_schema.json')
    )) {
      offenses.push(offense({ rule: 'refs', file, code, message }));
    }
  }

  // 2. Snippets renderizados e assets referenciados no Liquid.
  //    `stripInert` evita acusar os exemplos de uso escritos em {% comment %}.
  const RENDER = /\{%-?\s*(?:render|include)\s+'([a-zA-Z0-9_\/-]+)'/g;
  const ASSET = /'([a-zA-Z0-9_.@-]+\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?))'\s*\|\s*asset_url/g;

  for (const file of allLiquid()) {
    const src = stripInert(read(file));

    for (const match of src.matchAll(RENDER)) {
      const snippet = match[1];
      if (!exists(`snippets/${snippet}.liquid`)) {
        offenses.push(
          offense({
            rule: 'refs',
            file,
            line: lineAt(src, match.index),
            code: `missing-snippet:${snippet}`,
            message: `render '${snippet}' não encontra snippets/${snippet}.liquid — renderiza vazio silenciosamente.`,
          })
        );
      }
    }

    for (const match of src.matchAll(ASSET)) {
      const asset = match[1];
      if (!exists(`assets/${asset}`)) {
        offenses.push(
          offense({
            rule: 'refs',
            file,
            line: lineAt(src, match.index),
            code: `missing-asset:${asset}`,
            message: `asset_url aponta para assets/${asset}, que não existe.`,
          })
        );
      }
    }
  }

  return offenses;
}
