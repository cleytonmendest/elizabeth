import path from 'node:path';

/**
 * Onde a sessão da vitrine e a falha dela são gravadas.
 *
 * Ficam num módulo só de caminhos porque três lados precisam deles e nenhum
 * deveria arrastar os outros: `playwright.config.mjs` (storageState),
 * `e2e/global-setup.mjs` (quem escreve) e `e2e/helpers/loja.mjs` (quem lê, e
 * que é importado por testes de Vitest — onde puxar o `chromium` do Playwright
 * junto seria carregar um navegador para ler duas strings).
 */
export const ARQUIVO_DE_SESSAO = path.join('e2e', '.auth', 'vitrine.json');

/**
 * O motivo pelo qual a sessão não abriu, quando não abriu.
 *
 * Arquivo, e não variável de ambiente: os workers do Playwright são outros
 * processos, e o que o `globalSetup` escreve no `process.env` dele não chega a
 * ninguém.
 */
export const ARQUIVO_DE_FALHA = path.join('e2e', '.auth', 'falha.json');

/**
 * Onde o reporter `json` deixa o relatório da execução — a fonte do resumo de
 * "o que NÃO rodou" que `scripts/e2e.mjs` imprime.
 *
 * Mora aqui pelo mesmo motivo que os dois acima: `playwright.config.mjs`
 * (quem configura o reporter) e `scripts/e2e.mjs` (quem lê) precisam do mesmo
 * caminho, e nenhum deveria importar o outro. Na primeira versão a constante
 * morava no runner, e o config passou a importar o script que o executa — uma
 * inversão que só se sustentava com um guard de entrypoint no runner.
 *
 * O override por ambiente existe porque `npm run test:mutants -- --e2e` roda
 * um segundo Playwright DEPOIS da suíte, no mesmo job. O `--output` desvia o
 * `outputDir` dele, mas não alcança o `outputFile` do reporter: medido, o
 * relatório do mutante sobrescrevia o da execução real dentro do artefato, e
 * quem abrisse o arquivo para saber o que não rodou recebia a resposta do
 * mutante. Ver `ambienteDoMutante`, em scripts/test-mutants.mjs.
 */
export const ARQUIVO_DE_RELATORIO =
  process.env.RELATORIO_E2E || path.join('test-results', 'relatorio.json');
