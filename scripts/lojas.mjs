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
 * A CLI aceita `--raiz <dir>` para rodar contra outro repositório. É o que
 * deixa `tests/lojas.test.mjs` executar os três comandos como processo, e
 * conferir o código de saída: até a revisão do PR #169 os testes só chamavam
 * as funções, e um `validar` devolvendo 0 com a loja quebrada passava em todos.
 *
 * ── O bot é procurado na main que ainda não chegou às lojas ────────────────
 *
 * A primeira versão procurava o commit do bot no intervalo `antes..depois` do
 * push. O `concurrency` do workflow cancela a execução PENDENTE quando chega
 * uma nova, e o intervalo da cancelada nunca era conferido: um commit do bot
 * ali passava. Um `--antes` fora do histórico derrubava o job.
 *
 * Agora a pergunta é "que commits da `main` ainda não entraram nesta loja",
 * que não depende de qual execução rodou. O commit do bot reprova o job, mas a
 * propagação segue: travá-la exigiria um jeito de destravar, e reverter não
 * tira o commit do histórico. Ele é acusado até chegar a todas as lojas.
 *
 * ── O token ────────────────────────────────────────────────────────────────
 *
 * O `GITHUB_TOKEN` não empurra um ref cujos arquivos de `.github/workflows/`
 * mudam: a chave `permissions` não tem escopo `workflows`. Toda mudança de
 * workflow na `main` seria recusada em todas as lojas. Por isso o `propagar`
 * do CI usa o secret `LOJAS_TOKEN`, e com `--exigir-token` reprova logo, com
 * o motivo, quando há loja e o secret falta: descobrir na primeira propagação
 * é melhor que descobrir meses depois, na primeira mudança de workflow.
 *
 * ── Merge-base, e não a ponta da main ──────────────────────────────────────
 *
 * A pergunta do `conferir` é "o que ESTA LOJA mudou", e não "no que ela difere
 * da main agora". A diferença aparece assim que a `main` anda: comparada com a
 * ponta, uma loja que ainda não recebeu a propagação pareceria ter mudado todo
 * o código novo da `main`, e reprovaria por algo que não fez. Por isso a
 * comparação parte do merge-base: é o código que a loja de fato carrega.
 *
 * ── O conteúdo que a loja TEM fica inteiro com ela (ADR 0019) ─────────────
 *
 * O `propagar` não deixa o git mesclar linha a linha um arquivo de conteúdo
 * da loja. Um merge limpo de JSON pode produzir um arquivo válido e
 * incoerente: a `main` acrescenta um bloco à PDP, a loja reordenou a mesma PDP
 * no editor, e as duas metades se juntam sem conflito num layout que ninguém
 * montou.
 *
 * A primeira versão devolvia à loja só o arquivo que ela tinha MUDADO, e o
 * que ela nunca tocou recebia o da `main`. Medido depois do primeiro save da
 * Elizabeth Estudos: ela tinha mudado só o `index.json`. A PDP, o cabeçalho, o
 * rodapé e o `settings_data.json` dela eram idênticos aos da `main` — herdados
 * de quando a `main` ERA ela —, e a `main` neutra da fase 3 os teria trocado
 * na loja no ar. "Nunca tocou" não quer dizer "não é dela".
 *
 * Agora todo arquivo de conteúdo que a loja tem volta à versão dela, o que ela
 * apagou continua apagado, e da `main` só chega o arquivo de conteúdo que a
 * loja nunca teve: um template de página novo, um section group novo.
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

/**
 * Como se corrige o JSON de uma loja. O editor não basta: ele não mostra o
 * setting que o schema não declara mais, e não foi medido se ele apaga essa
 * chave ao salvar. O commit de conteúdo sempre resolve, e o `conferir` o
 * aceita (revisão retroativa da #168).
 */
