#!/usr/bin/env node
/**
 * O comentário de preview do PR — e a recusa de publicá-lo sem preview.
 *
 * ── Por que isto não é um bloco de shell dentro do YAML ────────────────────
 *
 * Mesma razão de `scripts/catraca.mjs` e `scripts/tema-de-teste.mjs`: shell
 * dentro de YAML não tem teste, não roda na máquina de ninguém, e as duas
 * vezes em que este repositório escondeu lógica lá o resultado foi um
 * verificador que sempre passava. Aqui o risco é idêntico e tem nome — um comentário dizendo
 * "preview pronto" com a URL vazia é indistinguível de um preview que funciona,
 * até alguém clicar.
 *
 * ── As três saídas, e por que "ausente" não é "inválido" ───────────────────
 *
 * A sonda da loja aprendeu isso na marra: relatar "respondeu errado" como
 * "ninguém respondeu" mandou duas horas de investigação para o lugar errado.
 * Aqui a mesma distinção decide se o job fica verde ou vermelho:
 *
 *   ausente   O passo de push não rodou — sem credencial da loja, ou PR de
 *             fork, onde o secret não chega ao runner. Não há o que comentar
 *             e não há nada quebrado. Verde, com o motivo no log.
 *
 *   invalido  O push rodou e devolveu algo que não serve: JSON quebrado, sem
 *             `theme`, sem `preview_url`, ou com uma URL que não é http. Isso
 *             é falha de verdade — VERMELHO. Publicar o comentário mesmo assim
 *             seria afirmar mais do que se verificou.
 *
 *   ok        Tem URL utilizável. Escreve o corpo do comentário.
 *
 * ── Por que ele mesmo publica, em vez de um `actions/github-script` ────────
 *
 * Porque a tag não é verificável. Este repositório já mergeou
 * `actions/add-to-project@v1` — uma tag que nunca existiu — e ficou dois dias
 * quebrado sem ninguém ver; o actionlint não vai à rede conferir tag, e o
 * ambiente onde isto foi escrito não alcança a API do GitHub para outros
 * repositórios. Publicar daqui troca uma dependência que eu não consigo
 * verificar por `fetch`, que o Node 22 já traz.
 *
 * De quebra, a escolha de QUAL comentário reescrever vira função pura com
 * teste. É onde mora o defeito silencioso: errar essa escolha não dá erro
 * nenhum — só empilha um comentário por push até o PR virar um mural.
 */
import fs from 'node:fs';

export const MARCADOR = '<!-- preview-do-tema -->';

/**
 * O que fazer, dado o que o `theme push --json` deixou (ou não deixou) no
 * disco. Pura: recebe o conteúdo, não o caminho.
 *
 * @param {{ bruto: string | null }} entrada  `null` = o arquivo não existe.
 */
export function avaliar({ bruto }) {
  if (bruto === null || bruto === undefined) {
    return {
      estado: 'ausente',
      motivo:
        'O passo de push não deixou JSON. Sem credencial da loja ' +
        '(SHOPIFY_STORE / SHOPIFY_CLI_THEME_TOKEN), ou PR de fork — o secret não ' +
        'chega ao runner. Nada a comentar.',
    };
  }

  let json;
  try {
    json = JSON.parse(bruto);
  } catch (erro) {
    return { estado: 'invalido', motivo: `O CLI não devolveu JSON válido: ${erro.message}` };
  }

  const tema = json?.theme;
  if (!tema || typeof tema !== 'object') {
    return {
      estado: 'invalido',
      motivo: `O JSON não tem a chave \`theme\`. Veio: ${resumo(json)}`,
    };
  }

  // A verificação que dá razão de existir a este arquivo. Uma string vazia é
  // falsy, mas "   " não é — e um comentário com URL em branco é o defeito.
  const url = typeof tema.preview_url === 'string' ? tema.preview_url.trim() : '';
  if (!url) {
    return {
      estado: 'invalido',
      motivo: `O tema veio sem \`preview_url\` utilizável. Veio: ${resumo(tema)}`,
    };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { estado: 'invalido', motivo: `\`preview_url\` não é uma URL http: ${url}` };
  }

  return {
    estado: 'ok',
    tema: {
      id: tema.id,
      nome: tema.name,
      papel: tema.role,
      previewUrl: url,
      editorUrl: typeof tema.editor_url === 'string' ? tema.editor_url.trim() : '',
    },
  };
}

