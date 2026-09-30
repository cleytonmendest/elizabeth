// @vitest-environment node
/**
 * As verificações do ADR 0018 conseguem reprovar?
 *
 * "Uma loja por branch" só vale se cada frase do ADR tiver um verificador que
 * falha quando ela é quebrada: código mudado numa `loja/*`, chave nova num
 * locale da loja, um setting renomeado na `main` que a loja ainda usa, e a
 * propagação que misturasse o layout da loja com o da `main`.
 *
 * ── Por que a maior parte deste arquivo roda git ───────────────────────────
 *
 * O que está sob teste é, em boa parte, uma premissa sobre o git: que o
 * merge-base separa o que a loja mudou do que a `main` andou, que um merge
 * limpo de JSON não fica com a loja, que o push de uma loja reprovada não
 * acontece. Premissa sobre ferramenta de terceiro não se verifica lendo o
 * próprio código (ver `tests/adr.test.mjs`), então cada caso monta um remoto
 * bare e um clone, com commits de verdade.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_DA_SHOPIFY,
  CONTEUDO_DA_LOJA,
  LOCALES_DE_VITRINE,
  buscar,
  chavesDivergentes,
  commitsDoBot,
  commitsDoPush,
  conferirLoja,
  ehConteudoDaLoja,
  ehLocaleDeVitrine,
  mudancasProibidas,
  planoDoMerge,
  propagar,
  validarLojas,
  vereditoDoBot,
} from '../scripts/lojas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('o que é conteúdo de loja', () => {
  it('o que o editor grava é conteúdo', () => {
    for (const caminho of [
      'templates/index.json',
      'templates/product.bebe.json',
      'sections/header-group.json',
      'config/settings_data.json',
      'config/markets.json',
    ]) {
      expect(ehConteudoDaLoja(caminho), caminho).toBe(true);
    }
  });

  it('código não é conteúdo, mesmo morando perto', () => {
    for (const caminho of [
      'sections/header.liquid',
      'templates/customers/login.liquid',
      'templates/customers/conta.json',
      'config/settings_schema.json',
      'locales/pt-BR.json',
      'snippets/preco.liquid',
      'assets/application.css',
    ]) {
      expect(ehConteudoDaLoja(caminho), caminho).toBe(false);
    }
  });

  it('o locale do editor é de vitrine; o de schema, não', () => {
    expect(ehLocaleDeVitrine('locales/pt-BR.json')).toBe(true);
    expect(ehLocaleDeVitrine('locales/en.default.json')).toBe(true);
    expect(ehLocaleDeVitrine('locales/pt-BR.schema.json')).toBe(false);
  });
});

describe('o CLAUDE.md não pode divergir de CONTEUDO_DA_LOJA', () => {
  // Mesmo motivo do teste gêmeo em `tests/catraca.test.mjs`: a lista em prosa
  // é o que alguém lê antes de mexer numa loja, e uma cópia desatualizada ali
  // faz a pessoa acreditar que um arquivo pode divergir quando não pode.
  const claude = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8');

  it('cita todo caminho que uma loja pode mudar', () => {
    for (const caminho of [...CONTEUDO_DA_LOJA, LOCALES_DE_VITRINE]) {
      expect(claude, `${caminho} não aparece no CLAUDE.md`).toContain(`\`${caminho}\``);
    }
  });
});

describe('as decisões, sem git', () => {
  it('chave nova e chave sumida num locale são código; valor mudado, não', () => {
    const antes = { produto: { comprar: 'Comprar', esgotado: 'Esgotado' } };
    expect(chavesDivergentes(antes, { produto: { comprar: 'COMPRAR', esgotado: 'Esgotado' } })).toEqual({
      novas: [],
      sumidas: [],
    });
    expect(chavesDivergentes(antes, { produto: { comprar: 'Comprar', presente: 'Presente' } })).toEqual({
      novas: ['produto.presente'],
      sumidas: ['produto.esgotado'],
    });
  });

  it('código mudado numa loja reprova, e o recado diz para onde a correção vai', () => {
    const [problema] = mudancasProibidas([{ status: 'M', caminho: 'snippets/preco.liquid' }], () => ({}));
    expect(problema.code).toBe('codigo-na-loja');
    expect(problema.message).toContain('main');
  });

  it('locale NOVO numa loja é código, mesmo sendo de vitrine', () => {
    const problemas = mudancasProibidas([{ status: 'A', caminho: 'locales/fr.json' }], () => ({}));
    expect(problemas.map((p) => p.code)).toEqual(['codigo-na-loja']);
  });

  it('conteúdo mudado passa sem nem ler o arquivo', () => {
    const locale = () => {
      throw new Error('não devia ler');
    };
    expect(mudancasProibidas([{ status: 'M', caminho: 'templates/index.json' }], locale)).toEqual([]);
  });

  it('o merge devolve à loja o conteúdo que ela mudou, e o conflito em código bloqueia', () => {
    expect(
      planoDoMerge({
        mudadosPelaLoja: ['templates/index.json', 'locales/pt-BR.json'],
        conflitos: ['templates/index.json', 'snippets/preco.liquid', 'locales/pt-BR.json'],
      })
    ).toEqual({
      restaurarDaLoja: ['templates/index.json'],
      bloqueiam: ['snippets/preco.liquid', 'locales/pt-BR.json'],
    });
  });

  it('o commit do bot é reconhecido pelo formato real, o do beac89f', () => {
    const log = [
      `beac89f52d6d1b9e67184707b3e56df585952841\t${BOT_DA_SHOPIFY}\t79544226+shopify[bot]@users.noreply.github.com`,
      '3d437f0000000000000000000000000000000000\tCleyton\tcleyton@exemplo',
    ].join('\n');
    expect(commitsDoBot(log).map((c) => c.sha.slice(0, 7))).toEqual(['beac89f']);
  });

  it('commit do bot na main reprova quando já existe loja/*', () => {
    const commits = [{ sha: 'beac89f52d', nome: BOT_DA_SHOPIFY, email: '' }];
    const veredito = vereditoDoBot({ commits, lojas: ['loja/moda'] });
    expect(veredito.ok).toBe(false);
    expect(veredito.mensagem).toContain('beac89f');
  });

  it('antes da migração, o commit do bot na main é o estado esperado — e é dito', () => {
    const veredito = vereditoDoBot({ commits: [{ sha: 'beac89f52d', nome: BOT_DA_SHOPIFY }], lojas: [] });
    expect(veredito.ok).toBe(true);
    expect(veredito.mensagem).toContain('#168');
  });
});

// ── Contra o git de verdade ─────────────────────────────────────────────────

/**
 * Nenhuma variável `GIT_*` chega ao git daqui: dentro de um hook elas apontam
 * para o repositório REAL, e o `cwd` não vence o `GIT_DIR`. Ver o comentário
 * de `tests/adr.test.mjs`, que registra o estrago que isso já fez.
 */
