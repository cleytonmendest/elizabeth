// @vitest-environment node

/**
 * A tabela "O contrato dos eventos" do CLAUDE.md é o código, e não uma cópia.
 *
 * Até a #152 ela era uma cópia que ninguém conferia: listava 5 eventos quando
 * o JavaScript disparava 7, e não dizia onde nenhum deles circulava. A falta
 * da coluna de escopo não era detalhe — a galeria e o aviso de estoque da PDP
 * escutavam `variant:change` no `document`, onde a troca feita pela cliente
 * nunca chega (#157), e a tabela não tinha como avisar.
 *
 * Mesmo desenho de `tests/catraca.test.mjs`, que exige que o CLAUDE.md cite os
 * caminhos de `CATRACAS`: "esta linha é cópia dela" era um pedido, e pedido é
 * o que este repositório substitui por verificação.
 *
 * O que conta como disparo, lido de `src/js/`:
 *   - `x.dispatchEvent(new CustomEvent('nome'…))`, com o alvo `x`;
 *   - `publish(PUB_SUB_EVENTS.chave, …)`, que dispara no `document`;
 *   - `x.dispatchEvent(new CustomEvent(PUB_SUB_EVENTS.chave…))`.
 * Evento nativo (`new Event('change')`) não é contrato do tema e fica de fora.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');

const DOCUMENT = '`document`';
const PRODUTO = 'contexto do produto';

/** As linhas da tabela, na ordem em que aparecem. */
function tabela() {
  const linhas = ler('CLAUDE.md').split('\n');
  const titulo = linhas.findIndex((l) => l.startsWith('O contrato dos eventos'));
  const cabecalho = linhas.findIndex((l, i) => i > titulo && l.startsWith('| Evento |'));
  const linhasDaTabela = [];
  for (let i = cabecalho + 2; linhas[i]?.startsWith('|'); i += 1) linhasDaTabela.push(linhas[i]);

  return linhasDaTabela.map((linha) => {
    const [evento, circula, detail] = linha.split('|').slice(1, -1).map((c) => c.trim());
    return { evento: evento.replace(/`/g, ''), circula, detail };
  });
}

const PUB_SUB = Object.fromEntries(
  [...ler('src/js/cart.js').match(/const PUB_SUB_EVENTS = \{([^}]*)\}/)[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(
    ([, chave, nome]) => [chave, nome]
  )
);

/** evento → onde ele é disparado (`document`, contexto do produto, outro). */
function disparos() {
  const onde = new Map();
  const anota = (nome, lugar) => onde.set(nome, new Set([...(onde.get(nome) ?? []), lugar]));

  for (const arquivo of fs.readdirSync(path.join(RAIZ, 'src/js')).filter((f) => f.endsWith('.js'))) {
    const fonte = ler(`src/js/${arquivo}`);

    for (const [, chave] of fonte.matchAll(/\bpublish\(\s*PUB_SUB_EVENTS\.(\w+)/g)) anota(PUB_SUB[chave], DOCUMENT);

    const disparo = /([\w.]+)\.dispatchEvent\(\s*new CustomEvent\(\s*(?:['"`]([^'"`]+)['"`]|PUB_SUB_EVENTS\.(\w+))/g;
    for (const [, alvo, literal, chave] of fonte.matchAll(disparo)) {
      const lugar = /productContext/.test(alvo) ? PRODUTO : alvo === 'document' ? DOCUMENT : 'outro';
      anota(literal ?? PUB_SUB[chave], lugar);
    }
  }
  return onde;
}

const LINHAS = tabela();
const DISPAROS = disparos();

describe('a tabela e o código dizem a mesma coisa', () => {
  it('todo evento que src/js/ dispara tem linha na tabela', () => {
    const naTabela = new Set(LINHAS.map((l) => l.evento));

    expect([...DISPAROS.keys()].filter((e) => !naTabela.has(e)).sort()).toEqual([]);
  });

  it('toda linha da tabela é um evento que src/js/ dispara', () => {
    expect(LINHAS.map((l) => l.evento).filter((e) => !DISPAROS.has(e))).toEqual([]);
  });

  it('a coluna "Circula em" diz onde cada evento é disparado', () => {
    const divergentes = LINHAS.filter(({ evento, circula }) =>
      [...(DISPAROS.get(evento) ?? [])].some((lugar) => lugar !== 'outro' && !circula.includes(lugar))
    ).map((l) => `${l.evento}: a tabela diz "${l.circula}", o código dispara em ${[...DISPAROS.get(l.evento)].join(' e ')}`);

    expect(divergentes).toEqual([]);
  });

  it('toda entrada de PUB_SUB_EVENTS é publicada — nome declarado e nunca disparado engana quem lê', () => {
    const disparados = new Set(DISPAROS.keys());

    expect(Object.values(PUB_SUB).filter((nome) => !disparados.has(nome))).toEqual([]);
  });
});

describe('a fronteira eventos-de-produto', () => {
  const { boundaries } = JSON.parse(ler('scripts/lint/config/boundaries.json'));
  const fronteira = boundaries.find((b) => b.capability === 'eventos-de-produto');
  const DO_PRODUTO = LINHAS.filter((l) => l.circula.includes(PRODUTO)).map((l) => l.evento);

  it('existe, e a tabela tem eventos de produto para ela vigiar', () => {
    expect(fronteira, 'a fronteira sumiu de boundaries.json').toBeDefined();
    expect(DO_PRODUTO.length).toBeGreaterThan(0);
  });

  it.each(DO_PRODUTO)('reprova %s escutado no document ou no window', (evento) => {
    const padrao = new RegExp(fronteira.pattern);

    expect(padrao.test(`document.addEventListener('${evento}', f)`)).toBe(true);
    expect(padrao.test(`window.addEventListener("${evento}", f)`)).toBe(true);
  });

  it.each(DO_PRODUTO)('deixa %s escutado no contexto do produto', (evento) => {
    const padrao = new RegExp(fronteira.pattern);

    expect(padrao.test(`this.productContext.addEventListener('${evento}', f)`)).toBe(false);
    expect(padrao.test(`contexto.addEventListener('${evento}', f)`)).toBe(false);
  });
});
