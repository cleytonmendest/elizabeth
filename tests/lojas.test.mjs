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
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_DA_SHOPIFY,
  COMO_CORRIGIR_O_CONTEUDO,
  CONTEUDO_DA_LOJA,
  LOCALES_DE_VITRINE,
  buscar,
  chavesDivergentes,
  commitsDoBot,
  commitsDoBotAPropagar,
  conferirLoja,
  ehConteudoDaLoja,
  ehLocaleDeVitrine,
  lojaDoCheckout,
  motivoDoPushRecusado,
  mudancasProibidas,
  planoDoMerge,
  problemasNovos,
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

  it('o merge devolve à loja TODO conteúdo que ela tem, e o conflito em código bloqueia', () => {
    // ADR 0019: o `product.json` não foi mexido pela loja, e é dela do mesmo
    // jeito. O `page.antiga.json` ela apagou, e continua apagado.
    expect(
      planoDoMerge({
        naLoja: ['templates/index.json', 'templates/product.json', 'locales/pt-BR.json', 'snippets/preco.liquid'],
        naBase: ['templates/index.json', 'templates/product.json', 'templates/page.antiga.json'],
        conflitos: ['templates/index.json', 'snippets/preco.liquid', 'locales/pt-BR.json', 'templates/page.antiga.json'],
      })
    ).toEqual({
      restaurarDaLoja: ['templates/index.json', 'templates/product.json'],
      apagadosPelaLoja: ['templates/page.antiga.json'],
      bloqueiam: ['snippets/preco.liquid', 'locales/pt-BR.json'],
    });
  });

  it('o conteúdo que só a main tem não entra no plano: ele chega pelo merge', () => {
    const plano = planoDoMerge({ naLoja: ['templates/index.json'], naBase: ['templates/index.json'], conflitos: [] });
    expect(plano.restaurarDaLoja).not.toContain('templates/page.faq.json');
    expect(plano.apagadosPelaLoja).toEqual([]);
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

  /**
   * Cria `loja/<nome>` a partir de OUTRO clone, como faz o `shopify[bot]`.
   *
   * O `criaLoja` empurra deste clone, e o `git push` já atualiza o
   * `refs/remotes/origin/loja/*` daqui, então quem roda depois nunca precisa
   * buscar nada. Foi assim que o mutante "o validar deixa de buscar as lojas"
   * sobreviveu à primeira execução completa: o teste media uma loja que o
   * clone conhecia por acaso. Na vida real a loja é escrita de fora.
   */
  const fora = path.join(path.dirname(cwd), 'fora');
  const f = (...args) => execFileSync('git', args, { cwd: fora, encoding: 'utf8', env: semGit, stdio: 'pipe' });
  const deFora = (nome, ponto, mexe) => {
    if (!fs.existsSync(fora)) {
      execFileSync('git', ['clone', '-q', origem, fora], { env: semGit, stdio: 'pipe' });
      f('config', 'user.email', 'bot@exemplo');
      f('config', 'user.name', 'Bot');
    }
    f('fetch', '-q', 'origin');
    f('checkout', '-q', '-B', `loja/${nome}`, ponto);
    mexe((caminho, texto) => fs.writeFileSync(path.join(fora, caminho), texto));
    f('add', '-A');
    f('commit', '-qm', `loja ${nome}`, '--allow-empty');
    f('push', '-q', 'origin', `loja/${nome}`);
  };
  const criaLojaDeFora = (nome, mexe = () => {}) => deFora(nome, 'origin/main', mexe);

  /** Um save no editor de uma loja que já existe: o commit do bot, feito de fora. */
  const naLojaDeFora = (nome, mexe) => deFora(nome, `origin/loja/${nome}`, mexe);

  /** Uma loja sem ancestral comum com a main: faz o git falhar no meio da propagação. */
  const criaLojaOrfa = (nome) => {
    deFora('rascunho', 'origin/main', () => {});
    f('checkout', '-q', '--orphan', `loja/${nome}`);
    f('rm', '-rqf', '.');
    fs.writeFileSync(path.join(fora, 'LEIAME'), 'sem história em comum\n');
    f('add', '-A');
    f('commit', '-qm', 'órfã');
    f('push', '-q', 'origin', `loja/${nome}`);
    f('push', '-q', 'origin', '--delete', 'loja/rascunho');
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

  return { cwd, g, escreve, le, commit, criaLoja, criaLojaDeFora, naLojaDeFora, criaLojaOrfa, naMain, doRemoto };
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
    // As duas lojas nascem em outro clone: este só as conhece se o `validar`
    // buscar. É o caso do CI, onde quem escreve na `loja/*` é o bot.
    const repo = repositorio();
    repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
    repo.criaLojaDeFora('moda');
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

    expect(validarLojas({ cwd: repo.cwd })).toEqual([{ loja: 'loja/bebe', problemas: [], antigos: [] }]);
  });

  it('problema que a loja JÁ tinha não reprova o PR que não o causou — vira aviso', () => {
    // O caso da revisão do #169: uma chave órfã no settings_data de uma loja
    // reprovava qualquer PR, até um que só mexe no README.
    const repo = repositorio();
    repo.criaLojaDeFora('bebe', (escreve) =>
      escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1200, largura_antiga: 1 } }))
    );
    repo.escreve('README.md', 'só o README mudou\n');
    buscar({ cwd: repo.cwd });

    const [resultado] = validarLojas({ cwd: repo.cwd });

    expect(resultado.problemas).toEqual([]);
    expect(resultado.antigos.map((p) => p.code)).toEqual(['missing-global-setting:largura_antiga']);
  });

  it('com o problema antigo presente, o que o PR quebra continua reprovando', () => {
    const repo = repositorio();
    repo.criaLojaDeFora('bebe', (escreve) =>
      escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1200, largura_antiga: 1 } }))
    );
    repo.escreve('sections/rich-text.liquid', SECTION(['titulo']));
    buscar({ cwd: repo.cwd });

    const [resultado] = validarLojas({ cwd: repo.cwd });

    expect(resultado.problemas.map((p) => p.code)).toEqual(['missing-setting:rich-text.heading']);
    expect(resultado.antigos.map((p) => p.code)).toEqual(['missing-global-setting:largura_antiga']);
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

  it('o caso da Elizabeth: o conteúdo que a loja nunca mexeu também é dela', () => {
    // ADR 0019. A loja herdou o `settings_data.json` e o `index.json` de
    // quando a main ERA ela, e só mexeu num locale. A main fica neutra (a fase
    // 3 da #168), e a loja no ar não pode receber a home e as cores neutras.
    const repo = repositorio();
    repo.criaLoja('elizabeth', () => repo.escreve('locales/pt-BR.json', LOCALE('COMPRAR')));
    repo.naMain(() => {
      repo.escreve('templates/index.json', HOME('Neutra'));
      repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1600 } }));
      repo.escreve('snippets/preco.liquid', 'preço v2\n');
    });
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('atualizada');
    expect(repo.doRemoto('loja/elizabeth', 'templates/index.json')).toBe(HOME('Moda'));
    expect(repo.doRemoto('loja/elizabeth', 'config/settings_data.json')).toBe(
      JSON.stringify({ current: { page_width: 1200 } })
    );
    // O código chega, e o valor do locale que a loja mudou continua o dela.
    expect(repo.doRemoto('loja/elizabeth', 'snippets/preco.liquid')).toBe('preço v2\n');
    expect(repo.doRemoto('loja/elizabeth', 'locales/pt-BR.json')).toBe(LOCALE('COMPRAR'));
  });

  it('o template que só a main tem chega à loja', () => {
    // A única porta pela qual conteúdo da main entra numa loja que já existe.
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() => repo.escreve('templates/page.faq.json', HOME('Perguntas')));
    buscar({ cwd: repo.cwd });

    propagar({ cwd: repo.cwd });

    expect(repo.doRemoto('loja/bebe', 'templates/page.faq.json')).toBe(HOME('Perguntas'));
  });

  it('o template que a loja apagou continua apagado, mesmo que a main o mude', () => {
    const repo = repositorio();
    repo.escreve('templates/page.antiga.json', HOME('Antiga'));
    repo.commit('página antiga');
    repo.g('push', '-q', 'origin', 'main');
    repo.criaLoja('bebe', () => fs.rmSync(path.join(repo.cwd, 'templates/page.antiga.json')));
    repo.naMain(() => repo.escreve('templates/page.antiga.json', HOME('Antiga, revista')));
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('atualizada');
    expect(() => repo.doRemoto('loja/bebe', 'templates/page.antiga.json')).toThrow();
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

  it('um ERRO do git numa loja não derruba as outras', () => {
    // A revisão do #169: sem ancestral comum, o `merge-base` lança, e a
    // primeira versão deixava a exceção sair do laço.
    const repo = repositorio();
    repo.criaLojaOrfa('a-orfa');
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    const resultados = propagar({ cwd: repo.cwd });

    expect(resultados.map((r) => [r.loja, r.estado])).toEqual([
      ['loja/a-orfa', 'falhou'],
      ['loja/bebe', 'atualizada'],
    ]);
    expect(resultados[0].motivo).toContain('erro inesperado do git');
    expect(repo.g('status', '--porcelain')).toBe('');
  });

  it('problema de conteúdo que a loja JÁ tinha não a trava, e vira aviso', () => {
    // Travar por ele deixaria a loja parada sem nada que a main pudesse fazer.
    const repo = repositorio();
    repo.criaLoja('bebe', () =>
      repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1200, largura_antiga: 1 } }))
    );
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('atualizada');
    expect(resultado.avisos.map((p) => p.code)).toEqual(['missing-global-setting:largura_antiga']);
    expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v2\n');
  });

  it('REPROVA a main que tira um bloco que a loja usa, não empurra, e diz como sair', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(() =>
      repo.escreve(
        'sections/rich-text.liquid',
        SECTION(['heading']).replace(/"blocks":\[[^\]]*\]\}\]/, '"blocks":[]')
      )
    );
    buscar({ cwd: repo.cwd });

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('falhou');
    expect(resultado.problemas.map((p) => p.code)).toEqual(['missing-block:rich-text/text']);
    expect(resultado.motivo).toContain(COMO_CORRIGIR_O_CONTEUDO);
    expect(repo.doRemoto('loja/bebe', 'sections/rich-text.liquid')).toBe(SECTION(['heading']));
  });

  it('o push recusado porque a loja andou culpa a corrida com o editor, com motivo', () => {
    const repo = repositorio();
    repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
    buscar({ cwd: repo.cwd });
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    // A lojista salva no editor depois da busca: o ref local fica para trás.
    repo.naLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços e cômodas')));

    const [resultado] = propagar({ cwd: repo.cwd });

    expect(resultado.estado).toBe('falhou');
    expect(resultado.motivo).toContain('editor');
    expect(repo.doRemoto('loja/bebe', 'templates/index.json')).toBe(HOME('Berços e cômodas'));
  });
});

