#!/usr/bin/env node
/**
 * ADR é append-only, e agora isso é verificado.
 *
 *   node scripts/adr.mjs --base-ref main
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * O CLAUDE.md dizia, em prosa: "Decisão estrutural → ADR em `docs/adr/`
 * (append-only, nunca se edita)". Nada verificava, e a regra JÁ FOI QUEBRADA:
 *
 *   474f387  docs/adr/0007-suite-de-navegador-contra-tema-empurrado.md
 *            75 insertions(+), 18 deletions(-)
 *
 * Dezoito linhas apagadas de um documento que a doc chama de append-only.
 *
 * E o commit era BEM-INTENCIONADO: ele corrigia afirmações que a medição tinha
 * refutado, o que é o espírito deste repositório. O defeito não está nele —
 * está na regra, que proibia sem oferecer o caminho certo. Regra que só fecha a
 * porta é burlada pela primeira pessoa que precisa passar.
 *
 * Por isso a mensagem de erro NOMEIA a saída: um ADR novo que supersede o
 * anterior. A decisão velha continua legível, com a data em que valia, e a nova
 * diz por que mudou. É assim que um registro de decisões serve para entender
 * uma escolha antiga — que é a única razão de ele existir.
 *
 * ── O critério é uma linha, e é de propósito ────────────────────────────────
 *
 * Nenhum arquivo de `docs/adr/` pode ter linha REMOVIDA no diff. Isso cobre os
 * quatro casos sem quatro regras:
 *
 *   ADR novo          → 0 remoções  → passa
 *   texto anexado     → 0 remoções  → passa
 *   linha reescrita   → remoções    → reprova
 *   arquivo apagado   → remoções    → reprova
 *
 * ── `--no-renames`, e isto foi medido depois de eu errar ────────────────────
 *
 * O nome do arquivo de um ADR é o alvo dos links: o CLAUDE.md, os comentários
 * das regras e os outros ADRs apontam para ele. Renomear quebra esses links em
 * silêncio, então rename precisa reprovar junto com a edição.
 *
 * A primeira versão disto não passava flag nenhuma, com um comentário
 * afirmando que `git diff` só detecta rename quando recebe `-M`. Está errado: a
 * detecção é LIGADA por padrão (`diff.renames`) desde a 2.9. Um `git mv` de ADR
 * passou verde na verificação à mão, reportado como "só com acréscimo".
 *
 * Pior que o erro: o teste que eu tinha escrito para isso lia o comando e
 * exigia a AUSÊNCIA de `-M` — ele media a minha crença sobre o git, não o
 * comportamento dele. Agora `tests/adr.test.mjs` roda git de verdade num
 * repositório temporário, porque premissa sobre ferramenta de terceiro é
 * exatamente o que não se verifica lendo o próprio código.
 *
 * `--no-renames` desliga a detecção, e aí o rename volta a ser um apagado mais
 * um criado — o apagado tem remoções, e a mesma checagem o barra.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASTA = 'docs/adr/';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Os argumentos do `git diff`, exportados para o teste rodá-los de verdade. */
export const ARGUMENTOS = (base) => [
  'diff',
  '--numstat',
  '--no-renames',
  `${base}...HEAD`,
  '--',
  PASTA,
];

/**
 * O veredito, dado o que o diff removeu de cada ADR. Puro: recebe uma lista de
 * `{ arquivo, removidas }` e devolve `{ ok, mensagem }`.
 *
 * É a parte onde dá para errar em silêncio, então é a parte que tem teste.
 */
export function avaliar(mudancas) {
  const editados = mudancas.filter(({ removidas }) => removidas > 0);

  if (editados.length === 0) {
    const n = mudancas.length;
    return {
      ok: true,
      mensagem: n === 0 ? 'ADR: nenhum tocado neste PR.' : `ADR: ${n} tocado(s), só com acréscimo.`,
    };
  }

  const lista = editados
    .map(({ arquivo, removidas }) => `  · ${arquivo} (${removidas} linha(s) removida(s))`)
    .join('\n');

  return {
    ok: false,
    mensagem:
      `ADR é append-only, e este PR remove linha de ${editados.length} arquivo(s):\n${lista}\n\n` +
      'Para REVOGAR ou corrigir uma decisão, crie um ADR NOVO que supersede o antigo, em vez ' +
      'de reescrever o antigo: a decisão velha precisa continuar legível para quem for ' +
      'entender por que ela valia. Acrescentar texto ao ADR existente é permitido — o que não ' +
      'pode é apagar. Renomear conta como apagar, porque o nome do arquivo é o alvo dos links ' +
      'que apontam para ele.',
  };
}

/**
 * `git diff --numstat` para os ADRs, já convertido em `{ arquivo, removidas }`.
 *
 * O `-` no lugar do número é como o git marca arquivo binário. Um ADR binário
 * não deveria existir; tratar como 1 remoção faz a checagem reprovar e alguém
 * olhar, em vez de o `Number()` virar `NaN` e a comparação passar calada.
 */
export function mudancasDoDiff(numstat) {
  return numstat
    .split('\n')
    .map((linha) => linha.split('\t'))
    .filter(([, , arquivo]) => arquivo?.startsWith(PASTA))
    .map(([, removidas, arquivo]) => ({
      arquivo,
      removidas: removidas === '-' ? 1 : Number(removidas),
    }));
}

