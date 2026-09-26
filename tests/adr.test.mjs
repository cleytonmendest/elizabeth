// @vitest-environment node
/**
 * A checagem dos ADRs consegue reprovar?
 *
 * Mesma pergunta que `tests/catraca.test.mjs` faz, e pela mesma razão: a regra
 * "ADR é append-only, nunca se edita" viveu meses só no CLAUDE.md e foi
 * desobedecida sem ninguém notar — o commit `474f387` removeu 18 linhas do
 * ADR 0007. Um verificador que não pega ESSE caso não serve, então ele está
 * plantado aqui com os números reais.
 *
 * ── Por que metade deste arquivo roda git ──────────────────────────────────
 *
 * A primeira versão do verificador afirmava, em comentário, que `git diff` só
 * detecta rename com `-M`. Está errado — a detecção é ligada por padrão desde
 * a 2.9 —, e um `git mv` de ADR passou verde.
 *
 * O teste que eu tinha escrito para esse caso lia o comando e exigia a
 * ausência de `-M`: ele media a minha CRENÇA sobre o git, e por isso ficou
 * verde sobre o defeito. Premissa sobre ferramenta de terceiro não se verifica
 * lendo o próprio código — só rodando a ferramenta.
 *
 * Daí `repositorioDeMentira()`: um repo git temporário, com commits de
 * verdade, onde o rename é feito com `git mv` e o resultado do `git diff` é
 * lido como o script o lê. `node` como ambiente porque jsdom não precisa
 * existir aqui e custa tempo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARGUMENTOS, PASTA, avaliar, mudancasDoDiff } from '../scripts/adr.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('o veredito', () => {
  it('nada tocado passa', () => {
    expect(avaliar([]).ok).toBe(true);
  });

  it('ADR novo passa — é o caminho normal', () => {
    // Arquivo criado aparece com ZERO remoções, igual a um acréscimo. Os dois
    // são permitidos, então não há o que distinguir.
    expect(avaliar([{ arquivo: `${PASTA}0016-nova.md`, removidas: 0 }]).ok).toBe(true);
  });

  it('acrescentar texto a um ADR existente passa', () => {
    // O que a #121 fez com o ADR 0015: +22 −0.
    expect(avaliar([{ arquivo: `${PASTA}0015-x.md`, removidas: 0 }]).ok).toBe(true);
  });

  it('REPROVA o caso real: 18 linhas removidas do ADR 0007', () => {
    const { ok, mensagem } = avaliar([
      { arquivo: `${PASTA}0007-suite-de-navegador-contra-tema-empurrado.md`, removidas: 18 },
    ]);

    expect(ok).toBe(false);
    expect(mensagem).toContain('0007');
    expect(mensagem).toContain('18');
  });

  it('uma linha só já reprova — não há tolerância', () => {
    // Tolerância aqui seria o defeito da regressão visual da #104: uma folga
    // que absorve a mudança real e deixa o verificador mudo.
    expect(avaliar([{ arquivo: `${PASTA}0001-x.md`, removidas: 1 }]).ok).toBe(false);
  });

  it('apagar o ADR inteiro reprova, pelo mesmo caminho', () => {
    expect(avaliar([{ arquivo: `${PASTA}0003-x.md`, removidas: 140 }]).ok).toBe(false);
  });

  it('um ADR limpo não salva o outro que foi editado', () => {
    const { ok, mensagem } = avaliar([
      { arquivo: `${PASTA}0016-nova.md`, removidas: 0 },
      { arquivo: `${PASTA}0002-x.md`, removidas: 3 },
    ]);

    expect(ok).toBe(false);
    expect(mensagem).toContain('0002');
    expect(mensagem).not.toContain('0016');
  });

  it('a mensagem NOMEIA o caminho legítimo', () => {
    // O ponto inteiro. O commit que quebrou a regra era bem-intencionado —
    // corrigia uma afirmação refutada pela medição. Regra que só proíbe, sem
    // dizer para onde ir, é burlada pela primeira pessoa que precisa passar.
    const { mensagem } = avaliar([{ arquivo: `${PASTA}0007-x.md`, removidas: 18 }]);

    expect(mensagem).toContain('supersede');
    expect(mensagem, 'precisa dizer que acrescentar é permitido').toMatch(/[Aa]crescentar/);
    expect(mensagem, 'precisa avisar que renomear conta como apagar').toContain('Renomear');
  });
});

describe('a leitura do `git diff --numstat`', () => {
  const numstat = (linhas) => mudancasDoDiff(linhas.join('\n'));

  it('lê inserções e remoções na ordem que o git usa', () => {
    expect(numstat([`75\t18\t${PASTA}0007-x.md`])).toEqual([
      { arquivo: `${PASTA}0007-x.md`, removidas: 18 },
    ]);
  });

  it('ignora o que não é ADR', () => {
    // O `-- docs/adr/` do comando já filtra, mas a função é pura e pode ser
    // chamada com um diff inteiro. Confiar no chamador é como o defeito nasce.
    expect(numstat(['10\t5\tsections/header.liquid', `3\t0\t${PASTA}0016-x.md`])).toEqual([
      { arquivo: `${PASTA}0016-x.md`, removidas: 0 },
    ]);
  });

  it('arquivo binário (o `-` do git) conta como remoção, e reprova', () => {
    // `-` viraria NaN num Number(), e `NaN > 0` é false: passaria calado.
    const lido = numstat([`-\t-\t${PASTA}0016-x.md`]);
    expect(lido).toEqual([{ arquivo: `${PASTA}0016-x.md`, removidas: 1 }]);
    expect(avaliar(lido).ok).toBe(false);
  });

  it('diff vazio não explode', () => {
    expect(mudancasDoDiff('')).toEqual([]);
  });
});

describe('contra o git de verdade', () => {
  let repo;
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

  /** O que o script veria, rodando o MESMO comando neste repo de mentira. */
  const veredito = () => avaliar(mudancasDoDiff(git(...ARGUMENTOS('base'))));

  const escreve = (nome, texto) => {
    fs.mkdirSync(path.join(repo, PASTA), { recursive: true });
    fs.writeFileSync(path.join(repo, PASTA, nome), texto);
  };

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-'));
    git('init', '-q', '-b', 'base');
    git('config', 'user.email', 'teste@exemplo');
    git('config', 'user.name', 'Teste');
    escreve('0001-primeira.md', 'uma\nduas\ntrês\n');
    git('add', '-A');
    git('commit', '-qm', 'base');
    git('checkout', '-qb', 'trabalho');
  });

  afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

  /** Cada caso parte da base — senão o segundo mede o acúmulo do primeiro. */
  const doZero = (mexe) => {
    git('checkout', '-q', 'base');
    git('branch', '-qD', 'trabalho');
    git('checkout', '-qb', 'trabalho');
    mexe();
    git('add', '-A');
    git('commit', '-qm', 'mudança');
    return veredito();
  };

  it('ADR novo passa', () => {
    expect(doZero(() => escreve('0002-nova.md', 'conteúdo\n')).ok).toBe(true);
  });

  it('acrescentar ao fim passa', () => {
    expect(
      doZero(() => escreve('0001-primeira.md', 'uma\nduas\ntrês\nquatro\n')).ok
    ).toBe(true);
  });

  it('reescrever uma linha reprova', () => {
    const { ok, mensagem } = doZero(() => escreve('0001-primeira.md', 'uma\nDUAS\ntrês\n'));
    expect(ok).toBe(false);
    expect(mensagem).toContain('0001-primeira.md');
  });

  it('`git mv` REPROVA — é o caso em que eu errei', () => {
    // Sem `--no-renames` isto passava verde, reportado como "só com
    // acréscimo", porque a detecção de rename do git é ligada por padrão.
    // Este teste roda `git mv` de verdade: se alguém tirar a flag, ele fica
    // vermelho, e nenhuma releitura de comentário é necessária.
    const { ok, mensagem } = doZero(() =>
      git('mv', `${PASTA}0001-primeira.md`, `${PASTA}0001-outro-nome.md`)
    );
    expect(ok, 'renomear ADR quebra os links que apontam para ele').toBe(false);
    expect(mensagem).toContain('0001-primeira.md');
  });

  it('apagar o arquivo reprova', () => {
    const { ok } = doZero(() => fs.rmSync(path.join(repo, PASTA, '0001-primeira.md')));
    expect(ok).toBe(false);
  });

  it('mexer fora de docs/adr/ não é assunto desta checagem', () => {
    const { ok } = doZero(() => {
      fs.writeFileSync(path.join(repo, 'outro.md'), 'nada a ver\n');
      escreve('0001-primeira.md', 'uma\nduas\ntrês\n');
    });
    expect(ok).toBe(true);
  });
});

describe('os ADRs do repositório', () => {
  it('todos numerados em sequência, sem buraco nem repetido', () => {
    // O número é a identidade de um ADR, e é assim que os outros o citam. Dois
    // com o mesmo número, ou um pulo, faz "ver ADR 0009" apontar para o lugar
    // errado ou para nada.
    const numeros = fs
      .readdirSync(path.join(RAIZ, PASTA))
      .filter((f) => /^\d{4}-.*\.md$/.test(f))
      .map((f) => Number(f.slice(0, 4)))
      .sort((a, b) => a - b);

    expect(numeros.length).toBeGreaterThan(0);
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));
  });
});
