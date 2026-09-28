/**
 * build — os artefatos commitados correspondem às fontes.
 *
 * São DOIS desde a #96, e a regra é a mesma para os dois: recompila para a
 * memória e compara byte a byte com o que está no disco.
 *
 *     src/tailwind.css           → assets/application.css         (Tailwind)
 *     src/checkout-acelerado.css → assets/checkout-acelerado.css  (Tailwind)
 *     src/js/*.js                → assets/*.js                    (esbuild)
 *
 * O segundo CSS é co-locado — só a PDP o carrega —, mas usa `@apply` para
 * herdar os tokens, e por isso também é gerado. A lista de pares está em
 * `scripts/build-css.mjs`.
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
 * E reprova aviso do esbuild sobre o `tailwind.config.js` (#150). A comparação
 * de CSS não vê config errado: com `minWidth` declarado duas vezes, o artefato
 * estava em dia com o config — o config é que tinha perdido dois tokens.
 *
 * É a única regra que executa um processo externo, então roda por último e
 * fica de fora do hook por arquivo (é lenta demais para isso).
 */
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, abs, offense } from '../lib.mjs';
import { VENDORIZADOS, fontes, minifica, orfaos } from '../../build-js.mjs';
import { CSS } from '../../build-css.mjs';

export const meta = {
  name: 'build',
  title: 'Build do Tailwind',
  description: 'Os CSS gerados pelo Tailwind e assets/*.js estão em dia com os fontes.',
  ratchet: false,
  slow: true,
};


export function run() {
  return [
    ...configComAviso(),
    ...CSS.flatMap(([fonte, destino]) => cssDesatualizado(fonte, destino)),
    ...jsDesatualizado(),
  ];
}

const CONFIG = 'tailwind.config.js';

/**
 * O `tailwind.config.js` é programa, e o erro dele não aparece em lugar nenhum.
 *
 * Chave repetida num objeto literal não é erro de JavaScript: a segunda
 * substitui a primeira em silêncio. `theme.extend` teve `minWidth` e
 * `maxWidth` declarados duas vezes, o Tailwind recebeu só a segunda
 * declaração de cada, e `min-w-menu-col` e `max-w-dropdown` nunca chegaram ao
 * CSS. O menu usava duas classes que não geravam nada, e a regra `tokens`
 * ficava satisfeita: ela sabe que `min-w-[150px]` é arbitrário, não se
 * `min-w-menu-col` existe.
 *
 * O esbuild, que já está aqui por causa do JS, acusa a duplicata e os outros
 * enganos que reconhece. Todo aviso dele sobre este arquivo reprova.
 */
export function configComAviso(fonte = fs.readFileSync(abs(CONFIG), 'utf8')) {
  const { warnings } = esbuild.transformSync(fonte, { loader: 'js', logLevel: 'silent' });

  return warnings.map((aviso) =>
    offense({
      rule: 'build',
      file: CONFIG,
      line: aviso.location?.line ?? 1,
      code: `config:${aviso.id || 'esbuild'}`,
      message:
        aviso.id === 'duplicate-object-key'
          ? `${aviso.text}. A segunda declaração substitui a primeira em silêncio, e os tokens da primeira somem do CSS. Junte as duas num objeto só.`
          : `O esbuild acusa: ${aviso.text}.`,
    })
  );
}

function cssDesatualizado(fonte, destino) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'theme-css-')), path.basename(destino));

  try {
    execFileSync(
      'npx',
      ['tailwindcss', '-i', `./${fonte}`, '-o', tmp, '--minify'],
      { cwd: ROOT, stdio: 'pipe' }
    );
  } catch (error) {
    return [
      offense({
        rule: 'build',
        file: fonte,
        code: 'build-failed',
        message: `Build do Tailwind falhou: ${String(error.stderr || error.message).trim().split('\n').pop()}`,
      }),
    ];
  }

  const fresh = fs.readFileSync(tmp, 'utf8');
  const committed = fs.existsSync(abs(destino)) ? fs.readFileSync(abs(destino), 'utf8') : '';
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });

  if (fresh === committed) return [];

  return [
    offense({
      rule: 'build',
      file: destino,
      code: 'stale',
      message: `${destino} está desatualizado em relação a ${fonte} e aos .liquid. Rode "npm run build" e inclua o resultado no commit.`,
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
