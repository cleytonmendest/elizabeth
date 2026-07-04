#!/usr/bin/env node
/*
 * Preview de preset na loja real.
 * Troca `current` de config/settings_data.json pelo preset escolhido, para
 * visualizar via `shopify theme dev`. Faz backup do estado real na 1a vez.
 *
 * Uso:
 *   node scripts/preview-preset.js Rosé      # aplica o preset "Rosé" ao current
 *   shopify theme dev                        # visualiza no navegador
 *   node scripts/preview-preset.js restore   # volta o current ao normal
 *
 * Aceita nome com ou sem acento/caixa (rose, Rosé, BOTANICO...).
 * Nada aqui vai para a loja no push: a pasta scripts/ não é enviada pelo CLI.
 */
const fs = require('fs');
const PATH = 'config/settings_data.json';
const BAK = 'scripts/.settings_data.backup';

function read() {
  const raw = fs.readFileSync(PATH, 'utf8');
  const i = raw.indexOf('{');
  return { header: raw.slice(0, i), data: JSON.parse(raw.slice(i)) };
}
function write(header, data) {
  fs.writeFileSync(PATH, header + JSON.stringify(data, null, 2) + '\n', 'utf8');
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const arg = process.argv[2];

if (arg === 'restore') {
  if (fs.existsSync(BAK)) {
    fs.copyFileSync(BAK, PATH);
    fs.unlinkSync(BAK);
    console.log('✓ current restaurado ao estado original.');
  } else {
    console.log('Sem backup. Se precisar, use: git checkout config/settings_data.json');
  }
  process.exit(0);
}

const { header, data } = read();
const names = Object.keys(data.presets || {});

if (!arg) {
  console.log('uso: node scripts/preview-preset.js <preset|restore>');
  console.log('presets:', names.join(', '));
  process.exit(0);
}

const key = names.find((n) => norm(n) === norm(arg));
if (!key) {
  console.log('Preset não encontrado:', arg);
  console.log('Disponíveis:', names.join(', '));
  process.exit(1);
}

if (!fs.existsSync(BAK)) fs.copyFileSync(PATH, BAK); // backup do estado real (só na 1a vez)
data.current = JSON.parse(JSON.stringify(data.presets[key]));
write(header, data);

console.log(`✓ current = "${key}".`);
console.log('  Agora rode:  shopify theme dev');
console.log('  Para voltar: node scripts/preview-preset.js restore');
