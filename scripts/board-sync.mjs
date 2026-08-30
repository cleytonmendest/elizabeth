#!/usr/bin/env node
/**
 * board-sync — o Status do board é DERIVADO, nunca afirmado.
 *
 * ── Por que derivado ───────────────────────────────────────────────────────
 *
 * Um campo que alguém precisa lembrar de mudar é a mesma coisa que o ROADMAP
 * que este projeto apagou: ele diverge no primeiro dia em que a pessoa (ou o
 * agente) está com pressa. Então ninguém escreve o Status à mão. Ele é
 * recalculado a partir de fatos que o GitHub já guarda.
 *
 * ── E por que isso importa para vários agentes ao mesmo tempo ──────────────
 *
 * Projects v2 não tem "escreva X só se ainda for Y". Dois agentes leem "Todo",
 * os dois escrevem "In Progress", e os dois acham que são donos da issue — sem
 * erro nenhum. O campo é um espelho, não um semáforo.
 *
 * O que TEM atomicidade é criar branch: o GitHub devolve 422 se o ref já
 * existe. Então a trava é a branch, e o board só mostra o que a branch já
 * decidiu. Um agente que quer a issue 35 cria `claude/issue-35`; quem perder a
 * corrida recebe erro e vai para a próxima.
 *
 * ── A tabela de decisão ────────────────────────────────────────────────────
 *
 *   issue fechada                         → Done
 *   PR aberto que fecha a issue           → In Review (ou In Progress)
 *   PR em rascunho que fecha a issue      → In Progress
 *   branch `…/issue-N` existe             → In Progress
 *   nada disso                            → Todo
 *
 * `decide()` é pura de propósito: recebe fatos, devolve string. `--self-test`
 * roda a tabela inteira contra casos montados à mão e reprova se algum mudar.
 * Isso existe porque hoje um teste meu passou verde sem exercitar nada — um
 * `gh` falso que só sabia responder sucesso. Verificação que não pode falhar
 * não verifica.
 *
 * ── Duas reconciliações, um caminho só ─────────────────────────────────────
 *
 * O script faz DUAS coisas, e as duas são recálculo completo: toda issue
 * aberta tem item no board, e todo item gerido tem o Status que os fatos
 * exigem. Nenhuma das duas é incremental, então rodar de novo conserta
 * divergência em vez de acumular estado.
 *
 * Antes isso eram três jobs: um que adicionava a issue nova (só em evento
 * `issues`), um backfill sob demanda (só em `workflow_dispatch`) e este sync.
 * Dividir por tipo de evento criou o pior tipo de bug: o job de adicionar
 * apontava para `actions/add-to-project@v1`, uma tag que nunca existiu, e
 * ninguém percebeu por dois dias — porque as execuções verdes eram todas de
 * `workflow_dispatch` e `pull_request`, que PULAM esse job. Caminho que só
 * roda numa circunstância é caminho que ninguém testa.
 *
 * Agora todo evento executa o mesmo código. Uma execução verde de qualquer
 * gatilho prova o caminho inteiro.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *
 *   node scripts/board-sync.mjs --self-test
 *   node scripts/board-sync.mjs --dry-run    (mostra o que mudaria)
 *   node scripts/board-sync.mjs
 *
 * Ambiente: GITHUB_TOKEN (escopo `project`), PROJECT_URL, REPO (owner/nome).
 */

const API = 'https://api.github.com/graphql';

/** Uma branch reivindica a issue N se o nome tem `issue-N` como termo inteiro. */
export const claimsIssue = (branch, number) =>
  new RegExp(`(^|[/_-])issue[-_/]${number}($|[^0-9])`).test(branch);

/**
 * Os quatro valores que este script é DONO. Qualquer outro é decisão de gente.
 *
 * Isto nasceu de um estrago: na primeira execução real a issue #7 estava em
 * "Stopped" — status que ninguém consegue derivar de branch, PR ou issue
 * fechada — e o sync passou por cima com "Todo". Um recálculo só pode
 * sobrescrever o que ele mesmo sabe produzir; o resto é informação que ele não
 * tem, e apagar informação que não se entende é pior que não mexer.
 */
export const GERIDOS = new Set(['Todo', 'In Progress', 'In Review', 'Done']);

/**
 * Status fora do conjunto gerido é intervenção humana: o sync não encosta.
 * Para devolver a issue ao controle automático, basta limpar o campo no board.
 */
