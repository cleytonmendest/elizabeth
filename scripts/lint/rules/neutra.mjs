/**
 * neutra — a `main` é o tema instalado do zero.
 *
 * ── De onde vem ────────────────────────────────────────────────────────────
 *
 * O [ADR 0018](../../../docs/adr/0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md)
 * fez de cada loja uma branch `loja/<nome>` e deixou a `main` para o tema. Ele
 * diz duas coisas sobre o conteúdo dela (`CONTEUDO_DA_LOJA`, em
 * `scripts/lojas.mjs`):
 *
 *   1. ele não aponta nenhum recurso de loja;
 *   2. a home usa toda section que pode entrar numa home.
 *
 * As duas eram falsas quando o ADR foi escrito, e as duas são do tipo que
 * volta a ser falsa sem ninguém ver: basta copiar um JSON de uma loja para a
 * `main`, ou criar uma section e não pô-la na home.
 *
 * ── 1. Recurso de loja ─────────────────────────────────────────────────────
 *
 * O inventário da fase 3 (#168) achou três formas de apontar a loja que
 * escolheu, e a regra cobre as três:
 *
 *   - `shopify://`: foto, vídeo, link e app embed. 26 no `index.json` e 11 no
 *     `settings_data.json` (logo e favicon, no `current` e nos quatro presets,
 *     e o app embed do Discounty);
 *   - handle de coleção ou produto: `"collection": "new-in"`. Não tem
 *     `shopify://`, e numa instalação nova aponta o nada do mesmo jeito;
 *   - menu: o cabeçalho apontava `menu-principal`, e o rodapé
 *     `institucional`, `politicas` e `central-do-cliente`. Só `main-menu` e
 *     `footer` existem em toda loja, porque a Shopify os cria com ela.
 *
 * E uma quarta, que não é recurso: o logotipo da Elizabeth Estudos, em SVG,
 * no `logo_svg` do `current` e dos quatro presets. Numa instalação nova ele
 * aparecia no cabeçalho no lugar do nome da loja, e escolher um preset o
 * trazia de volta. A identidade da loja (`IDENTIDADE_DA_LOJA`) nasce vazia.
 *
 * O tipo do setting vem do schema, e não do nome da chave: `link` pode ser
 * `url` numa section e `text` em outra.
 *
 * ── 2. A home usa toda section ─────────────────────────────────────────────
 *
 * O `e2e/a11y.spec.mjs` mede `/`. Com toda section na home, ele mede todos os
 * componentes, e não só os oito tipos que a home de moda usava. Uma section
 * nova que não entra na home é uma section que a suíte de navegador nunca
 * abre.
 *
 * "Pode entrar na home" é o que o editor oferece em "Adicionar section" no
 * `index`: tem preset, e o `enabled_on`/`disabled_on` não a barra. Conta como
 * usada a section do `templates/index.json` e a dos section groups, que toda
 * página renderiza (a barra de anúncio mora no grupo do cabeçalho).
 *
 * A section que fica de fora entra em `FORA_DA_HOME`, com o motivo escrito.
 * Entrada que perdeu o sentido reprova também: section que entrou na home,
 * ou que deixou de poder entrar. Senão a lista vira o lugar onde se esconde
 * uma section da suíte.
 *
 * ── O que ela não é ────────────────────────────────────────────────────────
 *
 * Ela não roda nas lojas. O conteúdo de uma `loja/*` aponta a loja dela, e é
 * para isso que ele existe. O `scripts/lojas.mjs` confere o JSON das lojas só
 * contra o código (`referenciasDoTemplate`), e o gate não roda em PR para
 * `loja/*` (`.github/workflows/ci.yml`).
 */
import { DIRS, extractSchema, lineAt, list, offense, read, readJSONC } from '../lib.mjs';
import { ehConteudoDaLoja } from '../../lojas.mjs';
import { schemaDoDisco } from './refs.mjs';

