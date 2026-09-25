/**
 * componentes — `customElements.define` sempre atrás da guarda.
 *
 * ── O defeito, medido ──────────────────────────────────────────────────────
 *
 * `customElements.define` com um nome já registrado **lança** — e o `throw`
 * mata o resto do arquivo. No navegador comum isso nunca acontece: cada script
 * é baixado e executado uma vez.
 *
 * No EDITOR de tema acontece o tempo todo. Asset co-locado é injetado pela
 * section que o renderiza, e a Shopify re-renderiza a section a cada mudança
 * de setting. A segunda injeção estoura, e o que quebra não é só a definição:
 * é tudo que vinha depois dela no arquivo.
 *
 * A #36 registrou "o mega menu nunca foi validado de ponta a ponta" e passou
 * duas versões assim. Medido: `src/js/header.js` (co-locado em
 * `sections/header.liquid`, com `async`) estourava no segundo carregamento, e
 * junto com ele `src/js/cart.js` — que define QUATRO elementos, incluindo o
 * `<cart-drawer>` — e `src/js/video-section.js`.
 *
 * O `CLAUDE.md` já mandava usar a guarda, e 12 dos 18 arquivos a usavam. Uma
 * convenção que só existe em prosa é uma convenção que seis arquivos podem
 * ignorar sem ninguém notar; é o que esta regra corrige.
 *
 * ── Por que AST e não regex ────────────────────────────────────────────────
 *
 * A guarda precisa ser do MESMO nome que se define. `if (!customElements.get(
 * 'a')) { customElements.define('b', B) }` passa em qualquer busca por texto e
 * não protege nada.
 */
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { lineAt, list, offense, read } from '../lib.mjs';

export const meta = {
  name: 'componentes',
  title: 'Web Components redefiníveis',
  description: 'customElements.define protegido por customElements.get do mesmo nome.',
  ratchet: true,
};

/** `customElements.define(…)` ou `customElements.get(…)` → o nome da tag. */
function chamada(node, metodo) {
  const { callee } = node;
  if (callee?.type !== 'MemberExpression') return null;
  if (callee.object?.name !== 'customElements') return null;
  if (callee.property?.name !== metodo) return null;
  const arg = node.arguments?.[0];
  return arg?.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null;
}

/**
 * O `if (!customElements.get('x'))` que protege este ponto, se existir.
 *
 * Procura entre os ancestrais porque a guarda costuma envolver um bloco, e
 * aceita tanto `!get(...)` quanto `get(...) === undefined`.
 */
function guardaDe(ancestors) {
  for (const anc of ancestors) {
    if (anc.type !== 'IfStatement') continue;
    const teste = anc.test;

    if (teste.type === 'UnaryExpression' && teste.operator === '!') {
      const nome = teste.argument.type === 'CallExpression' ? chamada(teste.argument, 'get') : null;
      if (nome) return nome;
    }

    if (teste.type === 'BinaryExpression' && ['===', '=='].includes(teste.operator)) {
      for (const lado of [teste.left, teste.right]) {
        const nome = lado.type === 'CallExpression' ? chamada(lado, 'get') : null;
        if (nome) return nome;
      }
    }
  }
  return null;
}

/** As violações de UM fonte. Separada de `run()` para poder ser exercitada. */
export function violacoesEm(file, src) {
  const offenses = [];

  {
    let ast;
    try {
      ast = acorn.parse(src, { ecmaVersion: 'latest' });
    } catch (error) {
      return [
        offense({ rule: 'componentes', file, code: 'parse-error', message: `Não foi possível parsear: ${error.message}` }),
      ];
    }

    walk.ancestor(ast, {
      CallExpression(node, _state, ancestors) {
        const tag = chamada(node, 'define');
        if (!tag) return;

        const guardada = guardaDe(ancestors);
        if (guardada === tag) return;

        const motivo =
          guardada === null
            ? 'sem guarda'
            : `a guarda confere '${guardada}', que não é o nome definido`;

        offenses.push(
          offense({
            rule: 'componentes',
            file,
            line: lineAt(src, node.start),
            code: `define:${tag}`,
            message:
              `customElements.define('${tag}', …) ${motivo}. ` +
              'Uma segunda injeção do asset lança e mata o resto do arquivo — e o editor de tema ' +
              're-injeta asset co-locado a cada mudança de setting. ' +
              `Envolva em: if (!customElements.get('${tag}')) { … }`,
          })
        );
      },
    });
  }

  return offenses;
}

export function run() {
  return list('src/js', '.js').flatMap((file) => violacoesEm(file, read(file)));
}
