/**
 * dinheiro — o tema não transforma dinheiro da Shopify por número do lojista.
 *
 * ── O defeito que esta regra existe para impedir ───────────────────────────
 *
 * O tema exibia "Em até 10x de R$ X". O número saía de `settings.max_installments`
 * e `settings.min_value_installment` e era calculado sobre `product.price`:
 *
 *     assign max_installment = settings.max_installments | default: 1
 *     for i in (2..max_installment) reversed
 *       assign installment_value_check = price | divided_by: i
 *     ...
 *     assign final_installment_value = price | divided_by: actual_installments
 *     {{ final_installment_value | money }}
 *
 * Ninguém digitou "R$ 47,90" e o checkout não o honra: o tema o inventou
 * dividindo o preço real por uma configuração global. A [ADR 0008] decidiu que
 * isso não se faz, e a #80 removeu os três lugares que faziam. Sobrou a lacuna
 * que a própria ADR registra: nenhum linter pega a reincidência.
 *
 * ── Por que não é "divided_by sobre price" ─────────────────────────────────
 *
 * A ADR sugeriu reprovar `divided_by` aplicado a `price` fora dos snippets de
 * desconto. Contados os casos, essa regra reprovaria seis usos legítimos — a %
 * de desconto (preço ÷ preço), a barra de frete grátis (total ÷ limiar), os
 * centavos do JSON-LD (price ÷ 100) — e o escape "fora dos snippets de
 * desconto" seria uma allowlist por caminho, que fura ao renomear o arquivo.
 * A correção dessa formulação está na issue #82, não na ADR: ADR é append-only.
 *
 * ── O predicado ───────────────────────────────────────────────────────────
 *
 * O filtro `| money` é o marcador sintático de "isto é dinheiro exibido" —
 * então a regra não precisa saber o que é dinheiro, ela pergunta ao tema.
 * A partir de cada valor impresso com `| money`, ela anda a cadeia de `assign`
 * para trás e reprova quando encontra um filtro ARITMÉTICO cujo OPERANDO
 * deriva de um `settings.*`.
 *
 * O lado da operação é o que separa os dois casos, e não é sutileza gratuita —
 * `a | minus: b` lê-se "a menos b":
 *
 *   REPROVA  price | divided_by: parcelas     a coisa é o dinheiro da Shopify,
 *                                             o ajuste é o palpite do lojista
 *   PASSA    limiar_do_lojista | minus: total a coisa é o valor que a lojista
 *                                             digitou, o ajuste é dado real
 *
 * O segundo é `snippets/cart-free-shipping.liquid`, que existe hoje e está
 * certo: a lojista digita R$ 200 e o tema mostra quanto falta para R$ 200.
 * O valor exibido é o dela. No parcelamento, não era de ninguém.
 *
 * Seguir dependência de VALOR (só o lado direito de um `assign`) é o que evita
 * o falso positivo previsto na issue: um `{% if settings.foo %}` escolhendo
 * entre dois preços da Shopify não contamina preço nenhum.
 *
 * [ADR 0008]: docs/adr/0008-o-tema-nao-calcula-dinheiro-que-o-checkout-nao-produz.md
 */
import { allLiquid, lineAt, offense, read, stripInert } from '../lib.mjs';

export const meta = {
  name: 'dinheiro',
  title: 'Dinheiro derivado de setting',
  description: 'Valor em dinheiro não se deriva de configuração do lojista (ADR 0008).',
  ratchet: true,
};

/**
 * Filtros que TRANSFORMAM a grandeza do sujeito. `default` fica de fora de
 * propósito: `| default: 0` é fallback, não conta.
 */
const ARITMETICOS = new Set([
  'divided_by',
  'times',
  'plus',
  'minus',
  'modulo',
  'at_least',
  'at_most',
]);

/**
 * Aqueles em que trocar os lados não muda o resultado — e por isso a leitura
 * "coisa / ajuste" que vale para `minus` e `divided_by` NÃO vale para eles.
 * `price | times: settings.f` e `settings.f | times: price` são a mesma conta;
 * a primeira versão desta regra reprovava só a primeira. Ver #84.
 */
const COMUTATIVOS = new Set(['times', 'plus']);

/**
 * Uma constante escrita no markup: `100`, `100.0`, `'texto'`.
 *
 * É o que separa `settings.limiar | times: 100` (conversão de unidade, legítima)
 * de `settings.fator | times: cart.total_price` (dinheiro da loja alterado por
 * palpite). Perguntar "é literal?" em vez de "é dinheiro da Shopify?" evita a
 * lista de fontes que a #84 considerou: medidas, são vinte, e boa parte são
 * variáveis de `for` (`item`, `line_item`, `card_product`, `hp`) — uma lista
 * dessas nasce desatualizada no próximo snippet.
 */