export const meta = {
  name: 'neutra',
  title: 'A main é o tema instalado do zero',
  description:
    'O conteúdo da main não aponta recurso de loja, e a home usa toda section que pode entrar nela.',
  ratchet: false,
};

/**
 * Os settings globais que SÃO a loja: o nome dela, desenhado, e o ícone da
 * aba. Vazios, o cabeçalho mostra o nome que a lojista deu à loja.
 */
export const IDENTIDADE_DA_LOJA = ['logo', 'logo_svg', 'favicon'];

/** Os menus que a Shopify cria com toda loja. */
export const MENUS_DE_TODA_LOJA = ['main-menu', 'footer'];

/**
 * Setting que guarda o handle de um recurso que só existe na loja que o
 * escolheu. `image_picker`, `video` e `url` guardam `shopify://`, e caem na
 * outra metade da regra.
 */
export const TIPOS_DE_RECURSO = new Set([
  'article',
  'blog',
  'collection',
  'collection_list',
  'metaobject',
  'metaobject_list',
  'page',
  'product',
  'product_list',
]);

/**
 * As sections que podem entrar numa home e não entram na da `main`.
 *
 * O motivo é a parte que vale: "não ficou bonito" não é motivo, porque a home
 * da `main` é o que a suíte de navegador mede, não uma vitrine.
 */
export const FORA_DA_HOME = {
  apps:
    'Renderiza só bloco de app, e bloco de app aponta um app instalado na loja ' +
    '(`shopify://apps/…`), que é justamente o que a main não pode apontar. Vazia, ' +
    'não há o que medir.',
  'countdown-timer':
    'Precisa de uma data de término. A data padrão vence, e vencida a section some ' +
    'da vitrine (ADR 0016): a suíte mediria o vazio. Uma data no futuro distante ' +
    'seria a urgência que não acaba, que o ADR 0016 proíbe.',
  'custom-liquid':
    'O conteúdo é Liquid escrito pela lojista. Vazia, a section não renderiza nada, ' +
    'de propósito (ver o cabeçalho de sections/custom-liquid.liquid).',
  'main-article':
    'Lê o `article` da página de artigo. Na home esse objeto não existe, e a section ' +
    'sai sem conteúdo. Ela mora em templates/article.json.',
  'main-blog':
    'Lê o `blog` da página de blog. Na home esse objeto não existe, e a section sai ' +
    'sem conteúdo. Ela mora em templates/blog.json.',
};

const vazio = (valor) =>
  valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);

/** Um valor de setting de tipo `tipo` aponta um recurso que só a loja dele tem? */
export function apontaRecursoDeLoja(tipo, valor) {
  if (vazio(valor)) return false;
  if (tipo === 'link_list') return !MENUS_DE_TODA_LOJA.includes(valor);
  return TIPOS_DE_RECURSO.has(tipo);
}

/**
 * Toda string do JSON que contém `shopify://`, com o caminho até ela. Contém,
 * e não começa com: o texto rico guarda o link para uma coleção dentro do
 * HTML (`<a href="shopify://collections/calcas">`).
 */
export function enderecosDeLoja(valor, caminho = '') {
  if (typeof valor === 'string') return valor.includes('shopify://') ? [{ caminho, valor }] : [];
  if (!valor || typeof valor !== 'object') return [];
  return Object.entries(valor).flatMap(([chave, filho]) =>
    enderecosDeLoja(filho, caminho ? `${caminho}.${chave}` : chave)
  );
}

/**
 * O que um arquivo de conteúdo aponta e só existe numa loja.
 *
 * Pura: recebe o JSON já lido; `schemaDe(tipo)` para template e section group,
 * `settingsSchema` para o `settings_data.json`.
 *
 * @returns {{ code: string, caminho: string, valor: unknown, message: string }[]}
 */
