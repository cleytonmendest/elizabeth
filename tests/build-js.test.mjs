// @vitest-environment node
//
// Ambiente `node` e não jsdom: o esbuild se recusa a rodar sob jsdom, cujo
// TextEncoder devolve um Uint8Array de outro realm. Não é perda nenhuma —
// aqui não se exercita componente, se exercita o gerador.

/**
 * O JS servido é gerado, e o gerador faz o que promete?
 *
 * A #96 tirou o JS de `assets/` e o pôs em `src/js/`, deixando `assets/*.js`
 * como artefato — o mesmo arranjo que `src/tailwind.css` → `application.css`
 * já tinha. A troca compra 32 KB em toda página e cria três jeitos NOVOS de o
 * tema quebrar em silêncio:
 *
 *   1. o gerador para de minificar (devolve o fonte) e ninguém nota, porque
 *      tudo continua funcionando — só que pesando o dobro;
 *   2. alguém escreve `assets/novo.js` à mão, o tema funciona, e aquele
 *      arquivo simplesmente nunca é minificado;
 *   3. o alvo do esbuild afrouxa e a loja passa a servir sintaxe que os
 *      navegadores exigidos pela Shopify não entendem.
 *
 * Nenhum dos três aparece como erro em lugar nenhum: os três aparecem como
 * "está tudo verde". É o que estes testes existem para impedir.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { VENDORIZADOS, fontes, minifica, orfaos, ROOT } from '../scripts/build-js.mjs';
import { jsDesatualizado } from '../scripts/lint/rules/build.mjs';

const parseFalha = (src) => {
  try {
    acorn.parse(src, { ecmaVersion: 2019 });
    return false;
  } catch {
    return true;
  }
};

const lerFonte = (nome) => fs.readFileSync(path.join(ROOT, 'src', 'js', nome), 'utf8');

describe('o gerador minifica de verdade', () => {
  it('encolhe todo arquivo de src/js/', () => {
    const teimosos = fontes().filter((nome) => minifica(nome).length >= lerFonte(nome).length);

    // Um arquivo que não encolhe não é crime — é sinal de que o gerador
    // devolveu o fonte. Que é o defeito nº 1, e ele passa despercebido
    // justamente porque o tema continua funcionando.
    expect(teimosos).toEqual([]);
  });

  it('o conjunto inteiro encolhe pelo menos 40%', () => {
    const antes = fontes().reduce((s, n) => s + lerFonte(n).length, 0);
    const depois = fontes().reduce((s, n) => s + minifica(n).length, 0);

    expect(depois / antes).toBeLessThan(0.6);
  });

  it('é determinístico — mesma entrada, mesmos bytes', () => {
    // A regra de lint `build` compara byte a byte contra o que está commitado.
    // Se o esbuild variasse entre execuções, ela acusaria "desatualizado" em
    // árvore limpa, e a primeira reação de qualquer pessoa seria desligá-la.
    for (const nome of fontes()) expect(minifica(nome)).toBe(minifica(nome));
  });
});

describe('o que a loja recebe continua sendo um script clássico', () => {
  it('preserva os nomes de topo que os testes carregam', () => {
    // `tests/helpers/load-asset.mjs` pede nomes declarados no topo e falha
    // alto se não os achar. Isso só funciona porque o esbuild não renomeia
    // declaração de topo em script não-empacotado (ela pode ser global).
    // Se algum dia passarmos a empacotar, estes nomes somem e a suíte inteira
    // cai de uma vez — o que é o comportamento certo, mas o motivo precisa
    // estar escrito em algum lugar. É aqui.
    expect(minifica('money.js')).toContain('formatMoney');
    expect(minifica('cart.js')).toContain('AddToCart');
  });

  it('não empacota: nada de import/export no que é servido', () => {
    for (const nome of fontes()) {
      expect(minifica(nome)).not.toMatch(/\bexport\s*[{*]|\bimport\s*[{*]/);
    }
  });

  it('não serve sintaxe mais nova que o alvo', () => {
    // Quem decide isto é um parser travado em ES2019, e não uma busca por
    // texto. A primeira versão deste teste procurava `?.` com regex e ficou
    // vermelha em `carousel-manager.js` por causa de `cond ? .28 : 0` — um
    // ternário com um número que começa em ponto, que o minificador encosta
    // num `?`. O defeito estava na pergunta: "parece encadeamento opcional"
    // não é a mesma coisa que "é sintaxe que o alvo não aceita".
    const parseComoES2019 = (src) => {
      try {
        acorn.parse(src, { ecmaVersion: 2019 });
        return null;
      } catch (error) {
        return error.message;
      }
    };

    for (const nome of fontes()) {
      expect(parseComoES2019(minifica(nome)), `assets/${nome}`).toBeNull();
    }
  });

  it('e o alvo está mesmo fazendo trabalho', () => {
    // Sem isto, o teste acima ficaria verde para sempre no dia em que o fonte
    // deixasse de usar sintaxe nova — verde por não ter mais o que provar, que
    // é indistinguível de verde por estar funcionando.
    const fonteModerna = fontes().filter((n) => parseFalha(lerFonte(n)));

    expect(fonteModerna.length, 'nenhum fonte usa sintaxe pós-ES2019').toBeGreaterThan(0);
  });
});

describe('nenhum assets/*.js entra sem fonte', () => {
  it('a árvore atual não tem órfão', () => {
    expect(orfaos()).toEqual([]);
  });

  it('o bundle de terceiro é declarado, não adivinhado', () => {
    // A alternativa seria um padrão `*.min.js`, que deixaria qualquer arquivo
    // entrar bastando o nome terminar certo.
    expect(Object.keys(VENDORIZADOS)).toContain('swiper-bundle.min.js');
  });

  it('todo vendorizado traz o motivo escrito', () => {
    // Mesma disciplina de `design-exceptions.json`: exceção sem justificativa
    // é exceção que ninguém revisa.
    for (const [nome, motivo] of Object.entries(VENDORIZADOS)) {
      expect(motivo, `${nome} sem motivo`).toBeTruthy();
      expect(motivo.length, `${nome}: o motivo é curto demais para ser um motivo`).toBeGreaterThan(30);
    }
  });

  it('todo vendorizado declarado existe mesmo em assets/', () => {
    // Entrada que sobrevive à remoção do arquivo vira permissão órfã: ela
    // continua autorizando um nome que ninguém mais usa.
    for (const nome of Object.keys(VENDORIZADOS)) {
      expect(fs.existsSync(path.join(ROOT, 'assets', nome)), `${nome} declarado e ausente`).toBe(true);
    }
  });
});

describe('o fonte não é servido', () => {
  it('src/ está no .shopifyignore', () => {
    // É o que faz a loja receber só o minificado. Sem esta linha, `src/js/`
    // sobe junto e o ganho da #96 vira um diretório a mais no tema.
    const ignore = fs.readFileSync(path.join(ROOT, '.shopifyignore'), 'utf8');
    expect(ignore.split('\n').map((l) => l.trim())).toContain('src/');
  });
});

/**
 * A regra de lint que trava o artefato velho.
 *
 * Ela recebe as dependências por parâmetro (mesmo arranjo de `fontesGlobais`
 * em `budget.mjs`) para poder ser exercitada contra um disco de mentira. A
 * alternativa seria sujar `assets/` durante o teste — e um teste que escreve
 * no artefato que os OUTROS testes leem é um teste que os faz oscilar.
 */
