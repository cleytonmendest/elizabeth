import fs from 'node:fs';
import { ARQUIVO_DE_FALHA } from './sessao.mjs';

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
 * O motivo pelo qual a sessão não abriu, ou `null`.
 *
 * `e2e/global-setup.mjs` GRAVA a falha em vez de estourar, porque estourar num
 * globalSetup aborta a execução inteira e leva junto `e2e/gate.spec.mjs`, que
 * não precisa de loja nenhuma. A leitura é feita a cada chamada, e não uma vez
 * no import, porque o import acontece na coleta — antes do setup ter escrito.
 */
export function falhaDeSessao() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_DE_FALHA, 'utf8')).motivo ?? null;
  } catch {
    return null;
  }
}

/**
 * ── A guarda: quem serviu esta página foi a nossa BRANCH? ──────────────────
 *
 * Até a #64, `baseURL` era `127.0.0.1:9292`: não existia produção alcançável,
 * e perguntar "esta página veio de um layout nosso?" era suficiente. Hoje
 * `baseURL` É a origem da loja, e o tema publicado É ESTE MESMO TEMA — emite
 * `window.shopUrl` igualzinho. A pergunta fraca passou a ter a mesma resposta
 * nos dois casos que ela precisava separar.
 *
 * E a fixação do tema é por SESSÃO, não por URL. Se ela cair no meio da suíte
 * — cookie expirado, redirect para fora, o que for —, cada navegação seguinte
 * recebe 200 da vitrine PUBLICADA, e o desfecho é o que a ADR 0007 chama de
 * pior resultado possível: verde medindo produção.
 *
 * Por isso a prova não é feita uma vez, no `global-setup`, e sim a cada
 * navegação: um verificador que confere na entrada e confia no resto do
 * percurso não verifica o percurso.
 *
 * `window.Shopify.theme.id` vem do `{{ content_for_header }}`, que os três
 * layouts emitem — onde há `shopUrl`, há id.
 *
 * São DUAS as portas por onde um documento novo entra, e a #73 nasceu de a
 * guarda cobrir só a primeira: `abrePaginaDoTema` (por URL) e `clicaNoTema`
 * (por clique). O que as duas compartilham é `reprovacao` — a decisão, sem a
 * navegação.
 */

/** O que a página respondeu. Uma viagem ao navegador, três respostas. */
const olha = (page) =>
  page.evaluate(
    (marca) => ({
      ehNosso: marca in window,
      temaId: window.Shopify?.theme?.id ?? null,
      barraDePreview: Boolean(document.querySelector('#preview-bar-iframe')),
    }),
    MARCA_DO_TEMA
  );

/** Onde estamos, para o erro não mandar procurar no lugar errado. */
async function contexto(page) {
  const lang = await page.getAttribute('html', 'lang');
  const titulo = await page.title().catch(() => '(sem título)');
  return `url=${page.url()} título="${titulo}" lang="${lang}"`;
}

/**
 * A decisão, SEM a navegação: com o que a página respondeu, ela serve?
 *
 * Pura de propósito. Enquanto morava dentro de `abrePaginaDoTema`, ela só era
 * alcançável por quem navegasse por URL — e foi exatamente assim que a
 * navegação por CLIQUE ficou fora da guarda por uma versão inteira (#73).
 * Separada, ela é a mesma decisão para toda porta que produz documento novo, e
 * ninguém precisa lembrar de repetir o critério ao abrir a próxima.
 *
 * `alvo` é sempre uma frase começando por "A página", porque é ela que abre as
 * mensagens abaixo — quem chama diz QUAL página, esta função diz o que há de
 * errado com ela.
 *
 * @returns {null | {curto: string, mensagem: string}} `null` quando aprova.
 *   `curto` é para o log da retentativa; `mensagem` é o erro.
 */
