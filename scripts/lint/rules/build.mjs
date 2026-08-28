/**
 * build — o CSS commitado corresponde às fontes.
 *
 * `assets/application.css` é gerado pelo Tailwind a partir dos `.liquid`. Se
 * alguém adiciona uma classe e esquece de rodar o build, o commit passa em
 * todos os outros linters e a loja sobe sem o estilo. Aqui recompilamos para
 * um arquivo temporário e comparamos byte a byte.
 *
 * É a única regra que executa um processo externo, então roda por último e
 * fica de fora do hook por arquivo (é lenta demais para isso).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, abs, offense } from '../lib.mjs';

export const meta = {
  name: 'build',
  title: 'Build do Tailwind',
  description: 'assets/application.css está em dia com os fontes .liquid.',
  ratchet: false,
  slow: true,
};

const OUTPUT = 'assets/application.css';

export function run() {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'theme-css-')), 'application.css');

  try {
    execFileSync(
      'npx',
      ['tailwindcss', '-i', './src/tailwind.css', '-o', tmp, '--minify'],
      { cwd: ROOT, stdio: 'pipe' }
    );
  } catch (error) {
    return [
      offense({
        rule: 'build',
        file: 'src/tailwind.css',
        code: 'build-failed',
        message: `Build do Tailwind falhou: ${String(error.stderr || error.message).trim().split('\n').pop()}`,
      }),
    ];
  }

  const fresh = fs.readFileSync(tmp, 'utf8');
  const committed = fs.existsSync(abs(OUTPUT)) ? fs.readFileSync(abs(OUTPUT), 'utf8') : '';
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });

  if (fresh === committed) return [];

  return [
    offense({
      rule: 'build',
      file: OUTPUT,
      code: 'stale',
      message: `${OUTPUT} está desatualizado em relação aos .liquid. Rode "npm run build" e inclua o resultado no commit.`,
    }),
  ];
}
