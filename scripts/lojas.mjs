#!/usr/bin/env node
/**
 * Uma loja por branch: as verificações do ADR 0018.
 *
 *   node scripts/lojas.mjs conferir                       numa loja/*: ela só mudou conteúdo?
 *   node scripts/lojas.mjs validar                        num PR: o JSON de cada loja/* cabe no código daqui?
 *   node scripts/lojas.mjs propagar --antes A --depois B  no push da main: leva a main a cada loja/*
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * O ADR 0018 decide que a `main` é o tema e cada loja é uma branch
 * `loja/<nome>`, conectada à sua loja pela integração GitHub da Shopify, que só
 * recebe da `main`. Escrito assim, é um pedido: "correção de código vai na
 * main" é o tipo de regra que este repositório já viu ser quebrada (ADR 0001).
 * Aqui ela vira quatro verificações:
 *
 *   conferir  uma `loja/*` só difere da `main` em CONTEUDO_DA_LOJA; nos locales
 *             de vitrine ela muda valor, não chave; e o JSON dela aponta só o
 *             que o código dela tem
 *   validar   num PR para a `main`, o JSON de cada `loja/*` contra o código do
 *             PR: é aqui que "renomeei um setting e quebrei a loja de bebê"
 *             aparece, antes do merge
 *   propagar  a cada push na `main`, a `main` entra em cada `loja/*`; o que a
 *             loja mudou em conteúdo fica com ela, e conflito em código reprova
 *   bot       um commit do `shopify[bot]` na `main` quer dizer que algum tema
 *             está conectado a ela, e isso reprova
 *
 * ── Merge-base, e não a ponta da main ──────────────────────────────────────
 *
 * A pergunta do `conferir` é "o que ESTA LOJA mudou", e não "no que ela difere
 * da main agora". A diferença aparece assim que a `main` anda: comparada com a
 * ponta, uma loja que ainda não recebeu a propagação pareceria ter mudado todo
 * o código novo da `main`, e reprovaria por algo que não fez. Por isso a
 * comparação parte do merge-base: é o código que a loja de fato carrega.
 *
 * ── O que a loja mudou fica INTEIRO com ela ────────────────────────────────
 *
 * O `propagar` não deixa o git mesclar linha a linha um arquivo de conteúdo
 * que a loja mudou. Um merge limpo de JSON pode produzir um arquivo válido e
 * incoerente: a `main` acrescenta um bloco à PDP, a loja reordenou a mesma PDP
 * no editor, e as duas metades se juntam sem conflito num layout que ninguém
 * montou. Arquivo de conteúdo que a loja mudou volta à versão dela, inteiro; o
 * que ela nunca tocou recebe o da `main`.
 *
 * Os locales de vitrine são a exceção, porque misturam as duas coisas: a
 * `main` acrescenta chave (código) e a loja muda valor (conteúdo). O git os
 * mescla por linha, e conflito ali reprova: resolver sozinho perderia uma das
 * duas.
 *
 * ── Por que ele mesmo faz o fetch ──────────────────────────────────────────
 *
 * As `loja/*` são branches do remoto, e o checkout do CI não as traz por
 * padrão. Um `validar` que não as encontrasse diria "nenhuma loja para
 * validar" com a mesma cara de "todas as lojas cabem no código". O fetch é
 * explícito, e a ausência de lojas é dita no resumo, com o motivo.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSchema, flatten, parseJSONC } from './lint/lib.mjs';
import { referenciasDoSettingsData, referenciasDoTemplate } from './lint/rules/refs.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * O que pode divergir entre uma `loja/*` e a `main`: o que o editor da Shopify
 * grava. É a lista que vale — o CLAUDE.md a cita, e `tests/lojas.test.mjs`
 * exige que cite toda ela.
 *
 * `*` não atravessa `/`: `templates/customers/*.liquid` é código, e continua
 * sendo mesmo que um dia vire JSON, até alguém acrescentar a linha aqui.
 */
export const CONTEUDO_DA_LOJA = [
  'templates/*.json',
  'sections/*.json',
  'config/settings_data.json',
  'config/markets.json',
];

/** Os locales da vitrine: a loja muda o valor em "Editar conteúdo padrão do tema". */
export const LOCALES_DE_VITRINE = 'locales/*.json';

export const PREFIXO = 'loja/';

export const BOT_DA_SHOPIFY = 'shopify[bot]';

const IDENTIDADE = [
  '-c',
  'user.name=github-actions[bot]',
  '-c',
  'user.email=41898282+github-actions[bot]@users.noreply.github.com',
];

