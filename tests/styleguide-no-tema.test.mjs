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
 *   · elementos `position: fixed` vivem na VIEWPORT, não no documento, então
 *     caem onde o scroll deixar — o banner de cookies apareceu em cima do
 *     scheme-1, e o botão "voltar ao topo" saiu em `botoes` e `feedback` e não
 *     em `color-schemes`, diferença produzida só por scroll
 *   · a seção "Componentes reais" renderiza `collections.all.products.first`,
 *     então preço, título e imagem vêm da LOJA: uma promoção reprovaria um PR
 *     que não tocou em nada visual
 *
 * Cada um tem a sua forma de correção, e a forma importa mais que o elemento:
 *
 *   · o fixo é VARRIDO, não listado. Esconder por hook resolveu o banner e
 *     deixou passar o botão de topo, porque ninguém o listou. `ESCONDE_FIXOS`,
 *     em `e2e/styleguide.spec.mjs`, pergunta ao navegador quem é fixo.
 *   · a seção de catálogo simplesmente não é fotografada, e `FORA` diz isso
 *     com o motivo escrito ao lado.
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

describe('e nada de `position: fixed` entra na foto', () => {
  /**
   * ── O defeito que custou nove baselines ──────────────────────────────────
   *
   * A primeira versão escondia `[data-cookie-banner]` por CSS, um hook por
   * elemento. Resolveu o banner. Deixou passar `snippets/back-to-top.liquid`,
   * que é `fixed bottom-6 right-6` e ganha `is-visible` com `scrollY > 400`:
   * ele saiu em `botoes` e `feedback` e não em `color-schemes` — diferença
   * produzida inteiramente por scroll, não pelas seções.
   *
   * Quem viu foi uma pessoa, olhando as imagens antes de commitar. Nenhum
   * verificador viu, porque o verificador cobria a lista, e o problema era a
   * lista. Este arquivo já tinha registrado o mesmo padrão duas vezes (a
   * página que não existia no tema, a baseline que media outra página); a
   * correção certa nunca é acrescentar o item que faltou.
   *
   * Por isso os testes abaixo não citam elemento nenhum: eles exigem que a
   * varredura EXISTA, que ela rode ANTES das fotos, e que o spec confira o
   * próprio resultado. Elemento fixo novo passa a ser coberto sem ninguém
   * lembrar de nada — que é a regra deste repositório.
   */
  const spec = leia('e2e/styleguide.spec.mjs');

  it('o spec varre o que o NAVEGADOR resolve como fixo', () => {
    expect(
      spec,
      'sem perguntar ao navegador, a cobertura vira uma lista escrita à mão — ' +
        'e foi uma lista que deixou o botão de topo entrar em duas baselines'
    ).toMatch(/getComputedStyle\(\w+\)\.position === 'fixed'/);
  });

  it('a varredura roda ANTES do laço de fotos', () => {
    // Ordem é um defeito real e silencioso: varrer depois esconde os fixos
    // para ninguém, e o teste de presença acima passaria igual.
    const varre = spec.indexOf('page.evaluate(ESCONDE_FIXOS)');
    const fotografa = spec.indexOf('for (const secao of SECOES)');
    expect(varre, 'a varredura sumiu do corpo do teste').toBeGreaterThan(-1);
    expect(fotografa, 'o laço de fotos sumiu').toBeGreaterThan(-1);
    expect(varre, 'varrer depois de fotografar não esconde nada').toBeLessThan(fotografa);
  });

  it('o spec confere o próprio resultado, e reprova duro se sobrar fixo', () => {
    // A mesma ideia de `e2e/gate.spec.mjs`: o verificador é testado, não
    // acreditado. Sem esta conferência, uma varredura que parasse de casar
    // exibiria o mesmo silêncio de uma que funciona — e envenenaria as nove
    // baselines de uma vez.
    expect(spec).toMatch(/estilo\.position === 'fixed' && estilo\.display !== 'none'/);
    expect(
      spec,
      'a conferência precisa reprovar, não avisar: com fixo sobrando nenhuma ' +
        'foto da execução presta, então `soft` aqui seria mentira'
    ).toMatch(/expect\(\s*await page\.evaluate\(FIXOS_QUE_SOBRARAM\)/);
  });

  it('e ninguém voltou a esconder fixo por hook', () => {
    // Um `display:none` por `data-*` de volta no spec é o sintoma de que a
    // varredura parou de dar conta e alguém remendou o caso da vez — que é
    // como esta seção do arquivo nasceu.
    const porHook = spec.match(/\[data-[a-z-]+\][^`\n]*display\s*:\s*none/g) || [];
    expect(
      porHook,
      `${porHook.join(', ')} — esconder elemento a elemento é a lista que falhou; ` +
        'se a varredura não pegou, conserte a varredura'
    ).toEqual([]);
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