export const ehOverrideHumano = (atual) => Boolean(atual) && !GERIDOS.has(atual);

/**
 * O Status que os fatos exigem. Pura: sem rede, sem relógio, sem estado.
 *
 * `temInReview` diz se o board tem essa coluna. Se não tiver, PR aberto cai em
 * In Progress — melhor que reprovar por causa de uma coluna que o lojista do
 * board nunca criou.
 */
export function decide(issue, { branches = [], prs = [] }, { temInReview = false } = {}) {
  if (issue.state === 'CLOSED') return 'Done';

  const pr = prs.find((p) => p.closes.includes(issue.number));
  if (pr) return pr.isDraft || !temInReview ? 'In Progress' : 'In Review';

  if (branches.some((b) => claimsIssue(b, issue.number))) return 'In Progress';

  return 'Todo';
}

/**
 * Issues abertas que ainda não têm item no board. Pura, pelo mesmo motivo de
 * `decide`: é a parte onde dá para errar em silêncio.
 *
 * Item sem `content.number` é rascunho do board ou PR — não representa issue
 * nenhuma e não pode fazer uma issue de verdade parecer já incluída.
 */
export function faltamNoBoard(issuesAbertas, itens) {
  const jaTem = new Set(itens.map((i) => i.content?.number).filter(Boolean));
  return issuesAbertas.filter((i) => !jaTem.has(i.number));
}

// ───────────────────────────────────────────────────────────────────────────

const CASOS = [
  ['issue fechada vence tudo', { number: 1, state: 'CLOSED' }, { branches: ['claude/issue-1'], prs: [{ closes: [1], isDraft: false }] }, true, 'Done'],
  ['PR aberto com a coluna', { number: 2, state: 'OPEN' }, { prs: [{ closes: [2], isDraft: false }] }, true, 'In Review'],
  ['PR aberto sem a coluna', { number: 2, state: 'OPEN' }, { prs: [{ closes: [2], isDraft: false }] }, false, 'In Progress'],
  ['PR em rascunho', { number: 3, state: 'OPEN' }, { prs: [{ closes: [3], isDraft: true }] }, true, 'In Progress'],
  ['só branch', { number: 4, state: 'OPEN' }, { branches: ['claude/issue-4'] }, true, 'In Progress'],
  ['branch com sufixo', { number: 35, state: 'OPEN' }, { branches: ['fix/issue-35-fontes'] }, true, 'In Progress'],
  ['issue-3 NÃO casa com issue-35', { number: 3, state: 'OPEN' }, { branches: ['claude/issue-35'] }, true, 'Todo'],
  ['issue-35 NÃO casa com issue-3', { number: 35, state: 'OPEN' }, { branches: ['claude/issue-3'] }, true, 'Todo'],
  ['branch sem relação', { number: 5, state: 'OPEN' }, { branches: ['main', 'claude/project-assessment-rqtzgf'] }, true, 'Todo'],
  ['nada', { number: 6, state: 'OPEN' }, {}, true, 'Todo'],
];

/** Casos de `ehOverrideHumano`: o que o sync tem e o que não tem direito de mexer. */
const CASOS_OVERRIDE = [
  ['campo vazio é do sync', null, false],
  ['string vazia é do sync', '', false],
  ['Todo é do sync', 'Todo', false],
  ['In Progress é do sync', 'In Progress', false],
  ['In Review é do sync', 'In Review', false],
  ['Done é do sync', 'Done', false],
  ['Stopped é humano', 'Stopped', true],
  ['Blocked é humano', 'Blocked', true],
  ['qualquer coluna nova é humana', 'Aguardando lojista', true],
];

/** Casos de `faltamNoBoard`: quem entra no board e quem já está lá. */
const CASOS_FALTANTES = [
  ['board vazio: todas entram', [{ number: 1 }, { number: 2 }], [], [1, 2]],
  ['todas já estão: nenhuma entra', [{ number: 1 }], [{ content: { number: 1 } }], []],
  ['só a que falta', [{ number: 1 }, { number: 2 }], [{ content: { number: 1 } }], [2]],
  ['rascunho do board não conta como issue', [{ number: 1 }], [{ content: null }], [1]],
  ['item sem content não conta como issue', [{ number: 1 }], [{}], [1]],
  ['issue fechada no board não é readicionada', [], [{ content: { number: 9 } }], []],
];