const semGit = Object.fromEntries(Object.entries(process.env).filter(([nome]) => !nome.startsWith('GIT_')));

const temporarios = [];
afterAll(() => temporarios.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const SECTION = (settings) =>
  `<div>{{ section.settings.${settings[0]} }}</div>\n{% schema %}\n${JSON.stringify({
    name: 'Texto',
    settings: settings.map((id) => ({ type: 'text', id })),
    blocks: [{ type: 'text', name: 'T', settings: [{ type: 'richtext', id: 'text' }] }],
    presets: [{ name: 'Texto' }],
  })}\n{% endschema %}\n`;

const HOME = (heading, bloco = 'text') =>
  `${JSON.stringify(
    {
      sections: {
        texto: {
          type: 'rich-text',
          settings: { heading },
          blocks: { t1: { type: bloco, settings: { text: '<p>oi</p>' } } },
          block_order: ['t1'],
        },
      },
      order: ['texto'],
    },
    null,
    2
  )}\n`;

const LOCALE = (comprar, extra = {}) =>
  `${JSON.stringify({ produto: { comprar, esgotado: 'Esgotado', ...extra } }, null, 2)}\n`;

/** Um remoto bare com um tema mínimo na `main`, e um clone para trabalhar. */
function repositorio() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lojas-'));
  temporarios.push(raiz);
  const origem = path.join(raiz, 'origem.git');
  const cwd = path.join(raiz, 'trabalho');
  fs.mkdirSync(cwd);

  const g = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: semGit, stdio: 'pipe' });
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origem], { env: semGit, stdio: 'pipe' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'teste@exemplo');
  g('config', 'user.name', 'Teste');
  g('remote', 'add', 'origin', origem);

  const escreve = (caminho, texto) => {
    fs.mkdirSync(path.dirname(path.join(cwd, caminho)), { recursive: true });
    fs.writeFileSync(path.join(cwd, caminho), texto);
  };
  const le = (caminho) => fs.readFileSync(path.join(cwd, caminho), 'utf8');
  const commit = (mensagem, autor) => {
    g('add', '-A');
    // `--allow-empty`: uma loja recém-criada, idêntica à main, é um caso real.
    g('commit', '-qm', mensagem, '--allow-empty', ...(autor ? ['--author', autor] : []));
  };

  escreve('sections/rich-text.liquid', SECTION(['heading']));
  escreve('templates/index.json', HOME('Moda'));
  escreve('snippets/preco.liquid', 'preço v1\n');
  escreve('locales/pt-BR.json', LOCALE('Comprar'));
  escreve(
    'config/settings_schema.json',
    JSON.stringify([{ name: 'theme_info' }, { name: 'Layout', settings: [{ type: 'range', id: 'page_width' }] }])
  );
  escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1200 } }));
  commit('tema');
  g('push', '-q', 'origin', 'main');

  /** Cria `loja/<nome>` a partir da main do remoto, aplica `mexe` e empurra. */
  const criaLoja = (nome, mexe = () => {}) => {
    g('fetch', '-q', 'origin');
    g('checkout', '-q', '-B', `loja/${nome}`, 'origin/main');
    mexe();
    commit(`loja ${nome}`);
    g('push', '-q', 'origin', `loja/${nome}`);
    g('checkout', '-q', 'main');
  };

  /** Um commit na main, empurrado. */
  const naMain = (mexe, autor) => {
    g('checkout', '-q', 'main');
    mexe();
    commit('main anda', autor);
    g('push', '-q', 'origin', 'main');
  };

  /** Lê um arquivo de uma branch do remoto, sem checkout. */
  const doRemoto = (ref, caminho) => execFileSync('git', ['show', `${ref}:${caminho}`], { cwd: origem, encoding: 'utf8', env: semGit });

  return { cwd, g, escreve, le, commit, criaLoja, naMain, doRemoto };
}

