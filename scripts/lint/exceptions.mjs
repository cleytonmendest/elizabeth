/**
 * Exceções e configuração dos linters.
 *
 * Uma exceção precisa de três coisas: onde vale, o que libera e POR QUÊ. O
 * campo `reason` é obrigatório — sem ele o linter falha na própria
 * configuração. A ideia é que ninguém consiga silenciar uma regra sem deixar
 * escrito para o próximo o motivo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'config');

const cache = new Map();

export function readConfig(name) {
  if (!cache.has(name)) {
    cache.set(name, JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, name), 'utf8')));
  }
  return cache.get(name);
}

/** Glob mínimo: só `*`, que casa qualquer coisa menos `/`. */
function matches(pattern, value) {
  if (pattern === '*') return true;
  const source = `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`;
  return new RegExp(source).test(value);
}

let allowList = null;

function load() {
  if (allowList) return allowList;
  const config = readConfig('design-exceptions.json');
  allowList = (config.allow ?? []).map((entry, index) => {
    if (!entry.reason || entry.reason.trim().length < 10) {
      throw new Error(
        `design-exceptions.json: entrada ${index} sem "reason" explicando por que a exceção é legítima.`
      );
    }
    return entry;
  });
  return allowList;
}

/**
 * `code` chega como "hex:#25D366" ou "scheme-not-painted". A exceção pode
 * casar o código inteiro ou usar `*` no fim para liberar uma família.
 */
export function isAllowed(rule, file, code) {
  return load().some(
    (entry) =>
      entry.rule === rule &&
      (entry.files ?? []).some((pattern) => matches(pattern, file)) &&
      (entry.codes ?? []).some((pattern) => matches(pattern, code))
  );
}