describe('a regra build reprova artefato fora de sincronia', () => {
  const discoDe = (arquivos) => (f) => arquivos[f] ?? '';

  it('pega o artefato que ficou para trás', () => {
    const o = jsDesatualizado({
      listar: () => ['cart.js'],
      gerar: () => 'programa novo',
      semFonte: () => [],
      ler: discoDe({ 'assets/cart.js': 'programa velho' }),
    });

    expect(o).toHaveLength(1);
    expect(o[0].code).toBe('stale');
  });

  it('pega a edição à mão no artefato — que some no build seguinte', () => {
    const o = jsDesatualizado({
      listar: () => ['cart.js'],
      gerar: () => 'programa',
      semFonte: () => [],
      ler: discoDe({ 'assets/cart.js': 'programa /* mexi aqui */' }),
    });

    expect(o).toHaveLength(1);
    expect(o[0].file).toBe('assets/cart.js');
  });

  it('pega o arquivo escrito direto em assets/, sem fonte', () => {
    const o = jsDesatualizado({
      listar: () => [],
      gerar: () => '',
      semFonte: () => ['novo.js'],
      ler: discoDe({}),
    });

    expect(o).toHaveLength(1);
    expect(o[0].code).toBe('sem-fonte');
  });

  it('e fica quieta quando os dois lados batem', () => {
    const o = jsDesatualizado({
      listar: () => ['cart.js'],
      gerar: () => 'programa',
      semFonte: () => [],
      ler: discoDe({ 'assets/cart.js': 'programa' }),
    });

    expect(o).toEqual([]);
  });
});