export function recursosDeLoja(json, { schemaDe = () => null, settingsSchema } = {}) {
  const achados = enderecosDeLoja(json).map(({ caminho, valor }) => ({
    code: `shopify:${caminho}`,
    caminho,
    valor,
    message:
      `"${caminho}" aponta ${valor.match(/shopify:\/\/[^\s"'<>]*/)[0]}, que só existe na ` +
      'loja que o escolheu. Numa instalação nova ele não resolve. Na main, deixe o campo vazio.',
  }));

  const confere = (onde, declarados, valores) => {
    if (!valores || typeof valores !== 'object') return;
    const tipos = new Map((declarados ?? []).filter((s) => s?.id).map((s) => [s.id, s.type]));
    for (const [id, valor] of Object.entries(valores)) {
      const tipo = tipos.get(id);
      if (!apontaRecursoDeLoja(tipo, valor)) continue;
      const caminho = `${onde}.${id}`;
      achados.push({
        code: `${tipo}:${caminho}`,
        caminho,
        valor,
        message:
          tipo === 'link_list'
            ? `"${caminho}" aponta o menu "${valor}", que só existe na loja que o criou. ` +
              `Na main, use um dos menus que toda loja tem: ${MENUS_DE_TODA_LOJA.join(', ')}.`
            : `"${caminho}" (${tipo}) aponta "${valor}", um handle que só existe na loja ` +
              'que o escolheu. Na main, deixe o campo vazio.',
      });
    }
  };

  for (const [id, section] of Object.entries(json?.sections ?? {})) {
    const schema = schemaDe(section?.type);
    if (!schema) continue;
    confere(`sections.${id}.settings`, schema.settings, section.settings);
    const blocos = new Map((schema.blocks ?? []).map((b) => [b?.type, b]));
    for (const [idDoBloco, bloco] of Object.entries(section.blocks ?? {})) {
      confere(
        `sections.${id}.blocks.${idDoBloco}.settings`,
        blocos.get(bloco?.type)?.settings,
        bloco?.settings
      );
    }
  }

  // A identidade que não é `shopify://`: o `logo_svg` é markup. A que é já
  // saiu acima, e não precisa sair duas vezes.
  const identidade = (onde, valores) => {
    for (const id of IDENTIDADE_DA_LOJA) {
      const valor = valores?.[id];
      if (vazio(valor) || String(valor).includes('shopify://')) continue;
      const caminho = `${onde}.${id}`;
      achados.push({
        code: `identidade:${caminho}`,
        caminho,
        valor,
        message:
          `"${caminho}" carrega a identidade de uma loja. Numa instalação nova ela aparece ` +
          'no lugar da loja que instalou o tema. Na main, deixe o campo vazio.',
      });
    }
  };

  if (settingsSchema) {
    const globais = settingsSchema.flatMap((grupo) => grupo?.settings ?? []);
    for (const [onde, valores] of [
      ['current', json?.current],
      ...Object.entries(json?.presets ?? {}).map(([nome, v]) => [`presets.${nome}`, v]),
    ]) {
      confere(onde, globais, valores);
      identidade(onde, valores);
    }
  }

  return achados;
}

/**
 * A leitura certa para cada arquivo de conteúdo: o `settings_data.json` pelo
 * schema global, que tem a identidade e os app embeds; templates e section
 * groups pelo schema de cada section.
 */
export function recursosDoArquivo(file, json, { schemaDe, settingsSchema }) {
  return recursosDeLoja(json, file === 'config/settings_data.json' ? { settingsSchema } : { schemaDe });
}

/** O editor oferece esta section em "Adicionar section", na home? */
export function podeIrNaHome(schema) {
  if (!schema?.presets?.length) return false;
  const naHome = (lista) => (lista ?? []).some((t) => t === '*' || t === 'index');
  if (schema.enabled_on && !naHome(schema.enabled_on.templates)) return false;
  return !naHome(schema.disabled_on?.templates);
}

/**
 * A contabilidade da home fecha?
 *
 * @param {object} p
 * @param {string[]} p.elegiveis  as sections que podem ir na home
 * @param {Iterable<string>} p.usadas  as que estão na home ou num section group
 * @param {Record<string, string>} p.foraDaHome  as que ficam de fora, com o motivo
 * @returns {{ esquecidas: string[], naHomeENaLista: string[], quePodemIr: string[], semMotivo: string[] }}
 */
