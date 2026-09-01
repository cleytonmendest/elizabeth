#!/usr/bin/env node
/**
 * A loja subiu — e é o TEMA que ela está servindo?
 *
 *   node scripts/loja-no-ar.mjs --url http://127.0.0.1:9292/ --pid 123 --log theme-dev.log
 *
 * A versão anterior desta sonda vivia no `ci.yml` e perguntava só isto:
 *
 *   curl -sf -o /dev/null http://127.0.0.1:9292/   →   "Loja no ar."
 *
 * A tela de senha da Shopify responde 200. Então, no dia em que a loja voltou
 * a exigir senha, o passo declarou sucesso, exportou THEME_URL, e o Playwright
 * mediu acessibilidade da tela de senha durante 80 segundos — entregando o
 * problema como 10 falhas de WCAG e timeouts esperando `#minicart-button`.
 * Duas horas para descobrir que a loja estava trancada.
 *
 * O defeito não era a loja. Era uma sonda que não conseguia falhar: ela
 * afirmava "o tema está no ar" tendo verificado apenas "alguma coisa
 * respondeu". O sinal de sucesso não provava o sucesso.
 *
 * Agora a sonda exige a evidência que só o tema tem: `window.shopUrl`, que o
 * `layout/theme.liquid` gera e que existe em TODA página servida pelo tema,
 * inclusive a 404. A tela de senha é markup da Shopify e não passa pelo nosso
 * layout, então não a tem.
 *
 * Por que virou script em vez de continuar no shell: isto é um VERIFICADOR, e
 * verificador não verificado foi exatamente a causa do episódio acima. Aqui
 * ele tem teste que planta as duas páginas e exige o veredito certo em cada
 * uma — ver tests/loja-no-ar.test.mjs.
 */

/**
 * A marca do tema. `request.origin` é Liquid, então esta linha só existe numa
 * página que passou pelo nosso layout.
 */
export const MARCA_DO_TEMA = 'window.shopUrl';

/** O corpo devolvido é uma página servida pelo tema? */
export function ehOTema(html) {
  return typeof html === 'string' && html.includes(MARCA_DO_TEMA);
}

/**
 * O log do `shopify theme dev` explica a morte do processo — com precisão, mas
 * sem dizer o que FAZER. Cada caso aqui já custou pelo menos uma rodada de CI
 * para ser entendido a partir da mensagem crua.
 */
const CASOS_DO_LOG = [
  {
    padrao: /401|invalid api key|unrecognized login/i,
    recado:
      'O secret SHOPIFY_CLI_THEME_TOKEN foi recusado (401) pela loja em SHOPIFY_STORE. Ele precisa ser uma senha do app Theme Access (começa com shptka_) gerada NESSA loja — token de Admin API ou de outra loja dá exatamente este erro. Gere em https://apps.shopify.com/theme-access e regrave o secret.',
  },
  {
    padrao: /Enter your store password|Failed to prompt/i,
    recado:
      'A loja tem proteção por senha de storefront, e o CLI tentou PERGUNTAR a senha — num runner sem terminal não há como responder. Grave a senha (admin → Loja virtual → Preferências → Proteção por senha) no secret SHOPIFY_STORE_PASSWORD, ou desative a proteção na loja de desenvolvimento.',
  },
  {
    padrao: /not found|does not exist|could not be found/i,
    recado:
      'A loja em SHOPIFY_STORE não foi encontrada. O valor deve ser o domínio myshopify.com (exemplo: minha-loja.myshopify.com).',
  },
];

/** Traduz o log do CLI em recados acionáveis. Vazio quando não reconhece nada. */
export function diagnosticarLog(texto) {
  if (!texto) return [];
  return CASOS_DO_LOG.filter((c) => c.padrao.test(texto)).map((c) => c.recado);
}

/**
 * O recado do caso que este script existe para nomear: alguém respondeu, mas
 * não é o tema. Quase sempre a tela de senha da vitrine.
 */
