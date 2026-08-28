/**
 * schemecontract — o contrato entre o admin e o CSS não pode ter buraco.
 *
 * O tema tem um pipeline de três pontas:
 *
 *   config/settings_schema.json  →  layout/theme.liquid  →  CSS custom props
 *                                                            ↓
 *                              assets/*.css  +  tailwind.config.js consomem
 *
 * Se alguém consome `var(--color-alguma-coisa)` que o theme.liquid não gera, a
 * propriedade resolve para vazio e a regra CSS inteira é descartada pelo
 * navegador — sem erro, sem aviso, só um estilo que não aparece. É uma falha
 * invisível em revisão de código e em Theme Check.
 *
 * Esta regra existe porque `--color-card-background` é consumida por
 * `.color-background-secondary` em color-scheme.css e nunca foi gerada.
 */
import { lineAt, list, offense, read } from '../lib.mjs';

export const meta = {
  name: 'schemecontract',
  title: 'Contrato dos color schemes',
  description: 'Toda CSS variable consumida é gerada pelo layout.',
  ratchet: true,
};

const SOURCE = 'layout/theme.liquid';

export function run() {
  const offenses = [];

  const generated = new Set(
    [...read(SOURCE).matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1])
  );

  const consumers = [
    ...list('assets', '.css'),
    'tailwind.config.js',
    ...list('sections'),
    ...list('snippets'),
    ...list('layout'),
  ];

  for (const file of consumers) {
    // O CSS compilado do Tailwind é derivado — a origem é o .liquid/config.
    if (file === 'assets/application.css') continue;

    let src;
    try {
      // Comentários de CSS/JS documentam o formato das variáveis com exemplos
      // fictícios — não são consumo real.
      src = read(file).replace(/\/\*[\s\S]*?\*\//g, (block) => '\n'.repeat(block.split('\n').length - 1));
    } catch {
      continue;
    }

    const seen = new Set();
    for (const match of src.matchAll(/var\((--color-[a-z0-9-]+)/g)) {
      const variable = match[1];
      if (generated.has(variable) || seen.has(variable)) continue;
      seen.add(variable);
      offenses.push(
        offense({
          rule: 'schemecontract',
          file,
          line: lineAt(src, match.index),
          code: `undefined-var:${variable}`,
          message: `${variable} é consumida aqui mas nunca é gerada em ${SOURCE} — a regra CSS é descartada silenciosamente.`,
        })
      );
    }
  }

  return offenses;
}
