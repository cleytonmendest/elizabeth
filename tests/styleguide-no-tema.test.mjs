/**
 * O style guide chega ao tema que a suíte mede?
 *
 * ── O impasse que este teste registra ──────────────────────────────────────
 *
 * `.shopifyignore` tira `sections/main-styleguide.liquid` e
 * `templates/page.styleguide.json` do tema — a página é de desenvolvimento e
 * não faz parte do que a Theme Store recebe. Só que o CLI respeita esse
 * arquivo em TODO `theme push`, não só no de produção. O tema de
 * desenvolvimento que o CI empurra nascia sem a página, e
 * `e2e/styleguide.spec.mjs` fotografava o fallback de `page.json`: título,
 * conteúdo vazio, nenhum componente.
 *
 * A #74 chegou a ter uma baseline candidata assim — de uma página que não
 * existia no tema medido. Quem olhou a imagem foi uma pessoa; nenhum
 * verificador viu, porque o teste RODAVA e a falha era "baseline não existe",
 * que é a mensagem esperada. Duas idas ao admin depois, a causa era esta.
 *
 * ── Por que o teste é este, e não outro ────────────────────────────────────
 *
 * O certo seria medir o tema empurrado, mas isso precisa da loja. Então aqui
 * se verifica a única coisa verificável sem ela: que os dois workflows que
 * empurram tema desfazem as exclusões ANTES do push, e que o `.shopifyignore`
 * continua protegendo a produção.
 *
 * Quando a baseline visual existir, ela passa a ser o guard rail forte — a
 * página sumir do tema muda a imagem inteira. Este teste cobre a janela até
 * lá, e o caso de alguém mexer só num dos dois workflows.
 *
 * ── O que a baseline NÃO pode vigiar, e por quê ────────────────────────────
 *
 * Uma foto só serve de referência se o que ela mostra depender do TEMA. Dois
 * pedaços desta página não dependiam, e cada um mordeu de um jeito:
 *
 *   · o banner de cookies é `position: fixed`, e numa captura ele cai onde o
 *     scroll deixar — foi visto por uma pessoa, em cima do scheme-1
 *   · a seção "Componentes reais" renderiza `collections.all.products.first`,
 *     então preço, título e imagem vêm da LOJA: uma promoção reprovaria um PR
 *     que não tocou em nada visual
 *
 * O banner é escondido por CSS. A seção de catálogo é resolvida de outro jeito
 * desde que a foto passou a ser por SEÇÃO: ela simplesmente não é fotografada,
 * e `FORA`, em `e2e/styleguide.spec.mjs`, diz isso com o motivo escrito ao
 * lado. Esconder deixou de ser necessário — o que a foto não enquadra não
 * precisa sumir da página.
 *
 * A pergunta a fazer antes de pôr qualquer coisa nova nesta página: **isto
 * muda quando o TEMA muda, ou quando a LOJA muda?** Se for a segunda, a seção
 * vai para `FORA` — senão a regressão visual vira alarme falso, e alarme falso
 * ensina o time a ignorar o vermelho.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leia = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Os dois arquivos que o `.shopifyignore` tira e o CI precisa de volta. */
const EXCLUIDOS = ['sections/main-styleguide.liquid', 'templates/page.styleguide.json'];

/** Todo workflow que empurra tema de desenvolvimento. */
const EMPURRAM = ['.github/workflows/ci.yml', '.github/workflows/preview.yml'];

describe('o `.shopifyignore` continua protegendo a produção', () => {
  for (const alvo of EXCLUIDOS) {
    it(`\`${alvo}\` segue excluído do tema publicado`, () => {
      const linhas = leia('.shopifyignore').split('\n').map((l) => l.trim());
      expect(
        linhas,
        'tirar isto do .shopifyignore mandaria a página de desenvolvimento para a Theme Store'
      ).toContain(alvo);
    });
  }
});

describe('mas o tema de DESENVOLVIMENTO recebe a página', () => {
  for (const workflow of EMPURRAM) {
    describe(workflow, () => {
      const fonte = leia(workflow);

      // O COMANDO, não a menção: `preview.yml` cita `shopify theme push
      // --help` num comentário, antes do comando de verdade, e um `indexOf`
      // ingênuo mede a partir dali — dando o trecho errado e reprovando um
      // workflow correto. É a mesma armadilha que o linter `templates` cobre
      // com `RENDERIZA_SECTION`, e aqui ela mordeu na primeira execução.
      const posPush = fonte.search(/^[^\S\n]*shopify theme push/m);

      it('empurra tema (senão esta lista está desatualizada)', () => {
        expect(posPush).toBeGreaterThan(-1);
      });

      for (const alvo of EXCLUIDOS) {
        it(`desfaz a exclusão de \`${alvo}\` antes do push`, () => {
          // O endereço do sed escapa `/` e `.` (`sections\/main-styleguide\.liquid`),
          // e a contagem de barras muda com a forma de escrever o comando.
          // Tirar as barras invertidas do trecho deixa o caminho igual ao
          // `alvo`, e o teste para de depender de como o sed foi escrito.
          const antes = fonte.slice(0, posPush).replace(/\\/g, '');
          expect(
            antes.includes('sed') && antes.includes(alvo),
            `sem isto, o tema empurrado nasce sem ${alvo} e a regressão visual ` +
              'mede o fallback de page.json em vez do style guide'
          ).toBe(true);
        });
      }
    });
  }
});