const EH_LITERAL = (trecho) => /^\s*(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")\s*$/.test(trecho);

/** `money`, `money_with_currency`, `money_without_currency`, `money_without_trailing_zeros`. */
const EH_MONEY = (nome) => nome === 'money' || nome.startsWith('money_');

/**
 * Quebra uma expressão Liquid em `{ sujeito, filtros }`, respeitando aspas —
 * um `|` dentro de string não é separador de filtro.
 *
 * `price | divided_by: i` → `{ sujeito: 'price', filtros: [{nome:'divided_by', args:'i'}] }`
 */
export function partirExpressao(expr) {
  const partes = [];
  let atual = '';
  let aspas = null;

  for (const ch of expr) {
    if (aspas) {
      atual += ch;
      if (ch === aspas) aspas = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      aspas = ch;
      atual += ch;
      continue;
    }
    if (ch === '|') {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += ch;
  }
  partes.push(atual);

  const [sujeito, ...resto] = partes.map((p) => p.trim());
  const filtros = resto
    .filter(Boolean)
    .map((p) => {
      const sep = p.indexOf(':');
      return sep === -1
        ? { nome: p.trim(), args: '' }
        : { nome: p.slice(0, sep).trim(), args: p.slice(sep + 1).trim() };
    });

  return { sujeito, filtros };
}

/** Identificadores de um trecho, ignorando strings, números e palavras-chave. */
const PALAVRAS = new Set(['true', 'false', 'nil', 'null', 'blank', 'empty', 'and', 'or', 'not']);

export function identificadores(trecho) {
  const semStrings = trecho.replace(/'[^']*'|"[^"]*"/g, ' ');
  const achados = semStrings.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_?]*)*/g) || [];
  return achados.filter((id) => !PALAVRAS.has(id));
}

/** `settings.x` — direto, ou como raiz de um caminho mais fundo. */
const EH_SETTING = (id) => id === 'settings' || id.startsWith('settings.');

/** A variável nua: `product.price` depende de `product`. */
const raiz = (id) => id.split('.')[0];

/**
 * Todos os `assign` do fonte — os de `{% assign %}` e os de dentro de
 * `{% liquid %}`, que é onde o parcelamento morava.
 *
 * @returns {{nome: string, expr: string, index: number}[]}
 */
function coletarAssigns(src) {
  const out = [];

  for (const m of src.matchAll(/\{%-?\s*assign\s+([a-zA-Z_][\w]*)\s*=\s*([\s\S]*?)-?%\}/g)) {
    out.push({ nome: m[1], expr: m[2].trim(), index: m.index });
  }

  for (const bloco of src.matchAll(/\{%-?\s*liquid\s([\s\S]*?)-?%\}/g)) {
    const corpo = bloco[1];
    const base = bloco.index + bloco[0].indexOf(corpo);
    for (const m of corpo.matchAll(/^[^\S\n]*assign\s+([a-zA-Z_][\w]*)\s*=\s*(.*)$/gm)) {
      out.push({ nome: m[1], expr: m[2].trim(), index: base + m.index });
    }
  }

  return out;
}

/**
 * `for i in (2..max_installment)` — a variável do loop herda o que o limite
 * carrega. Sem isto o parcelamento escapa: o divisor era `i`, e `i` só é
 * suspeito porque o teto do range vinha de `settings.max_installments`.
 */
function coletarRanges(src) {
  const out = [];
  const alvo = /(?:\{%-?\s*|^[^\S\n]*)for\s+([a-zA-Z_][\w]*)\s+in\s+\(([^)]*)\)/gm;
  for (const m of src.matchAll(alvo)) {
    out.push({ nome: m[1], expr: m[2], index: m.index });
  }
  return out;
}

/**
 * O que há de errado num fonte Liquid. Pura de propósito — `run()` só varre
 * arquivos e traduz para offense, e `tests/dinheiro.test.mjs` planta os
 * defeitos que o tema (corrigido) não tem mais.
 *
 * @returns {{variavel: string, filtro: string, operando: string, index: number}[]}
 */