describe('o motivo do push recusado', () => {
  it('a recusa por workflow aponta o LOJAS_TOKEN, e não a lojista', () => {
    // O texto que o GitHub devolve ao GITHUB_TOKEN (comunidade, discussion #26164).
    const erro =
      ' ! [remote rejected] HEAD -> loja/bebe (refusing to allow a GitHub App to create or update ' +
      'workflow `.github/workflows/lojas.yml` without `workflows` permission)\n' +
      "error: failed to push some refs to 'https://github.com/x/y'";
    const motivo = motivoDoPushRecusado(erro);

    expect(motivo).toContain('LOJAS_TOKEN');
    expect(motivo).not.toContain('lojista');
  });

  it('a recusa por fast-forward é a corrida com o editor', () => {
    const erro = ' ! [rejected]        HEAD -> loja/bebe (fetch first)\nerror: failed to push some refs';
    expect(motivoDoPushRecusado(erro)).toContain('editor');
  });

  it('o resto mostra o que o git disse, em vez de adivinhar', () => {
    expect(motivoDoPushRecusado('fatal: could not read Username\n')).toContain('could not read Username');
  });
});

describe('a catraca dos problemas da loja', () => {
  it('só o que aparece depois e não estava antes', () => {
    const antigo = { arquivo: 'config/settings_data.json', code: 'missing-global-setting:x' };
    const novo = { arquivo: 'templates/index.json', code: 'missing-setting:rich-text.heading' };
    expect(problemasNovos([antigo, novo], [antigo])).toEqual([novo]);
  });
});

