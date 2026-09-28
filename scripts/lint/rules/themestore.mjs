/**
 * themestore — os recursos que a Theme Store exige estão no markup?
 *
 * ── O que esta regra NÃO prova ─────────────────────────────────────────────
 *
 * Presença não é funcionamento. Ela garante que `payment_button` está na
 * árvore do form de produto, não que o botão compra a variante certa; que
 * `store_availabilities` está numa section, não que o dialog prende o foco.
 * É a mesma divisão que o CLAUDE.md faz para todos os linters: eles verificam
 * ESTRUTURA. O comportamento de cada recurso mora nos testes da issue dele —
 * `tests/` (jsdom) e `e2e/` (Playwright contra o tema empurrado).
 *
 * Então "limpo" aqui quer dizer "nada da tabela falta no código-fonte", e não
 * "pronto para submeter". Também não entra o que só existe medido na loja:
 * Lighthouse (#58), acessibilidade (e2e/) e o que o revisor julga.
 *
 * ── Por que ela existe ─────────────────────────────────────────────────────
 *
 * Até 26/09, `label:theme-store-blocker` mostrava UMA issue aberta. Cruzar os
 * requisitos da Shopify com o código achou doze recursos obrigatórios
 * ausentes (#133 a #145, fora a #142). A label era tão boa quanto a memória de
 * quem abria a issue — o defeito que a ADR 0001 descreve, num lugar novo.
 *
 * A tabela mora em `config/theme-store.json`, não aqui: cada linha é um
 * requisito, com o link da Shopify, a issue que o acompanha, onde procurar e o
 * que precisa aparecer. As ausências de hoje entram no baseline como dívida;
 * cada issue fechada derruba o número, e um recurso que SOME depois de pronto
 * vira erro, não aviso.
 *
 * ── Dois cuidados que o repositório já pagou para aprender ────────────────
 *
 * 1. Seguir o que a section renderiza. O `payment_button` vai morar em
 *    `snippets/add-to-cart.liquid`, não em `main-product`. A regra `budget`
 *    subiu o teto três vezes por ler um nível só (`$comment_teto` e
 *    `$comment_pontocego` em perf-budget.json). A travessia é a DELA —
 *    `fontesGlobais`, que segue `{% render %}`, `{% section %}` e
 *    `{% sections %}` —, reusada em vez de reescrita: duas travessias
 *    divergem, e a que ficar para trás volta a subnotificar.
 *
 * 2. Procurar depois de `stripInert`. Senão um
 *    `{% comment %}payment_button{% endcomment %}` satisfaz a regra. E o
 *    render dentro de um comentário também não é seguido: o texto que a
 *    travessia lê já é o limpo.
 *
 * ── Os estados ─────────────────────────────────────────────────────────────
 *
 *   · requisito cumprido: a verificação passa;
 *   · padrão ausente: um achado por (verificação, padrão), no primeiro alvo;
 *   · alvo que sumiu (renomeado, removido, glob que não casa nada): achado que
 *     diz qual linha perdeu o alvo — nunca "passa porque não achou o arquivo";
 *   · linha sem link para shopify.dev ou sem issue: a regra FALHA ao executar,
 *     como `design-exceptions.json` sem `reason`. Não é achado, porque achado
 *     de regra com catraca pode ser registrado no baseline, e uma tabela
 *     quebrada não é dívida: é o verificador desarmado.
 *
 * O achado é por padrão, e não por linha da tabela, de propósito: com uma
 * impressão digital por linha, o `unit_price` que sumisse do carrinho enquanto
 * o pedido ainda não o tem teria a MESMA impressão da dívida já registrada, e
 * passaria como aviso. Por padrão, cada lugar trava sozinho. A contagem por
 * requisito — a regressiva da submissão — sai de `contagem()`, no painel.
 */
import fs from 'node:fs';
import * as acorn from 'acorn';
import { abs, extractSchema, offense, read, stripInert } from '../lib.mjs';
import { readConfig } from '../exceptions.mjs';
import { fontesGlobais } from './budget.mjs';

export const meta = {
  name: 'themestore',
  title: 'Requisitos da Theme Store',
  description: 'Os recursos que a Theme Store exige aparecem em markup ativo, seguindo o que cada section renderiza.',
  ratchet: true,
};

const TABELA = 'scripts/lint/config/theme-store.json';

/** O disco de verdade. Os testes trocam por um objeto em memória. */
export const DISCO = {
  ler: read,
  listar: (dir) =>
    fs.existsSync(abs(dir)) ? fs.readdirSync(abs(dir)).map((nome) => `${dir}/${nome}`) : [],
};

/**
 * A tabela está em condição de ser usada? Lança em vez de devolver achado —
 * ver "Os estados", no cabeçalho.
 */
