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
import { ambienteDoMutante } from '../scripts/test-mutants.mjs';

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
});

describe('o runner usa a poda de verdade', () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'scripts/test-mutants.mjs'), 'utf8');

  // Sem isto, os quatro testes acima verificariam uma função que ninguém
  // chama — verde exibindo o mesmo silêncio do caso em que ela é chamada.
  it('o spawn do Playwright recebe o ambiente podado', () => {
    expect(fonte).toMatch(/env:\s*ambienteDoMutante\(process\.env,\s*mutante\.teste\)/);
  });

  // A lista de mutantes de a11y roda contra `e2e/gate.spec.mjs`. Se um dia ela
  // apontar para um spec que MEDE a loja, a poda deixaria de ser correta e
  // este teste é onde isso aparece.
  it('todo mutante de navegador roda contra o gate, que não precisa de loja', () => {
    const alvos = [...fonte.matchAll(/teste:\s*'(e2e\/[^']+)'/g)].map((m) => m[1]);
    expect(alvos.length).toBeGreaterThan(0);
    expect([...new Set(alvos)]).toEqual(['e2e/gate.spec.mjs']);
  });
});