/** Glob mínimo: `*` casa qualquer coisa menos `/`. */
export function casa(padrao, caminho) {
  const regex = new RegExp(
    `^${padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`
  );
  return regex.test(caminho);
}

export const ehConteudoDaLoja = (caminho) => CONTEUDO_DA_LOJA.some((p) => casa(p, caminho));

export const ehLocaleDeVitrine = (caminho) =>
  casa(LOCALES_DE_VITRINE, caminho) && !caminho.endsWith('.schema.json');

// ── As decisões, puras ─────────────────────────────────────────────────────

/** `git diff --name-status --no-renames` → `[{ status, caminho }]`. */
export function mudancasDoDiff(saida) {
  return saida
    .split('\n')
    .filter(Boolean)
    .map((linha) => {
      const [status, caminho] = linha.split('\t');
      return { status: status[0], caminho };
    });
}

/** As chaves que a loja acrescentou ou tirou de um locale. Valor mudado não conta. */
export function chavesDivergentes(antes, depois) {
  const deAntes = new Set(Object.keys(flatten(antes ?? {})));
  const deDepois = new Set(Object.keys(flatten(depois ?? {})));
  return {
    novas: [...deDepois].filter((c) => !deAntes.has(c)).sort(),
    sumidas: [...deAntes].filter((c) => !deDepois.has(c)).sort(),
  };
}

/**
 * O que uma loja mudou e não podia. Recebe as mudanças desde o merge-base e
 * `locale(caminho)`, que devolve `{ antes, depois }` já lidos.
 */
export function mudancasProibidas(mudancas, locale) {
  const problemas = [];
  for (const { status, caminho } of mudancas) {
    if (ehConteudoDaLoja(caminho)) continue;

    if (ehLocaleDeVitrine(caminho) && status === 'M') {
      let lidos;
      try {
        lidos = locale(caminho);
      } catch (error) {
        problemas.push({ arquivo: caminho, code: 'invalid-json', message: `JSON inválido: ${error.message}` });
        continue;
      }
      const { novas, sumidas } = chavesDivergentes(lidos.antes, lidos.depois);
      if (!novas.length && !sumidas.length) continue;
      problemas.push({
        arquivo: caminho,
        code: 'locale-com-chave-da-loja',
        message:
          'A loja pode mudar o VALOR de uma chave, não a lista de chaves: chave é código. ' +
          [novas.length ? `Novas: ${novas.join(', ')}.` : '', sumidas.length ? `Sumidas: ${sumidas.join(', ')}.` : '']
            .filter(Boolean)
            .join(' '),
      });
      continue;
    }

    problemas.push({
      arquivo: caminho,
      code: 'codigo-na-loja',
      message:
        'Código mudou numa loja. A correção vai na main, e chega a esta loja pela propagação. ' +
        'Se foi um app que escreveu no tema, o arquivo também precisa nascer na main.',
    });
  }
  return problemas;
}

/**
 * O plano do merge da `main` numa loja: o que a loja mudou em conteúdo volta
 * inteiro para ela, e o conflito que sobra reprova.
 *
 * @param {{ mudadosPelaLoja: string[], conflitos: string[] }} entrada
 */
export function planoDoMerge({ mudadosPelaLoja, conflitos }) {
  const restaurarDaLoja = mudadosPelaLoja.filter(ehConteudoDaLoja);
  const daLoja = new Set(restaurarDaLoja);
  return { restaurarDaLoja, bloqueiam: conflitos.filter((c) => !daLoja.has(c)) };
}

/** `git log --format=%H%x09%an%x09%ae` → os commits do `shopify[bot]`. */
export function commitsDoBot(log) {
  return log
    .split('\n')
    .filter(Boolean)
    .map((linha) => {
      const [sha, nome = '', email = ''] = linha.split('\t');
      return { sha, nome, email };
    })
    .filter(({ nome, email }) => nome === BOT_DA_SHOPIFY || email.includes(BOT_DA_SHOPIFY));
}

/**
 * Commit do bot na `main` reprova, desde que exista alguma `loja/*`. Antes
 * disso a `main` AINDA é a loja conectada — é o estado anterior à fase 2 da
 * #168 —, e reprovar ali deixaria a `main` vermelha a cada save da lojista.
 */
