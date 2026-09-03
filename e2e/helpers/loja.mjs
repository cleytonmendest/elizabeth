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
 * Quem faz a pergunta forte é `e2e/global-setup.mjs`: ele exige
 * `window.Shopify.theme.id` igual ao tema que empurramos. Isso a sonda nunca
 * conseguiu perguntar, e é o que separa "é o nosso tema" de "é a nossa
 * BRANCH" — a diferença entre uma suíte verde e uma suíte verde medindo a loja
 * de produção. `abrePaginaDoTema` repete essa pergunta A CADA NAVEGAÇÃO, e o
 * porquê está no cabeçalho dela.
 *
 * O valor é o NOME da propriedade, não a frase `window.shopUrl`: quem verifica
 * e quem escreve a mensagem leem a mesma constante. Enquanto eram duas coisas,
 * a verificação podia mudar sem a mensagem mudar junto — e mensagem que
 * descreve outra verificação é pior que mensagem nenhuma.
 */
export const MARCA_DO_TEMA = 'shopUrl';

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
 * Abre uma página E confirma que quem a serviu foi a nossa BRANCH.
 *
 * ── Por que a pergunta fraca não bastava mais ──────────────────────────────
 *
 * Até a #64, `baseURL` era `127.0.0.1:9292`: não existia produção alcançável,
 * e perguntar "esta página veio de um layout nosso?" era suficiente. Hoje
 * `baseURL` É a origem da loja, e o tema publicado É ESTE MESMO TEMA — emite
 * `window.shopUrl` igualzinho. A pergunta fraca passou a ter a mesma resposta
 * nos dois casos que ela precisava separar.
 *
 * E a fixação do tema é por SESSÃO, não por URL. Se ela cair no meio da suíte
 * — cookie expirado, redirect para fora, o que for —, cada `page.goto`
 * seguinte recebe 200 da vitrine PUBLICADA, e o desfecho é o que a ADR 0007
 * chama de pior resultado possível: verde medindo produção.
 *
 * Por isso a prova não é feita uma vez, no `global-setup`, e sim a cada
 * navegação: um verificador que confere na entrada e confia no resto do
 * percurso não verifica o percurso.
 *
 * `window.Shopify.theme.id` vem do `{{ content_for_header }}`, que os três
 * layouts emitem — onde há `shopUrl`, há id.
 *
 * A segunda tentativa cobre o caso transitório, e é anunciada em vez de
 * silenciosa: instabilidade é informação, não detalhe a esconder.
 */
export async function abrePaginaDoTema(page, caminho) {
  const esperado = process.env.PREVIEW_THEME_ID;
  let visto;

  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    await page.goto(caminho);
    visto = await page.evaluate(
      (marca) => ({
        ehNosso: marca in window,
        temaId: window.Shopify?.theme?.id ?? null,
      }),
      MARCA_DO_TEMA
    );

    if (visto.ehNosso && String(visto.temaId) === String(esperado)) return;

    if (tentativa === 1) {
      const sintoma = visto.ehNosso
        ? `respondeu o tema ${visto.temaId}, e não o ${esperado}`
        : `veio sem \`window.${MARCA_DO_TEMA}\``;
      console.log(`  [loja] ${caminho} ${sintoma} — tentando de novo`);
    }
  }

  const lang = await page.getAttribute('html', 'lang');
  const titulo = await page.title().catch(() => '(sem título)');
  const onde = `url=${page.url()} título="${titulo}" lang="${lang}"`;

  // Duas causas, duas mensagens. Uma só mandaria metade das investigações
  // para o lugar errado — que é o defeito que este arquivo inteiro combate.
  if (!visto.ehNosso) {
    throw new Error(
      `A página ${caminho} NÃO foi servida pelo nosso tema em duas tentativas: falta ` +
        `\`window.${MARCA_DO_TEMA}\`, que snippets/theme-head.liquid gera em toda página ` +
        `nossa. ${onde}. Medir acessibilidade daqui reportaria defeito de uma página ` +
        'que não é do tema — foi assim que uma tela de senha virou dez falhas de WCAG. ' +
        'Se a sessão caiu, o culpado costuma ser a senha da vitrine: ver ' +
        '`e2e/global-setup.mjs` e o secret SHOPIFY_STORE_PASSWORD.'
    );
  }

  throw new Error(
    `A página ${caminho} é do nosso tema, mas do tema ERRADO: respondeu ` +
      `${visto.temaId} e o empurrado é ${esperado}. A fixação é por SESSÃO e caiu no ` +
      `meio da execução — daqui para a frente a suíte mediria a vitrine PUBLICADA e ` +
      `ficaria verde sobre ela. ${onde}. Ver ADR 0007.`
  );
}
