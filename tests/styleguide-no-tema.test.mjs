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
 *   · o banner de cookies é `position: fixed`, e numa captura fullPage cai
 *     onde o scroll deixar — foi visto por uma pessoa, em cima do scheme-1
 *   · a seção "Componentes reais" renderiza `collections.all.products.first`,
 *     então preço, título e imagem vêm da LOJA: uma promoção reprovaria um PR
 *     que não tocou em nada visual
 *
 * Os dois são escondidos, não mascarados. `mask` do Playwright pinta por cima
 * sem tirar do fluxo: um título mais longo ainda deixaria o card mais alto e
 * deslocaria tudo abaixo, estourando a tolerância com a região já pintada.
 *
 * A pergunta a fazer antes de pôr qualquer coisa nova nesta página: **isto
 * muda quando o TEMA muda, ou quando a LOJA muda?** Se for a segunda, marque
 * com `data-amostra-de-catalogo` — senão a regressão visual vira alarme falso,
 * e alarme falso ensina o time a ignorar o vermelho.
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

describe('e as amostras de catálogo também não', () => {
  /**
   * A seção "Componentes reais" renderiza `collections.all.products.first` —
   * preço, título e imagem de um produto de VERDADE. Isso muda quando a loja
   * muda, não quando o tema muda: uma promoção reprovaria a baseline num PR
   * que não tocou em nada visual.
   *
   * Esconder, e não mascarar: `mask` pinta por cima sem tirar do fluxo, então
   * um título mais longo ainda deixaria o card mais alto e deslocaria a página
   * inteira abaixo dele.
   */
  const HOOK = 'data-amostra-de-catalogo';

  it(`o style guide marca as amostras com \`${HOOK}\``, () => {
    const section = leia('sections/main-styleguide.liquid');
    // Os dois blocos que usam `sample_product` — o `payment-icons` não leva a
    // marca de propósito, porque vem de settings e é estável.
    const marcados = section.split(`<div ${HOOK}>`).length - 1;
    expect(marcados, 'price-v2 e card-product-slider').toBe(2);
  });

  /**
   * Contar, e não parsear: a primeira versão deste teste dividia o markup por
   * `<div` e olhava até o primeiro `</div>`, o que quebra no aninhamento real
   * — o `card-product-slider` mora dentro de um `<div class="max-w-xs">`, e o
   * parser via um bloco não marcado onde havia um marcado por fora.
   *
   * A contagem pega o que importa: uma amostra nova de produto sem marca faz
   * os dois números divergirem.
   */
  it('toda amostra que recebe `sample_product` tem um bloco marcado', () => {
    const section = leia('sections/main-styleguide.liquid');
    const renders = (section.match(/\{%\s*render[^%]*sample_product/g) || []).length;
    const marcados = section.split(`<div ${HOOK}>`).length - 1;
    expect(renders, 'price-v2 e card-product-slider').toBe(2);
    expect(
      marcados,
      `${renders} render(s) usam sample_product, mas ${marcados} bloco(s) levam ${HOOK} — ` +
        'uma amostra de produto entraria na baseline e a traria o catálogo junto'
    ).toBe(renders);
  });

  it(`o teste de screenshot esconde \`${HOOK}\``, () => {
    const spec = leia('e2e/styleguide.spec.mjs');
    expect(spec).toMatch(/\[data-amostra-de-catalogo\][^`]*display\s*:\s*none/);
  });
});
