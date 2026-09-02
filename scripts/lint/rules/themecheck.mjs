/**
 * themecheck — Theme Check da Shopify, dentro do mesmo gate.
 *
 * O tema já estava em 0 offenses, mas dependia de alguém lembrar de rodar
 * `shopify theme check` com o CLI global instalado. Aqui usamos o pacote
 * `@shopify/theme-check-node` como devDependency, para que o resultado seja o
 * mesmo na sua máquina, no hook e no CI.
 *
 * ── Por que filtramos o que o Theme Check devolve ──────────────────────────
 *
 * O `themeCheckRun` varre `**​/*.{liquid,json}` a partir da raiz e descarta o
 * que casa com o `ignore` do config — que, no preset `recommended`, é
 * `node_modules/**`. O descarte usa minimatch, e `**` NÃO atravessa segmento
 * que começa com ponto.
 *
 * O efeito: quando a raiz do tema mora sob um diretório oculto, `node_modules`
 * deixa de ser ignorado e os FIXTURES dos pacotes viram "offenses do tema".
 * `@shopify/theme-graph` publica um tema de mentira em `fixtures/` — com
 * `layout/`, `sections/` e `snippets/` — e ele chegava aqui como 8 erros e 3
 * avisos, todos em arquivos que não são nossos.
 *
 * Isso não é hipótese: no CI a raiz é `/home/runner/work/elizabeth/elizabeth`
 * e o lint passa limpo; num worktree em `.claude/worktrees/<nome>` o MESMO
 * commit reprova. Um gate cujo resultado depende de onde o repositório foi
 * clonado não é um gate — e este repositório usa worktree para quase tudo.
 *
 * Então a regra não delega mais essa decisão: offense fora de um diretório de
 * tema não é offense do tema. É a mesma informação que o `.shopifyignore` já
 * dá ao `shopify theme push` — o que está publicado é o que está nessas pastas.
 */
import { ROOT, offense, rel } from '../lib.mjs';

export const meta = {
  name: 'themecheck',
  title: 'Theme Check',
  description: 'Linter oficial da Shopify — requisito da Theme Store.',
  ratchet: true,
  slow: true,
  async: true,
};

// 0 = erro, 1 = aviso, 2 = informativo.
const SEVERITY = ['error', 'warn', 'warn'];

/**
 * As pastas que a Shopify publica. `blocks` não existe neste tema ainda, mas
 * é diretório de tema e entra na lista pelo mesmo motivo que as outras.
 */
const PASTAS_DO_TEMA = [
  'assets',
  'blocks',
  'config',
  'layout',
  'locales',
  'sections',
  'snippets',
  'templates',
];

/**
 * O arquivo faz parte do tema publicado? Pura e exportada porque a alternativa
 * é verificá-la plantando um fixture dentro de node_modules — e regra que só
 * dá para testar mexendo em dependência é regra que ninguém testa.
 */
export function ehDoTema(file) {
  const caminho = String(file ?? '');
  return PASTAS_DO_TEMA.some((pasta) => caminho.startsWith(`${pasta}/`));
}

export async function run() {
  let themeCheck;
  try {
    themeCheck = await import('@shopify/theme-check-node');
  } catch {
    return [
      offense({
        rule: 'themecheck',
        file: 'package.json',
        severity: 'warn',
        code: 'not-installed',
        message: '@shopify/theme-check-node não está instalado. Rode "npm ci".',
      }),
    ];
  }

  const { offenses } = await themeCheck.themeCheckRun(ROOT);

  return offenses
    .map((item) => ({ item, file: rel(new URL(item.uri).pathname) }))
    .filter(({ file }) => ehDoTema(file))
    .map(({ item, file }) =>
      offense({
        rule: 'themecheck',
        file,
        line: (item.start?.line ?? 0) + 1,
        severity: SEVERITY[item.severity] ?? 'error',
        code: `${item.check}:${item.message}`,
        message: `${item.check}: ${item.message}`,
      })
    );
}