function selfTest() {
  let falhas = 0;
  for (const [nome, issue, fatos, temInReview, esperado] of CASOS) {
    const obtido = decide(issue, fatos, { temInReview });
    const ok = obtido === esperado;
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHOU'}  ${nome.padEnd(34)} → ${obtido}${ok ? '' : `  (esperado ${esperado})`}`);
  }
  for (const [nome, atual, esperado] of CASOS_OVERRIDE) {
    const obtido = ehOverrideHumano(atual);
    const ok = obtido === esperado;
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHOU'}  ${nome.padEnd(34)} → ${obtido ? 'não encosta' : 'do sync'}${ok ? '' : '  (esperado o contrário)'}`);
  }
  for (const [nome, abertas, itens, esperado] of CASOS_FALTANTES) {
    const obtido = faltamNoBoard(abertas, itens).map((i) => i.number);
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas++;
    console.log(`  ${ok ? 'ok  ' : 'FALHOU'}  ${nome.padEnd(34)} → [${obtido}]${ok ? '' : `  (esperado [${esperado}])`}`);
  }
  const total = CASOS.length + CASOS_OVERRIDE.length + CASOS_FALTANTES.length;
  console.log(falhas ? `\n${falhas} de ${total} caso(s) falharam.` : `\n${total} casos, todos passaram.`);
  return falhas === 0;
}

// ───────────────────────────────────────────────────────────────────────────

async function graphql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

/** Percorre todas as páginas de uma conexão, devolvendo os nós juntos. */
async function paginate(query, variables, caminho) {
  const out = [];
  let cursor = null;
  for (;;) {
    const data = await graphql(query, { ...variables, endCursor: cursor });
    const conexao = caminho(data);
    out.push(...conexao.nodes);
    if (!conexao.pageInfo.hasNextPage) return out;
    cursor = conexao.pageInfo.endCursor;
  }
}

