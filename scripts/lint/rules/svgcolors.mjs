/**
 * svgcolors — cor NOMEADA em SVG do tema.
 *
 * ── O buraco que esta regra fecha ──────────────────────────────────────────
 *
 * A regra `tokens` procura cor cravada no formato `#rrggbb`. Ela nunca viu
 * `fill="black"` nem `fill="white"`, porque nome de cor não casa com aquele
 * padrão. Os ícones sociais passaram versões inteiras com `fill="black"` e
 * nenhum linter reclamou — quem achou foi a #5, olhando.
 *
 * Medido quando esta regra nasceu: 45 `fill="white"` e 26 `fill="black"` no
 * tema, quase todos em ícone de pagamento.
 *
 * ── Por que nome de cor é pior que hex ─────────────────────────────────────
 *
 * Não porque seja mais errado — é a MESMA cor cravada. É que hex parece cor e
 * chama atenção em revisão; `white` parece configuração. Um glifo com
 * `fill="black"` some no scheme escuro exatamente como um com `fill="#000"`, e
 * a diferença é só que ninguém repara no primeiro.
 *
 * ── O que continua legítimo ────────────────────────────────────────────────
 *
 * `none` (sem preenchimento), `currentColor` (herda o `color-text` do scheme,
 * que é a correção certa para glifo monocromático) e `url(#…)` (gradiente ou
 * padrão definido no próprio SVG).
 *
 * Cor de marca de terceiro é exceção legítima e vai para
 * `design-exceptions.json` COM justificativa escrita — que é o mecanismo que
 * torna a decisão visível em vez de esquecida. É onde vivem as bandeiras de
 * cartão: Visa é azul, Pix é teal, e mudar isso com o color scheme
 * descaracteriza logo de terceiro.
 */
import { lineAt, list, offense, read } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'svgcolors',
  title: 'Cor nomeada em SVG',
  description: 'fill/stroke de SVG usa token, currentColor ou none — não nome de cor.',
  ratchet: true,
};

/** O que não é cor: ausência, herança, e referência a algo do próprio SVG. */
const LEGITIMOS = new Set(['none', 'currentcolor', 'inherit', 'transparent']);

const ehNome = (valor) => /^[a-z]+$/i.test(valor) && !LEGITIMOS.has(valor.toLowerCase());

/**
 * As violações de UM fonte. Separada de `run()` para poder ser exercitada.
 *
 * Sem isto, `stroke` era cobertura de papel: nada no tema usa stroke nomeado
 * hoje, então tirar `stroke` do padrão não derrubava teste nenhum — e um
 * mutante provou isso antes de o arquivo ser commitado.
 */
export function violacoesEm(file, src) {
  const offenses = [];

  {
    for (const match of src.matchAll(/\b(fill|stroke)="([^"]*)"/g)) {
      const [, atributo, valor] = match;
      if (!ehNome(valor)) continue;

      const code = `nomeada:${valor.toLowerCase()}`;
      if (isAllowed('svgcolors', file, code)) continue;

      offenses.push(
        offense({
          rule: 'svgcolors',
          file,
          line: lineAt(src, match.index),
          code,
          message:
            `${atributo}="${valor}" é cor cravada com nome, e a regra \`tokens\` não a vê — ` +
            'ela só procura hex. Um glifo assim some no color scheme escuro. ' +
            'Use `currentColor` para herdar o texto do scheme, ou registre a exceção ' +
            'em design-exceptions.json se for cor de marca de terceiro.',
        })
      );
    }
  }

  return offenses;
}

export function run() {
  return [...list('snippets'), ...list('sections'), ...list('layout')].flatMap((file) =>
    violacoesEm(file, read(file))
  );
}
