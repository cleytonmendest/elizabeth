/**
 * jsstrings — nenhuma frase voltada ao usuário fica cravada num `.js`.
 *
 * A regra `i18n` cobre Liquid e schema, mas para no `.js`. E o JS escreve na
 * tela: `textContent`, `innerHTML`, `aria-label`. Um `'ESGOTADO'` ali não passa
 * por locale nenhum — a loja em inglês mostra português, e é reprovação direta
 * na Theme Store.
 *
 * ── Por que não basta procurar "palavra em português" ──────────────────────
 *
 * Porque não dá. Medido neste tema: de 533 literais de string em `assets/*.js`,
 * 501 têm uma sequência de duas letras — `'true'`, `'div'`, `'swiper'`,
 * `'resize'`, `'aria-hidden'`, `':scope > *'`. E nenhum teste de idioma separa
 * `'ESGOTADO'` de `'beforeend'`: as duas são palavra única, sem espaço, sem
 * acento. Detecção de idioma como critério de gate é ruído garantido.
 *
 * O critério aqui é POSICIONAL, e por isso é decidível:
 *
 *   1. o valor está numa posição que vira texto na tela, E
 *   2. ele é um literal — não um `Identifier`, `CallExpression` ou cálculo, E
 *   3. sobra alguma palavra depois de tirar as tags HTML.
 *
 * O passo 2 é o que faz `qtdBubble.textContent = newQtd` (o contador do
 * carrinho) e `span.textContent = (realIndex % items) + 1` sumirem sozinhos.
 * Não é exceção cadastrada: eles não são literais, então a regra nem olha o
 * conteúdo. Só o passo 3 é heurístico, e ele é deliberadamente burro — duas
 * letras seguidas, não dicionário —, o que ele separa é frase de pontuação
 * (`'-'`, `'%'`, `'0'`, `'</div>'`, `'<svg viewBox=...>'`).
 *
 * ── As duas portas ─────────────────────────────────────────────────────────
 *
 * Uma frase só entra no JS por dois lugares, e a regra tranca os dois:
 *
 *   sink      literal direto numa posição de texto
 *   fallback  literal no `||` de um valor que veio do DOM:
 *             `el.dataset.x || 'Adicionar'`
 *
 * A terceira via imaginável — uma variável que carrega a frase — não precisa de
 * rastreio: a variável teve que receber o valor de uma das duas portas acima.
 * Trancadas as duas, ela fica sem estoque. (Seguir variável de fato, sem
 * análise de escopo, produz falso positivo: dois métodos do mesmo arquivo com
 * um `const textDesktop` cada é o bastante para a regra acusar a linha errada.)
 *
 * ── Sinks do próprio tema ──────────────────────────────────────────────────
 *
 * `_showFeedback('Por favor, insira um e-mail válido.', 'error')` é literal
 * direto, mas numa posição que a regra não conheceria. Então ela descobre: um
 * método cujo PARÂMETRO é atribuído a um sink de texto é ele próprio um sink,
 * e aquele argumento passa a ser verificado. É link sintático (parâmetro →
 * atribuição), não fluxo de dados. A descoberta é por arquivo, para que dois
 * `_show` de classes diferentes não se confundam.
 *
 * O caminho certo para o texto é o mesmo que metade do tema já usa: chave de
 * locale (ou `default` de setting, que é conteúdo do lojista) → Liquid →
 * atributo `data-*` → JS lê o atributo. Sem cópia no meio.
 */
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { lineAt, list, offense, read } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'jsstrings',
  title: 'Texto de interface no JS',
  description: 'Nenhuma frase voltada ao usuário cravada em .js — o texto vem do Liquid por data-*.',
  ratchet: true,
};

/** Propriedades cuja atribuição vira texto lido por gente. */
const TEXT_PROPS = new Set([
  'textContent', 'innerText', 'innerHTML', 'outerHTML',
  'placeholder', 'title', 'alt', 'ariaLabel', 'ariaDescription',
]);

