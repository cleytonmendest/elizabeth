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
 *
 * ── E o que o script NÃO via, até a #74 ────────────────────────────────────
 *
 * Ele avisava sobre as metades que a FALTA DE CREDENCIAL derruba. Não avisava
 * nada quando um teste se pulava por conta própria — e foi assim que a
 * regressão visual do style guide passou a existência inteira dela pulada,
 * esperando um artefato que só ela produziria, exibindo a mesma cara de um
 * teste que roda e passa.
 *
 * Agora todo pulo aparece no resumo, agrupado por motivo. "Não configurado" e
 * "o teste se retirou sozinho" continuam sendo coisas diferentes — a
 * diferença agora está escrita, em vez de ser invisível nas duas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ARQUIVO_DE_FALHA, ARQUIVO_DE_RELATORIO } from '../e2e/helpers/sessao.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYWRIGHT = path.join(ROOT, 'node_modules', '.bin', 'playwright');

function avisar(texto) {
  console.log(process.env.CI ? `::warning::${texto}` : texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `> [!WARNING]\n> ${texto}\n\n`);
  }
}

/**
 * Os testes que NÃO rodaram, agrupados por motivo.
 *
 * O relatório do Playwright dá, para cada teste pulado, o `type` (`skip` ou
 * `fixme`) e a `description` que quem pulou escreveu. É o bastante para
 * separar as três formas de não rodar que este repositório tem — falta de
 * credencial, catálogo sem o caso, e defeito conhecido em `fixme` — sem
 * classificar nada por conta própria: o texto de quem pulou é a classificação.
 *
 * Agrupa porque sem loja são duas dezenas de testes com o MESMO motivo, e uma
 * lista de vinte linhas iguais é a forma mais rápida de ensinar alguém a não
 * ler o resumo.
 *
 * @returns {{tipo: string, motivo: string, quantos: number}[]} do mais
 *   frequente para o menos, e alfabético no empate.
 */
export function pulos(relatorio) {
  const contagem = new Map();

  const varre = (suite) => {
    for (const spec of suite?.specs ?? []) {
      for (const teste of spec.tests ?? []) {
        if (teste.status !== 'skipped') continue;

        const anotacao = (teste.annotations ?? []).find(
          (a) => a.type === 'skip' || a.type === 'fixme'
        );
        const tipo = anotacao?.type ?? 'skip';
        // Pulo sem motivo escrito é pior que pulo com motivo, e some da mesma
        // forma: nomeá-lo é o mínimo para alguém poder perguntar por quê.
        const motivo = anotacao?.description || '(sem motivo escrito)';
        const chave = `${tipo}|${motivo}`;
        const antes = contagem.get(chave);

        // O grupo guarda os campos, e não a chave para ser fatiada de volta:
        // motivo é prosa de quem pulou, e prosa carrega qualquer separador que
        // se escolha.
        contagem.set(chave, { tipo, motivo, quantos: (antes?.quantos ?? 0) + 1 });
      }
    }

    // Suíte aninhada é `test.describe`. Sem descer, um arquivo inteiro dentro
    // de um describe sumiria do resumo — subnotificar aqui reconstrói
    // exatamente o silêncio que este resumo existe para quebrar.
    for (const filha of suite?.suites ?? []) varre(filha);
  };

  for (const suite of relatorio?.suites ?? []) varre(suite);

  return [...contagem.values()].sort(
    (a, b) => b.quantos - a.quantos || a.motivo.localeCompare(b.motivo)
  );
}

/** O texto do aviso, ou `null` quando todo teste que existe rodou. */
export function resumoDePulos(relatorio) {
  const grupos = pulos(relatorio);
  if (grupos.length === 0) return null;

  const total = grupos.reduce((soma, g) => soma + g.quantos, 0);
  const linhas = grupos.map((g) => `${g.quantos}× [${g.tipo}] ${g.motivo}`);

  return (
    `${total} ${total === 1 ? 'teste não rodou' : 'testes não rodaram'} nesta execução. ` +
    `O verde acima não cobre o que está listado abaixo:\n${linhas.map((l) => `- ${l}`).join('\n')}`
  );
}

function main() {
  const temLoja = Boolean(process.env.THEME_URL);

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

  // E a quarta, que não tem nada a ver com credencial: o teste que se retirou
  // sozinho. Sem relatório não há o que dizer — é o que acontece quando o
  // Playwright morre antes de escrever, e nesse caso o run já está vermelho
  // por outro motivo.
  try {
    const relatorio = JSON.parse(fs.readFileSync(path.join(ROOT, ARQUIVO_DE_RELATORIO), 'utf8'));
    const resumo = resumoDePulos(relatorio);
    if (resumo) avisar(resumo);
  } catch {
    // Sem relatório legível, sem resumo.
  }

  return status ?? 1;
}

// `import.meta.url` contra o argv[1] resolvido, e não um `endsWith` do nome:
// este arquivo é importado por `tests/e2e.test.mjs`, e um `main()` disparando
// ali spawnaria o Playwright no meio do Vitest. O `endsWith('e2e.mjs')` da
// primeira versão dava isso a qualquer entrypoint chamado `algum-e2e.mjs`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
