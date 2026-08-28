/**
 * Helpers compartilhados pelos linters do tema.
 *
 * Sem dependências externas — Node 18+ puro. Tudo que os linters precisam saber
 * sobre a forma de um tema Shopify (onde ficam os arquivos, como ler um schema,
 * como ler um locale com cabeçalho de comentário) mora aqui.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const DIRS = {
  sections: 'sections',
  snippets: 'snippets',
  templates: 'templates',
  layout: 'layout',
  assets: 'assets',
  locales: 'locales',
  config: 'config',
};

/** Caminho absoluto a partir da raiz do repositório. */
export const abs = (rel) => path.join(ROOT, rel);

/** Caminho relativo à raiz — é o que aparece nas mensagens de offense. */
export const rel = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');

export const exists = (relPath) => fs.existsSync(abs(relPath));

export const read = (relPath) => fs.readFileSync(abs(relPath), 'utf8');

/**
 * Lê JSON tolerando o cabeçalho `/* ... *\/` que o admin da Shopify escreve
 * nos arquivos de locale e nos templates JSON.
 */
export function readJSONC(relPath) {
  const raw = read(relPath).replace(/^﻿/, '');
  return JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\//, ''));
}

/** Lista arquivos de um diretório do tema (recursivo), filtrando por extensão. */
export function list(dir, ext = '.liquid', { recursive = false } = {}) {
  const base = abs(dir);
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (recursive) out.push(...list(relPath, ext, { recursive }));
    } else if (entry.name.endsWith(ext)) {
      out.push(relPath);
    }
  }
  return out.sort();
}

/** Todo arquivo `.liquid` do tema, em qualquer diretório relevante. */
export function allLiquid() {
  return [
    ...list(DIRS.layout),
    ...list(DIRS.sections),
    ...list(DIRS.snippets),
    ...list(DIRS.templates, '.liquid', { recursive: true }),
  ];
}

/** Todo template JSON, incluindo os section groups. */
export function allJsonTemplates() {
  return [...list(DIRS.templates, '.json'), ...list(DIRS.sections, '.json')];
}

/**
 * Extrai o bloco `{% schema %}` de uma section.
 * Devolve `{ json, raw, line }` ou `null` se não houver schema.
 * `line` é a linha (1-indexed) onde o conteúdo do schema começa, para que os
 * offenses apontem para um lugar navegável no editor.
 */
export function extractSchema(src) {
  const match = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!match) return null;
  const line = lineAt(src, match.index) + countLines(match[0].slice(0, match[0].indexOf(match[1])));
  try {
    return { json: JSON.parse(match[1]), raw: match[1], line };
  } catch (error) {
    return { json: null, raw: match[1], line, error: error.message };
  }
}

const countLines = (text) => text.split('\n').length - 1;

/** Linha 1-indexed de um índice de caractere. */
export function lineAt(src, index) {
  return countLines(src.slice(0, index)) + 1;
}

/** Achata um objeto aninhado em `{ 'a.b.c': valor }`. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

/**
 * Percorre um objeto de schema chamando `visit(key, value, path)` em cada par.
 * Usado pelas regras que precisam inspecionar `label`/`info`/`content`/`name`.
 */
export function walkSchema(node, visit, currentPath = '') {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walkSchema(item, visit, `${currentPath}[${index}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (typeof value === 'string') visit(key, value, nextPath);
    else walkSchema(value, visit, nextPath);
  }
}

/**
 * Remove blocos que não são markup ativo (comentários Liquid/HTML e a tag
 * `{% schema %}`), para que as regras não acusem exemplos de documentação.
 * Preserva a contagem de linhas trocando o conteúdo por linhas em branco.
 */
export function stripInert(src) {
  const blank = (m) => '\n'.repeat(countLines(m));
  return src
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, blank)
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

/** Cria um offense com fingerprint estável (sem número de linha). */
export function offense({ rule, file, line = 1, code, message, severity = 'error' }) {
  return {
    rule,
    file,
    line,
    code,
    message,
    severity,
    fingerprint: `${rule}|${file}|${code}`,
  };
}

export const bytes = (relPath) => (exists(relPath) ? fs.statSync(abs(relPath)).size : 0);

/**
 * As regras existentes, descobertas lendo o diretório — nunca uma lista escrita
 * à mão. Um arquivo novo em `rules/` já entra no `npm run lint`, no painel de
 * status e no hook, sem ninguém precisar lembrar de registrá-lo em três lugares
 * (que foi exatamente o que aconteceu quando a regra `settings` nasceu).
 *
 * Ordem: as rápidas primeiro, alfabéticas dentro de cada grupo, para que o
 * retorno útil apareça antes das que levam segundos.
 */
export async function loadRules() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rules');
  const modules = await Promise.all(
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.mjs'))
      .map(async (name) => import(`./rules/${name}`))
  );
  return modules.sort(
    (a, b) =>
      Number(a.meta.slow ?? false) - Number(b.meta.slow ?? false) ||
      a.meta.name.localeCompare(b.meta.name)
  );
}