function parseProjectUrl(url) {
  const m = /\/(users|orgs)\/([^/]+)\/projects\/(\d+)/.exec(url ?? '');
  if (!m) throw new Error(`PROJECT_URL não reconhecida: ${url}`);
  return { campo: m[1] === 'orgs' ? 'organization' : 'user', login: m[2], number: Number(m[3]) };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { campo, login, number } = parseProjectUrl(process.env.PROJECT_URL);
  const [owner, repo] = (process.env.REPO ?? '').split('/');
  if (!owner || !repo) throw new Error(`REPO precisa ser "dono/nome", veio: ${process.env.REPO}`);

  // 1. O projeto e o campo Status.
  const proj = await graphql(
    `query($login: String!, $number: Int!) {
       ${campo}(login: $login) {
         projectV2(number: $number) {
           id
           field(name: "Status") {
             ... on ProjectV2SingleSelectField { id options { id name } }
           }
         }
       }
     }`,
    { login, number }
  );
  const projeto = proj[campo]?.projectV2;
  if (!projeto) throw new Error(`Projeto ${number} de ${login} não encontrado.`);
  if (!projeto.field) throw new Error('O board não tem um campo "Status" do tipo single select.');

  const opcao = Object.fromEntries(projeto.field.options.map((o) => [o.name, o.id]));
  const temInReview = 'In Review' in opcao;
  const faltando = ['Todo', 'In Progress', 'Done'].filter((n) => !(n in opcao));
  if (faltando.length) {
    throw new Error(
      `O campo Status não tem a(s) opção(ões) ${faltando.join(', ')}. ` +
        `Existem: ${projeto.field.options.map((o) => o.name).join(', ')}.`
    );
  }
  console.log(`Board: projeto ${number} de ${login} · coluna "In Review" ${temInReview ? 'existe' : 'não existe, PR cai em In Progress'}`);

  // 2. Os fatos: branches e PRs abertos.
  const branches = (
    await paginate(
      `query($owner: String!, $repo: String!, $endCursor: String) {
         repository(owner: $owner, name: $repo) {
           refs(refPrefix: "refs/heads/", first: 100, after: $endCursor) {
             nodes { name }
             pageInfo { hasNextPage endCursor }
           }
         }
       }`,
      { owner, repo },
      (d) => d.repository.refs
    )
  ).map((r) => r.name);

  const prs = (
    await paginate(
      `query($owner: String!, $repo: String!, $endCursor: String) {
         repository(owner: $owner, name: $repo) {
           pullRequests(states: OPEN, first: 100, after: $endCursor) {
             nodes { number isDraft closingIssuesReferences(first: 20) { nodes { number } } }
             pageInfo { hasNextPage endCursor }
           }
         }
       }`,
      { owner, repo },
      (d) => d.repository.pullRequests
    )
  ).map((p) => ({ number: p.number, isDraft: p.isDraft, closes: p.closingIssuesReferences.nodes.map((n) => n.number) }));

  console.log(`Fatos: ${branches.length} branch(es), ${prs.length} PR(s) aberto(s)`);

  // 3. Os itens do board.
  const itens = await paginate(
    `query($project: ID!, $endCursor: String) {
       node(id: $project) {
         ... on ProjectV2 {
           items(first: 100, after: $endCursor) {
             nodes {
               id
               fieldValueByName(name: "Status") {
                 ... on ProjectV2ItemFieldSingleSelectValue { name }
               }
               content { ... on Issue { number state } }
             }
             pageInfo { hasNextPage endCursor }
           }
         }
       }
     }`,
    { project: projeto.id },
    (d) => d.node.items
  );

  // 3.5. Toda issue ABERTA precisa ter item no board.
  //
  // `addProjectV2ItemById` casa pelo conteúdo: reenviar uma issue que já está
  // no board devolve o item existente em vez de duplicar. É o que torna esta
  // etapa idempotente, e é por isso que ela pode rodar em todo evento em vez
  // de existir um job separado só para a issue recém-aberta.
  //
  // Issue FECHADA não entra: se ela já estiver no board, o passo seguinte a
  // marca como Done; se nunca entrou, não há por que trazê-la agora.
  const abertas = await paginate(
    `query($owner: String!, $repo: String!, $endCursor: String) {
       repository(owner: $owner, name: $repo) {
         issues(states: OPEN, first: 100, after: $endCursor) {
           nodes { id number }
           pageInfo { hasNextPage endCursor }
         }
       }
     }`,
    { owner, repo },
    (d) => d.repository.issues
  );

  const faltam = faltamNoBoard(abertas, itens);
  console.log(`${abertas.length} issue(s) aberta(s) · ${faltam.length} fora do board`);
  for (const issue of faltam) {
    console.log(`  + #${issue.number}`);
    if (dryRun) continue;
    const add = await graphql(
      `mutation($project: ID!, $content: ID!) {
         addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } }
       }`,
      { project: projeto.id, content: issue.id }
    );
    // Entra na lista desta execução para já sair daqui com o Status certo:
    // uma issue nova vira item E vira "Todo" no mesmo run, sem segunda passada.
    itens.push({
      id: add.addProjectV2ItemById.item.id,
      fieldValueByName: null,
      content: { number: issue.number, state: 'OPEN' },
    });
  }

  // 4. Só o que diverge vira escrita — e só no que o sync é dono.
  const mudancas = [];
  const preservados = [];
  let naoIssue = 0;
  for (const item of itens) {
    if (!item.content?.number) {
      naoIssue++; // PR ou rascunho do board: este script só governa issue
      continue;
    }
    const atual = item.fieldValueByName?.name ?? null;
    if (ehOverrideHumano(atual)) {
      preservados.push({ numero: item.content.number, atual });
      continue;
    }
    const desejado = decide(item.content, { branches, prs }, { temInReview });
    if (atual !== desejado) mudancas.push({ item, atual, desejado });
  }

  console.log(
    `${itens.length} item(ns) no board · ${naoIssue} não são issue · ` +
      `${preservados.length} com status posto à mão · ${mudancas.length} para mudar`
  );
  for (const { numero, atual } of preservados) {
    console.log(`  #${String(numero).padStart(3)}  ${atual} — decisão sua, não encostei`);
  }
  if (!mudancas.length) return;

  for (const { item, atual, desejado } of mudancas) {
    console.log(`  #${String(item.content.number).padStart(3)}  ${String(atual ?? '(vazio)').padEnd(14)} → ${desejado}`);
    if (dryRun) continue;
    await graphql(
      `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
         updateProjectV2ItemFieldValue(
           input: {projectId: $project, itemId: $item, fieldId: $field, value: {singleSelectOptionId: $option}}
         ) { projectV2Item { id } }
       }`,
      { project: projeto.id, item: item.id, field: projeto.field.id, option: opcao[desejado] }
    );
  }

  console.log(dryRun ? '\n(dry-run: nada foi escrito)' : `\n${mudancas.length} item(ns) atualizado(s).`);
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
