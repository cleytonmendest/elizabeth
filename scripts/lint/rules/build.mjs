/**
 * build — os artefatos commitados correspondem às fontes.
 *
 * São DOIS desde a #96, e a regra é a mesma para os dois: recompila para a
 * memória e compara byte a byte com o que está no disco.
 *
 *     src/tailwind.css → assets/application.css   (Tailwind)
 *     src/js/*.js      → assets/*.js              (esbuild)
 *
 * Se alguém adiciona uma classe e esquece de rodar o build, o commit passa em
 * todos os outros linters e a loja sobe sem o estilo. O mesmo vale para o JS,
 * com um agravante: `assets/*.js` é agora um ARTEFATO com cara de fonte. Uma
 * edição à mão ali sobrevive a todos os testes (que leem `assets/`, porque é
 * o que a loja serve) e some no build seguinte, sem deixar rastro. Esta regra
 * é o que transforma esse sumiço silencioso em erro.
 *
 * Também reprova `assets/*.js` sem fonte e sem entrada em VENDORIZADOS: sem
 * isso, um arquivo escrito direto em `assets/` simplesmente nunca seria
 * minificado, e a #96 voltaria de fininho um arquivo por vez.
 *
 * É a única regra que executa um processo externo, então roda por último e
 * fica de fora do hook por arquivo (é lenta demais para isso).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, abs, offense } from '../lib.mjs';
import { VENDORIZADOS, fontes, minifica, orfaos } from '../../build-js.mjs';

export const meta = {
  name: 'build',
  title: 'Build do Tailwind',
  description: 'assets/application.css e assets/*.js estão em dia com os fontes.',
  ratchet: false,
  slow: true,
};

const OUTPUT = 'assets/application.css';

export function run() {
  return [...cssDesatualizado(), ...jsDesatualizado()];
}

function cssDesatualizado() {
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

/**
 * O JS servido corresponde a `src/js/`.
 *
 * Compara em memória (o esbuild é determinístico: mesmo fonte, mesmos bytes),
 * então não custa processo externo e roda rápido apesar de a regra ser lenta
 * por causa do Tailwind.
 */
export function jsDesatualizado(deps = {}) {
  const {
    listar = fontes,
    gerar = minifica,
    semFonte = orfaos,
    ler = (f) => (fs.existsSync(abs(f)) ? fs.readFileSync(abs(f), 'utf8') : ''),
  } = deps;
  const offenses = [];

  for (const nome of listar()) {
    const destino = `assets/${nome}`;
    let fresco;
    try {
      fresco = gerar(nome);
    } catch (error) {
      offenses.push(
        offense({
          rule: 'build',
          file: `src/js/${nome}`,
          code: 'build-failed',
          message: `esbuild não conseguiu minificar: ${String(error.message).trim().split('\n')[0]}`,
        })
      );
      continue;
    }

    const commitado = ler(destino);
    if (fresco === commitado) continue;

    offenses.push(
      offense({
        rule: 'build',
        file: destino,
        code: 'stale',
        message:
          `${destino} não corresponde a src/js/${nome}. ` +
          'Rode "npm run build" e inclua o resultado no commit. ' +
          `(assets/*.js é gerado — edite src/js/${nome}.)`,
      })
    );
  }

  for (const nome of semFonte()) {
    offenses.push(
      offense({
        rule: 'build',
        file: `assets/${nome}`,
        code: 'sem-fonte',
        message:
          `assets/${nome} não é gerado a partir de src/js/ e não está declarado como vendorizado. ` +
          `Mova-o para src/js/${nome} (e rode "npm run build"), ou declare-o em VENDORIZADOS ` +
          'em scripts/build-js.mjs, com o motivo escrito.',
      })
    );
  }

  return offenses;
}