/** Atributos que carregam texto, quando escritos via `setAttribute`. */
const TEXT_ATTRS = new Set(['aria-label', 'aria-description', 'title', 'alt', 'placeholder']);

/** Chamadas nativas que mostram texto direto ao usuário. */
const TEXT_GLOBALS = new Set(['alert', 'confirm', 'prompt']);

/** Sobra palavra depois de remover as tags? `'</div>'` e `'%'` não têm. */
const hasWord = (value) => /\p{L}{2,}/u.test(value.replace(/<[^>]*>/g, ' '));

const slug = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export function run() {
  const offenses = [];

  for (const file of list('assets', '.js')) {
    // Bundle de terceiro não é nosso para corrigir.
    if (file.includes('.min.')) continue;

    const src = read(file);
    let ast;
    try {
      ast = acorn.parse(src, { ecmaVersion: 'latest' });
    } catch (error) {
      offenses.push(
        offense({ rule: 'jsstrings', file, code: 'parse-error', message: `Não foi possível parsear: ${error.message}` })
      );
      continue;
    }

    // Um literal pode ser alcançado pelas duas checagens (`innerHTML = attr ||
    // 'texto'`). Uma ocorrência por literal, chaveada pela posição no arquivo;
    // `fallback` ganha de `sink` porque a mensagem dele diz o que fazer.
    const found = new Map();
    const record = (node, value, kind, detail) => {
      if (!hasWord(value)) return;
      const previous = found.get(node.start);
      if (previous && previous.kind === 'fallback') return;
      found.set(node.start, { node, value, kind, detail });
    };

    const sinks = discoverSinks(ast);

    walk.simple(ast, {
      AssignmentExpression(node) {
        const target = textProp(node.left);
        if (target) collect(node.right, (n, v) => record(n, v, 'sink', `.${target}`));
      },

      CallExpression(node) {
        const name = calleeName(node);
        if (!name) return;

        if (name === 'setAttribute') {
          const attr = node.arguments[0]?.value;
          if (TEXT_ATTRS.has(attr) && node.arguments[1]) {
            collect(node.arguments[1], (n, v) => record(n, v, 'sink', `setAttribute('${attr}')`));
          }
          return;
        }
        // O primeiro argumento é a posição ('beforeend'), não texto.
        if (name === 'insertAdjacentHTML' && node.arguments[1]) {
          collect(node.arguments[1], (n, v) => record(n, v, 'sink', 'insertAdjacentHTML()'));
          return;
        }
        if (TEXT_GLOBALS.has(name) && node.arguments[0]) {
          collect(node.arguments[0], (n, v) => record(n, v, 'sink', `${name}()`));
          return;
        }
        for (const index of sinks.get(name) ?? []) {
          const argument = node.arguments[index];
          if (argument) collect(argument, (n, v) => record(n, v, 'sink', `${name}() [arg ${index}]`));
        }
      },

      LogicalExpression(node) {
        if (node.operator !== '||' && node.operator !== '??') return;
        const from = domSource(node.left);
        if (!from) return;
        collect(node.right, (n, v) => record(n, v, 'fallback', from));
      },
    });

    for (const { node, value, kind, detail } of found.values()) {
      const text = value.replace(/\s+/g, ' ').trim();
      const code = `${kind}:${slug(text)}`;
      if (isAllowed('jsstrings', file, code)) continue;

      offenses.push(
        offense({
          rule: 'jsstrings',
          file,
          line: lineAt(src, node.start),
          code,
          message:
            kind === 'fallback'
              ? `Fallback ${JSON.stringify(truncate(text))} para ${detail} — o texto já tem dono (setting ou locale) e esta é uma segunda cópia, que só pode divergir. Leia o atributo sem fallback; o Liquid é quem garante o valor.`
              : `Texto ${JSON.stringify(truncate(text))} cravado em ${detail} — a loja em outro idioma mostra isto em português. Passe pelo locale e leia de um data-* no elemento.`,
        })
      );
    }
  }

  return offenses;
}