/** O corpo do comentário. Primeira linha SEMPRE o marcador — ver o cabeçalho. */
export function comentario({ tema, sha }) {
  const linhas = [
    MARCADOR,
    '## Preview desta branch',
    '',
    `**[Abrir a loja com esta mudança](${tema.previewUrl})**`,
    '',
  ];

  if (tema.editorUrl) {
    linhas.push(`Editor do tema: ${tema.editorUrl}`, '');
  }

  linhas.push(
    '> A loja é a de desenvolvimento: o catálogo, os menus e as imagens são os que',
    '> estiverem lá. O preview mostra se o tema quebrou visualmente — não como ele',
    '> fica com outro catálogo. Se a vitrine pedir senha, é a proteção da loja, não',
    '> o tema.',
    ''
  );

  const commit = sha ? ` · commit \`${String(sha).slice(0, 7)}\`` : '';
  linhas.push(`<sub>Tema \`${tema.id}\`${commit} — este comentário é reescrito a cada push.</sub>`);

  return linhas.join('\n');
}

/**
 * Qual comentário reescrever, entre os que já estão no PR. `null` = nenhum,
 * publique um novo.
 *
 * O marcador é a primeira linha do corpo, não um trecho solto: comentário de
 * pessoa que cite o link do preview (copiando o corpo, por exemplo) não pode
 * ser confundido com o nosso e sobrescrito.
 */
export function escolherComentario(comentarios, marcador) {
  const meus = (comentarios ?? []).filter((c) => typeof c?.body === 'string' && c.body.startsWith(marcador));
  // O mais antigo: se por acidente existir mais de um, reescrever sempre o
  // mesmo faz o excedente parar de crescer em vez de alternar entre eles.
  return meus.sort((a, b) => a.id - b.id)[0] ?? null;
}

/** Um pedaço legível do que veio, para a mensagem de erro não ser um mistério. */
function resumo(valor) {
  return JSON.stringify(valor)?.slice(0, 200) ?? String(valor);
}

// ── Publicação ─────────────────────────────────────────────────────────────

const API = 'https://api.github.com';

async function chamar(caminho, { metodo = 'GET', corpo, token } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  if (!resposta.ok) {
    throw new Error(`${metodo} ${caminho} devolveu ${resposta.status}: ${await resposta.text()}`);
  }
  return resposta.json();
}

async function publicar({ repo, pr, token, corpo }) {
  const marcador = corpo.split('\n', 1)[0];
  const existentes = await chamar(`/repos/${repo}/issues/${pr}/comments?per_page=100`, { token });
  const meu = escolherComentario(existentes, marcador);

  if (meu) {
    await chamar(`/repos/${repo}/issues/comments/${meu.id}`, {
      metodo: 'PATCH',
      corpo: { body: corpo },
      token,
    });
    return `Comentário ${meu.id} atualizado.`;
  }

  const criado = await chamar(`/repos/${repo}/issues/${pr}/comments`, {
    metodo: 'POST',
    corpo: { body: corpo },
    token,
  });
  return `Comentário ${criado.id} criado.`;
}

// ── Entrada de linha de comando ────────────────────────────────────────────
// node scripts/preview.mjs --json tema.json --sha <sha> --repo dono/repo --pr 60
//
// Sem --repo/--pr (ou sem GITHUB_TOKEN) ele só imprime, sem publicar: é o que
// permite rodar na mão para ver o corpo antes de acreditar nele.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const arg = (nome) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i === -1 ? undefined : process.argv[i + 1];
  };

  const caminho = arg('json') ?? 'tema.json';
  const bruto = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8') : null;
  const veredito = avaliar({ bruto });

  if (veredito.estado === 'invalido') {
    console.error(`✖ O push rodou e não deu preview utilizável.\n  ${veredito.motivo}`);
    console.error('  Publicar o comentário assim afirmaria mais do que foi verificado.');
    process.exit(1);
  }

  if (veredito.estado === 'ausente') {
    console.log(`Sem preview nesta execução.\n  ${veredito.motivo}`);
    process.exit(0);
  }

  const corpo = comentario({ tema: veredito.tema, sha: arg('sha') });
  console.log(`Preview: ${veredito.tema.previewUrl}`);

  const repo = arg('repo');
  const pr = arg('pr');
  const token = process.env.GITHUB_TOKEN;

  if (!repo || !pr || !token) {
    console.log('Sem --repo/--pr/GITHUB_TOKEN: não publiquei. O corpo seria:\n');
    console.log(corpo);
    process.exit(0);
  }

  console.log(await publicar({ repo, pr, token, corpo }));
}
