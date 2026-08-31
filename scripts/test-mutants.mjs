#!/usr/bin/env node
/**
 * Os testes conseguem falhar?
 *
 *   npm run test:mutants
 *
 * Uma suíte verde diz que os testes passaram. Ela não diz que eles verificam
 * alguma coisa — um `expect(true).toBe(true)` também passa, e um teste que
 * perdeu o alvo (o seletor mudou, o evento trocou de nome) fica verde exibindo
 * o mesmo silêncio de um teste que está funcionando.
 *
 * Este script quebra o tema de propósito, uma quebra por vez, e exige que a
 * suíte fique VERMELHA. Mutante que sobrevive é um teste que não estava
 * olhando para o que dizia olhar.
 *
 * Cada entrada é uma quebra REAL — um bug que já aconteceu neste repositório
 * ou que aconteceria na primeira refatoração distraída. Não é uma varredura
 * automática de operadores: a lista é curta e escolhida a dedo, porque o que
 * ela protege é a intenção do teste, não a cobertura de linhas.
 *
 * Há duas listas, e cada execução roda UMA:
 *
 *   npm run test:mutants          assets/*.js, via Vitest
 *   npm run test:mutants -- --e2e  o verificador de a11y, via Playwright
 *
 * A segunda precisa de Chromium, então vive no job de navegador do CI.
 *
 * A segunda não é luxo. Ela já pagou por si: a primeira versão de
 * `e2e/gate.spec.mjs` afirmava `expect(relatorio(...)).toBe('')`, e um mutante
 * mostrou que um `relatorio` devolvendo '' por engano deixaria o teste passar
 * com a página cheia de violações. O gate verificava o gate — e o teste do
 * gate não verificava nada.
 *
 * O arquivo original é restaurado sempre, inclusive se o processo falhar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = path.join(ROOT, 'node_modules', '.bin', 'vitest');
const PLAYWRIGHT = path.join(ROOT, 'node_modules', '.bin', 'playwright');

const comE2E = process.argv.includes('--e2e');

const MUTANTES = [
  {
    porque: 'formatPrice deixa de converter centavos em reais',
    arquivo: 'assets/cart.js',
    de: '.format(value / 100)',
    para: '.format(value)',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'updateQuantity para de avisar o erro para quem escuta',
    arquivo: 'assets/cart.js',
    de: 'publish(PUB_SUB_EVENTS.cartError, error);',
    para: 'void error;',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'addToCart volta a mandar Content-Type e o multipart chega ilegível',
    arquivo: 'assets/cart.js',
    de: "delete config.headers['Content-Type'];",
    para: '// mutante',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'o botão sem data-text-* volta a ser reescrito (apaga o ícone do quick-add)',
    arquivo: 'assets/cart.js',
    de: 'if (!textDesktop || !textMobile) return;',
    para: 'if (false) return;',
    teste: 'tests/add-to-cart.test.mjs',
  },
  {
    porque: 'o mínimo por parcela deixa de ser inclusivo',
    arquivo: 'assets/price-component.js',
    de: 'if (installmentValueCheck >= minValueCents) {',
    para: 'if (installmentValueCheck > minValueCents) {',
    teste: 'tests/price-component.test.mjs',
  },
  {
    porque: 'o preço riscado aparece justamente quando não há desconto',
    arquivo: 'assets/price-component.js',
    de: "classList.toggle('hidden', !listingPrice)",
    para: "classList.toggle('hidden', listingPrice)",
    teste: 'tests/price-component.test.mjs',
  },
  {
    porque: 'a variante passa a casar com combinação parcial',
    arquivo: 'assets/variations-selector.js',
    de: 'return optionsMatchLength && optionsMatchValues;',
    para: 'return optionsMatchLength || optionsMatchValues;',
    teste: 'tests/variations-selector.test.mjs',
  },
  {
    porque: 'a URL compartilhável perde o parâmetro que a Shopify entende',
    arquivo: 'assets/variations-selector.js',
    de: '?variant=${this.currentVariant.id}',
    para: '?variante=${this.currentVariant.id}',
    teste: 'tests/variations-selector.test.mjs',
  },
  {
    porque: 'datas impossíveis (31/02) voltam a rolar para o mês seguinte',
    arquivo: 'assets/countdown-timer.js',
    de: 'if (d > lastDay) d = lastDay;',
    para: 'if (false) d = lastDay;',
    teste: 'tests/countdown-timer.test.mjs',
  },
  {
    porque: 'o modo diário para de pular para o dia seguinte',
    arquivo: 'assets/countdown-timer.js',
    de: 'if (target <= now) target += 86400000;',
    para: 'if (false) target += 86400000;',
    teste: 'tests/countdown-timer.test.mjs',
  },
  {
    porque: 'o contador vencido volta a rodar para sempre com a seção escondida',
    arquivo: 'assets/countdown-timer.js',
    de: 'this.interval = setInterval(() => this.tick(), 1000);\n    this.tick();',
    para: 'this.tick();\n    this.interval = setInterval(() => this.tick(), 1000);',
    teste: 'tests/countdown-timer.test.mjs',
  },
];

/**
 * Mutantes do verificador de acessibilidade. Rodam com `--e2e`, porque exigem
 * navegador. Note que aqui o alvo NÃO é o tema: é `e2e/helpers/axe.mjs`, o
 * código que decide se uma página passa ou não.
 */
