/**
 * A catraca consegue reprovar?
 *
 * Mesma pergunta que `tests/tema-de-teste.test.mjs` faz do script que escolhe
 * onde medir, e pela mesma
 * razão: a versão anterior desta lógica vivia em shell dentro do `ci.yml`,
 * comparava o total consigo mesma e passava sem verificar nada. Um verificador
 * que sempre passa é indistinguível de um que funciona — até o dia em que
 * alguém precisa dele.
 *
 * O que está plantado aqui são as quatro formas de burlar uma catraca:
 * regravar o baseline para cima, mentir no campo de total, apagar o arquivo, e
 * adicionar uma linha à mão para silenciar uma violação nova.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATRACAS, avaliar, tocouCobertura, fantasmas, presenca } from '../scripts/catraca.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const porNome = (nome) => CATRACAS.find((c) => c.nome === nome);

describe('o veredito da catraca', () => {
  it('encolher passa', () => {
    expect(avaliar({ nome: 'lint', base: 341, atual: 340 }).ok).toBe(true);
  });

  it('empatar passa — a dívida não precisa cair em todo PR', () => {
    expect(avaliar({ nome: 'lint', base: 341, atual: 341 }).ok).toBe(true);
  });

  it('crescer REPROVA', () => {
    const { ok, nivel, mensagem } = avaliar({
      nome: 'lint',
      base: 341,
      atual: 342,
      comoRegravar: 'npm run lint:baseline',
    });

    expect(ok).toBe(false);
    expect(nivel).toBe('cresceu');
    // O recado carrega os dois números: sem eles quem lê o log do CI não sabe
    // se cresceu 1 ou 80, e a diferença muda o que fazer.
    expect(mensagem).toContain('341');
    expect(mensagem).toContain('342');
  });

  it('crescer com o verificador mudado no diff é cobertura nova, não dívida', () => {
    const { ok, nivel } = avaliar({ nome: 'lint', base: 341, atual: 400, cobertura: true });

    expect(ok).toBe(true);
    expect(nivel).toBe('cobertura');
  });

  it('a exceção de cobertura NÃO vale quando o verificador não mudou', () => {
    expect(avaliar({ nome: 'lint', base: 341, atual: 400, cobertura: false }).ok).toBe(false);
  });
});

describe('o que legitima crescer', () => {
  it('uma regra nova em scripts/lint/rules/ conta', () => {
    expect(tocouCobertura(['scripts/lint/rules/nova.mjs'], porNome('lint').cobertura)).toBe(true);
  });

  it('mexer no tema NÃO conta', () => {
    expect(
      tocouCobertura(['sections/header.liquid', 'assets/cart.js'], porNome('lint').cobertura)
    ).toBe(false);
  });

  it('um caminho que só PARECE o do verificador não conta', () => {
    // Sem a barra final, 'scripts/lint/rules' casaria com isto e daria a
    // qualquer PR uma licença para crescer o baseline.
    expect(tocouCobertura(['scripts/lint/rules-antigas/x.mjs'], porNome('lint').cobertura)).toBe(
      false
    );
  });

  it('o verificador de a11y é arquivo exato, não diretório', () => {
    const { cobertura } = porNome('a11y');
    expect(tocouCobertura(['e2e/helpers/axe.mjs'], cobertura)).toBe(true);
    expect(tocouCobertura(['e2e/fluxos.spec.mjs'], cobertura)).toBe(false);
  });

  it('lista vazia de mudanças nunca libera', () => {
    expect(tocouCobertura([], porNome('lint').cobertura)).toBe(false);
  });
});

describe('o total é contado, não lido', () => {
  it('lint: um "total" editado à mão não engana a contagem', () => {
    // Exatamente o buraco da versão em shell, que fazia
    // `require(...).total` e acreditava no número.
    const mentiroso = { total: 0, fingerprints: ['tokens|a.liquid|x', 'i18n|b.liquid|y'] };
    expect(porNome('lint').contar(mentiroso)).toBe(2);
  });

  it('a11y: idem para "_total"', () => {
    const mentiroso = { _total: 0, violacoes: { 'home|color-contrast': '3 nós', 'busca|label': '1 nó' } };
    expect(porNome('a11y').contar(mentiroso)).toBe(2);
  });

  it('baseline vazio conta zero em vez de explodir', () => {
    expect(porNome('lint').contar({})).toBe(0);
    expect(porNome('a11y').contar({})).toBe(0);
  });
});

describe('as duas catracas estão armadas', () => {
  // Este bloco existe porque a a11y passou meses com metade da regra: o teste
  // reprovava violação nova, mas nada impedia o baseline de crescer. Uma
  // entrada removida daqui reabriria exatamente esse buraco, em silêncio.
  it('lint e a11y, as duas', () => {
    expect(CATRACAS.map((c) => c.nome).sort()).toEqual(['a11y', 'lint']);
  });

  it('cada arquivo travado existe de verdade no repositório', () => {
    // Renomear um baseline sem atualizar esta lista desarmaria a catraca dele
    // sem nenhum sintoma: `git show` falharia, o script trataria como
    // "baseline novo" e passaria.
    for (const { nome, arquivo } of CATRACAS) {
      expect(fs.existsSync(path.join(RAIZ, arquivo)), `${nome}: ${arquivo}`).toBe(true);
    }
  });

  it('cada catraca sabe dizer como se regrava', () => {
    for (const { comoRegravar } of CATRACAS) {
      expect(comoRegravar).toMatch(/^npm run /);
    }
  });
});

describe('a tabela de presença — antes de comparar, há o que comparar?', () => {
  const caso = (extra) => presenca({ nome: 'lint', arquivo: 'x.json', baseRef: 'main', ...extra });

  it('existe nos dois lados → compara os totais', () => {
    expect(caso({ naBase: true, aqui: true }).nivel).toBe('comparar');
  });

  it('não existe em lado nenhum → não há catraca ainda, e tudo bem', () => {
    const { ok, nivel } = caso({ naBase: false, aqui: false });
    expect(ok).toBe(true);
    expect(nivel).toBe('ausente');
  });

  it('APAGAR o baseline neste PR reprova', () => {
    // O jeito mais barato de fazer a catraca sumir é apagar o número que ela
    // compara. Sem esta linha, o script leria "sem baseline aqui" e passaria.
    const { ok, nivel } = caso({ naBase: true, aqui: false });
    expect(ok).toBe(false);
    expect(nivel).toBe('sumiu');
  });

  it('baseline que NASCE no PR passa como aviso', () => {
    const { ok, nivel } = caso({ naBase: false, aqui: true, adicionado: true });
    expect(ok).toBe(true);
    expect(nivel).toBe('novo');
  });

  it('existe aqui, não na base, e o diff não o adicionou → REPROVA', () => {
    // A linha que separa "nasceu agora" de "a base não é a que você pensa".
    // Confundi-las troca a catraca por um aviso exatamente quando ela sumiu:
    // é o mesmo defeito da versão em shell, que comparava o total consigo
    // mesmo porque `origin/main` não existia no runner.
    const { ok, nivel, mensagem } = caso({ naBase: false, aqui: true, adicionado: false });
    expect(ok).toBe(false);
    expect(nivel).toBe('basefalsa');
    expect(mensagem).toContain('origin/main');
  });
});

describe('fingerprint registrada que nenhuma regra produz', () => {
  it('aparece — é dívida paga sem regravar, ou linha plantada à mão', () => {
    const registradas = new Set(['tokens|a.liquid|x', 'i18n|b.liquid|y']);
    const presentes = new Set(['tokens|a.liquid|x']);

    expect(fantasmas(registradas, presentes)).toEqual(['i18n|b.liquid|y']);
  });

  it('baseline honesto não acusa nada', () => {
    const iguais = ['tokens|a.liquid|x', 'i18n|b.liquid|y'];
    expect(fantasmas(new Set(iguais), new Set(iguais))).toEqual([]);
  });

  it('violação nova NÃO é fantasma — quem reprova essa é o lint', () => {
    // Presente e não registrada é o outro lado da catraca. Confundir os dois
    // faria esta função reprovar todo PR que corrige nada.
    expect(fantasmas(new Set(), new Set(['tokens|novo.liquid|z']))).toEqual([]);
  });
});