const truncate = (text) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);

/** `el.textContent` → 'textContent'. Ignora acesso computado (`el[x]`). */
function textProp(node) {
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  return TEXT_PROPS.has(node.property.name) ? node.property.name : null;
}

function calleeName(node) {
  const callee = node.callee;
  if (callee.type === 'MemberExpression' && !callee.computed) return callee.property.name;
  if (callee.type === 'Identifier') return callee.name;
  return null;
}

/** `el.dataset.x` ou `el.getAttribute('data-x')` — texto que veio do Liquid. */
function domSource(node) {
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object?.type === 'MemberExpression' &&
    node.object.property?.name === 'dataset'
  ) {
    return `dataset.${node.property.name}`;
  }
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property?.name === 'getAttribute'
  ) {
    return `getAttribute(${JSON.stringify(node.arguments[0]?.value ?? '?')})`;
  }
  return null;
}

/**
 * Chama `visit(node, value)` em cada literal que PODE ser o valor desta
 * expressão. Desce por ternário, `||`/`??` e concatenação; para em
 * `Identifier`, `CallExpression` e qualquer cálculo — que é o ponto.
 */
function collect(node, visit) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') visit(node, node.value);
      break;
    case 'TemplateLiteral':
      for (const quasi of node.quasis) if (quasi.value.cooked) visit(quasi, quasi.value.cooked);
      break;
    case 'ConditionalExpression':
      collect(node.consequent, visit);
      collect(node.alternate, visit);
      break;
    case 'LogicalExpression':
      collect(node.left, visit);
      collect(node.right, visit);
      break;
    case 'BinaryExpression':
      if (node.operator === '+') {
        collect(node.left, visit);
        collect(node.right, visit);
      }
      break;
    default:
      break;
  }
}

/**
 * Funções deste arquivo que são, elas próprias, sink de texto: algum parâmetro
 * cai direto num sink conhecido. Devolve `nome → Set(índices de parâmetro)`.
 * Um nível só — o objetivo é alcançar o `_showFeedback(msg)` do tema, não
 * fazer análise de fluxo.
 */
function discoverSinks(ast) {
  const sinks = new Map();

  const register = (name, fn) => {
    if (!name || !fn?.body || !Array.isArray(fn.params)) return;
    const params = fn.params.map((p) => (p.type === 'Identifier' ? p.name : null));
    if (!params.some(Boolean)) return;

    const mark = (identifier) => {
      const index = params.indexOf(identifier);
      if (index < 0) return;
      if (!sinks.has(name)) sinks.set(name, new Set());
      sinks.get(name).add(index);
    };

    walk.simple(fn.body, {
      AssignmentExpression(node) {
        if (textProp(node.left) && node.right.type === 'Identifier') mark(node.right.name);
      },
      CallExpression(node) {
        if (calleeName(node) !== 'setAttribute') return;
        if (!TEXT_ATTRS.has(node.arguments[0]?.value)) return;
        if (node.arguments[1]?.type === 'Identifier') mark(node.arguments[1].name);
      },
    });
  };

  const isFn = (node) => node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression';

  walk.simple(ast, {
    MethodDefinition(node) {
      if (!node.computed && node.key.type === 'Identifier') register(node.key.name, node.value);
    },
    PropertyDefinition(node) {
      if (!node.computed && node.key.type === 'Identifier' && isFn(node.value)) register(node.key.name, node.value);
    },
    FunctionDeclaration(node) {
      register(node.id?.name, node);
    },
    VariableDeclarator(node) {
      if (node.id.type === 'Identifier' && isFn(node.init)) register(node.id.name, node.init);
    },
    Property(node) {
      if (!node.computed && node.key.type === 'Identifier' && isFn(node.value)) register(node.key.name, node.value);
    },
  });

  return sinks;
}
