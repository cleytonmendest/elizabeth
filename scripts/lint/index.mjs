#!/usr/bin/env node
/**
 * Runner dos linters do tema.
 *
 *   npm run lint                  todas as regras
 *   npm run lint -- --rules=refs,i18n
 *   npm run lint -- --files=sections/header.liquid   (modo hook: só o que mudou)
 *   npm run lint -- --fast        pula as regras lentas (theme check, build)
 *   npm run lint:baseline         regrava o baseline com o estado atual
 *
 * ── A catraca ──────────────────────────────────────────────────────────────
 * Violação já existente fica registrada em config/baseline.json e sai como
 * aviso. Violação nova é erro e quebra o build. E o baseline precisa descrever
 * o que as regras REALMENTE produzem: entrada registrada que ninguém mais
 * viola reprova até ser regravada, seja porque a dívida foi paga, seja porque
 * a linha foi escrita à mão. É assim que a dívida fica visível e contável em
 * vez de virar uma nota num documento que ninguém atualiza.
 *
 * A outra metade da catraca — o total não pode crescer entre a base e o PR —
 * mora em `scripts/catraca.mjs`, que trava também o baseline de a11y.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from './lib.mjs';
import { fantasmas } from '../catraca.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, 'config', 'baseline.json');

// As regras são descobertas lendo o diretório — ver loadRules() em lib.mjs.

const args = parseArgs(process.argv.slice(2));

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code, text) => (colors ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const red = (t) => paint('31', t);
const yellow = (t) => paint('33', t);
const green = (t) => paint('32', t);
const dim = (t) => paint('2', t);
const bold = (t) => paint('1', t);

const baseline = loadBaseline();
const all = await loadRules();

if (args.rules) {
  const known = new Set(all.map((r) => r.meta.name));
  const unknown = args.rules.filter((name) => !known.has(name));
  if (unknown.length) {
    console.error(red(`Regra desconhecida: ${unknown.join(', ')}`));
    console.error(dim(`  disponíveis: ${[...known].sort().join(', ')}`));
    process.exit(2);
  }
}

const selected = args.rules ? all.filter((r) => args.rules.includes(r.meta.name)) : all;
const found = [];
const failures = [];

for (const rule of selected) {
  const name = rule.meta.name;

  if (args.fast && rule.meta.slow) continue;
  // O modo por arquivo serve ao hook de edição: regras que olham o tema
  // inteiro (build, budget) não fazem sentido com escopo reduzido.
  if (args.files && rule.meta.slow) continue;

  try {
    const result = await rule.run();
    found.push(...result.map((item) => ({ ...item, ratchet: rule.meta.ratchet })));
  } catch (error) {
    failures.push({ name, message: error.message });
  }
}

if (failures.length) {
  for (const { name, message } of failures) {
    console.error(red(`✖ regra "${name}" falhou ao executar: ${message}`));
  }
  process.exit(2);
}

const scoped = args.files ? found.filter((item) => args.files.includes(item.file)) : found;

if (args.writeBaseline) {
  writeBaseline(scoped);
  process.exit(0);
}

// Classificação: nova (erro) vs. registrada no baseline (aviso).
const errors = [];
const warnings = [];
for (const item of scoped) {
  const known = item.ratchet && baseline.has(item.fingerprint);
  if (known || item.severity === 'warn') warnings.push(item);
  else errors.push(item);
}

report(errors, warnings);

// O outro lado da catraca: o baseline não pode conter fingerprint que nenhuma
// regra produz mais. Isso era um `console.log` sugerindo "rode lint:baseline"
// — e sugestão que alguém precisa lembrar de seguir é a categoria de coisa que
// este repositório move para código. Enquanto foi só recado, duas coisas
// passavam: dívida já paga inflando o número que o `npm run status` publica
// (com a folga que isso dá para dívida nova entrar debaixo do total antigo), e
// linha adicionada à mão para silenciar uma violação nova — que o lint então
// vê como conhecida. O cabeçalho do baseline.json PEDE que ninguém edite à
// mão; aqui o pedido vira verificação.
//
// Só vale quando a execução cobriu TODAS as regras: com `--rules`, `--files`
// ou `--fast` as regras não executadas pareceriam "corrigidas".
let assombracoes = [];
if (!args.files && !args.rules && !args.fast) {
  const presentes = new Set(scoped.filter((item) => item.ratchet).map((item) => item.fingerprint));
  assombracoes = fantasmas(baseline, presentes);

  if (assombracoes.length) {
    console.log(
      red(`\n✖ ${assombracoes.length} entrada(s) do baseline que nenhuma regra produz.`)
    );
    for (const fingerprint of assombracoes.slice(0, 20)) console.log(dim(`    ${fingerprint}`));
    if (assombracoes.length > 20) console.log(dim(`    … e mais ${assombracoes.length - 20}.`));
    console.log(
      dim('  Ou a dívida foi corrigida (ótimo) e falta travar o progresso, ou alguém escreveu\n') +
        dim('  a linha à mão. Nos dois casos: npm run lint:baseline')
    );
  }
}

process.exit(errors.length || assombracoes.length ? 1 : 0);

// ───────────────────────────────────────────────────────────────────────────

function report(errors, warnings) {
  const groups = new Map();
  for (const item of [...errors, ...warnings]) {
    if (!groups.has(item.file)) groups.set(item.file, []);
    groups.get(item.file).push(item);
  }

  const isError = new Set(errors);

  for (const [file, items] of [...groups].sort()) {
    console.log(`\n${bold(file)}`);
    for (const item of items.sort((a, b) => a.line - b.line)) {
      const tag = isError.has(item) ? red('erro ') : yellow('aviso');
      const known = item.ratchet && baseline.has(item.fingerprint) ? dim(' [baseline]') : '';
      console.log(`  ${dim(String(item.line).padStart(4))}  ${tag}  ${dim(item.rule)}  ${item.message}${known}`);
    }
  }

  console.log('');
  if (errors.length) {
    console.log(red(`✖ ${errors.length} erro(s)`) + dim(` · ${warnings.length} aviso(s)`));
    console.log(
      dim('  Erros são violações NOVAS. Corrija-as ou, se forem legítimas, registre a exceção')
    );
    console.log(dim('  com justificativa em scripts/lint/config/design-exceptions.json.'));
  } else if (warnings.length) {
    console.log(green('✔ nenhuma violação nova') + dim(` · ${warnings.length} ocorrência(s) de dívida conhecida`));
  } else {
    console.log(green('✔ tudo limpo'));
  }
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return new Set();
  const json = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  return new Set(json.fingerprints ?? []);
}

function writeBaseline(items) {
  const fingerprints = [...new Set(items.filter((i) => i.ratchet).map((i) => i.fingerprint))].sort();
  const byRule = {};
  for (const fingerprint of fingerprints) {
    const rule = fingerprint.split('|')[0];
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          'Dívida técnica conhecida. Gerado por "npm run lint:baseline". Só deve encolher — nunca adicione entradas à mão para silenciar uma violação nova.',
        generated: new Date().toISOString().slice(0, 10),
        counts: byRule,
        total: fingerprints.length,
        fingerprints,
      },
      null,
      2
    )}\n`
  );
  console.log(green(`✔ baseline regravado: ${fingerprints.length} violação(ões) conhecida(s)`));
  for (const [rule, count] of Object.entries(byRule).sort()) {
    console.log(dim(`    ${rule.padEnd(12)} ${count}`));
  }
}

function parseArgs(argv) {
  const out = { fast: false, writeBaseline: false };
  for (const arg of argv) {
    if (arg === '--fast') out.fast = true;
    else if (arg === '--write-baseline') out.writeBaseline = true;
    else if (arg.startsWith('--rules=')) out.rules = arg.slice(8).split(',').filter(Boolean);
    else if (arg.startsWith('--files=')) out.files = arg.slice(8).split(',').filter(Boolean);
  }
  return out;
}