export function reprovacao({ visto, esperado, alvo }) {
  if (visto.ehNosso && String(visto.temaId) === String(esperado) && !visto.barraDePreview) {
    return null;
  }

  // Três causas, três mensagens. Uma só mandaria dois terços das investigações
  // para o lugar errado — que é o defeito que este arquivo inteiro combate.
  if (!visto.ehNosso) {
    return {
      curto: `veio sem \`window.${MARCA_DO_TEMA}\``,
      mensagem:
        `${alvo} NÃO foi servida pelo nosso tema: falta ` +
        `\`window.${MARCA_DO_TEMA}\`, que snippets/theme-head.liquid gera em toda página ` +
        'nossa. Medir acessibilidade daqui reportaria defeito de uma página ' +
        'que não é do tema — foi assim que uma tela de senha virou dez falhas de WCAG. ' +
        'Se a sessão caiu, o culpado costuma ser a senha da vitrine: ver ' +
        '`e2e/global-setup.mjs` e o secret SHOPIFY_STORE_PASSWORD.',
    };
  }

  // A barra é markup que a Shopify injeta sobre tema de desenvolvimento, e que
  // a vitrine publicada não tem. Medir acessibilidade com ela é medir outra
  // página — e o `FORA_DO_TEMA` do axe não a exclui, de propósito: excluir
  // ESCONDERIA o sintoma, quando o que ele indica é que a página inteira veio
  // vestida de outra coisa.
  //
  // O `global-setup` já pede `pb=0` uma vez, na fixação, e a evidência da
  // primeira execução diz que isso vale para a sessão toda (o baseline de a11y
  // tem 8 entradas, nenhuma da barra — se ela estivesse nas páginas seguintes,
  // o axe teria enchido o arquivo com ela). "Diz que vale" não é "verifica que
  // vale": é o mesmo argumento que este arquivo faz para a fixação do tema, e
  // ele custa uma propriedade no `evaluate` que já ia e voltava.
  if (visto.barraDePreview) {
    return {
      curto: 'veio com a barra de preview',
      mensagem:
        `${alvo} veio com a barra de preview da Shopify ` +
        '(`#preview-bar-iframe`), que a vitrine publicada não tem — o axe mediria ' +
        'elementos que o tema não controla. O `pb=0` da página fixadora deveria ' +
        'valer para a sessão inteira; se a Shopify mudou isso, é aqui que aparece. ' +
        'Ver `e2e/global-setup.mjs` e a ADR 0007.',
    };
  }

  return {
    curto: `respondeu o tema ${visto.temaId}, e não o ${esperado}`,
    mensagem:
      `${alvo} é do nosso tema, mas do tema ERRADO: respondeu ` +
      `${visto.temaId} e o empurrado é ${esperado}. A fixação é por SESSÃO e caiu no ` +
      'meio da execução — daqui para a frente a suíte mediria a vitrine PUBLICADA e ' +
      'ficaria verde sobre ela. Ver ADR 0007.',
  };
}

/**
 * Abre uma página por URL e confirma que quem a serviu foi a nossa branch.
 *
 * A segunda tentativa cobre o caso transitório, e é anunciada em vez de
 * silenciosa: instabilidade é informação, não detalhe a esconder.
 */
export async function abrePaginaDoTema(page, caminho) {
  // Antes de navegar: se a sessão não abriu, navegar é pior que não navegar —
  // a loja responde 200 com o tema PUBLICADO e a falha viria disfarçada de
  // asserção de conteúdo, a três camadas do motivo real.
  const falha = falhaDeSessao();
  if (falha) {
    throw new Error(
      `A sessão da vitrine não abriu, então este teste não tem como medir esta ` +
        `branch. Motivo registrado por e2e/global-setup.mjs:\n  ${falha}`
    );
  }

  const esperado = process.env.PREVIEW_THEME_ID;
  const alvo = `A página ${caminho}`;
  let falhou;

  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    await page.goto(caminho);
    falhou = reprovacao({ visto: await olha(page), esperado, alvo });
    if (!falhou) return;

    if (tentativa === 1) {
      console.log(`  [loja] ${caminho} ${falhou.curto} — tentando de novo`);
    }
  }

  throw new Error(`${falhou.mensagem} Duas tentativas. ${await contexto(page)}`);
}