export function validar(tabela) {
  const linhas = tabela?.requisitos;
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw new Error(`${TABELA}: "requisitos" vazio — a regra passaria sem verificar nada.`);
  }

  const ids = new Set();
  linhas.forEach((linha, indice) => {
    const falha = (motivo) => {
      throw new Error(`${TABELA}: a linha "${linha?.id ?? indice}" ${motivo}`);
    };

    if (!/^[a-z0-9-]+$/.test(linha?.id ?? '')) {
      falha('precisa de um "id" em kebab-case — ele entra na impressão digital do baseline.');
    }
    if (ids.has(linha.id)) falha('repete o "id" de outra linha.');
    ids.add(linha.id);

    if (!linha.requisito?.trim()) falha('não diz qual é o requisito ("requisito").');
    if (!/^https:\/\/shopify\.dev\/\S+$/.test(linha.link ?? '')) {
      falha(
        'não aponta para o requisito em shopify.dev ("link"). Requisito sem fonte é opinião, ' +
          'e é pela mesma razão que design-exceptions.json exige "reason".'
      );
    }
    if (!Number.isInteger(linha.issue) || linha.issue <= 0) {
      falha('não diz qual issue acompanha o requisito ("issue", um número).');
    }
    if (!Array.isArray(linha.verificacoes) || linha.verificacoes.length === 0) {
      falha('não tem nenhuma verificação — passaria sem olhar nada.');
    }

    for (const verificacao of linha.verificacoes) {
      const { onde, precisa, schema } = verificacao ?? {};
      if (!Array.isArray(onde) || onde.length === 0 || onde.some((alvo) => !alvoValido(alvo))) {
        falha('tem verificação sem "onde", ou com alvo fora do formato `dir/arquivo` (glob só no nome).');
      }
      const temPadrao = Array.isArray(precisa) && precisa.length > 0;
      const temSchema = Boolean(schema?.bloco || schema?.setting);
      if (!temPadrao && !temSchema) falha('tem verificação sem "precisa" e sem "schema".');
      for (const texto of precisa ?? []) {
        try {
          padrao(texto);
        } catch (error) {
          falha(`tem um padrão que não compila: ${texto} (${error.message}).`);
        }
      }
    }
  });
}

const alvoValido = (alvo) =>
  typeof alvo === 'string' && /^[^*]+\/[^/]+$/.test(alvo) && !alvo.startsWith('/');

/**
 * `"/…/flags"` é regex; qualquer outra string é texto literal.
 * `g` e `y` saem: com eles `test()` guarda estado entre chamadas.
 */
export function padrao(texto) {
  if (typeof texto !== 'string' || texto === '') throw new Error('padrão vazio');
  const regex = /^\/(.+)\/([gimsuy]*)$/s.exec(texto);
  if (!regex) return (fonte) => fonte.includes(texto);
  const re = new RegExp(regex[1], regex[2].replace(/[gy]/g, ''));
  return (fonte) => re.test(fonte);
}

