/**
 * editable — "tudo que puder ser editável deve ser editável".
 *
 * Traduz o princípio do tema em quatro verificações mecânicas:
 *
 *   1. Toda section expõe um setting `color_scheme`.
 *   2. O PORTADOR do scheme — o elemento que carrega `color-{{ ... }}` — pinta
 *      o próprio fundo.
 *   3. A section pinta cor de texto em algum lugar.
 *   4. Toda section que não é ligada a template nem a section group tem
 *      `presets`, senão o lojista não consegue adicioná-la.
 *
 * As verificações 2 e 3 existem porque o bug já aconteceu: foi corrigido em
 * footer/blog/artigo e permaneceu em main-product, main-collection,
 * section-images-link e slider-cards.
 *
 * ── Por que 2 e 3 são separadas, e por que 2 olha o portador ───────────────
 *
 * Até a #99 havia uma verificação só, e ela rodava dois regex sobre o ARQUIVO
 * INTEIRO. Qualquer ocorrência dos tokens, em qualquer elemento, em qualquer
 * profundidade, satisfazia a regra.
 *
 * `main-collection` passava assim. O portador não pintava nada:
 *
 *     <div class="page-width !py-8 color-{{ section.settings.color_scheme }}">
 *
 * e o que deixava a regra verde eram duas ocorrências sem relação com a
 * superfície: um `bg-background` na gaveta de filtros, que no desktop vira
 * `lg:bg-transparent`, e um `text-foreground/55` num parágrafo interno. A
 * página de coleção estava com o defeito da #28 e o linter não via.
 *
 * A #99 propunha duas saídas, e MEDIR mostrou que uma delas não funciona:
 * descer pela subárvore do portador deixaria `main-collection` passar do mesmo
 * jeito, porque os dois tokens estão DENTRO da subárvore dele — linhas 56 e 77,
 * sob o `<div>` da linha 26. Subárvore responde "o token existe aqui embaixo?",
 * e a pergunta que importa é "a superfície da section foi pintada?".
 *
 * Quem responde isso é o portador: ele é o elemento que define as variáveis do
 * scheme E o que cobre a section. Se o fundo dele não é pintado, o lojista
 * escolhe um scheme escuro e a página continua branca — não importa o que
 * exista mais abaixo.
 *
 * A cor de TEXTO continua valendo por arquivo, e de propósito: ela pode viver
 * num descendente legitimamente (o `header` pinta em `#main-header-container`)
 * ou ser explícita sobre mídia (`text-white` sobre scrim, em image-banner,
 * slider-image, video e countdown-timer). Exigi-la no portador transformaria
 * seis casos corretos em exceção escrita, sem pegar um defeito a mais.
 */
import { extractSchema, list, offense, read, readJSONC, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'editable',
  title: 'Editável pelo lojista',
  description: 'Sections com color scheme aplicado de verdade e adicionáveis no editor.',
  ratchet: true,
};

/** Sections presas a um template (main-*) não precisam de preset. */
const TEMPLATE_BOUND = /^main-/;

