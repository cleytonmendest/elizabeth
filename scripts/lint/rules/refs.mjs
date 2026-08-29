/**
 * refs — integridade referencial do tema.
 *
 * Pega o tipo de bug que não quebra no editor mas quebra na loja: um template
 * JSON apontando para uma section que não existe, um `render` de snippet
 * ausente, um `asset_url` de arquivo que ninguém subiu.
 *
 * Esta regra existe porque `templates/product.json` referencia a section `apps`
 * sem que `sections/apps.liquid` exista no repositório.
 */
import {
  allJsonTemplates,
  allLiquid,
  exists,
  lineAt,
  offense,
  read,
  readJSONC,
  stripInert,
} from '../lib.mjs';

export const meta = {
  name: 'refs',
  title: 'Integridade referencial',
  description: 'Sections, snippets e assets referenciados existem no repositório.',
  ratchet: false,
};

export function run() {
  const offenses = [];

  // 1. Sections referenciadas em templates JSON e section groups.
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
    for (const [id, section] of Object.entries(json.sections ?? {})) {
      const type = section?.type;
      if (!type) continue;
      if (!exists(`sections/${type}.liquid`)) {
        offenses.push(
          offense({
            rule: 'refs',
            file,
            code: `missing-section:${type}`,
            message: `Section "${type}" (id "${id}") não existe em sections/${type}.liquid — a página falha ao renderizar.`,
          })
        );
      }
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