/** Os arquivos que um alvo nomeia: o próprio caminho, ou o que o glob casa. */
export function expandir(alvo, disco = DISCO) {
  const corte = alvo.lastIndexOf('/');
  const dir = alvo.slice(0, corte);
  const nome = alvo.slice(corte + 1);
  const re = new RegExp(`^${nome.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
  return disco
    .listar(dir)
    .filter((arquivo) => re.test(arquivo.slice(corte + 1)))
    .sort();
}

/**
 * O texto que CONTA num arquivo — o markup ativo.
 *
 * Liquid passa por `stripInert` e por mais uma forma de comentário que ele
 * ainda não conhece: a tag inline `{% # … %}`. Sem ela, `{% # payment_button %}`
 * cumpriria o requisito. O lugar certo dela é o próprio `stripInert`, que
 * decide o que TODAS as regras enxergam; aqui é o mínimo para esta regra não
 * aceitar um comentário como recurso.
 *
 * JS perde os comentários pelo parser, porque `//` dentro de uma string (uma
 * URL) não é comentário e uma regex não sabe disso. Fonte que não parseia não
 * conta: presença não comprovada é ausência, e o erro fica do lado de acusar.
 *
 * JSON (o grupo de um `{% sections %}`) passa inteiro: dele a travessia só lê
 * os tipos de section.
 */
export function ativo(arquivo, bruto) {
  if (arquivo.endsWith('.json')) return bruto;
  if (arquivo.endsWith('.js')) return semComentarioDeJs(bruto);
  const branco = (trecho) => '\n'.repeat(trecho.split('\n').length - 1);
  return stripInert(bruto).replace(/\{%-?\s*#[\s\S]*?%\}/g, branco);
}

function semComentarioDeJs(src) {
  const comentarios = [];
  try {
    acorn.parse(src, {
      ecmaVersion: 'latest',
      onComment: (_bloco, _texto, inicio, fim) => comentarios.push([inicio, fim]),
    });
  } catch {
    return '';
  }
  let limpo = '';
  let cursor = 0;
  for (const [inicio, fim] of comentarios) {
    limpo += `${src.slice(cursor, inicio)} `;
    cursor = fim;
  }
  return limpo + src.slice(cursor);
}

/**
 * O markup ativo dos alvos e de tudo que eles renderizam.
 *
 * `fontesGlobais` se chama assim porque, na regra `budget`, a entrada é o
 * layout; a travessia em si não sabe de "global". O leitor que ela recebe já
 * devolve o texto limpo, então um `{% render %}` comentado não é seguido.
 */
export function arvore(arquivos, disco = DISCO) {
  const ler = (arquivo) => ativo(arquivo, disco.ler(arquivo));
  return arquivos.flatMap((arquivo) => fontesGlobais(arquivo, ler)).join('\n');
}

/** O schema de algum dos arquivos declara o bloco / o setting pedido? */
export function schemaCumpre(arquivos, pedido, disco = DISCO) {
  return arquivos.some((arquivo) => {
    const json = extractSchema(disco.ler(arquivo))?.json;
    if (!json) return false;
    const blocos = Array.isArray(json.blocks) ? json.blocks : [];
    if (pedido.bloco && !blocos.some((bloco) => bloco?.type === pedido.bloco)) return false;
    if (pedido.setting) {
      const settings = [...(json.settings ?? []), ...blocos.flatMap((bloco) => bloco?.settings ?? [])];
      if (!settings.some((setting) => setting?.type === pedido.setting)) return false;
    }
    return true;
  });
}

const rotulo = (linha) => `[#${linha.issue}] ${linha.requisito}`;
const fonte = (linha) => `Requisito: ${linha.link}${linha.secao ? ` (${linha.secao})` : ''}.`;
const ondeLegivel = (onde) =>
  onde.length === 1
    ? `${onde[0]}, nem no que ela renderiza`
    : `${onde.join(' + ')}, nem no que eles renderizam`;

/** A regra inteira, sobre uma tabela e um disco quaisquer. */
export function verificar(tabela, disco = DISCO) {
  validar(tabela);

  const achados = new Map();
  const acusa = (dados) => {
    const item = offense({ rule: 'themestore', ...dados });
    if (!achados.has(item.fingerprint)) achados.set(item.fingerprint, item);
  };

  for (const linha of tabela.requisitos) {
    for (const verificacao of linha.verificacoes) {
      const { onde } = verificacao;

      const perdidos = onde.filter((alvo) => expandir(alvo, disco).length === 0);
      for (const alvo of perdidos) {
        acusa({
          file: alvo,
          code: `${linha.id}:alvo`,
          message:
            `${rotulo(linha)}: a linha "${linha.id}" da tabela perdeu o alvo ${alvo} — nenhum ` +
            `arquivo casa. Se ele foi renomeado, atualize ${TABELA}; se o recurso ainda não ` +
            `existe, é dívida. ${fonte(linha)}`,
        });
      }
      if (perdidos.length) continue;

      const arquivos = onde.flatMap((alvo) => expandir(alvo, disco));

      if (verificacao.precisa?.length) {
        const texto = arvore(arquivos, disco);
        for (const esperado of verificacao.precisa) {
          if (padrao(esperado)(texto)) continue;
          acusa({
            file: onde[0],
            code: `${linha.id}:${esperado}`,
            message:
              `${rotulo(linha)}: \`${esperado}\` não aparece em markup ativo de ` +
              `${ondeLegivel(onde)}. ${fonte(linha)}`,
          });
        }
      }

      if (verificacao.schema && !schemaCumpre(arquivos, verificacao.schema, disco)) {
        const [chave, valor] = verificacao.schema.bloco
          ? ['bloco', verificacao.schema.bloco]
          : ['setting', verificacao.schema.setting];
        acusa({
          file: onde[0],
          line: extractSchema(disco.ler(arquivos[0]))?.line ?? 1,
          code: `${linha.id}:schema:${chave}=${valor}`,
          message:
            `${rotulo(linha)}: o schema de ${onde.join(' + ')} não declara ` +
            `${chave === 'bloco' ? `um bloco \`"type": "${valor}"\`` : `um setting \`"type": "${valor}"\``}. ` +
            fonte(linha),
        });
      }
    }
  }

  return [...achados.values()];
}

export function run() {
  return verificar(readConfig('theme-store.json'));
}

/**
 * A contagem regressiva da submissão, por REQUISITO e não por achado: quantas
 * linhas da tabela ainda têm alguma ausência. É o número que o painel mostra —
 * o de achados é o que a catraca trava.
 */
export function contagem(tabela = readConfig('theme-store.json'), achados = verificar(tabela)) {
  const abertos = new Set(achados.map((achado) => achado.code.split(':')[0]));
  return {
    total: tabela.requisitos.length,
    pendentes: tabela.requisitos.filter((linha) => abertos.has(linha.id)),
  };
}