export function run() {
  const offenses = [];
  const inGroups = sectionsInGroups();

  for (const file of list('sections')) {
    const name = file.replace('sections/', '').replace('.liquid', '');
    const src = read(file);
    const parsed = extractSchema(src);
    if (!parsed?.json) continue;

    const settings = collectSettings(parsed.json);
    const hasColorScheme = settings.some((s) => s.type === 'color_scheme');
    const markup = stripInert(src);

    // 1. Expõe color scheme?
    if (!hasColorScheme && !isAllowed('editable', file, 'no-color-scheme')) {
      offenses.push(
        offense({
          rule: 'editable',
          file,
          line: parsed.line,
          code: 'no-color-scheme',
          message: `Section "${name}" não expõe setting color_scheme — o lojista não consegue mudar as cores dela.`,
        })
      );
    }

    // 2. O PORTADOR pinta o próprio fundo?
    //    A classe `.color-scheme-N` só define as CSS variables; ela não pinta
    //    nada sozinha. Quem cobre a superfície da section é o elemento que
    //    carrega o scheme — ver o cabeçalho para o porquê de a pergunta ser
    //    sobre ele e não sobre o arquivo.
    if (hasColorScheme && !isAllowed('editable', file, 'scheme-carrier-not-painted')) {
      for (const carrier of portadoresSemFundo(markup)) {
        offenses.push(
          offense({
            rule: 'editable',
            file,
            line: carrier.line,
            code: 'scheme-carrier-not-painted',
            message:
              `Section "${name}": o elemento que carrega o color scheme não pinta o próprio ` +
              'fundo (color-background ou bg-background). Em esquema escuro a superfície da ' +
              'section continua clara — pintar um descendente qualquer não resolve, porque ' +
              'não é ele que cobre a section.',
          })
        );
      }
    }

    // 3. A section pinta cor de texto em algum lugar?
    //    Por arquivo, e não no portador: ver o cabeçalho.
    if (hasColorScheme) {
      const paintsText = PINTA_TEXTO.test(markup);
      if (!paintsText && !isAllowed('editable', file, 'scheme-not-painted')) {
        offenses.push(
          offense({
            rule: 'editable',
            file,
            code: 'scheme-not-painted',
            message: `Section "${name}" tem color_scheme mas não aplica cor de texto (color-text ou text-foreground) em lugar nenhum — em esquemas escuros o conteúdo fica ilegível.`,
          })
        );
      }
    }

    // 4. Adicionável no editor?
    const addable = Array.isArray(parsed.json.presets) && parsed.json.presets.length > 0;
    const exempt = TEMPLATE_BOUND.test(name) || inGroups.has(name);
    if (!addable && !exempt && !isAllowed('editable', file, 'no-presets')) {
      offenses.push(
        offense({
          rule: 'editable',
          file,
          line: parsed.line,
          code: 'no-presets',
          message: `Section "${name}" não tem "presets" e não pertence a um section group — o lojista não consegue adicioná-la a uma página.`,
        })
      );
    }
  }

  return offenses;
}

const PINTA_FUNDO = /\b(?:color-background|bg-background)\b/;
const PINTA_TEXTO = /\b(?:color-text|text-foreground)\b/;

/**
 * Os portadores do color scheme: todo atributo `class` que contém
 * `color-{{ ... }}`.
 *
 * Uma section pode ter mais de um — `footer` tem o dela e o da newsletter,
 * `highlighted-section` tem o dela e o do acento de fundo. Cada um cobre uma
 * superfície e cada um responde pela própria.
 *
 * `[\\s\\S]*?` porque o atributo quebra linha: o `<aside>` de `main-collection`
 * tem a `class` espalhada por quatro linhas, e um `.` que não atravessa \\n
 * simplesmente não o enxergaria — que é a forma de cegueira que esta regra
 * existe para não ter.
 */
export function portadores(markup) {
  const achados = [];
  const re = /class\s*=\s*(["'])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(String(markup ?? ''))) !== null) {
    if (!/color-\{\{/.test(m[2])) continue;
    achados.push({ classes: m[2], line: markup.slice(0, m.index).split('\n').length });
  }
  return achados;
}

/**
 * Os portadores que NÃO pintam o próprio fundo — a decisão da regra, inteira.
 *
 * Exportada e testada como função pura porque é ela que o mutante quebra. A
 * mutação que importa é trocar `p.classes` por `markup`: isso é literalmente a
 * regra de antes da #99, e o teste que a mata usa a forma exata da
 * `main-collection` — portador sem pintura, token presente em outro lugar do
 * arquivo. Sem esse teste, a regressão voltaria pelo mesmo caminho por onde
 * entrou.
 */
export function portadoresSemFundo(markup) {
  return portadores(markup).filter((p) => !PINTA_FUNDO.test(p.classes));
}

/** Settings da section + settings de todos os blocos. */
function collectSettings(schema) {
  const out = [...(schema.settings ?? [])];
  for (const block of schema.blocks ?? []) out.push(...(block.settings ?? []));
  return out;
}

/** Sections que vivem em header-group/footer-group — não precisam de preset. */
function sectionsInGroups() {
  const names = new Set();
  for (const file of list('sections', '.json')) {
    try {
      const json = readJSONC(file);
      for (const section of Object.values(json.sections ?? {})) {
        if (section?.type) names.add(section.type);
      }
    } catch {
      // refs.mjs já reporta JSON inválido — aqui só não bloqueamos a análise.
    }
  }
  return names;
}
