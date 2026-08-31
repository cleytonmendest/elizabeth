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
 * O resto aponta para `THEME_URL` — um `shopify theme dev` autenticado. Sem
 * essa variável, esses testes se anunciam como não executados em vez de
 * passar em silêncio (ver scripts/e2e.mjs).
 */

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,

  // `forbidOnly` impede que um `test.only` esquecido faça o CI passar tendo
  // rodado um teste só — o mesmo tipo de verde vazio que a catraca do baseline
  // já produziu neste repositório.
  forbidOnly: !!process.env.CI,

  // Zero retentativas, de propósito. Retentar transforma teste instável em
  // teste verde, que é o pior dos dois mundos: o defeito continua lá e ninguém
  // mais o vê. Se um teste oscila, o teste é que está errado.
  retries: 0,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: process.env.THEME_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

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
});
