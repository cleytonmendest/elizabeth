/**
 * O mutante de navegador mede o VERIFICADOR, não a loja.
 *
 * `e2e/gate.spec.mjs` planta uma página com `setContent` e pergunta se o axe a
 * reprova — nenhuma linha dele toca a vitrine. Mas o `globalSetup` do
 * Playwright é de config: com `THEME_URL` no ambiente ele sobe Chromium e abre
 * sessão na loja em toda invocação, uma por mutante.
 *
 * O que isso quebra não é o tempo do CI, é o veredito. O runner conta mutante
 * morto por `status !== 0`, então um `globalSetup` que estoura — sessão
 * expirada, tema apagado, loja fora do ar — vira "morreu". Sairia
 * "8 mutantes, 8 mortos" sem o axe ter rodado uma vez.
 *
 * É a forma de verde vazio que este repositório mais persegue, e ela estava
 * dentro do script que a procura: no CI o passo herda `THEME_URL` do
 * `$GITHUB_ENV` escrito pelo passo "Onde medir".
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ambienteDoMutante, SAIDA_DO_MUTANTE } from '../scripts/test-mutants.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COM_LOJA = {
  PATH: '/usr/bin',
  THEME_URL: 'https://loja.myshopify.com',
  PREVIEW_THEME_ID: '158207180978',
};

describe('o ambiente de um mutante de navegador', () => {
  it('não leva THEME_URL, para o globalSetup não abrir sessão nenhuma', () => {
    const env = ambienteDoMutante(COM_LOJA, 'e2e/gate.spec.mjs');
    expect(env.THEME_URL).toBeUndefined();
    expect(env.PREVIEW_THEME_ID).toBeUndefined();
  });

  it('preserva o resto do ambiente — podar não é esvaziar', () => {
    expect(ambienteDoMutante(COM_LOJA, 'e2e/gate.spec.mjs').PATH).toBe('/usr/bin');
  });

  it('não poda o mutante de Vitest, que nunca teve loja no caminho', () => {
    expect(ambienteDoMutante(COM_LOJA, 'tests/cart.test.mjs')).toBe(COM_LOJA);
  });

  it('não muta o objeto recebido: process.env do próprio runner fica de pé', () => {
    const antes = { ...COM_LOJA };
    ambienteDoMutante(COM_LOJA, 'e2e/gate.spec.mjs');
    expect(COM_LOJA).toEqual(antes);
  });

  // O `--output` desvia o `outputDir` e para um arquivo antes do fim: o
  // relatório do reporter `json` sai por `outputFile`, que é do config, e
  // continuava caindo em `test-results/` — sobrescrevendo, dentro do artefato,
  // o relatório da execução que falhou. Achado na revisão do PR #75.
  it('o relatório do mutante também vai para o diretório dele', () => {
    const env = ambienteDoMutante(COM_LOJA, 'e2e/gate.spec.mjs');
    expect(env.RELATORIO_E2E).toContain(SAIDA_DO_MUTANTE);
    expect(env.RELATORIO_E2E).not.toMatch(/(^|\/)test-results\//);
  });

  it('o mutante de Vitest não ganha a variável: ele não roda Playwright', () => {
    expect(ambienteDoMutante(COM_LOJA, 'tests/cart.test.mjs').RELATORIO_E2E).toBeUndefined();
  });
});

describe('o runner usa a poda de verdade', () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'scripts/test-mutants.mjs'), 'utf8');

  // Sem isto, os quatro testes acima verificariam uma função que ninguém
  // chama — verde exibindo o mesmo silêncio do caso em que ela é chamada.
  it('o spawn do Playwright recebe o ambiente podado', () => {
    expect(fonte).toMatch(/env:\s*ambienteDoMutante\(process\.env,\s*mutante\.teste\)/);
  });

  // O Playwright APAGA o diretório de saída ao começar. Como este passo roda
  // depois da suíte no mesmo job, escrever no `test-results/` padrão apagava
  // as evidências da falha antes do `upload-artifact` — foi o que aconteceu no
  // PR #75 com a imagem que a #74 acabara de gravar.
  it('o spawn do Playwright escreve os artefatos FORA do diretório da suíte', () => {
    expect(fonte).toMatch(/'test',\s*mutante\.teste,\s*`--output=\$\{SAIDA_DO_MUTANTE\}`/);
    expect(SAIDA_DO_MUTANTE).not.toBe('test-results');
  });

  /**
   * Os specs que medem VERIFICADORES, e não a loja.
   *
   * São os únicos alvos legítimos de um mutante de navegador. Um mutante
   * apontado para um spec que MEDE a loja se declararia PULADO com a poda de
   * `THEME_URL`, o Playwright sairia 0, e o mutante contaria como SOBREVIVENTE
   * sem nada ter sido medido — a forma de verde vazio que este script existe
   * para encontrar, dentro do script que a procura.
   */
  const SEM_LOJA = ['e2e/gate.spec.mjs', 'e2e/guarda-do-clique.spec.mjs'];

  it('todo mutante de navegador roda contra um spec que não precisa de loja', () => {
    const alvos = [...new Set([...fonte.matchAll(/teste:\s*'(e2e\/[^']+)'/g)].map((m) => m[1]))];
    expect(alvos.length).toBeGreaterThan(0);
    expect(alvos.filter((alvo) => !SEM_LOJA.includes(alvo))).toEqual([]);
  });

  // E a lista acima não é palavra dada: ela é conferida contra o que os specs
  // fazem. Sem esta metade, bastaria acrescentar um nome ali em cima para o
  // teste de novo aprovar um mutante que não mede nada.
  it('e esses specs realmente não dependem da loja', () => {
    for (const spec of SEM_LOJA) {
      expect(fs.readFileSync(path.join(RAIZ, spec), 'utf8')).not.toMatch(/THEME_URL/);
    }
  });
});