/**
 * Clica em algo que NAVEGA, e refaz a mesma pergunta na página que chegou.
 *
 * ── Por que a guarda por URL não cobria isto (#73) ─────────────────────────
 *
 * `abrePaginaDoTema` prova o tema a cada `page.goto`. Só que metade das
 * páginas que a suíte mede não entra por `goto`: entra por clique — a PDP a
 * partir da coleção, a coleção filtrada. Se a fixação cair entre o `goto` e o
 * clique, a página seguinte vem da vitrine PUBLICADA com 200, e a asserção
 * seguinte mede produção exibindo a mesma cara de quando está tudo certo.
 *
 * O caminho ficou FECHADO em vez de vigiado: não há mais um clique de
 * navegação cru nos specs, então a guarda não depende de alguém lembrar dela
 * — que é o critério da ADR 0001.
 *
 * ── Duas escolhas que parecem detalhe e não são ────────────────────────────
 *
 * 1. Espera o documento novo ANTES de perguntar. Sem isso o `evaluate`
 *    responderia sobre a página anterior — que passou na guarda um instante
 *    atrás —, e a guarda diria "tudo certo" sobre um documento que não é o que
 *    o teste vai medir. Seria a mesma família de defeito que ela existe para
 *    impedir, um nível abaixo.
 *
 * 2. Sem retentativa. `page.goto` pode repetir a mesma navegação; um clique,
 *    não. Recarregar não seria repetir o clique — seria navegar por URL, que é
 *    a outra porta, com a outra guarda.
 *
 * Serve para clique que muda de URL. Num clique que não navega (quick-add,
 * "carregar mais", troca de variante por `pushState`) ele reprova DIZENDO
 * isso, e não é detalhe de ergonomia: sem timeout próprio, a espera ia até o
 * timeout do TESTE, e a falha chegava como "Test timeout of 30000ms exceeded"
 * — verdadeira e inútil, a mesma forma de defeito que `entrar()` corrigiu em
 * `e2e/endereco.spec.mjs`. Foi medido num navegador antes de virar esta linha.
 */

/**
 * Quanto se espera pelo documento novo.
 *
 * Precisa ser MENOR que o timeout do teste, senão a mensagem abaixo nunca é
 * lida — quem estoura primeiro é o Playwright, com o texto genérico dele. Os
 * 15s são o mesmo número que `fluxos.spec.mjs` usa para a busca preditiva, e
 * pelo mesmo motivo: navegação de loja que demora mais que isso está quebrada
 * para a cliente de qualquer jeito.
 */
const ESPERA_DE_NAVEGACAO = 15_000;

export async function clicaNoTema(page, locator, descricao) {
  const antes = page.url();
  await locator.click();

  try {
    await page.waitForURL((url) => url.href !== antes, {
      waitUntil: 'domcontentloaded',
      timeout: ESPERA_DE_NAVEGACAO,
    });
  } catch {
    throw new Error(
      `O clique em ${descricao} não trocou de URL em ${ESPERA_DE_NAVEGACAO}ms — a página ` +
        `continua em ${antes}. \`clicaNoTema\` é para clique que NAVEGA: ele espera o ` +
        'documento novo justamente para poder provar de que tema ele veio. Clique que não ' +
        'navega (quick-add, "carregar mais", troca de variante por `pushState`) não traz ' +
        'documento novo, não tem tema novo para provar, e deve ser chamado cru — o tema da ' +
        'página em que ele acontece já foi provado na entrada. Se ele DEVIA navegar, então ' +
        'o defeito é do tema, e é isto aqui que o teste está reportando.'
    );
  }

  const falhou = reprovacao({
    visto: await olha(page),
    esperado: process.env.PREVIEW_THEME_ID,
    alvo: `A página aberta pelo clique em ${descricao}`,
  });
  if (!falhou) return;

  throw new Error(`${falhou.mensagem} ${await contexto(page)}`);
}