const AUTOR_DO_BOT = `${BOT_DA_SHOPIFY} <79544226+shopify[bot]@users.noreply.github.com>`;

describe('o bot na main, contra o git de verdade', () => {
  // A primeira versão procurava o bot no intervalo `antes..depois` do push, e
  // o `concurrency` do workflow cancela a execução PENDENTE: o intervalo dela
  // nunca era conferido. Agora a pergunta é o que ainda não chegou às lojas.

  it('o commit do bot que ainda não chegou à loja é achado, e só ele', () => {
    const repo = repositorio();
    repo.criaLoja('bebe');
    repo.naMain(
      () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
      AUTOR_DO_BOT
    );
    repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
    buscar({ cwd: repo.cwd });

    expect(commitsDoBotAPropagar({ cwd: repo.cwd, lojas: ['loja/bebe'] })).toHaveLength(1);
  });

  it('o commit do bot ANTERIOR à loja não é acusado — é o beac89f de hoje', () => {
    const repo = repositorio();
    repo.naMain(
      () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
      AUTOR_DO_BOT
    );
    repo.criaLoja('moda');
    buscar({ cwd: repo.cwd });

    expect(commitsDoBotAPropagar({ cwd: repo.cwd, lojas: ['loja/moda'] })).toEqual([]);
  });

  it('depois de propagado, o commit do bot deixa de ser acusado', () => {
    const repo = repositorio();
    repo.criaLoja('bebe', () => repo.escreve('templates/index.json', HOME('Berços')));
    repo.naMain(
      () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
      AUTOR_DO_BOT
    );
    buscar({ cwd: repo.cwd });
    propagar({ cwd: repo.cwd });
    buscar({ cwd: repo.cwd });

    expect(commitsDoBotAPropagar({ cwd: repo.cwd, lojas: ['loja/bebe'] })).toEqual([]);
  });

  it('acha o commit que falta a UMA das lojas, mesmo que a outra já o tenha', () => {
    const repo = repositorio();
    repo.criaLoja('a');
    repo.naMain(
      () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
      AUTOR_DO_BOT
    );
    repo.criaLoja('b');
    buscar({ cwd: repo.cwd });

    expect(commitsDoBotAPropagar({ cwd: repo.cwd, lojas: ['loja/a', 'loja/b'] })).toHaveLength(1);
  });
});

