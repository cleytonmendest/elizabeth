/**
 * designscope — cada setting no nível certo (ADR 0003).
 *
 * O tema precisa ser customizável pelo lojista E continuar parecendo um tema.
 * Isso só funciona porque customização tem níveis:
 *
 *   nível 1  token global    o VALOR de um eixo (cor, raio, fonte, escala)
 *   nível 2  composição      ARRANJO em opções fechadas (scheme, colunas)
 *   nível 3  conteúdo        texto, imagem, produto
 *
 * O modo de falha é vazar nível 1 para dentro de uma section. Se cada section
 * puder escolher a própria cor ou o próprio raio, o lojista faz a section A
 * redonda e azul e a B quadrada e verde — customização máxima, design zero.
 * É o que separa um tema de uma colagem, e é por isso que Dawn e Prestige têm
 * raio e fonte como setting global, nunca por section.
 *
 * Esta regra existe porque `blog-posts` declarava um `type: color` com default
 * `#ffffff` — uma section escolhendo a própria cor de fundo em vez de usar o
 * color scheme.
 *
 * O que NÃO é violação: `richtext`, `text`, `image_picker`, `url` e afins são
 * nível 3. `select`, `checkbox` e `range` de arranjo (colunas, alinhamento,
 * padding) são nível 2 — arranjo é exatamente o que a section deve controlar.
 */
import { extractSchema, list, offense, read } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'designscope',
  title: 'Nível dos settings',
  description: 'Nenhuma section expõe valor de design que é global (ADR 0003).',
  ratchet: true,
};

/** Tipos que entregam um valor de design cru ao lojista, por section. */
const LEVEL_1_TYPES = {
  color: 'cor',
  color_background: 'cor de fundo',
  font_picker: 'fonte',
};

/** Ids que denunciam um eixo global vazando para o nível 2. */
const LEVEL_1_IDS = [
  { pattern: /radius|arredond/i, axis: 'raio', global: 'settings.radius_style' },
  { pattern: /font_size|text_size|tamanho_texto/i, axis: 'tamanho de texto', global: 'settings.font_scale' },
  { pattern: /font_family|fonte_familia/i, axis: 'família de fonte', global: 'settings.type_header_font / type_body_font' },
  { pattern: /letter_spacing|tracking/i, axis: 'espaçamento entre letras', global: 'a escala do tailwind.config.js' },
  { pattern: /page_width|largura_pagina/i, axis: 'largura da página', global: 'settings.page_width' },
];

export function run() {
  const offenses = [];

  for (const file of list('sections')) {
    const parsed = extractSchema(read(file));
    if (!parsed?.json) continue;

    const name = file.replace('sections/', '').replace('.liquid', '');

    // Blocos contam igual: um raio por bloco é ainda pior que um por section.
    const settings = [
      ...(parsed.json.settings ?? []).map((s) => ({ s, where: 'section' })),
      ...(parsed.json.blocks ?? []).flatMap((b) =>
        (b.settings ?? []).map((s) => ({ s, where: `bloco "${b.type}"` }))
      ),
    ];

    for (const { s, where } of settings) {
      if (!s.id) continue;

      const kind = LEVEL_1_TYPES[s.type];
      if (kind && !isAllowed('designscope', file, `type:${s.id}`)) {
        offenses.push(
          offense({
            rule: 'designscope',
            file,
            line: parsed.line,
            code: `type:${s.id}`,
            message:
              `"${s.id}" (${where}) deixa o lojista escolher ${kind} só nesta section — ` +
              `é nível 1 do ADR 0003, e nível 1 é global. Use o color scheme (setting ` +
              `\`color_scheme\` + wrapper com bg-background/text-foreground) ou o token ` +
              `global; senão cada section vira uma ilha visual.`,
          })
        );
        continue;
      }

      const axis = LEVEL_1_IDS.find((a) => a.pattern.test(s.id));
      if (axis && !isAllowed('designscope', file, `axis:${s.id}`)) {
        offenses.push(
          offense({
            rule: 'designscope',
            file,
            line: parsed.line,
            code: `axis:${s.id}`,
            message:
              `"${s.id}" (${where}) controla ${axis.axis}, que é eixo global — ` +
              `já existe em ${axis.global}. Duplicar aqui deixa a section fora de sincronia ` +
              `com o resto do tema no dia em que o lojista mudar o valor global.`,
          })
        );
      }
    }
  }

  return offenses;
}