export const COMO_CORRIGIR_O_CONTEUDO =
  `Corrija o JSON da loja num commit na ${PREFIXO}* que mude só conteúdo: o \`conferir\` aceita, e a ` +
  'integração da Shopify o leva ao tema. O editor resolve a section ou o bloco que ele ainda mostra, ' +
  'mas não mostra o setting que o schema não declara mais.';

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
 * O plano do merge da `main` numa loja (ADR 0019): todo arquivo de conteúdo
 * que a loja TEM volta inteiro para ela, mexido ou não; o que ela apagou
 * continua apagado; e só o arquivo de conteúdo que ela nunca teve chega da
 * `main`. O conflito que sobra, fora disso, reprova.
 *
 * @param {{ naLoja: string[], naBase: string[], conflitos: string[] }} entrada
 *   os arquivos da loja, os do merge-base com a `main`, e os em conflito
 */
export function planoDoMerge({ naLoja, naBase, conflitos }) {
  const daLoja = new Set(naLoja);
  const restaurarDaLoja = naLoja.filter(ehConteudoDaLoja);
  const apagadosPelaLoja = naBase.filter((c) => ehConteudoDaLoja(c) && !daLoja.has(c));
  const resolvidos = new Set([...restaurarDaLoja, ...apagadosPelaLoja]);
  return { restaurarDaLoja, apagadosPelaLoja, bloqueiam: conflitos.filter((c) => !resolvidos.has(c)) };
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
 *
 * @param {{ commits: { sha: string }[], lojas: string[] }} entrada  `commits`
 *   são os do bot que ainda não chegaram a alguma loja.
 */
export function vereditoDoBot({ commits, lojas }) {
  if (!commits.length) {
    return { ok: true, mensagem: `Nenhum commit do ${BOT_DA_SHOPIFY} na main a propagar.` };
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
      `Commit do ${BOT_DA_SHOPIFY} na main, ainda não propagado (${shas}): algum tema está ` +
      'conectado à main. Pelo ADR 0018 nenhuma loja fica conectada a ela, porque cada save no ' +
      'editor sobrescreve o conteúdo da main. Remova esse tema da biblioteca (Loja virtual → ' +
      'Temas) e reverta o que ele gravou. A propagação rodou mesmo assim, e este aviso some ' +
      'quando o commit chegar a todas as lojas.',
  };
}

/** Impressão digital de um problema: é o que a catraca compara. */
const chaveDoProblema = (p) => `${p.arquivo}|${p.code}`;

/**
 * O que aparece em `depois` e não estava em `antes`. É a catraca do lint
 * aplicada à loja: problema antigo dela não reprova um PR que não o causou.
 */
export function problemasNovos(depois, antes) {
  const vistos = new Set(antes.map(chaveDoProblema));
  return depois.filter((p) => !vistos.has(chaveDoProblema(p)));
}

/**
 * Por que o push de uma loja foi recusado, a partir do que o git disse. A
 * primeira versão culpava a lojista por qualquer recusa, inclusive pela do
 * token sem permissão de workflows, que não tem nada a ver com ela.
 */
export function motivoDoPushRecusado(erro) {
  const texto = String(erro ?? '');
  if (/workflow/i.test(texto) && /refusing|permission/i.test(texto)) {
    return (
      'o push foi recusado porque o merge traz mudança em .github/workflows/, e o token não tem ' +
      'permissão de workflows. O GITHUB_TOKEN nunca tem: o propagar precisa do secret LOJAS_TOKEN.'
    );
  }
  if (/non-fast-forward|fetch first|\[rejected\]/i.test(texto)) {
    return (
      'o push foi recusado porque a branch andou durante a propagação. O mais provável é a ' +
      'lojista ter salvo no editor nesse intervalo; rode o workflow de novo.'
    );
  }
  return `o push foi recusado: ${primeiraLinha(texto) || 'o git não disse por quê'}`;
}

const primeiraLinha = (texto) =>
  String(texto ?? '')
    .split('\n')
    .map((linha) => linha.trim())
    .find(Boolean) ?? '';

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

/** Como `git`, mas devolve o que o git disse ao falhar, em vez de lançar. */
function tentar(args, { cwd = RAIZ } = {}) {
  try {
    return { ok: true, saida: git(args, { cwd }) };
  } catch (error) {
    return { ok: false, erro: `${error.stderr ?? ''}` || `${error.message ?? ''}` };
  }
}

/**
 * A `loja/*` em que este checkout está, ou `null`.
 *
 * É por ela que as verificações da `main` (a regra `neutra` e os testes que
 * leem o conteúdo do disco) sabem que o conteúdo daqui é de uma loja, e que
 * apontar a loja é para isso que ele existe. Sem isso, resolver à mão um
 * conflito de locale numa loja (ADR 0018) esbarrava no `pre-commit`.
 *
 * HEAD destacado não é loja: é como o CI faz checkout de um PR para a `main`.
 */
export function lojaDoCheckout({ cwd = RAIZ } = {}) {
  const ramo = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd, permitirFalha: true })?.trim();
  return ramo?.startsWith(PREFIXO) ? ramo : null;
}