// ── A linha de comando, como processo ───────────────────────────────────────

describe('a CLI, executada como o CI a executa', () => {
  // A revisão do #169 mutou os códigos de saída e todos sobreviveram: os
  // testes acima chamam as funções, e o que o CI lê é o `exit` do processo.
  // Um `validar` devolvendo 0 com a loja quebrada deixaria o gate verde para
  // sempre. Aqui o script roda de verdade, com `--raiz` apontando o repo
  // temporário, sem variável `GIT_*` e sem o resumo do Actions.
  const SCRIPT = path.join(RAIZ, 'scripts/lojas.mjs');

  const cli = (repo, args, extra = {}) => {
    const env = { ...semGit, ...extra };
    delete env.GITHUB_STEP_SUMMARY;
    if (!('LOJAS_TOKEN' in extra)) delete env.LOJAS_TOKEN;
    const r = spawnSync(process.execPath, [SCRIPT, ...args, '--raiz', repo.cwd], { encoding: 'utf8', env });
    return { codigo: r.status, saida: `${r.stdout}${r.stderr}` };
  };

  describe('conferir', () => {
    it('sai 0 na loja que só mudou conteúdo', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      expect(cli(repo, ['conferir', '--loja', 'origin/loja/bebe']).codigo).toBe(0);
    });

    it('sai 1 na loja que mudou código, e diz qual arquivo', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('snippets/preco.liquid', 'preço da loja\n'));
      const { codigo, saida } = cli(repo, ['conferir', '--loja', 'origin/loja/bebe']);

      expect(codigo).toBe(1);
      expect(saida).toContain('snippets/preco.liquid');
    });

    it('erro inesperado do git sai 1 com o motivo, e não com um stack trace', () => {
      const repo = repositorio();
      const { codigo, saida } = cli(repo, ['conferir', '--loja', 'origin/loja/nao-existe']);

      expect(codigo).toBe(1);
      expect(saida).toContain('lojas conferir:');
      expect(saida).not.toMatch(/\n\s+at /);
    });
  });

  describe('validar', () => {
    it('sem loja/* sai 0, e diz que não havia o que validar', () => {
      const repo = repositorio();
      const { codigo, saida } = cli(repo, ['validar']);

      expect(codigo).toBe(0);
      expect(saida).toContain('nenhuma loja/*');
    });

    it('sai 1 quando o código do PR quebra uma loja', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.escreve('sections/rich-text.liquid', SECTION(['titulo']));
      const { codigo, saida } = cli(repo, ['validar']);

      expect(codigo).toBe(1);
      expect(saida).toContain('loja/bebe');
    });

    it('sai 0 com um problema antigo da loja, e o mostra como aviso', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) =>
        escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1200, largura_antiga: 1 } }))
      );
      const { codigo, saida } = cli(repo, ['validar']);

      expect(codigo).toBe(0);
      expect(saida).toContain('Aviso');
      expect(saida).toContain('largura_antiga');
    });
  });

  describe('propagar', () => {
    it('busca sozinho a loja que o bot criou, leva a main e sai 0', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
      const { codigo, saida } = cli(repo, ['propagar']);

      expect(codigo).toBe(0);
      expect(saida).toContain('loja/bebe: atualizada');
      expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v2\n');
    });

    it('sai 1 quando uma loja falha, mesmo que a outra passe', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('a-quebrada', (escreve) => escreve('snippets/preco.liquid', 'preço da loja\n'));
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
      const { codigo, saida } = cli(repo, ['propagar']);

      expect(codigo).toBe(1);
      expect(saida).toContain('loja/a-quebrada: falhou');
      expect(saida).toContain('loja/bebe: atualizada');
    });

    it('sai 1 com commit do bot na main ainda não propagado, e propaga mesmo assim', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.naMain(
        () => repo.escreve('config/settings_data.json', JSON.stringify({ current: { page_width: 1400 } })),
        AUTOR_DO_BOT
      );
      const sha = repo.g('rev-parse', '--short=7', 'HEAD').trim();

      const primeira = cli(repo, ['propagar']);
      expect(primeira.codigo).toBe(1);
      expect(primeira.saida).toContain(sha);
      expect(primeira.saida).toContain('loja/bebe: atualizada');

      // Já propagado, o commit deixa de ser acusado: o aviso não fica preso.
      expect(cli(repo, ['propagar']).codigo).toBe(0);
    });

    it('com --exigir-token e sem LOJAS_TOKEN, sai 1 antes de tocar em qualquer loja', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));
      const { codigo, saida } = cli(repo, ['propagar', '--exigir-token']);

      expect(codigo).toBe(1);
      expect(saida).toContain('LOJAS_TOKEN');
      expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v1\n');
    });

    it('com --exigir-token e o LOJAS_TOKEN presente, propaga', () => {
      const repo = repositorio();
      repo.criaLojaDeFora('bebe', (escreve) => escreve('templates/index.json', HOME('Berços')));
      repo.naMain(() => repo.escreve('snippets/preco.liquid', 'preço v2\n'));

      expect(cli(repo, ['propagar', '--exigir-token'], { LOJAS_TOKEN: 'presente' }).codigo).toBe(0);
      expect(repo.doRemoto('loja/bebe', 'snippets/preco.liquid')).toBe('preço v2\n');
    });

    it('sem loja/* sai 0 mesmo com --exigir-token: antes da fase 2 não há o que empurrar', () => {
      const repo = repositorio();
      expect(cli(repo, ['propagar', '--exigir-token']).codigo).toBe(0);
    });
  });
});

