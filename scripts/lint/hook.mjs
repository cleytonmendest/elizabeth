#!/usr/bin/env node
/**
 * Ponte entre o harness do Claude Code e os linters do tema.
 *
 * Roda como hook PostToolUse: depois de cada Edit/Write, recebe o JSON da
 * chamada em stdin, descobre qual arquivo foi tocado e roda as regras rápidas
 * só nele. Se houver violação nova, sai com código 2 — que o harness trata
 * como erro bloqueante e devolve a mensagem ao agente.
 *
 * É a camada mais importante do gate: aqui o retorno chega em segundos, antes
 * do commit, sem depender de ninguém lembrar de rodar nada. As camadas
 * seguintes (pre-commit e CI) existem porque esta pode ser desligada.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Diretórios que os linters entendem. Um Write em docs/ ou scripts/ não passa
// por aqui.
const THEME_DIRS = /^(sections|snippets|templates|layout|assets|locales|config)\//;

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const absolute = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
if (!absolute) process.exit(0);

const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
if (relative.startsWith('..') || !THEME_DIRS.test(relative)) process.exit(0);
if (!/\.(liquid|json|css|js)$/.test(relative)) process.exit(0);

let output = '';
let failed = false;
try {
  output = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/lint/index.mjs'), '--fast', `--files=${relative}`],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }
  );
} catch (error) {
  // Código 1 = violação nova. Qualquer outro = o linter quebrou, e nesse caso
  // não faz sentido bloquear a edição do agente por um bug nosso.
  if (error.status !== 1) process.exit(0);
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  failed = true;
}

if (!failed) process.exit(0);

const lines = output
  .split('\n')
  .filter((line) => line.includes('erro '))
  .map((line) => line.trim());

process.stderr.write(
  [
    `Os linters do tema reprovaram ${relative}:`,
    '',
    ...lines,
    '',
    'Corrija antes de seguir. Se a violação for legítima (cor de marca, scrim de',
    'imagem, lightbox), registre a exceção com justificativa em',
    'scripts/lint/config/design-exceptions.json — não a ignore.',
    '',
  ].join('\n')
);

// 2 = erro bloqueante: o harness devolve o stderr ao agente.
process.exit(2);