/**
 * Traz a `main` e toda `loja/*` do remoto, esquece as que foram apagadas lá, e
 * devolve as que existem.
 */
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
  return lojasDoRemoto({ cwd });
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

/** O que uma `loja/*` mudou desde o merge-base com a `main` e não podia ter mudado. */
export function mudancasDaLoja({ loja = 'HEAD', main = 'origin/main', cwd = RAIZ } = {}) {
  const base = git(['merge-base', main, loja], { cwd }).trim();
  const mudancas = mudancasDoDiff(git(['diff', '--name-status', '--no-renames', base, loja], { cwd }));

  const locale = (caminho) => ({
    antes: parseJSONC(git(['show', `${base}:${caminho}`], { cwd })),
    depois: parseJSONC(git(['show', `${loja}:${caminho}`], { cwd })),
  });
  return mudancasProibidas(mudancas, locale);
}

/** Uma `loja/*` contra o merge-base com a `main`: só conteúdo mudou, e ele cabe no código dela. */
export function conferirLoja({ loja = 'HEAD', main = 'origin/main', cwd = RAIZ } = {}) {
  const daLoja = leitorDoRef(loja, { cwd });
  return [...mudancasDaLoja({ loja, main, cwd }), ...problemasDoConteudo(daLoja, daLoja)];
}

/**
 * Toda `loja/*` contra o código do disco — o do PR. Reprova só o que ESTE
 * código quebra: o problema que a loja já tinha com o código da base sai em
 * `antigos`, como aviso. Sem isso, uma chave órfã numa loja reprovaria até um
 * PR que só muda o README, e o gate da `main` ficaria refém de uma loja.
 */
export function validarLojas({ cwd = RAIZ, base = 'origin/main', lojas = lojasDoRemoto({ cwd }) } = {}) {
  const codigo = leitorDoDisco({ cwd });
  const codigoDaBase = leitorDoRef(base, { cwd });
  return lojas.map((loja) => {
    const conteudo = leitorDoRef(`origin/${loja}`, { cwd });
    const comEsteCodigo = problemasDoConteudo(conteudo, codigo);
    const novos = problemasNovos(comEsteCodigo, problemasDoConteudo(conteudo, codigoDaBase));
    return { loja, problemas: novos, antigos: problemasNovos(comEsteCodigo, novos) };
  });
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
  const lojaAntes = leitorDoRef(remota, { cwd });
  const problemasAntes = problemasDoConteudo(lojaAntes, lojaAntes);

  git(['checkout', '-q', '--force', '--detach', remota], { cwd });
  git([...IDENTIDADE, 'merge', '--no-ff', '--no-commit', main], { cwd, permitirFalha: true });

  const conflitos = git(['diff', '--name-only', '--diff-filter=U'], { cwd }).split('\n').filter(Boolean);
  const { restaurarDaLoja, apagadosPelaLoja, bloqueiam } = planoDoMerge({
    naLoja: lojaAntes.arquivos(),
    naBase: leitorDoRef(base, { cwd }).arquivos(),
    conflitos,
  });

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

  if (restaurarDaLoja.length) git(['checkout', remota, '--', ...restaurarDaLoja], { cwd });
  if (apagadosPelaLoja.length) git(['rm', '-q', '-f', '--ignore-unmatch', '--', ...apagadosPelaLoja], { cwd });

  git([...IDENTIDADE, 'commit', '-q', '-m', `A main entra em ${loja} (ADR 0018)`], { cwd });

  const proibidas = mudancasDaLoja({ loja: 'HEAD', main, cwd });
  if (proibidas.length) {
    return {
      loja,
      estado: 'falhou',
      motivo:
        `a loja tem código que a main não tem, e não recebe a main até isso sair. Reverta em ${loja} ` +
        'o commit que o trouxe, ou leve a mudança para a main',
      problemas: proibidas,
    };
  }

  // Só o que o merge QUEBROU trava a loja. O problema de conteúdo que ela já
  // tinha continua com ela, como aviso: travar por ele deixaria a loja parada
  // sem nada que a main pudesse fazer.
  const depois = leitorDoRef('HEAD', { cwd });
  const comAMain = problemasDoConteudo(depois, depois);
  const novos = problemasNovos(comAMain, problemasAntes);
  if (novos.length) {
    return {
      loja,
      estado: 'falhou',
      motivo:
        'a main quebra o JSON desta loja, e o merge não foi empurrado. Deixe de usar o que a main ' +
        `tirou, e a próxima propagação passa. ${COMO_CORRIGIR_O_CONTEUDO}`,
      problemas: novos,
    };
  }
  const avisos = problemasNovos(comAMain, novos);

  if (empurrar) {
    const push = tentar(['push', '-q', 'origin', `HEAD:refs/heads/${loja}`], { cwd });
    if (!push.ok) return { loja, estado: 'falhou', motivo: motivoDoPushRecusado(push.erro), avisos };
  }
  return { loja, estado: 'atualizada', commit: git(['rev-parse', 'HEAD'], { cwd }).trim(), avisos };
}

