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