/** A conferência, como o CI a roda: na ponta da loja, depois de buscar. */
const confere = (repo, nome) => {
  buscar({ cwd: repo.cwd });
  repo.g('checkout', '-q', '--detach', `origin/loja/${nome}`);
  const problemas = conferirLoja({ cwd: repo.cwd });
  repo.g('checkout', '-q', 'main');
  return problemas;
};

describe('conferir: a loja só mudou conteúdo?', () => {
  it('home reordenada no editor passa', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    expect(confere(repo, 'bebe')).toEqual([]);
  });

  it('REPROVA código mudado na loja, e nomeia o arquivo', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('snippets/preco.liquid', 'preço da loja\n'));
    const problemas = confere(repo, 'bebe');

    expect(problemas.map((p) => [p.arquivo, p.code])).toEqual([['snippets/preco.liquid', 'codigo-na-loja']]);
  });

  it('valor de locale mudado passa; chave nova reprova', () => {
    const repo = repositorio();
    repo.criaLoja('valor', () => repo.escreve('locales/pt-BR.json', LOCALE('COMPRAR')));
    repo.criaLoja('chave', () => repo.escreve('locales/pt-BR.json', LOCALE('Comprar', { presente: 'Presente' })));

    expect(confere(repo, 'valor')).toEqual([]);
    const [problema] = confere(repo, 'chave');
    expect(problema.code).toBe('locale-com-chave-da-loja');
    expect(problema.message).toContain('produto.presente');
  });

  it('a main andou depois de a loja nascer, e a loja NÃO reprova pelo que não fez', () => {
    // Comparada com a ponta da main, a loja pareceria ter "mudado" o snippet
    // que a main mudou. O merge-base é o que separa uma coisa da outra.
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));

    expect(confere(repo, 'bebe')).toEqual([]);
  });

  it('REPROVA o JSON da loja que aponta um bloco que o código dela não tem', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços', 'bloco_que_nao_existe')));
    const problemas = confere(repo, 'bebe');

    expect(problemas.map((p) => p.code)).toEqual(['missing-block:rich-text/bloco_que_nao_existe']);
  });
});

describe('validar: o código do PR cabe no JSON de cada loja?', () => {
  it('sem loja/* no remoto, não há o que validar — e o resultado diz isso com uma lista vazia', () => {
    const repo = repositorio();
    buscar({ cwd: repo.cwd });
    expect(validarLojas({ cwd: repo.cwd })).toEqual([]);
  });

  it('REPROVA o setting renomeado no PR enquanto a loja ainda usa o nome velho', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.criaLoja('moda');
    // O PR, no disco: `heading` vira `titulo`.
    repo.escreve('sections/rich-text.liquid', SECTION(['titulo']));
    buscar({ cwd: repo.cwd });

    const resultado = validarLojas({ cwd: repo.cwd });

    expect(resultado.map((r) => r.loja)).toEqual(['loja/bebe', 'loja/moda']);
    for (const { problemas } of resultado) {
      expect(problemas.map((p) => [p.arquivo, p.code])).toEqual([
        ['templates/index.json', 'missing-setting:rich-text.heading'],
      ]);
    }
  });

  it('o mesmo PR, com o nome mantido, passa', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.escreve('sections/rich-text.liquid', SECTION(['heading', 'subtitulo']));
    buscar({ cwd: repo.cwd });

    expect(validarLojas({ cwd: repo.cwd })).toEqual([{ loja: 'loja/bebe', problemas: [] }]);
  });
});