describe('e o banner de cookies não entra na foto', () => {
  /**
   * `snippets/cookie-banner.liquid` é `position: fixed`, e numa captura
   * `fullPage` a posição de um elemento fixo depende de scroll e timing — na
   * primeira execução com a página renderizando, ele saiu por cima do bloco
   * `scheme-1`, não no rodapé. `e2e/styleguide.spec.mjs` o esconde por CSS,
   * e esse CSS depende do atributo continuar existindo no markup.
   *
   * Renomear o hook não quebra nada visível: o CSS simplesmente deixa de
   * casar, o banner volta para a foto, e a baseline passa a reprovar por um
   * motivo que ninguém liga ao rename.
   */
  const HOOK = 'data-cookie-banner';

  it(`o snippet do banner expõe \`${HOOK}\``, () => {
    expect(leia('snippets/cookie-banner.liquid')).toContain(HOOK);
  });

  it(`o teste de screenshot esconde \`${HOOK}\``, () => {
    const spec = leia('e2e/styleguide.spec.mjs');
    expect(spec).toContain(HOOK);
    expect(spec, 'esconder, não só mencionar').toMatch(/\[data-cookie-banner\][^`]*display\s*:\s*none/);
  });
});

describe('e toda seção da página está numa das duas listas', () => {
  /**
   * A foto passou a ser por seção (uma baseline cada), e isso criou uma junta
   * nova: o markup marca as seções com `data-secao`, e `e2e/styleguide.spec.mjs`
   * decide quais entram na foto. As duas pontas podem divergir em silêncio.
   *
   * Divergir para MENOS é o caso perigoso: uma seção nova sem entrada em
   * `SECOES` não é fotografada, e nada fica vermelho — o componente entra no
   * tema sem vigilância nenhuma, exibindo exatamente o mesmo verde de quando
   * está tudo coberto. É o defeito da #74 outra vez, e é por isso que existe
   * `FORA`: "esqueceram de incluir" e "decidiram excluir" precisam ser
   * distinguíveis, e só o segundo carrega motivo escrito.
   *
   * Divergir para MAIS é o outro lado da catraca do lint: entrada que não
   * corresponde a nenhuma seção do markup vira baseline órfã, que nunca mais é
   * comparada e continua no repositório parecendo cobertura.
   */
  const spec = leia('e2e/styleguide.spec.mjs');
  const markup = leia('sections/main-styleguide.liquid');

  const NO_MARKUP = [...markup.matchAll(/data-secao="([^"]+)"/g)].map((m) => m[1]);

  const corpoDe = (re) => spec.match(re)?.[1] ?? '';
  const FOTOGRAFADAS = [...corpoDe(/const SECOES = \[([\s\S]*?)\];/).matchAll(/'([^']+)'/g)].map(
    (m) => m[1]
  );
  const bodyFora = corpoDe(/const FORA = \{([\s\S]*?)\n\};/);
  const EXCLUIDAS = [...bodyFora.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]);

  it('o spec ainda declara as duas listas (senão este teste mede o vazio)', () => {
    // Um regex que deixou de casar devolve lista vazia, e lista vazia passaria
    // calada em toda asserção de "está contida em". A checagem existe para que
    // renomear `SECOES` reprove aqui, e não vire cobertura fantasma.
    expect(FOTOGRAFADAS.length, 'nenhuma seção lida de SECOES').toBeGreaterThan(0);
    expect(EXCLUIDAS.length, 'nenhuma chave lida de FORA').toBeGreaterThan(0);
    expect(NO_MARKUP.length, 'nenhum data-secao no markup').toBeGreaterThan(0);
  });

  it('nenhuma seção do markup fica sem decisão', () => {
    const orfas = NO_MARKUP.filter(
      (s) => !FOTOGRAFADAS.includes(s) && !EXCLUIDAS.includes(s)
    );
    expect(
      orfas,
      `estas seções existem na página e ninguém decidiu sobre elas: ${orfas.join(', ')} — ` +
        'ponha em SECOES para fotografar, ou em FORA com o motivo'
    ).toEqual([]);
  });

  it('nenhuma entrada das listas aponta para seção que não existe mais', () => {
    const fantasmas = [...FOTOGRAFADAS, ...EXCLUIDAS].filter((s) => !NO_MARKUP.includes(s));
    expect(
      fantasmas,
      `${fantasmas.join(', ')} não está no markup — baseline órfã nunca mais é comparada ` +
        'e continua no repositório parecendo cobertura'
    ).toEqual([]);
  });

  it('uma seção não está nas duas listas ao mesmo tempo', () => {
    const ambas = FOTOGRAFADAS.filter((s) => EXCLUIDAS.includes(s));
    expect(ambas, `${ambas.join(', ')} está em SECOES e em FORA`).toEqual([]);
  });

  it('toda exclusão vem com motivo escrito', () => {
    // A mesma exigência que `design-exceptions.json` faz: exceção sem
    // justificativa é exceção que ninguém consegue revisar depois.
    for (const chave of EXCLUIDAS) {
      const inicio = bodyFora.indexOf(`'${chave}':`) + `'${chave}':`.length;
      const seguinte = EXCLUIDAS[EXCLUIDAS.indexOf(chave) + 1];
      const fim = seguinte ? bodyFora.indexOf(`'${seguinte}':`) : bodyFora.length;
      const motivo = bodyFora.slice(inicio, fim).replace(/[^\p{L}\s]/gu, '').trim();
      expect(motivo.length, `FORA['${chave}'] não explica por que a seção fica fora`).toBeGreaterThan(
        40
      );
    }
  });
});

describe('e as amostras de catálogo ficam fora da foto', () => {
  /**
   * `sample_product` é `collections.all.products.first` — um produto de
   * VERDADE. Toda seção que o renderiza depende da LOJA, não do tema: uma
   * promoção reprovaria a baseline num PR que não tocou em nada visual.
   *
   * O teste antigo marcava cada amostra com `data-amostra-de-catalogo` e exigia
   * que o CSS do spec a escondesse. Com a foto por seção isso ficou indireto
   * demais: o que importa não é o atributo, é que a seção onde a amostra mora
   * esteja em `FORA`. Mover um `render` de `price-v2` para a seção de botões
   * passava calado no teste antigo (a marca continuava lá) e traria o catálogo
   * para dentro de `botoes.png`.
   */
  const markup = leia('sections/main-styleguide.liquid');
  const spec = leia('e2e/styleguide.spec.mjs');
  const EXCLUIDAS = [
    ...(spec.match(/const FORA = \{([\s\S]*?)\n\};/)?.[1] ?? '').matchAll(/^\s*'([^']+)':/gm),
  ].map((m) => m[1]);

  /**
   * Fatiar por `<section data-secao=`, e não parsear `<div>`: a primeira
   * versão deste arquivo dividia por `<div` e olhava até o primeiro `</div>`,
   * o que quebra no aninhamento real. O corte por seção não tem esse problema
   * — `<section>` não aninha aqui, e o que interessa é só em qual delas cada
   * `render` caiu.
   */
  const fatias = markup.split(/<section data-secao="/).slice(1).map((t) => ({
    secao: t.slice(0, t.indexOf('"')),
    corpo: t,
  }));

  it('o corte por seção encontrou as seções (senão mede o vazio)', () => {
    expect(fatias.length).toBeGreaterThan(0);
  });

  it('todo `render` que recebe `sample_product` mora numa seção de `FORA`', () => {
    const usa = (corpo) => /\{%\s*render[^%]*sample_product/.test(corpo);
    const vazando = fatias.filter((f) => usa(f.corpo) && !EXCLUIDAS.includes(f.secao));
    expect(
      vazando.map((f) => f.secao),
      'estas seções renderizam um produto da loja E entram na foto — o catálogo ' +
        'passa a reprovar PRs que não mudaram nada visual'
    ).toEqual([]);
  });

  it('e nenhuma amostra escapou do corte', () => {
    // Se um `render` com `sample_product` aparecer fora de qualquer
    // `<section data-secao>`, o teste acima não o vê — e o silêncio dele seria
    // idêntico ao de tudo certo.
    const total = (markup.match(/\{%\s*render[^%]*sample_product/g) || []).length;
    const dentro = fatias.reduce(
      (n, f) => n + (f.corpo.match(/\{%\s*render[^%]*sample_product/g) || []).length,
      0
    );
    expect(dentro, `${total - dentro} render(s) de amostra fora de qualquer seção`).toBe(total);
    expect(total, 'price-v2 e card-product-slider').toBe(2);
  });
});