/**
 * Leva a `main` a cada `loja/*` do remoto. Uma loja que falha não impede as
 * outras — nem quando a falha é um erro inesperado do git, que a primeira
 * versão deixava derrubar o laço inteiro.
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
    for (const loja of lojasDoRemoto({ cwd })) {
      try {
        resultados.push(propagarUma(loja, { cwd, main, empurrar }));
      } catch (erroDaLoja) {
        git(['merge', '--abort'], { cwd, permitirFalha: true });
        resultados.push({
          loja,
          estado: 'falhou',
          motivo: `erro inesperado do git: ${primeiraLinha(erroDaLoja.stderr) || erroDaLoja.message}`,
        });
      }
    }
  } finally {
    git(['merge', '--abort'], { cwd, permitirFalha: true });
    git(['checkout', '-q', '--force', inicio], { cwd });
  }
  return resultados;
}

/**
 * Os commits do bot na `main` que ainda não chegaram a alguma loja. Não
 * depende do intervalo do push: uma execução cancelada pelo `concurrency` não
 * deixa nada sem conferir, porque o que não foi propagado continua aqui.
 */
export function commitsDoBotAPropagar({ cwd = RAIZ, main = 'origin/main', lojas }) {
  const achados = new Map();
  for (const loja of lojas) {
    const log = git(['log', '--format=%H%x09%an%x09%ae', main, `^origin/${loja}`], { cwd });
    for (const commit of commitsDoBot(log)) achados.set(commit.sha, commit);
  }
  return [...achados.values()];
}

// ── A linha de comando ─────────────────────────────────────────────────────

const opcao = (argv, nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : argv[i + 1];
};

