import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright — a metade de navegador dos testes (issue #31).
 *
 * O jsdom cobre lógica de componente, mas não é navegador: ele não calcula
 * layout, não resolve contraste, não move foco. Acessibilidade e regressão
 * visual só existem aqui.
 *
 * ── Duas metades, e só uma roda sem credencial ─────────────────────────────
 *
 * `e2e/gate.spec.mjs` não precisa de loja nenhuma: ele verifica que o próprio
 * verificador funciona, contra páginas montadas na hora. Roda sempre.
 *
 * O resto aponta para `THEME_URL` — a loja de verdade, com um tema EMPURRADO
 * por `shopify theme push --development` (ADR 0007). Sem essa variável, esses
 * testes se anunciam como não executados em vez de passar em silêncio (ver
 * scripts/e2e.mjs).
 *
 * Até a #64 esta metade apontava para um `shopify theme dev` em :9292. O proxy
 * dele não é a vitrine: engolia a busca preditiva (#51), o login de cliente
 * (#64) e o estado sem sessão da página de senha (#71) — três caminhos, um
 * defeito só. `globalSetup` abre a sessão uma vez e PROVA que ela ficou fixada
 * no tema desta branch; sem essa prova, a suíte inteira mediria a loja
 * publicada e ficaria verde.
 */
import { ARQUIVO_DE_SESSAO } from './e2e/global-setup.mjs';
import { RELATORIO } from './scripts/e2e.mjs';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,

  // Abre a sessão da vitrine (senha + fixação do tema) uma vez, antes de tudo.
  globalSetup: './e2e/global-setup.mjs',

  // `forbidOnly` impede que um `test.only` esquecido faça o CI passar tendo
  // rodado um teste só — o mesmo tipo de verde vazio que a catraca do baseline
  // já produziu neste repositório.
  forbidOnly: !!process.env.CI,

  // Zero retentativas, de propósito. Retentar transforma teste instável em
  // teste verde, que é o pior dos dois mundos: o defeito continua lá e ninguém
  // mais o vê. Se um teste oscila, o teste é que está errado.
  retries: 0,

  // O `json` acompanha os outros dois SEMPRE, e não só no CI: é dele que
  // `scripts/e2e.mjs` tira quais testes não rodaram e por quê. Sem ele, um
  // teste que se pula por conta própria é indistinguível de um que passou —
  // que foi exatamente o que a regressão visual do style guide fez a
  // existência inteira dela (#74).
  reporter: process.env.CI
    ? [['github'], ['list'], ['json', { outputFile: RELATORIO }]]
    : [['list'], ['json', { outputFile: RELATORIO }]],

  use: {
    baseURL: process.env.THEME_URL,

    // Diagnóstico só do que falhou. Desde a ADR 0007 estes artefatos carregam
    // a sessão de uma loja REAL — cookie da senha da vitrine e da fixação do
    // tema —, e não mais um localhost. Ficam 7 dias, no artefato de um run
    // privado, e só quem tem acesso ao repositório os baixa; a senha da
    // vitrine é de loja de desenvolvimento e rotaciona pelo secret. Vale
    // saber ao anexar um trace num lugar mais público que o Actions.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

    // A sessão que o globalSetup abriu: cookie da senha da vitrine e a fixação
    // do tema empurrado. O arquivo é sempre escrito — vazio quando não há loja
    // —, para que `e2e/gate.spec.mjs`, que não precisa de nenhuma das duas
    // coisas, continue rodando sem storefront.
    storageState: ARQUIVO_DE_SESSAO,

    // O ambiente remoto do Claude Code já traz um Chromium, numa build que
    // pode não ser a que esta versão do Playwright baixaria (hoje: tem a 1194,
    // o Playwright 1.62 quer a 1234). No CI não existe nada pré-instalado e o
    // caminho normal é `playwright install`. Então: sem knob, comportamento
    // padrão; com CHROMIUM_PATH, usa o binário que já está no disco.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',

  // Explícito porque é o contrato da regressão visual, não uma preferência:
  // baseline que falta é GRAVADA e o run que a gravou REPROVA. Uma baseline
  // que ninguém olhou não é referência — é o estado atual promovido a verdade,
  // e é por isso que o run precisa ficar vermelho até alguém ver a imagem e
  // commitá-la (#74). Hoje é também o padrão do Playwright; escrito aqui, ele
  // para de depender disso continuar sendo verdade.
  updateSnapshots: 'missing',
});
