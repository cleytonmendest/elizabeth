/**
 * O resumo sabe dizer o que NÃO rodou?
 *
 * A suíte de navegador tem quatro formas de não medir, e três delas já
 * apareciam no resumo do CI: falta de THEME_URL, falta de conta de cliente, e
 * a sessão da vitrine que não abriu. A quarta — o teste que se pula por conta
 * própria — não aparecia em lugar nenhum, e foi assim que a regressão visual
 * do style guide passou a existência inteira dela pulada, esperando um
 * artefato que só ela produziria (#74).
 *
 * O `relatorio` aqui é o JSON do reporter do Playwright, montado à mão. O que
 * está sob teste é a LEITURA dele: quais testes contam como não executados, e
 * como isso vira uma frase que alguém lê no resumo do run.
 */
import { describe, it, expect } from 'vitest';
import { pulos, resumoDePulos } from '../scripts/e2e.mjs';

const pulado = (tipo, motivo) => ({
  status: 'skipped',
  annotations: motivo === null ? [] : [{ type: tipo, description: motivo }],
});

const passou = () => ({ status: 'expected', annotations: [] });

const spec = (titulo, ...testes) => ({ title: titulo, tests: testes });

const relatorio = (...suites) => ({ suites });

describe('quem entra na conta', () => {
  it('agrupa os pulos que compartilham o motivo', () => {
    const r = relatorio({
      specs: [
        spec('a', pulado('skip', 'falta THEME_URL')),
        spec('b', pulado('skip', 'falta THEME_URL')),
      ],
    });

    expect(pulos(r)).toEqual([{ tipo: 'skip', motivo: 'falta THEME_URL', quantos: 2 }]);
  });

  it('separa fixme de skip, mesmo com o mesmo texto', () => {
    const r = relatorio({
      specs: [spec('a', pulado('skip', 'igual')), spec('b', pulado('fixme', 'igual'))],
    });

    expect(pulos(r)).toHaveLength(2);
    expect(pulos(r).map((g) => g.tipo).sort()).toEqual(['fixme', 'skip']);
  });

  // O contrário do defeito: um resumo que também contasse quem rodou diria
  // "23 testes não rodaram" numa execução em que todos rodaram, e a primeira
  // pessoa a ler isso aprenderia a ignorar o aviso.
  it('teste que rodou não entra', () => {
    const r = relatorio({ specs: [spec('a', passou()), spec('b', passou())] });
    expect(pulos(r)).toEqual([]);
  });

  it('desce em suíte aninhada — describe não esconde pulo', () => {
    const r = relatorio({
      specs: [],
      suites: [{ specs: [spec('dentro do describe', pulado('fixme', 'issue #64'))] }],
    });

    expect(pulos(r)).toEqual([{ tipo: 'fixme', motivo: 'issue #64', quantos: 1 }]);
  });

  it('pulo sem motivo escrito é nomeado, não some', () => {
    const r = relatorio({ specs: [spec('a', pulado('skip', null))] });
    expect(pulos(r)[0].motivo).toBe('(sem motivo escrito)');
  });

  it('o mais frequente vem primeiro', () => {
    const r = relatorio({
      specs: [
        spec('a', pulado('skip', 'raro')),
        spec('b', pulado('skip', 'comum')),
        spec('c', pulado('skip', 'comum')),
      ],
    });

    expect(pulos(r).map((g) => g.motivo)).toEqual(['comum', 'raro']);
  });

  it('relatório vazio ou ilegível não inventa pulo', () => {
    expect(pulos({})).toEqual([]);
    expect(pulos(undefined)).toEqual([]);
  });
});

describe('a frase que aparece no resumo do run', () => {
  it('execução sem pulo nenhum não gera aviso', () => {
    expect(resumoDePulos(relatorio({ specs: [spec('a', passou())] }))).toBeNull();
  });

  it('cita o total e cada motivo, com a contagem', () => {
    const r = relatorio({
      specs: [
        spec('a', pulado('skip', 'falta THEME_URL')),
        spec('b', pulado('skip', 'falta THEME_URL')),
        spec('c', pulado('fixme', 'issue #68 — id duplicado')),
      ],
    });

    const texto = resumoDePulos(r);

    expect(texto).toContain('3 testes não rodaram');
    expect(texto).toContain('2× [skip] falta THEME_URL');
    expect(texto).toContain('1× [fixme] issue #68 — id duplicado');
  });

  it('um teste só não vira "1 testes"', () => {
    const r = relatorio({ specs: [spec('a', pulado('skip', 'sozinho'))] });
    expect(resumoDePulos(r)).toContain('1 teste não rodou');
  });
});