export function vereditoDoBot({ commits, lojas }) {
  if (!commits.length) {
    return { ok: true, mensagem: `Nenhum commit do ${BOT_DA_SHOPIFY} neste push.` };
  }
  const shas = commits.map((c) => c.sha.slice(0, 7)).join(', ');
  if (!lojas.length) {
    return {
      ok: true,
      mensagem:
        `Commit do ${BOT_DA_SHOPIFY} na main (${shas}), e nenhuma ${PREFIXO}* ainda: a main ainda é ` +
        'a loja conectada. Isso deixa de valer na fase 2 da #168.',
    };
  }
  return {
    ok: false,
    mensagem:
      `Commit do ${BOT_DA_SHOPIFY} na main (${shas}): algum tema está conectado à main. Pelo ADR ` +
      '0018 nenhuma loja fica conectada a ela, porque cada save no editor sobrescreve o conteúdo ' +
      'da main. Remova esse tema da biblioteca (Loja virtual → Temas) e reverta o commit. ' +
      'A propagação para as lojas não rodou.',
  };
}

// ── O git ──────────────────────────────────────────────────────────────────

/**
 * Nenhuma variável `GIT_*` passa adiante. Dentro de um hook o git exporta
 * `GIT_DIR` e `GIT_INDEX_FILE`, e o `cwd` não vence o `GIT_DIR`: foi assim que
 * um teste de `tests/adr.test.mjs` já gravou num repositório que não era o
 * dele. Ver o comentário de lá.
 */
const semGit = () =>
  Object.fromEntries(Object.entries(process.env).filter(([nome]) => !nome.startsWith('GIT_')));

function git(args, { cwd = RAIZ, permitirFalha = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: semGit(),
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (permitirFalha) return null;
    throw error;
  }
}

/** Traz a `main` e toda `loja/*` do remoto, e esquece as que foram apagadas lá. */
export function buscar({ cwd = RAIZ } = {}) {
  git(
    [
      'fetch',
      '--quiet',
      '--prune',
      'origin',
      '+refs/heads/main:refs/remotes/origin/main',
      `+refs/heads/${PREFIXO}*:refs/remotes/origin/${PREFIXO}*`,
    ],
    { cwd }
  );
}

/** As `loja/*` que o remoto tem, pelo nome da branch. */
export function lojasDoRemoto({ cwd = RAIZ } = {}) {
  const refs = git(['for-each-ref', '--format=%(refname)', `refs/remotes/origin/${PREFIXO}`], { cwd });
  return refs
    .split('\n')
    .filter(Boolean)
    .map((ref) => ref.replace('refs/remotes/origin/', ''))
    .sort();
}

/** Lê arquivos de uma árvore do git sem fazer checkout dela. */
export function leitorDoRef(ref, { cwd = RAIZ } = {}) {
  const arquivos = new Set(git(['ls-tree', '-r', '--name-only', ref], { cwd }).split('\n').filter(Boolean));
  return {
    arquivos: () => [...arquivos],
    le: (caminho) => (arquivos.has(caminho) ? git(['show', `${ref}:${caminho}`], { cwd }) : undefined),
  };
}

/** Lê o código do disco: o do PR, no `validar`. */
export function leitorDoDisco({ cwd = RAIZ } = {}) {
  return {
    le: (caminho) => {
      const absoluto = path.join(cwd, caminho);
      return fs.existsSync(absoluto) ? fs.readFileSync(absoluto, 'utf8') : undefined;
    },
  };
}

/**
 * O JSON de conteúdo de uma loja contra um código: sections, blocos e
 * settings que ele aponta existem? É a regra `refs`, sobre outra árvore.
 */
export function problemasDoConteudo(conteudo, codigo) {
  const schemaDe = (tipo) => {
    const fonte = codigo.le(`sections/${tipo}.liquid`);
    if (fonte === undefined) return undefined;
    return extractSchema(fonte)?.json ?? null;
  };
  const fonteDoSchemaGlobal = codigo.le('config/settings_schema.json');

  const problemas = [];
  for (const arquivo of conteudo.arquivos().filter(ehConteudoDaLoja).sort()) {
    if (arquivo === 'config/markets.json') continue;

    let json;
    try {
      json = parseJSONC(conteudo.le(arquivo));
    } catch (error) {
      problemas.push({ arquivo, code: 'invalid-json', message: `JSON inválido: ${error.message}` });
      continue;
    }

    const achados =
      arquivo === 'config/settings_data.json'
        ? fonteDoSchemaGlobal === undefined
          ? []
          : referenciasDoSettingsData(json, parseJSONC(fonteDoSchemaGlobal))
        : referenciasDoTemplate(json, schemaDe);
    for (const achado of achados) problemas.push({ arquivo, ...achado });
  }
  return problemas;
}

