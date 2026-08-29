/**
 * themecheck — Theme Check da Shopify, dentro do mesmo gate.
 *
 * O tema já estava em 0 offenses, mas dependia de alguém lembrar de rodar
 * `shopify theme check` com o CLI global instalado. Aqui usamos o pacote
 * `@shopify/theme-check-node` como devDependency, para que o resultado seja o
 * mesmo na sua máquina, no hook e no CI.
 */
import { ROOT, offense, rel } from '../lib.mjs';

export const meta = {
  name: 'themecheck',
  title: 'Theme Check',
  description: 'Linter oficial da Shopify — requisito da Theme Store.',
  ratchet: true,
  slow: true,
  async: true,
};

// 0 = erro, 1 = aviso, 2 = informativo.
const SEVERITY = ['error', 'warn', 'warn'];

export async function run() {
  let themeCheck;
  try {
    themeCheck = await import('@shopify/theme-check-node');
  } catch {
    return [
      offense({
        rule: 'themecheck',
        file: 'package.json',
        severity: 'warn',
        code: 'not-installed',
        message: '@shopify/theme-check-node não está instalado. Rode "npm ci".',
      }),
    ];
  }

  const { offenses } = await themeCheck.themeCheckRun(ROOT);

  return offenses.map((item) =>
    offense({
      rule: 'themecheck',
      file: rel(new URL(item.uri).pathname),
      line: (item.start?.line ?? 0) + 1,
      severity: SEVERITY[item.severity] ?? 'error',
      code: `${item.check}:${item.message}`,
      message: `${item.check}: ${item.message}`,
    })
  );
}