export function recadoNaoEhOTema({ status, urlFinal, amostra }) {
  return [
    `A porta respondeu (HTTP ${status}), mas a página servida NÃO é o tema: falta \`${MARCA_DO_TEMA}\`, que o layout/theme.liquid gera em toda página nossa.`,
    'O caso de longe mais comum é a loja estar atrás da proteção por senha da vitrine — a Shopify serve a tela de senha com 200, e ela não passa pelo nosso layout.',
    'Confira o secret SHOPIFY_STORE_PASSWORD contra admin → Loja virtual → Preferências → Proteção por senha. Um espaço ou quebra de linha sobrando no valor basta.',
    `URL final: ${urlFinal}`,
    `Começo do que veio: ${amostra}`,
  ].join(' ');
}

const processoVivo = (pid) => {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera até a URL servir o tema.
 *
 * Devolve `{ ok: true }` ou `{ ok: false, erros: [...] }`. Nunca lança por
 * falha da loja: quem chama decide o que fazer com o veredito.
 *
 * Três desfechos, e a diferença entre os dois últimos é o ponto deste arquivo:
 *   - serviu o tema                       → ok
 *   - o processo morreu                   → o log diz por quê
 *   - respondeu, mas sem a marca do tema  → está no ar servindo OUTRA coisa
 */
export async function esperarLoja({
  url,
  pid = null,
  lerLog = () => '',
  timeoutMs = 300_000,
  intervaloMs = 2_000,
  buscar = fetch,
} = {}) {
  const limite = Date.now() + timeoutMs;
  // O que a última resposta parecia. Guardado para a mensagem do timeout: sem
  // isso, "não respondeu em 300s" mente sobre uma loja que respondeu 150 vezes.
  let ultimaSemTema = null;

  while (Date.now() < limite) {
    if (!processoVivo(pid)) {
      return {
        ok: false,
        erros: [
          'O shopify theme dev morreu antes de servir. Log abaixo.',
          ...diagnosticarLog(lerLog()),
        ],
      };
    }

    let resposta = null;
    try {
      resposta = await buscar(url, { redirect: 'follow' });
    } catch {
      // Ninguém escutando ainda: o servidor está subindo. Continua esperando.
    }

    if (resposta) {
      const corpo = await resposta.text().catch(() => '');
      if (ehOTema(corpo)) return { ok: true };
      ultimaSemTema = {
        status: resposta.status,
        urlFinal: resposta.url || url,
        amostra: corpo.replace(/\s+/g, ' ').trim().slice(0, 200) || '(vazio)',
      };
    }

    await dormir(intervaloMs);
  }

  if (ultimaSemTema) return { ok: false, erros: [recadoNaoEhOTema(ultimaSemTema)] };
  return {
    ok: false,
    erros: [
      `Nada respondeu em ${url} dentro de ${Math.round(timeoutMs / 1000)}s. Log abaixo.`,
      ...diagnosticarLog(lerLog()),
    ],
  };
}

// ---------------------------------------------------------------------------

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? padrao : process.argv[i + 1];
}

async function main() {
  const fs = await import('node:fs');
  const url = argumento('url', 'http://127.0.0.1:9292/');
  const pid = Number(argumento('pid', 0)) || null;
  const caminhoDoLog = argumento('log', null);
  const timeoutMs = Number(argumento('timeout-ms', 300_000));

  const lerLog = () => {
    if (!caminhoDoLog || !fs.existsSync(caminhoDoLog)) return '';
    return fs.readFileSync(caminhoDoLog, 'utf8');
  };

  const { ok, erros } = await esperarLoja({ url, pid, lerLog, timeoutMs });

  if (ok) {
    console.log('Loja no ar, servindo o tema.');
    return 0;
  }

  for (const erro of erros) console.log(`::error::${erro}`);
  const log = lerLog();
  if (log) {
    console.log('--- theme-dev.log ---');
    console.log(log);
  }
  return 1;
}

// Só executa quando chamado direto; importar para teste não dispara nada.
if (process.argv[1] && process.argv[1].endsWith('loja-no-ar.mjs')) {
  main().then((codigo) => process.exit(codigo));
}
