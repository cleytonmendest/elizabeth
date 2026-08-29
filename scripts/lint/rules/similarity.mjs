/**
 * similarity — trechos idênticos entre arquivos (copy-paste).
 *
 * Complementa a regra `boundaries`, que responde outra pergunta:
 *
 *   boundaries   "quem tocou nesta capacidade?"  → pega função reescrita do zero
 *   similarity   "este texto já existe?"         → pega copiar e colar
 *
 * Nenhuma cobre as duas. Os três formatadores de preço do tema são
 * funcionalmente idênticos e compartilham 1 ou 2 blocos de 8 — invisíveis
 * aqui, e pegos pela `boundaries`. Já o `video`, que nasceu de um copy-paste
 * do `image-banner`, compartilha 259 blocos e não toca capacidade declarada
 * nenhuma — invisível lá, e pego aqui.
 *
 * ── Como funciona ──────────────────────────────────────────────────────────
 * 1. Normaliza o arquivo: remove comentários e `{% schema %}`, colapsa espaços.
 * 2. Desliza uma janela de N tokens; cada janela é um "bloco".
 * 3. Compara os conjuntos de blocos de cada par de arquivos.
 *
 * Dois arquivos com muitos blocos em comum têm o mesmo texto, palavra por
 * palavra — não "parecido", idêntico.
 *
 * ── Por que é heurística ───────────────────────────────────────────────────
 * As outras regras verificam fatos: ou o arquivo toca `/cart/add` ou não toca.
 * Esta depende de limiares escolhidos por calibragem (ver config/similarity.json).
 * Por isso duplicação legítima tem escape em design-exceptions.json, com
 * justificativa escrita — e não silenciando a regra.
 */
import { allLiquid, list, offense, read, stripInert } from '../lib.mjs';
import { isAllowed, readConfig } from '../exceptions.mjs';

export const meta = {
  name: 'similarity',
  title: 'Duplicação entre arquivos',
  description: 'Trechos idênticos copiados de um arquivo para outro.',
  ratchet: true,
};

export function run() {
  const config = readConfig('similarity.json');
  const size = config.shingleSize ?? 8;
  const minBlocks = config.minSharedBlocks ?? 40;
  const minContainment = config.minContainment ?? 0.35;
  const excluded = (config.exclude ?? []).map(toRegExp);

  const files = [...allLiquid(), ...list('assets', '.js'), ...list('assets', '.css')]
    .filter((file) => !excluded.some((re) => re.test(file)))
    .sort();

  // Assinatura de cada arquivo. Arquivos curtos demais não têm blocos
  // suficientes para uma comparação significativa.
  const signatures = new Map();
  for (const file of files) {
    const blocks = shingle(tokenize(read(file)), size);
    if (blocks.size >= minBlocks) signatures.set(file, blocks);
  }

  const offenses = [];
  const names = [...signatures.keys()];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i], names[j]];
      const setA = signatures.get(a);
      const setB = signatures.get(b);

      const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
      let shared = 0;
      for (const block of small) if (big.has(block)) shared++;

      if (shared < minBlocks) continue;
      const containment = shared / small.size;
      if (containment < minContainment) continue;

      // O par é a unidade, não o arquivo: reporta uma vez, no primeiro em
      // ordem alfabética, para o fingerprint ser estável.
      const code = `pair:${b}`;
      if (isAllowed('similarity', a, code)) continue;

      offenses.push(
        offense({
          rule: 'similarity',
          file: a,
          code,
          message:
            `${shared} blocos de ${size} tokens são idênticos aos de ${b} ` +
            `(${(containment * 100).toFixed(0)}% do menor arquivo). ` +
            `Se é copy-paste, extraia um snippet compartilhado — senão a correção de um bug ` +
            `num arquivo deixa o outro quebrado. Se a duplicação é intencional, registre a ` +
            `exceção com justificativa em design-exceptions.json.`,
        })
      );
    }
  }

  return offenses;
}

/**
 * Texto do arquivo reduzido a tokens comparáveis. Comentários e `{% schema %}`
 * saem: documentação parecida e schema com a mesma forma não são duplicação de
 * lógica, e inflariam a contagem sem sinal.
 */
function tokenize(src) {
  return stripInert(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function shingle(tokens, size) {
  const blocks = new Set();
  for (let i = 0; i + size <= tokens.length; i++) blocks.add(tokens.slice(i, i + size).join(' '));
  return blocks;
}

/** Glob mínimo: `*` casa qualquer coisa menos `/`. */
function toRegExp(glob) {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
}
