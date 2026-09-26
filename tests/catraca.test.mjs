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
    expect(tocouCobertura(['scripts/lint/rules/nova.mjs'], porNome('lint').liberadoPor)).toBe(true);
  });

  it('mexer no tema NÃO conta', () => {
    expect(
      tocouCobertura(['sections/header.liquid', 'assets/cart.js'], porNome('lint').liberadoPor)
    ).toBe(false);
  });

  it('um caminho que só PARECE o do verificador não conta', () => {
    // Sem a barra final, 'scripts/lint/rules' casaria com isto e daria a
    // qualquer PR uma licença para crescer o baseline.
    expect(tocouCobertura(['scripts/lint/rules-antigas/x.mjs'], porNome('lint').liberadoPor)).toBe(
      false
    );
  });

  it('o verificador de a11y é arquivo exato, não diretório', () => {
    const { liberadoPor } = porNome('a11y');
    expect(tocouCobertura(['e2e/helpers/axe.mjs'], liberadoPor)).toBe(true);
    expect(tocouCobertura(['e2e/fluxos.spec.mjs'], liberadoPor)).toBe(false);
  });

  it('lista vazia de mudanças nunca libera', () => {
    expect(tocouCobertura([], porNome('lint').liberadoPor)).toBe(false);
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

describe('todas as catracas estão armadas', () => {
  // Este bloco existe porque a a11y passou meses com metade da regra: o teste
  // reprovava violação nova, mas nada impedia o baseline de crescer. Uma
  // entrada removida daqui reabriria exatamente esse buraco, em silêncio.
  it('lint, a11y e os dois eixos do orçamento', () => {
    expect(CATRACAS.map((c) => c.nome).sort()).toEqual(['a11y', 'lint', 'perf-css', 'perf-js']);
  });

  it('cada arquivo travado existe de verdade no repositório', () => {
    // Renomear um baseline sem atualizar esta lista desarmaria a catraca dele
    // sem nenhum sintoma: `git show` falharia, o script trataria como
    // "baseline novo" e passaria.
    for (const { nome, arquivo } of CATRACAS) {
      expect(fs.existsSync(path.join(RAIZ, arquivo)), `${nome}: ${arquivo}`).toBe(true);
    }
  });

  it('cada catraca sabe dizer como se muda o número', () => {
    // A asserção é por catraca, e não uma só para todas, porque os dois tipos
    // de arquivo se mudam de formas diferentes. Afrouxar para um `toBeTruthy()`
    // que aceitasse qualquer string cobriria os dois casos e nenhum bem.
    for (const nome of ['lint', 'a11y']) {
      expect(porNome(nome).comoRegravar, `${nome} é GERADO: o recado nomeia o comando`).toMatch(
        /^npm run /
      );
    }
    for (const nome of ['perf-js', 'perf-css']) {
      expect(
        porNome(nome).comoRegravar,
        `${nome} é escrito à mão: o recado nomeia o arquivo e o campo`
      ).toContain('perf-budget.json');
    }
  });

  /**
   * O teto tem dois eixos hoje. Se alguém acrescentar um terceiro a
   * `global` — fontes, imagens —, ele nasce DESTRAVADO e nada avisaria.
   *
   * Por isso a lista vem do arquivo, e não de duas strings escritas aqui.
   */
  it('todo eixo de `global` no perf-budget tem catraca', () => {
    const budget = JSON.parse(
      fs.readFileSync(path.join(RAIZ, 'scripts/lint/config/perf-budget.json'), 'utf8')
    );
    const travados = CATRACAS.map((c) => c.nome);

    for (const eixo of Object.keys(budget.global ?? {})) {
      expect(travados, `global.${eixo} não tem catraca`).toContain(`perf-${eixo}`);
    }
    expect(Object.keys(budget.global ?? {}).length).toBeGreaterThan(0);
  });
});

describe('o teto de performance, que é declarado e não medido', () => {
  const perf = (base, atual, cobertura = false) =>
    avaliar({ ...porNome('perf-js'), base, atual, cobertura });

  it('descer o teto passa — foi o que a #32 e a #96 fizeram', () => {
    expect(perf(62000, 34000).ok).toBe(true);
  });

  it('LEVANTAR o teto reprova, e é o buraco que a #128 fechou', () => {
    const { ok, nivel, mensagem } = perf(34000, 99000);

    expect(ok).toBe(false);
    expect(nivel).toBe('cresceu');
    expect(mensagem).toContain('34000');
    expect(mensagem).toContain('99000');
    // O recado não pode falar de "dívida" e "violação": aqui não há violação
    // para corrigir, há peso para reduzir. Vocabulário errado manda a pessoa
    // procurar a coisa errada.
    expect(mensagem).toContain('teto');
    expect(mensagem).not.toContain('Dívida');
  });

  it('levantar com `budget.mjs` no diff passa — é cobertura, como na #27 e na #117', () => {
    // As três vezes que o teto subiu foram a regra passando a enxergar peso que
    // sempre esteve lá. Sem esta válvula, fechar um ponto cego do orçamento
    // seria impossível sem desligar a catraca.
    expect(perf(29900, 32100, true).nivel).toBe('cobertura');
    expect(tocouCobertura(['scripts/lint/rules/budget.mjs'], porNome('perf-js').liberadoPor)).toBe(
      true
    );
  });

  it('mexer no tema não libera o teto', () => {
    expect(tocouCobertura(['sections/header.liquid'], porNome('perf-js').liberadoPor)).toBe(false);
  });

  it('os dois eixos são independentes: CSS a menos não paga JS a mais', () => {
    // Um `contar` que somasse os dois deixaria isto passar — 2 KB de JS a mais
    // escondidos atrás de 2 KB de CSS a menos. São dois downloads diferentes.
    const antes = { global: { js: 34000, css: 58000 } };
    const depois = { global: { js: 36000, css: 56000 } };

    const eixo = (nome, json) => porNome(nome).contar(json);

    expect(avaliar({ ...porNome('perf-js'), base: eixo('perf-js', antes), atual: eixo('perf-js', depois) }).ok).toBe(false);
    expect(avaliar({ ...porNome('perf-css'), base: eixo('perf-css', antes), atual: eixo('perf-css', depois) }).ok).toBe(true);
  });
});

describe('teto que deixa de ser número', () => {
  // `scripts/lint/rules/budget.mjs` faz `if (limit == null) continue`: sem a
  // chave, o eixo inteiro deixa de ser verificado. Um `?? 0` na contagem leria
  // isso como o teto tendo DESPENCADO e aprovaria o PR que desarmou a regra.
  it('a chave apagada conta como Infinity, não como zero', () => {
    expect(porNome('perf-js').contar({ global: { css: 58000 } })).toBe(Infinity);
    expect(porNome('perf-js').contar({})).toBe(Infinity);
  });

  it('e reprova', () => {
    const { ok, nivel, mensagem } = avaliar({ ...porNome('perf-js'), base: 34000, atual: Infinity });

    expect(ok).toBe(false);
    expect(nivel).toBe('semteto');
    expect(mensagem).toContain('desliga o eixo');
  });

  it('reprova MESMO com o verificador mudado no diff', () => {
    // A exceção de cobertura existe para dívida escondida virar visível.
    // Melhorar um verificador nunca produz um verificador desarmado, então esta
    // checagem fica ACIMA da válvula de escape, e não dentro dela.
    expect(avaliar({ ...porNome('perf-js'), base: 34000, atual: Infinity, cobertura: true }).ok).toBe(
      false
    );
  });

  it('número entre aspas também reprova, em vez de passar por coerção', () => {
    // `"34000" <= 34000` é true em JavaScript, e `total > "34000"` na regra
    // também coage. Funcionaria por acidente, que é pior que não funcionar.
    expect(porNome('perf-js').contar({ global: { js: '34000' } })).toBe(Infinity);
  });

  it('teto que NASCE no PR passa como aviso', () => {
    const { ok, nivel } = avaliar({ ...porNome('perf-js'), base: Infinity, atual: 34000 });
    expect(ok).toBe(true);
    expect(nivel).toBe('novo');
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

describe('o CLAUDE.md não pode divergir de CATRACAS', () => {
  /**
   * O parágrafo das exceções termina com "A lista que vale é a de `CATRACAS`
   * (…); esta linha é cópia dela." — uma cópia que ninguém conferia.
   *
   * Isso não é zelo com a prosa. O texto é o que alguém lê antes de mexer no
   * gate, e uma lista desatualizada ali faz a pessoa acreditar que um caminho
   * libera o crescimento quando não libera (ou o contrário). Foi assim que o
   * `ROADMAP.md` morreu, e o ADR 0001 existe por causa disso.
   */
  const claude = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8');

  it('cita todo caminho que libera crescimento', () => {
    for (const { nome, liberadoPor } of CATRACAS) {
      for (const caminho of liberadoPor) {
        expect(claude, `${nome}: ${caminho} não aparece no CLAUDE.md`).toContain(caminho);
      }
    }
  });

  it('não promete um caminho que CATRACAS não tem', () => {
    // A direção contrária. Sem ela, remover uma entrada de CATRACAS deixaria o
    // CLAUDE.md prometendo uma válvula de escape que não existe mais — e o
    // primeiro teste continuaria verde, porque ele só olha o que sobrou.
    const declarados = new Set(CATRACAS.flatMap((c) => c.liberadoPor));
    const citados = [...claude.matchAll(/`((?:scripts|e2e)\/[\w./-]+)`/g)].map((m) => m[1]);

    for (const caminho of citados) {
      if (!/rules\/|axe\.mjs|a11y\.spec\.mjs/.test(caminho)) continue;
      expect(declarados, `o CLAUDE.md cita ${caminho} como verificador, e CATRACAS não`).toContain(
        caminho
      );
    }
  });

  it('afirma a quantidade certa de catracas', () => {
    // O texto dizia "os **dois** baselines" e continuou dizendo depois de a
    // #128 acrescentar o terceiro e o quarto. Número em prosa é a forma mais
    // barata de mentira: ninguém relê o parágrafo ao editar a lista.
    const porExtenso = { 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis' };
    // Espaços normalizados antes de comparar: a frase atravessa a quebra de
    // linha do parágrafo, e um teste que casasse o `\n` exato ficaria vermelho
    // no dia em que alguém reembrulhasse o texto sem mudar o que ele afirma.
    const corrido = claude.replace(/\s+/g, ' ');
    expect(corrido, `deveria dizer "São ${porExtenso[CATRACAS.length]} catracas"`).toContain(
      `São ${porExtenso[CATRACAS.length]} catracas`
    );
  });
});
