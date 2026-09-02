/**
 * A guarda dos testes que precisam de uma loja.
 *
 * `THEME_URL` é a origem da loja, com um tema EMPURRADO para ela por
 * `shopify theme push --development` (ADR 0007). Sem ela, os testes que a
 * usam se declaram PULADOS, com o motivo escrito — nunca passam em silêncio.
 * Um teste que "passa" sem ter carregado página nenhuma é a mesma mentira que
 * a catraca do baseline contava ao comparar o total consigo mesma.
 *
 * Quem torna isso visível de fato é `scripts/e2e.mjs`, que avisa em alto e bom
 * som quando a metade de loja não rodou.
 */

/**
 * A marca do tema. `request.origin` é Liquid, então esta linha só existe numa
 * página que passou por um layout NOSSO — os três a emitem, via
 * `snippets/theme-head.liquid`.
 *
 * Ela morava em `scripts/loja-no-ar.mjs`, a sonda que esperava o
 * `shopify theme dev` subir. Essa sonda saiu na #64 junto com o proxy (ADR
 * 0007), e por dois motivos, não um:
 *
 *   1. Não há mais o que esperar. `theme push` é síncrono: quando ele volta, o
 *      tema está lá.
 *   2. A pergunta dela tinha DEIXADO DE FUNCIONAR. A sonda nasceu para separar
 *      "o tema respondeu" de "a tela de senha da Shopify respondeu", e a #27
 *      deu ao tema a sua própria página de senha — que emite `window.shopUrl`
 *      como qualquer outra. Desde então uma loja trancada passava nela.
 *
 * Quem faz a pergunta forte agora é `e2e/global-setup.mjs`: ele exige
 * `window.Shopify.theme.id` igual ao tema que empurramos. Isso a sonda nunca
 * conseguiu perguntar, e é o que separa "é o nosso tema" de "é a nossa
 * BRANCH" — a diferença entre uma suíte verde e uma suíte verde medindo a loja
 * de produção.
 */
export const MARCA_DO_TEMA = 'window.shopUrl';

export const THEME_URL = process.env.THEME_URL;

export const MOTIVO =
  'THEME_URL não definida — este teste precisa de um tema EMPURRADO para a ' +
  'loja (`shopify theme push --development`, ver ADR 0007). Veja o secret ' +
  'SHOPIFY_CLI_THEME_TOKEN em .github/workflows/ci.yml.';

/** Onde a lojista publicou a página com o template `page.styleguide`. */
export const STYLEGUIDE_PATH = process.env.STYLEGUIDE_PATH || '/pages/styleguide';

/**
 * A conta de cliente da loja de dev, para os testes que só existem depois do
 * login — o formulário de endereço mora atrás dele.
 *
 * Separada de THEME_URL de propósito: a loja pode estar no ar sem a conta
 * existir, e nesse caso o que não roda é só a metade de conta. Um único
 * `skip` para as duas coisas esconderia qual das duas faltou.
 */
export const CLIENTE = {
  email: process.env.SHOPIFY_CUSTOMER_EMAIL,
  senha: process.env.SHOPIFY_CUSTOMER_PASSWORD,
};

export const MOTIVO_CLIENTE =
  'SHOPIFY_CUSTOMER_EMAIL / SHOPIFY_CUSTOMER_PASSWORD não definidos — este ' +
  'teste precisa de uma conta de cliente na loja de dev. Sem ela, o formulário ' +
  'de endereço (atrás de login) não é medido por nenhum teste de navegador.';

/**
 * A senha da VITRINE (a proteção da loja inteira), não a da conta de cliente.
 *
 * Quem a atravessa agora é o Playwright, em `e2e/global-setup.mjs`, e não mais
 * o CLI: sem proxy, cada requisição do navegador precisa do cookie de sessão.
 * Isso é o que torna a página de senha alcançável no estado que a usa (#71) —
 * e o que faz um erro aqui reprovar a suíte inteira de uma vez.
 */
export const SENHA_VITRINE = process.env.SHOPIFY_STORE_PASSWORD;

/**
 * Abre uma página E confirma que quem a serviu foi o nosso tema.
 *
 * ── Por que isto não é paranoia ────────────────────────────────────────────
 *
 * `e2e/global-setup.mjs` já fez a pergunta forte uma vez, na abertura da
 * sessão: o tema que respondeu é o que empurramos? Aqui a pergunta é mais
 * fraca e mais frequente — esta página veio de um layout nosso?
 *
 * Ela continua valendo depois da #64, mesmo sem proxy no caminho. Uma sessão
 * pode ser perdida (a senha da vitrine expira, um redirect leva para fora), e
 * quando isso acontece no meio da suíte o axe acusa `html-has-lang` — uma
 * mensagem que manda quem lê investigar o `theme.liquid`, que está correto.
 * Duas horas foi o que custou a primeira vez.
 *
 * A segunda tentativa cobre o caso transitório, e é anunciada em vez de
 * silenciosa: instabilidade é informação, não detalhe a esconder.
 */
export async function abrePaginaDoTema(page, caminho) {
  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    await page.goto(caminho);
    if (await page.evaluate(() => 'shopUrl' in window)) return;

    if (tentativa === 1) {
      console.log(`  [loja] ${caminho} veio sem \`${MARCA_DO_TEMA}\` — tentando de novo`);
    }
  }

  const lang = await page.getAttribute('html', 'lang');
  const titulo = await page.title().catch(() => '(sem título)');

  throw new Error(
    `A página ${caminho} NÃO foi servida pelo nosso tema em duas tentativas: falta ` +
      `\`${MARCA_DO_TEMA}\`, que snippets/theme-head.liquid gera em toda página nossa. ` +
      `título="${titulo}" lang="${lang}". Medir acessibilidade daqui reportaria ` +
      'defeito de uma página que não é do tema — foi assim que uma tela de senha ' +
      'virou dez falhas de WCAG. Se a sessão caiu, o culpado costuma ser a senha ' +
      'da vitrine: ver `e2e/global-setup.mjs` e o secret SHOPIFY_STORE_PASSWORD.'
  );
}
