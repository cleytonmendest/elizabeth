/**
 * scripts/lint/config/boundaries.json — a fronteira vigia o que ela diz vigiar?
 *
 * A regra `boundaries` lê este arquivo e reprova quem toca uma capacidade
 * alheia. Ela não tem como perceber uma fronteira cujo PADRÃO não casa com
 * nada: o linter varre, não encontra ocorrência nenhuma, e reporta zero
 * violação — a mesma saída de uma fronteira respeitada. Um `\\.` a mais, um
 * nome de método renomeado no código e a guarda continua no arquivo,
 * anunciada no `npm run status`, sem vigiar coisa alguma.
 *
 * Foi por não ter este teste que a regra `remotes` nasceu verde com um regex
 * quebrado. Aqui a pergunta é feita ao contrário: o padrão de cada fronteira
 * precisa ENCONTRAR o código do dono dela. Se não encontra, ou o dono mudou ou
 * o padrão está errado — e nos dois casos a fronteira parou de valer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');

const { boundaries } = JSON.parse(ler('scripts/lint/config/boundaries.json'));

/** Os assets de JS do tema, sem o Swiper — código de terceiro não é do tema. */
const ASSETS_JS = fs
  .readdirSync(path.join(RAIZ, 'assets'))
  .filter((nome) => nome.endsWith('.js') && !nome.endsWith('.min.js'))
  .map((nome) => `assets/${nome}`)
  .sort();

describe('toda fronteira declarada', () => {
  it.each(boundaries.map((f) => [f.capability, f]))('%s: o padrão compila', (_nome, fronteira) => {
    expect(() => new RegExp(fronteira.pattern)).not.toThrow();
  });

  it.each(boundaries.filter((f) => f.owners?.length).map((f) => [f.capability, f]))(
    '%s: o padrão encontra o código do dono',
    (nome, fronteira) => {
      const padrao = new RegExp(fronteira.pattern);
      const donosQueCasam = fronteira.owners.filter((dono) => padrao.test(ler(dono)));

      expect(
        donosQueCasam,
        `A fronteira "${nome}" não casa com nenhum dos donos dela (${fronteira.owners.join(', ')}). ` +
          'Um padrão que não encontra nada reporta zero violação — igualzinho a uma fronteira respeitada.'
      ).not.toHaveLength(0);
    }
  );
});

describe('a fronteira money-format', () => {
  // O critério de aceite da issue #39: uma única implementação de formatação
  // de moeda em JS. O linter verifica isso lendo o JSON; este teste verifica
  // lendo o DIRETÓRIO — então ele continua valendo se a declaração sumir.
  const fronteira = boundaries.find((f) => f.capability === 'money-format');

  it('existe, e o dono é assets/money.js', () => {
    expect(fronteira, 'money-format não está declarada em boundaries.json').toBeTruthy();
    expect(fronteira.owners).toEqual(['assets/money.js']);
  });

  it('nenhum outro asset formata moeda por conta própria', () => {
    const padrao = new RegExp(fronteira.pattern);
    const formatadores = ASSETS_JS.filter((arquivo) => padrao.test(ler(arquivo)));

    expect(
      formatadores,
      'Havia três (cart.js, cart-extras.js, search-component.js) e elas discordavam ' +
        'sobre dividir por 100. Use formatMoney() de assets/money.js.'
    ).toEqual(['assets/money.js']);
  });
});