const MUTANTES_E2E = [
  {
    porque: 'o axe passa a devolver lista vazia — toda página "acessível"',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '  return violations;',
    para: '  return [];',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'os critérios do WCAG viram uma tag que não existe',
    arquivo: 'e2e/helpers/axe.mjs',
    de: "['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']",
    para: "['tag-que-nao-existe']",
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o filtro de escopo deixa de excluir (widget de terceiro reprovaria o PR)',
    arquivo: 'e2e/helpers/axe.mjs',
    de: 'builder = builder.exclude(seletor);',
    para: 'builder = builder;',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o relatório fica vazio e a falha não diz o que quebrou',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '  return violations\n    .map((v) => {',
    para: '  return [].map((v) => {',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o relatório perde o seletor do nó afetado',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '    em: ${onde}${resto}',
    para: '    em: ???',
    teste: 'e2e/gate.spec.mjs',
  },
];

// Listas separadas, não somadas: cada uma roda no job de CI que tem as
// ferramentas dela. Somar faria o job de navegador repetir os 11 do unitário.
const LISTA = comE2E ? MUTANTES_E2E : MUTANTES;

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code, text) => (colors ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const red = (t) => paint('31', t);
const green = (t) => paint('32', t);
const dim = (t) => paint('2', t);

const sobreviventes = [];

for (const mutante of LISTA) {
  const alvo = path.join(ROOT, mutante.arquivo);
  const original = fs.readFileSync(alvo, 'utf8');

  const ocorrencias = original.split(mutante.de).length - 1;
  if (ocorrencias !== 1) {
    console.error(
      red(`✖ ${mutante.arquivo}: o trecho a mutar aparece ${ocorrencias} vez(es), esperava 1.`)
    );
    console.error(dim(`  ${JSON.stringify(mutante.de)}`));
    console.error(dim('  O arquivo mudou — atualize a lista em scripts/test-mutants.mjs.'));
    process.exit(2);
  }

  let resultado;
  try {
    fs.writeFileSync(alvo, original.replace(mutante.de, mutante.para));
    const navegador = mutante.teste.startsWith('e2e/');
    resultado = navegador
      ? spawnSync(PLAYWRIGHT, ['test', mutante.teste], { cwd: ROOT, encoding: 'utf8' })
      : spawnSync(VITEST, ['run', mutante.teste], { cwd: ROOT, encoding: 'utf8' });
  } finally {
    fs.writeFileSync(alvo, original);
  }

  const morreu = resultado.status !== 0;
  console.log(
    `${morreu ? green('morreu ') : red('SOBREVIVEU')}  ${mutante.porque}`,
    dim(`(${mutante.arquivo} → ${mutante.teste})`)
  );
  if (!morreu) sobreviventes.push(mutante);
}

console.log('');
if (sobreviventes.length) {
  console.error(
    red(`${sobreviventes.length} de ${LISTA.length} mutante(s) sobreviveram.`) +
      ' A suíte ficou verde com o tema quebrado — esses testes não verificam o que dizem verificar.'
  );
  process.exit(1);
}
console.log(green(`${LISTA.length} mutantes, ${LISTA.length} mortos.`));
