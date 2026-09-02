/**
 * A guarda dos testes que precisam de uma loja rodando.
 *
 * `THEME_URL` é o endereço de um `shopify theme dev` autenticado. Sem ela, os
 * testes que a usam se declaram PULADOS, com o motivo escrito — nunca passam
 * em silêncio. Um teste que "passa" sem ter carregado página nenhuma é a mesma
 * mentira que a catraca do baseline contava ao comparar o total consigo mesma.
 *
 * Quem torna isso visível de fato é `scripts/e2e.mjs`, que avisa em alto e bom
 * som quando a metade de loja não rodou.
 */
import { MARCA_DO_TEMA } from '../../scripts/loja-no-ar.mjs';

export const THEME_URL = process.env.THEME_URL;

export const MOTIVO =
  'THEME_URL não definida — este teste precisa de um `shopify theme dev` ' +
  'autenticado. Veja o secret SHOPIFY_CLI_THEME_TOKEN em .github/workflows/ci.yml.';

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
 * O `shopify theme dev` a usa para os GETs, mas a tela de senha volta a
 * aparecer em outros caminhos — e ela renderiza sem erro nenhum, o que a torna
 * indistinguível de "o formulário não foi enviado".
 */
export const SENHA_VITRINE = process.env.SHOPIFY_STORE_PASSWORD;

/**
 * Abre uma página E confirma que quem a serviu foi o nosso tema.
 *
 * ── Por que isto não é paranoia ────────────────────────────────────────────
 *
 * `scripts/loja-no-ar.mjs` já faz esta pergunta, uma vez, na subida: a porta
 * respondeu, mas a página é do tema? Ela nasceu depois do dia em que a loja
 * voltou a exigir senha, a sonda aprovou o 200 da tela de senha, e o axe mediu
 * acessibilidade DELA por 80 segundos — entregando o problema como dez falhas
 * de WCAG. Duas horas para descobrir que não era acessibilidade.
 *
 * A pergunta era feita uma vez e nunca mais. O proxy do `shopify theme dev`
 * não é a vitrine (ver #51 e #64), e serve página que não é nossa em mais
 * situações do que a subida: sob concorrência, numa rota que ele não resolve,
 * num caminho autenticado. Quando isso acontece no meio da suíte, o axe acusa
 * `html-has-lang` — e a mensagem manda quem lê investigar o `theme.liquid`,
 * que está correto.
 *
 * Então a evidência passa a ser exigida em TODA navegação. Uma segunda
 * tentativa cobre o caso transitório, e ela é anunciada em vez de silenciosa:
 * proxy instável é informação, não detalhe a esconder.
 */
export async function abrePaginaDoTema(page, caminho) {
  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    await page.goto(caminho);
    if (await page.evaluate(() => 'shopUrl' in window)) return;

    if (tentativa === 1) {
      console.log(`  [proxy] ${caminho} veio sem \`${MARCA_DO_TEMA}\` — tentando de novo`);
    }
  }

  const lang = await page.getAttribute('html', 'lang');
  const titulo = await page.title().catch(() => '(sem título)');

  throw new Error(
    `A página ${caminho} NÃO foi servida pelo nosso tema em duas tentativas: falta ` +
      `\`${MARCA_DO_TEMA}\`, que o layout/theme.liquid gera em toda página nossa. ` +
      `título="${titulo}" lang="${lang}". Medir acessibilidade daqui reportaria ` +
      'defeito de uma página que não é do tema — foi assim que uma tela de senha ' +
      'virou dez falhas de WCAG. Ver as issues #51 e #64: o proxy do `theme dev` ' +
      'não é a vitrine.'
  );
}