function resumo(linhas, env) {
  const texto = linhas.join('\n');
  console.log(texto);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${texto}\n`);
}

const listar = (problemas) => problemas.map((p) => `  · ${p.arquivo}: ${p.message}`);

function cmdConferir({ cwd, argv, env }) {
  buscar({ cwd });
  const problemas = conferirLoja({ loja: opcao(argv, 'loja') ?? 'HEAD', cwd });
  resumo(
    problemas.length
      ? [
          `Loja: ${problemas.length} problema(s).`,
          ...listar(problemas),
          '',
          `Uma ${PREFIXO}* só difere da main em ${CONTEUDO_DA_LOJA.join(', ')}, e nos valores dos ` +
            `${LOCALES_DE_VITRINE} (ADR 0018). ${COMO_CORRIGIR_O_CONTEUDO}`,
        ]
      : ['Loja: só conteúdo de loja mudou, e ele cabe no código desta branch.'],
    env
  );
  return problemas.length ? 1 : 0;
}

function cmdValidar({ cwd, argv, env }) {
  const lojas = validarLojas({
    cwd,
    base: opcao(argv, 'base') ?? 'origin/main',
    lojas: buscar({ cwd }),
  });
  const quebradas = lojas.filter((l) => l.problemas.length);
  const linhas = [];

  if (!lojas.length) {
    linhas.push(`Lojas: nenhuma ${PREFIXO}* no remoto, então não há JSON de loja para validar contra este código.`);
  } else if (!quebradas.length) {
    linhas.push(`Lojas: este código não quebra o JSON de ${lojas.map((l) => l.loja).join(', ')}.`);
  } else {
    linhas.push(
      'Lojas: este código quebra o JSON de loja/*.',
      ...quebradas.flatMap((l) => [`${l.loja}:`, ...listar(l.problemas)]),
      '',
      'Um setting renomeado ou um bloco removido faz a loja perder o que salvou no editor. ' +
        `Mantenha o nome antigo, ou mude o JSON da loja antes deste merge. ${COMO_CORRIGIR_O_CONTEUDO}`
    );
  }

  const comAntigos = lojas.filter((l) => l.antigos.length);
  if (comAntigos.length) {
    linhas.push(
      '',
      'Aviso — problema que a loja já tinha com o código da base, e que este PR não causou:',
      ...comAntigos.flatMap((l) => [`${l.loja}:`, ...listar(l.antigos)]),
      COMO_CORRIGIR_O_CONTEUDO
    );
  }

  resumo(linhas, env);
  return quebradas.length ? 1 : 0;
}

function cmdPropagar({ cwd, argv, env }) {
  const lojas = buscar({ cwd });
  if (!lojas.length) {
    resumo([`Propagação: nenhuma ${PREFIXO}* no remoto, nada a levar.`], env);
    return 0;
  }

  if (argv.includes('--exigir-token') && !env.LOJAS_TOKEN) {
    resumo(
      [
        'Propagação: falta o secret LOJAS_TOKEN, e nenhuma loja foi tocada.',
        'O GITHUB_TOKEN não empurra mudança de .github/workflows/, então a primeira mudança de ' +
          'workflow na main seria recusada em todas as lojas. Crie um token pessoal fine-grained, ' +
          'só deste repositório, com Contents e Workflows em leitura e escrita, e guarde-o em ' +
          'Settings → Secrets and variables → Actions como LOJAS_TOKEN.',
      ],
      env
    );
    return 1;
  }

  const veredito = vereditoDoBot({ commits: commitsDoBotAPropagar({ cwd, lojas }), lojas });
  const resultados = propagar({ cwd, empurrar: !argv.includes('--sem-push') });
  resumo(
    [
      veredito.mensagem,
      ...resultados.flatMap((r) => [
        `${r.loja}: ${r.estado}${r.motivo ? ` — ${r.motivo}` : ''}`,
        ...listar(r.problemas ?? []),
        ...(r.avisos?.length
          ? ['  aviso — problema que a loja já tinha, e que continua com ela:', ...listar(r.avisos)]
          : []),
      ]),
    ],
    env
  );
  const falhou = resultados.some((r) => r.estado === 'falhou');
  return falhou || !veredito.ok ? 1 : 0;
}

const COMANDOS = { conferir: cmdConferir, validar: cmdValidar, propagar: cmdPropagar };

if (process.argv[1] && process.argv[1].endsWith('lojas.mjs')) {
  const [comando, ...argv] = process.argv.slice(2);
  const executa = COMANDOS[comando];
  if (!executa) {
    console.error(`Uso: node scripts/lojas.mjs <${Object.keys(COMANDOS).join('|')}> [--raiz <dir>]`);
    process.exit(2);
  }

  // Erro inesperado (git ausente, merge-base sem ancestral comum, árvore suja)
  // vira saída 1 com a primeira linha do motivo, e não um stack trace no meio
  // do resumo do CI.
  let codigo;
  try {
    codigo = executa({ cwd: path.resolve(opcao(argv, 'raiz') ?? RAIZ), argv, env: process.env });
  } catch (error) {
    console.error(`lojas ${comando}: ${primeiraLinha(error.stderr) || error.message}`);
    codigo = 1;
  }
  process.exit(codigo);
}