describe('propagar: a main entra em cada loja', () => {
  it('o código da main chega, e a home que a loja montou fica INTEIRA com ela', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    // A main muda o snippet E a própria home padrão. Um merge por linha
    // juntaria as duas homes; a da loja precisa sair intacta.
    repo.naMain(() => {
      repo.escreve('snippets/preco.liquid', 'preço v2\n');
      repo.escreve('templates/index.json', HOME('Neutra'));
    });
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado).toMatchObject({ loja: 'loja/bebe', estado: 'atualizada' });
    expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v2\n');
    expect(repo.doRemoto('loja/bebe', 'templates/index.json')).toBe(HOME('Berços'));
  });

  it('o conteúdo que a loja nunca tocou recebe o da main', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('locales/pt-BR.json', LOCALE('COMPRAR')));
    repo.naMain(() => repo.escreve('templates/index.json', HOME('Neutra')));
    buscar({ cwd: repo.cwd });

    propagar({ cwd: repo.cwd });

    expect(repo.doRemoto('loja/bebe', 'templates/index.json')).toBe(HOME('Neutra'));
    expect(repo.doRemoto('loja/bebe', 'locales/pt-BR.json')).toBe(LOCALE('COMPRAR'));
  });

  it('loja que já tem a main fica em dia, sem commit novo', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    buscar({ cwd: repo.cwd });
    const antes = repo.doRemoto('loja/bebe', 'templates/index.json');

    expect(propagar({ cwd: repo.cwd })).toEqual([{ loja: 'loja/bebe', estado: 'em-dia' }]);
    expect(repo.doRemoto('loja/bebe', 'templates/index.json')).toBe(antes);
  });

  it('REPROVA conflito em código, não empurra, e devolve o checkout limpo', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('snippets/preco.liquid', 'preço da loja\n'));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('falhou');
    expect(resultado.motivo).toContain('snippets/preco.liquid');
    expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço da loja\n');
    expect(repo.g('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main');
    expect(repo.g('status', '--porcelain')).toBe('');
  });

  it('REPROVA a loja com código mudado mesmo sem conflito, e não empurra', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('snippets/extra.liquid', 'de app\n'));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('falhou');
    expect(resultado.problemas.map((p) => p.arquivo)).toEqual(['snippets/extra.liquid']);
    expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v1\n');
  });

  it('RECUSA rodar com arquivo rastreado modificado, e o arquivo sobrevive', () => {
    // O defeito medido do jeito ruim: a volta ao ponto de partida usa
    // `checkout --force`, e a primeira versão apagou uma edição não commitada
    // do `ci.yml` na máquina de quem a rodou.
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });
    repo.escreve('snippets/preco.liquid', 'edição que ninguém commitou\n');

    expect(() => propagar({ cwd: repo.cwd })).toThrow(/descartaria/);
    expect(repo.le('snippets/preco.liquid')).toBe('edição que ninguém commitou\n');
  });

  it('uma loja que falha não impede as outras', () => {
    const repo = repositorio();
    repo.criaLoja('a-quebrada', () => repo.escreve('snippets/preco.liquid', 'preço da loja\n'));
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    const resultados = propagar({ cwd: repo.cwd });

    expect(resultados.map((r) => [r.loja, r.estado])).toEqual([
      ['loja/a-quebrada', 'falhou'],
      ['loja/bebe', 'atualizada'],
    ]);
    expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v2\n');
  });
});

describe('o bot na main, contra o git de verdade', () => {
  it('acha o commit do shopify[bot] dentro do intervalo do push, e só ele', () => {
    const repo = repositorio();
    const antes = repo.g('rev-parse', 'HEAD').trim();
    repo.naMain(
      () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
      `${BOT_DA_SHOPIFY} <79544226+shopify[bot]@users.noreply.github.com>`
    );
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    const depois = repo.g('rev-parse', 'HEAD').trim();

    expect(commitsDoPush({ antes, depois, cwd: repo.cwd })).toHaveLength(1);
    // O `antes` do push é o topo anterior: o que já estava lá não conta de novo.
    expect(commitsDoPush({ antes: depois, depois, cwd: repo.cwd })).toHaveLength(0);
  });
});