/** Uma `loja/*` contra o merge-base com a `main`: só conteúdo mudou, e ele cabe no código dela. */
export function conferirLoja({ loja = 'HEAD', main = 'origin/main', cwd = RAIZ } = {}) {
  const base = git(['merge-base', main, loja], { cwd }).trim();
  const mudancas = mudancasDoDiff(git(['diff', '--name-status', '--no-renames', base, loja], { cwd }));

  const locale = (caminho) => ({
    antes: parseJSONC(git(['show', `${base}:${caminho}`], { cwd })),
    depois: parseJSONC(git(['show', `${loja}:${caminho}`], { cwd })),
  });

  const daLoja = leitorDoRef(loja, { cwd });
  return [...mudancasProibidas(mudancas, locale), ...problemasDoConteudo(daLoja, daLoja)];
}

/** Toda `loja/*` do remoto contra o código do disco. */
export function validarLojas({ cwd = RAIZ } = {}) {
  const codigo = leitorDoDisco({ cwd });
  return lojasDoRemoto({ cwd }).map((loja) => ({
    loja,
    problemas: problemasDoConteudo(leitorDoRef(`origin/${loja}`, { cwd }), codigo),
  }));
}

/** O commit onde o checkout está, para voltar a ele no fim. */
function posicaoAtual({ cwd }) {
  const nome = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).trim();
  return nome === 'HEAD' ? git(['rev-parse', 'HEAD'], { cwd }).trim() : nome;
}

function propagarUma(loja, { cwd, main, empurrar }) {
  const remota = `origin/${loja}`;
  if (git(['merge-base', '--is-ancestor', main, remota], { cwd, permitirFalha: true }) !== null) {
    return { loja, estado: 'em-dia' };
  }

  const base = git(['merge-base', main, remota], { cwd }).trim();
  const mudadosPelaLoja = mudancasDoDiff(
    git(['diff', '--name-status', '--no-renames', base, remota], { cwd })
  ).map((m) => m.caminho);

  git(['checkout', '-q', '--force', '--detach', remota], { cwd });
  git([...IDENTIDADE, 'merge', '--no-ff', '--no-commit', main], { cwd, permitirFalha: true });

  const conflitos = git(['diff', '--name-only', '--diff-filter=U'], { cwd }).split('\n').filter(Boolean);
  const { restaurarDaLoja, bloqueiam } = planoDoMerge({ mudadosPelaLoja, conflitos });

  if (bloqueiam.length) {
    git(['merge', '--abort'], { cwd, permitirFalha: true });
    return {
      loja,
      estado: 'falhou',
      motivo:
        `conflito fora do conteúdo da loja: ${bloqueiam.join(', ')}. ` +
        'Resolva à mão, com um merge da main nesta branch. Num locale, fica a chave da main e o valor da loja.',
    };
  }

  const naLoja = new Set(leitorDoRef(remota, { cwd }).arquivos());
  for (const caminho of restaurarDaLoja) {
    if (naLoja.has(caminho)) git(['checkout', remota, '--', caminho], { cwd });
    else git(['rm', '-q', '-f', '--ignore-unmatch', '--', caminho], { cwd });
  }

  git([...IDENTIDADE, 'commit', '-q', '-m', `A main entra em ${loja} (ADR 0018)`], { cwd });

  const problemas = conferirLoja({ loja: 'HEAD', main, cwd });
  if (problemas.length) {
    return {
      loja,
      estado: 'falhou',
      motivo: 'o resultado do merge não passa na conferência, e não foi empurrado',
      problemas,
    };
  }

  if (empurrar && git(['push', '-q', 'origin', `HEAD:refs/heads/${loja}`], { cwd, permitirFalha: true }) === null) {
    return {
      loja,
      estado: 'falhou',
      motivo:
        'o push foi recusado. O mais provável é a lojista ter salvo no editor durante a propagação; ' +
        'rode o workflow de novo.',
    };
  }
  return { loja, estado: 'atualizada', commit: git(['rev-parse', 'HEAD'], { cwd }).trim() };
}

/**
 * Leva a `main` a cada `loja/*` do remoto. Uma loja que falha não impede as outras.
 *
 * Recusa rodar com arquivo rastreado modificado. O merge de cada loja é feito
 * no próprio checkout, e voltar ao ponto de partida exige `--force`, que
 * descarta modificação não commitada. Medido do jeito ruim: a primeira versão
 * disto, rodada à mão durante o desenvolvimento, apagou uma edição do
 * `ci.yml` que ainda não tinha sido commitada. No CI o checkout é limpo; na
 * máquina de alguém, não.
 */