describe('lojaDoCheckout: este checkout é de uma loja?', () => {
  // A regra `neutra` e os testes que leem o conteúdo do disco perguntam isso
  // antes de reprovar o conteúdo de uma loja por apontar a loja dela. A
  // revisão do #171 mostrou o custo de não perguntar: numa `loja/*`, o
  // `pre-commit` barrava até o conflito de locale resolvido à mão.
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'checkout-'));
  temporarios.push(raiz);
  const g = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', env: semGit, stdio: 'pipe' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'teste@exemplo');
  g('config', 'user.name', 'Teste');
  g('commit', '-q', '--allow-empty', '-m', 'tema');

  it('numa loja/*, devolve o nome dela', () => {
    g('checkout', '-q', '-B', 'loja/bebe');
    expect(lojaDoCheckout({ cwd: raiz })).toBe('loja/bebe');
  });

  it('na main, nenhuma', () => {
    g('checkout', '-q', 'main');
    expect(lojaDoCheckout({ cwd: raiz })).toBeNull();
  });

  it('um ramo com "loja" no meio do nome não é loja', () => {
    g('checkout', '-q', '-B', 'claude/loja/teste');
    expect(lojaDoCheckout({ cwd: raiz })).toBeNull();
    g('checkout', '-q', '-B', 'lojas/teste');
    expect(lojaDoCheckout({ cwd: raiz })).toBeNull();
  });

  it('HEAD destacado, como no checkout de PR do CI, não é loja', () => {
    g('checkout', '-q', 'loja/bebe');
    g('checkout', '-q', '--detach');
    expect(lojaDoCheckout({ cwd: raiz })).toBeNull();
  });

  it('fora de um repositório git, nenhuma, e sem lançar', () => {
    const solta = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-git-'));
    temporarios.push(solta);
    expect(lojaDoCheckout({ cwd: solta })).toBeNull();
  });
});
