/**
 * editable — "tudo que puder ser editável deve ser editável".
 *
 * Traduz o princípio do tema em três verificações mecânicas:
 *
 *   1. Toda section expõe um setting `color_scheme`.
 *   2. Toda section que expõe `color_scheme` PINTA o fundo com ele
 *      (`color-background` + `color-text` no markup). Sem isso o lojista
 *      escolhe um esquema escuro, as variáveis mudam e o fundo continua
 *      branco — texto claro sobre fundo claro.
 *   3. Toda section que não é ligada a template nem a section group tem
 *      `presets`, senão o lojista não consegue adicioná-la.
 *
 * A verificação 2 existe porque o bug já aconteceu: foi corrigido em
 * footer/blog/artigo e permaneceu em main-product, main-collection,
 * section-images-link e slider-cards.
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

    // 2. Aplica de verdade?
    //    A classe `.color-scheme-N` só define as CSS variables; ela não pinta
    //    nada sozinha. É preciso aplicar fundo E cor de texto, seja pelas
    //    classes legadas (color-background / color-text) seja pelos tokens
    //    (bg-background / text-foreground). Pintar só o fundo é pior que não
    //    pintar: o fundo escurece e o texto continua escuro.
    if (hasColorScheme) {
      const paintsBackground = /\b(?:color-background|bg-background)\b/.test(markup);
      const paintsText = /\b(?:color-text|text-foreground)\b/.test(markup);
      if (!(paintsBackground && paintsText) && !isAllowed('editable', file, 'scheme-not-painted')) {
        const missing = [
          !paintsBackground && 'fundo (color-background ou bg-background)',
          !paintsText && 'cor de texto (color-text ou text-foreground)',
        ]
          .filter(Boolean)
          .join(' e ');
        offenses.push(
          offense({
            rule: 'editable',
            file,
            code: 'scheme-not-painted',
            message: `Section "${name}" tem color_scheme mas não aplica ${missing} — em esquemas escuros o conteúdo fica ilegível.`,
          })
        );
      }
    }

    // 3. Adicionável no editor?
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