export function analisar(fonte) {
  const src = stripInert(fonte);
  const assigns = coletarAssigns(src);
  const ranges = coletarRanges(src);

  // ── Quem deriva de settings ────────────────────────────────────────────
  // Ponto fixo: uma variável pode ser definida depois de ser usada, e o
  // `for` do parcelamento fecha um ciclo entre `i` e `actual_installments`.
  const sujo = new Set();
  const definicoes = new Map();

  const registrar = (nome, expr) => {
    if (!definicoes.has(nome)) definicoes.set(nome, []);
    definicoes.get(nome).push(expr);
  };

  for (const { nome, expr } of assigns) registrar(nome, expr);
  for (const { nome, expr } of ranges) registrar(nome, expr);

  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [nome, exprs] of definicoes) {
      if (sujo.has(nome)) continue;
      const contamina = exprs.some((expr) =>
        identificadores(expr).some((id) => EH_SETTING(id) || sujo.has(raiz(id)))
      );
      if (contamina) {
        sujo.add(nome);
        mudou = true;
      }
    }
  }

  const derivaDeSetting = (trecho) =>
    identificadores(trecho).find((id) => EH_SETTING(id) || sujo.has(raiz(id)));

  /**
   * A aritmética que mistura dinheiro com configuração do lojista.
   *
   * Em `minus`, `divided_by` e afins só o OPERANDO conta: `a | minus: b` lê-se
   * "a menos b", e o que a regra proíbe é mexer no dinheiro da Shopify — não
   * exibir o valor que a lojista digitou, que é o caso legítimo do
   * `cart-free-shipping.liquid`.
   *
   * Em `times` e `plus` o lado não significa nada, então basta um dos dois vir
   * de setting e o outro não ser constante literal.
   */
  const misturaSuja = ({ sujeito, filtros }) => {
    const sujeitoSujo = derivaDeSetting(sujeito);

    for (const { nome, args } of filtros) {
      if (!ARITMETICOS.has(nome)) continue;

      const operando = derivaDeSetting(args);
      if (operando) return { filtro: nome, operando };

      if (COMUTATIVOS.has(nome) && sujeitoSujo && !EH_LITERAL(args)) {
        return { filtro: nome, operando: args.trim() };
      }
    }
    return null;
  };

  // ── De onde vem um valor, andando os `assign` para trás ────────────────
  const derivacao = (nome, vistos = new Set()) => {
    if (vistos.has(nome)) return [];
    vistos.add(nome);
    const out = [];
    for (const { expr } of assigns.filter((a) => a.nome === nome)) {
      out.push(expr);
      for (const id of identificadores(expr)) out.push(...derivacao(raiz(id), vistos));
    }
    return out;
  };

  // ── Cada ponto onde o tema imprime dinheiro ────────────────────────────
  const achados = [];
  const vistos = new Set();

  const examinar = (expr, index, variavel) => {
    const { sujeito, filtros } = partirExpressao(expr);
    if (!filtros.some((f) => EH_MONEY(f.nome))) return;

    // A operação suja pode estar na própria linha do money…
    const aqui = misturaSuja({ sujeito, filtros });
    if (aqui) return guardar(variavel ?? sujeito, aqui, index);

    // …ou em qualquer ponto da cadeia que produziu o sujeito.
    for (const id of identificadores(sujeito)) {
      for (const passo of derivacao(raiz(id))) {
        const culpa = misturaSuja(partirExpressao(passo));
        if (culpa) return guardar(raiz(id), culpa, index);
      }
    }
  };

  const guardar = (variavel, { filtro, operando }, index) => {
    const chave = `${variavel}|${filtro}|${operando}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    achados.push({ variavel, filtro, operando, index });
  };

  for (const m of src.matchAll(/\{\{-?\s*([\s\S]*?)\s*-?\}\}/g)) examinar(m[1], m.index);
  for (const { nome, expr, index } of assigns) examinar(expr, index, nome);
  for (const bloco of src.matchAll(/\{%-?\s*liquid\s([\s\S]*?)-?%\}/g)) {
    const corpo = bloco[1];
    const base = bloco.index + bloco[0].indexOf(corpo);
    for (const m of corpo.matchAll(/^[^\S\n]*echo\s+(.*)$/gm)) examinar(m[1], base + m.index);
  }

  return achados.sort((a, b) => a.index - b.index);
}

export function run() {
  const ofensas = [];

  for (const file of allLiquid()) {
    const src = read(file);

    for (const { variavel, filtro, operando, index } of analisar(src)) {
      ofensas.push(
        offense({
          rule: 'dinheiro',
          file,
          line: lineAt(stripInert(src), index),
          code: `${variavel}:${filtro}`,
          message:
            `\`${variavel}\` é impresso com \`| money\`, mas sai de \`| ${filtro}: ${operando}\` — ` +
            'um valor em dinheiro derivado de configuração do lojista. O checkout não honra ' +
            'esse número, e a loja não tem como corrigi-lo: ele não é dela nem do tema. ' +
            'Ver ADR 0008. Para falar de condição de pagamento, use o bloco `payment_icons` ' +
            'da PDP (`show_installment_text` + `installment_text`), onde a lojista escreve ' +
            'o que o gateway dela realmente faz.',
        })
      );
    }
  }

  return ofensas;
}