// ── O índice (#155) ────────────────────────────────────────────────────────

/**
 * O índice de `docs/adr/README.md` confere com a pasta?
 *
 * Ele pulou do 0011 para o 0016: quatro ADRs aceitos, do 0012 ao 0015, sem
 * linha — entre eles o 0013, que o CLAUDE.md cita para explicar por que o
 * teste lê `assets/`. Quem abria o índice para entender por que algo é assim
 * não os achava. A checagem de append-only acima não via, e não tinha como: o
 * índice não PERDEU linha, ele nunca as ganhou.
 *
 * Puro: recebe os ADRs (de `adrsDaPasta`) e o texto do README, e devolve as
 * divergências, uma frase cada. Lista vazia é índice em dia.
 *
 * O título é comparado sem diferenciar maiúsculas: o H1 do 0011 grita
 * "COMPONENTE" e o índice não, e isso não é divergência. O status é comparado
 * inteiro, porque é ele que muda quando um ADR é superado — o arquivo passa a
 * dizer "Substituído por NNNN", e o índice não pode continuar dizendo "Aceito".
 */
export function divergenciasDoIndice(adrs, readme) {
  const linhas = [...readme.matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \| (.+?) \| (.+?) \|$/gm)].map(
    ([, numero, arquivo, titulo, status]) => ({ numero, arquivo, titulo, status })
  );
  const porArquivo = new Map(adrs.map((adr) => [adr.arquivo, adr]));
  const indexados = new Set(linhas.map((linha) => linha.arquivo));
  const divergencias = [];

  for (const adr of adrs) {
    if (!indexados.has(adr.arquivo)) divergencias.push(`${adr.numero} não tem linha no índice (${adr.arquivo}).`);
  }

  for (const linha of linhas) {
    const adr = porArquivo.get(linha.arquivo);
    if (!adr) {
      divergencias.push(`A linha ${linha.numero} aponta para ${linha.arquivo}, que não existe.`);
      continue;
    }
    if (linha.numero !== adr.numero) {
      divergencias.push(`A linha ${linha.numero} aponta para ${linha.arquivo}, que é o ${adr.numero}.`);
    }
    if (linha.titulo.toLowerCase() !== adr.titulo.toLowerCase()) {
      divergencias.push(`${adr.numero}: o índice diz "${linha.titulo}", e o H1 do ADR diz "${adr.titulo}".`);
    }
    if (linha.status !== adr.status) {
      divergencias.push(`${adr.numero}: o índice diz "${linha.status}", e o ADR diz "${adr.status}".`);
    }
  }

  return divergencias;
}

/**
 * Os ADRs de `docs/adr/`, lidos do disco: número, arquivo, título do H1
 * (`# 12. Título`) e o `- **Status:**`. Um ADR sem H1 ou sem status sai com
 * o campo vazio, e o índice diverge dele — que é o aviso certo.
 */
export function adrsDaPasta(raiz = RAIZ) {
  const pasta = path.join(raiz, PASTA);
  return fs
    .readdirSync(pasta)
    .filter((arquivo) => /^\d{4}-.*\.md$/.test(arquivo))
    .sort()
    .map((arquivo) => {
      const texto = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
      return {
        numero: arquivo.slice(0, 4),
        arquivo,
        titulo: texto.match(/^# \d+\. (.+)$/m)?.[1].trim() ?? '',
        status: texto.match(/^- \*\*Status:\*\* (.+)$/m)?.[1].trim() ?? '',
      };
    });
}

// ---------------------------------------------------------------------------

const git =(args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const anotar = (nivel, texto) =>
  console.log(process.env.CI ? `::${nivel}::${texto}` : `[${nivel}] ${texto}`);

function main() {
  const i = process.argv.indexOf('--base-ref');
  const baseRef = (i === -1 ? null : process.argv[i + 1]) || 'main';

  // Não pode falhar em silêncio, pelo mesmo motivo da catraca: um checkout raso
  // não traz `origin/main`, e um `|| true` aqui faria a checagem sempre passar.
  // Verificador que não consegue reprovar é pior que nenhum.
  try {
    git(['rev-parse', '--verify', `origin/${baseRef}`]);
  } catch (error) {
    anotar(
      'error',
      `Não consegui resolver origin/${baseRef} — a checagem dos ADRs não pôde ser feita. ` +
        'Passar assim seria fingir que verificou. (No CI: actions/checkout precisa de ' +
        `fetch-depth: 0.) ${error.message}`
    );
    return 1;
  }

  const veredito = avaliar(mudancasDoDiff(git(ARGUMENTOS(`origin/${baseRef}`))));

  if (veredito.ok) console.log(veredito.mensagem);
  else anotar('error', veredito.mensagem);

  const indice = divergenciasDoIndice(adrsDaPasta(), fs.readFileSync(path.join(RAIZ, PASTA, 'README.md'), 'utf8'));

  if (indice.length === 0) console.log('ADR: o índice confere com a pasta.');
  else
    anotar(
      'error',
      `O índice de ${PASTA}README.md não confere com a pasta:\n  · ${indice.join('\n  · ')}\n\n` +
        'Cada ADR tem uma linha no índice, com o título do H1 e o status do arquivo. ' +
        'Quando um ADR for superado, o status muda nos dois lugares.'
    );

  return veredito.ok && indice.length === 0 ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('adr.mjs')) {
  process.exit(main());
}
