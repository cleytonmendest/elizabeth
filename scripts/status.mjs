#!/usr/bin/env node
/**
 * Painel de conformidade — GERADO, nunca escrito à mão.
 *
 * Este arquivo existe para substituir a seção "Requisitos Críticos" do antigo
 * ROADMAP.md. A diferença não é de formato, é de categoria: o ROADMAP afirmava
 * um estado que alguém precisava lembrar de atualizar depois de cada correção,
 * e foi exatamente aí que ele apodreceu. Aqui o estado é medido a cada
 * execução, então não existe "esqueci de atualizar".
 *
 *   npm run status              imprime no terminal
 *   npm run status -- --md      Markdown (usado pelo CI no resumo do PR)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure } from './lint/rules/budget.mjs';
import { loadRules } from './lint/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const asMarkdown = process.argv.includes('--md');

const baseline = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lint', 'config', 'baseline.json'), 'utf8')
);
const known = new Set(baseline.fingerprints ?? []);

const rows = [];
// Regras descobertas do diretório: o painel nunca fica atrás do lint.
for (const rule of await loadRules()) {
  if (rule.meta.name === 'build') continue; // recompila o Tailwind; caro demais para um painel
  const offenses = await rule.run();
  const fresh = offenses.filter((o) => o.severity !== 'warn' && !(rule.meta.ratchet && known.has(o.fingerprint)));
  const debt = offenses.filter((o) => rule.meta.ratchet && known.has(o.fingerprint));
  rows.push({ name: rule.meta.name, title: rule.meta.title, fresh: fresh.length, debt: debt.length });
}

const budget = measure();
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const clean = rows.every((r) => r.fresh === 0);
const totalDebt = rows.reduce((sum, r) => sum + r.debt, 0);

if (asMarkdown) {
  console.log('## Estado do tema\n');
  console.log(`${clean ? '✅' : '❌'} **${clean ? 'Nenhuma violação nova' : 'Há violações novas'}** · ${totalDebt} item(ns) de dívida conhecida no baseline\n`);
  console.log('| Verificação | Novas | Dívida |');
  console.log('| --- | ---: | ---: |');
  for (const r of rows) {
    console.log(`| ${r.title} | ${r.fresh === 0 ? '—' : `**${r.fresh}**`} | ${r.debt || '—'} |`);
  }
  console.log(`\n**Peso global:** ${kb(budget.js)} de JS · ${kb(budget.css)} de CSS em toda página.`);
} else {
  const pad = Math.max(...rows.map((r) => r.title.length));
  console.log('\nEstado do tema\n');
  for (const r of rows) {
    const mark = r.fresh === 0 ? '✔' : '✖';
    const debt = r.debt ? `  (${r.debt} no baseline)` : '';
    console.log(`  ${mark}  ${r.title.padEnd(pad)}  ${r.fresh === 0 ? 'limpo' : `${r.fresh} nova(s)`}${debt}`);
  }
  console.log(`\n  Peso global: ${kb(budget.js)} JS · ${kb(budget.css)} CSS (toda página)`);
  console.log(`  Dívida total no baseline: ${totalDebt}\n`);
}

process.exit(clean ? 0 : 1);