export function propagar({ cwd = RAIZ, main = 'origin/main', empurrar = true } = {}) {
  const sujos = git(['status', '--porcelain', '--untracked-files=no'], { cwd }).trim();
  if (sujos) {
    throw new Error(
      `A propagação faz checkout de cada loja e descartaria o que não foi commitado:\n${sujos}\n` +
        'Commite ou guarde (git stash) antes de rodar.'
    );
  }

  const inicio = posicaoAtual({ cwd });
  const resultados = [];
  try {
    for (const loja of lojasDoRemoto({ cwd })) resultados.push(propagarUma(loja, { cwd, main, empurrar }));
  } finally {
    git(['merge', '--abort'], { cwd, permitirFalha: true });
    git(['checkout', '-q', '--force', inicio], { cwd });
  }
  return resultados;
}

/** Os commits do bot entre dois pontos do push. Sem `antes` (branch nova, dispatch), só o `depois`. */
export function commitsDoPush({ antes, depois, cwd = RAIZ }) {
  const intervalo = !antes || /^0+$/.test(antes) ? ['-1', depois] : [`${antes}..${depois}`];
  return commitsDoBot(git(['log', '--format=%H%x09%an%x09%ae', ...intervalo], { cwd }));
}

// ── A linha de comando ─────────────────────────────────────────────────────

const argumento = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

function resumo(linhas) {
  const texto = linhas.join('\n');
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
}

const listar = (problemas) => problemas.map((p) => `  · ${p.arquivo}: ${p.message}`);

function cmdConferir() {
  buscar();
  const problemas = conferirLoja({ loja: argumento('loja') ?? 'HEAD' });
  if (!problemas.length) {
    resumo(['Loja: só conteúdo de loja mudou, e ele cabe no código desta branch.']);
    return 0;
  }
  resumo([
    `Loja: ${problemas.length} problema(s).`,
    ...listar(problemas),
    '',
    `Uma ${PREFIXO}* só difere da main em ${CONTEUDO_DA_LOJA.join(', ')}, e nos valores dos ` +
      `${LOCALES_DE_VITRINE} (ADR 0018).`,
  ]);
  return 1;
}

function cmdValidar() {
  buscar();
  const lojas = validarLojas();
  if (!lojas.length) {
    resumo([`Lojas: nenhuma ${PREFIXO}* no remoto, então não há JSON de loja para validar contra este código.`]);
    return 0;
  }
  const quebradas = lojas.filter((l) => l.problemas.length);
  if (!quebradas.length) {
    resumo([`Lojas: o JSON de ${lojas.map((l) => l.loja).join(', ')} cabe no código deste commit.`]);
    return 0;
  }
  resumo([
    'Lojas: este código quebra o JSON de loja/*.',
    ...quebradas.flatMap((l) => [`${l.loja}:`, ...listar(l.problemas)]),
    '',
    'Um setting renomeado ou um bloco removido faz a loja perder o que salvou no editor. ' +
      'Mantenha o nome antigo, ou mude o JSON da loja no editor dela antes deste merge.',
  ]);
  return 1;
}

function cmdPropagar() {
  buscar();
  const depois = argumento('depois');
  if (depois) {
    const veredito = vereditoDoBot({
      commits: commitsDoPush({ antes: argumento('antes'), depois }),
      lojas: lojasDoRemoto(),
    });
    resumo([veredito.mensagem]);
    if (!veredito.ok) return 1;
  } else {
    resumo(['Sem --depois: a checagem de commit do bot não se aplica a esta execução.']);
  }

  let resultados;
  try {
    resultados = propagar({ empurrar: !process.argv.includes('--sem-push') });
  } catch (error) {
    resumo([`Propagação: ${error.message}`]);
    return 1;
  }
  if (!resultados.length) {
    resumo([`Propagação: nenhuma ${PREFIXO}* no remoto, nada a levar.`]);
    return 0;
  }
  resumo(
    resultados.flatMap((r) => [
      `${r.loja}: ${r.estado}${r.motivo ? ` — ${r.motivo}` : ''}`,
      ...listar(r.problemas ?? []),
    ])
  );
  return resultados.some((r) => r.estado === 'falhou') ? 1 : 0;
}

const COMANDOS = { conferir: cmdConferir, validar: cmdValidar, propagar: cmdPropagar };

if (process.argv[1] && process.argv[1].endsWith('lojas.mjs')) {
  const comando = COMANDOS[process.argv[2]];
  if (!comando) {
    console.error(`Uso: node scripts/lojas.mjs <${Object.keys(COMANDOS).join('|')}>`);
    process.exit(2);
  }
  process.exit(comando());
}
