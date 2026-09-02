/**
 * schemecontract — o contrato entre o admin e o CSS não pode ter buraco.
 *
 * O tema tem um pipeline de três pontas:
 *
 *   config/settings_schema.json  →  snippets/theme-styles.liquid  →  CSS custom props
 *                                                                      ↓
 *                                assets/*.css  +  tailwind.config.js consomem
 *
 * Se alguém consome `var(--color-alguma-coisa)` que ninguém gera, a
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

/**
 * Onde as variáveis NASCEM.
 *
 * Era o caminho único `layout/theme.liquid` até a #27. Quando o terceiro
 * layout apareceu (a página de senha) o bloco que as emite virou
 * `snippets/theme-styles.liquid` — e esta regra acusou 47 violações de uma
 * vez, todas falsas: ela olhava para o lugar antigo e concluía que NADA era
 * gerado.
 *
 * Plural de propósito, e incluindo os layouts: a pergunta que importa não é
 * "está no theme.liquid?" e sim "alguma coisa que chega na página gera isto?".
 * Um layout pode declarar variável própria sem estar errado.
 */
const GERADORES = ['snippets/theme-styles.liquid'];

/** Os `--color-*: …` declarados numa fonte. Pura, para poder ser testada. */
export function variaveisGeradas(fonte) {
  return [...String(fonte ?? '').matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);
}

export function run() {
  const offenses = [];

  const sources = [...GERADORES, ...list('layout')];
  const generated = new Set(
    sources.flatMap((file) => {
      try {
        return variaveisGeradas(read(file));
      } catch {
        return [];
      }
    })
  );

  /**
   * Nenhuma variável encontrada não significa "o tema está todo errado" —
   * significa que a REGRA perdeu a fonte, provavelmente porque o bloco mudou
   * de arquivo. Antes disto existir, esse caso saía como uma violação por
   * consumidor: 47 erros apontando para 47 arquivos inocentes, e nenhum deles
   * dizendo qual era o problema de verdade.
   */
  if (generated.size === 0) {
    return [
      offense({
        rule: 'schemecontract',
        file: GERADORES[0],
        line: 1,
        code: 'sem-fonte',
        message:
          'Nenhuma `--color-*` é gerada por ' +
          `${GERADORES.join(', ')} nem pelos layouts. O bloco que as emite mudou de ` +
          'lugar? Atualize GERADORES em scripts/lint/rules/schemecontract.mjs.',
      }),
    ];
  }

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
          message: `${variable} é consumida aqui mas nunca é gerada por nenhum layout nem por snippets/theme-styles.liquid — a regra CSS é descartada silenciosamente.`,
        })
      );
    }
  }

  return offenses;
}
