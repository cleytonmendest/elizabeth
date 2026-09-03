#!/usr/bin/env node
/**
 * Roda a suíte de navegador e DIZ o que não rodou.
 *
 * A suíte tem duas metades. A de gate (`e2e/gate.spec.mjs`) verifica que o
 * verificador de acessibilidade sabe reprovar, e não precisa de loja: roda
 * sempre, em toda execução, em todo gatilho. A de storefront precisa de um
 * tema EMPURRADO para a loja, em THEME_URL (ADR 0007).
 *
 * O motivo deste script existir é uma linha só: quando a segunda metade não
 * roda, isso precisa APARECER. A alternativa óbvia — um job de CI com `if:`
 * checando o secret — é o bug que este repositório acabou de corrigir no
 * board: um caminho que só roda em certas circunstâncias fica quebrado sem
 * ninguém ver, porque as execuções verdes são todas das outras.
 *
 * Então o job roda sempre, o script roda sempre, e a ausência da credencial
 * vira um aviso no resumo do run em vez de um job cinza que some da tela.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ARQUIVO_DE_FALHA } from '../e2e/helpers/sessao.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYWRIGHT = path.join(ROOT, 'node_modules', '.bin', 'playwright');

const temLoja = Boolean(process.env.THEME_URL);

function avisar(texto) {
  console.log(process.env.CI ? `::warning::${texto}` : texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `> [!WARNING]\n> ${texto}\n\n`);
  }
}

if (temLoja) {
  console.log(`Loja: ${process.env.THEME_URL}`);
} else {
  avisar(
    'A metade de storefront NÃO rodou: falta THEME_URL (um tema empurrado com ' +
      '`shopify theme push --development`). O que rodou foi só o gate de ' +
      'acessibilidade, que verifica o ' +
      'verificador. Enquanto este aviso aparecer, nenhuma página do tema foi ' +
      'medida por axe neste run — o verde abaixo não cobre acessibilidade real.'
  );
}

// A conta de cliente é uma terceira metade, e some com a mesma facilidade: a
// loja pode estar no ar sem ela existir, e aí o formulário de endereço — que
// mora atrás do login — não é medido por teste nenhum. Sem este aviso, o run
// verde diria que a suíte de navegador passou, sem dizer que ela nem abriu a
// página em questão.
if (!process.env.SHOPIFY_CUSTOMER_EMAIL || !process.env.SHOPIFY_CUSTOMER_PASSWORD) {
  avisar(
    'A metade de CONTA não rodou: faltam SHOPIFY_CUSTOMER_EMAIL / ' +
      'SHOPIFY_CUSTOMER_PASSWORD. O formulário de endereço fica atrás do login, ' +
      'então nada dele foi medido neste run — nem que ele lista países, nem que ' +
      'ele salva fora do Brasil.'
  );
}

const { status } = spawnSync(PLAYWRIGHT, ['test', ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
});

// A terceira forma de "não mediu": THEME_URL existia, e a sessão não abriu.
// O `globalSetup` grava o motivo em vez de estourar — estourar abortaria a
// execução inteira e levaria junto o gate, que não precisa de loja. O preço
// desse acerto é que a falha some do topo do log, atrás de N testes vermelhos
// todos dizendo a mesma coisa. Este aviso a traz de volta para onde os outros
// dois já estão: o resumo do CI.
try {
  const { motivo } = JSON.parse(fs.readFileSync(path.join(ROOT, ARQUIVO_DE_FALHA), 'utf8'));
  avisar(
    `A metade de storefront REPROVOU sem medir: a sessão da vitrine não abriu. ${motivo}`
  );
} catch {
  // Sem arquivo, sem falha — é o caminho normal.
}

process.exit(status ?? 1);