export function contabilidadeDaHome({ elegiveis, usadas, foraDaHome }) {
  const usada = new Set(usadas);
  const pode = new Set(elegiveis);
  const listadas = Object.keys(foraDaHome);
  return {
    esquecidas: elegiveis.filter((tipo) => !usada.has(tipo) && !(tipo in foraDaHome)),
    naHomeENaLista: listadas.filter((tipo) => usada.has(tipo)),
    quePodemIr: listadas.filter((tipo) => !pode.has(tipo)),
    semMotivo: listadas.filter((tipo) => String(foraDaHome[tipo] ?? '').trim().length < 20),
  };
}

const HOME = 'templates/index.json';

export function run() {
  const ofensas = [];
  const schemaGlobal = readJSONC('config/settings_schema.json');

  const conteudo = [
    ...list(DIRS.templates, '.json'),
    ...list(DIRS.sections, '.json'),
    'config/settings_data.json',
  ].filter(ehConteudoDaLoja);

  const lidos = new Map();
  for (const file of conteudo) {
    let json;
    try {
      json = readJSONC(file);
    } catch {
      continue; // JSON inválido é problema da regra `refs`.
    }
    lidos.set(file, json);

    const src = read(file);
    const achados = recursosDoArquivo(file, json, { schemaDe: schemaDoDisco, settingsSchema: schemaGlobal });
    for (const achado of achados) {
      ofensas.push(
        offense({
          rule: 'neutra',
          file,
          line: lineAt(src, Math.max(0, src.indexOf(JSON.stringify(achado.valor)))),
          code: achado.code,
          message: achado.message,
        })
      );
    }
  }

  const elegiveis = list(DIRS.sections)
    .map((file) => ({ tipo: file.slice(DIRS.sections.length + 1, -'.liquid'.length), file }))
    .filter(({ file }) => podeIrNaHome(extractSchema(read(file))?.json))
    .map(({ tipo }) => tipo);

  const usadas = [HOME, ...list(DIRS.sections, '.json')].flatMap((file) =>
    Object.values(lidos.get(file)?.sections ?? {}).map((s) => s?.type)
  );

  const conta = contabilidadeDaHome({ elegiveis, usadas, foraDaHome: FORA_DA_HOME });
  const reprova = (file, code, message) => ofensas.push(offense({ rule: 'neutra', file, code, message }));

  for (const tipo of conta.esquecidas) {
    reprova(
      HOME,
      `fora-da-home:${tipo}`,
      `A section "${tipo}" pode entrar numa home e não está em ${HOME}, nem num section ` +
        'group. A suíte de navegador mede a home, e nunca a abre. Ponha a section na home, ' +
        'a partir do preset dela, ou em FORA_DA_HOME (scripts/lint/rules/neutra.mjs) com o motivo.'
    );
  }
  for (const tipo of conta.naHomeENaLista) {
    reprova(
      'scripts/lint/rules/neutra.mjs',
      `lista-vencida:${tipo}`,
      `"${tipo}" está em FORA_DA_HOME e na home ao mesmo tempo. Tire-a da lista.`
    );
  }
  for (const tipo of conta.quePodemIr) {
    reprova(
      'scripts/lint/rules/neutra.mjs',
      `lista-vencida:${tipo}`,
      `"${tipo}" está em FORA_DA_HOME, mas não é uma section que pode entrar numa home ` +
        '(não existe, não tem preset, ou o schema a barra do index). Tire-a da lista.'
    );
  }
  for (const tipo of conta.semMotivo) {
    reprova(
      'scripts/lint/rules/neutra.mjs',
      `sem-motivo:${tipo}`,
      `"${tipo}" está em FORA_DA_HOME sem um motivo escrito.`
    );
  }

  return ofensas;
}
