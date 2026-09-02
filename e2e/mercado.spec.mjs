/**
 * O que só a loja de verdade responde.
 *
 * Três mudanças recentes têm em comum o fato de o Vitest não conseguir
 * verificá-las: elas dependem do que o Liquid resolve com dados da Shopify, e
 * em jsdom fui EU quem escreveu o markup. Cada uma virou "conferir no editor
 * depois", que é o mesmo que não conferir.
 *
 *   #35  A tipografia passou a vir do `font_picker`. Se um handle não
 *        existir na biblioteca (`work_sans_n4` e companhia), a Shopify devolve
 *        família VAZIA — e `--font-body-family: , sans-serif` não quebra a
 *        página, só faz a loja inteira cair no fallback do navegador. Nada
 *        na tela grita; o tema simplesmente parece outro.
 *
 *   #25  Os snippets de JSON-LD pararam de afirmar "BR" e "pt-BR". JSON-LD é
 *        invisível: uma vírgula errada ou um campo mentindo passa por toda
 *        revisão humana, porque ninguém lê `<script type="application/ld+json">`.
 *        O bloco de `contactPoint` virou condicional neste trabalho, que é
 *        exatamente o tipo de mudança que produz JSON inválido.
 *
 *   #33  As chaves de tradução do storefront. O linter garante que a chave
 *        EXISTE nos dois idiomas; só a página renderizada mostra "Translation
 *        missing" quando o nome usado no Liquid não é o nome que está lá.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

/** As variáveis que o `{% style %}` do layout gera a partir do font_picker. */
const FAMILIAS = ['--font-body-family', '--font-heading-family'];

test('a fonte escolhida existe: nenhuma família resolve para vazio', async ({ page }) => {
  await page.goto('/');

  const valores = await page.evaluate((nomes) => {
    const raiz = getComputedStyle(document.documentElement);
    return Object.fromEntries(nomes.map((n) => [n, raiz.getPropertyValue(n).trim()]));
  }, FAMILIAS);

  for (const [nome, valor] of Object.entries(valores)) {
    // Vazio, ou começando por vírgula: os dois significam que
    // `settings.type_*_font.family` não resolveu — handle inexistente na
    // biblioteca da Shopify. O CSS continua válido e a loja perde a fonte.
    expect(valor, `${nome} não resolveu — o handle do font_picker existe?`).not.toBe('');
    expect(valor, `${nome} começa com vírgula: a família ficou vazia`).not.toMatch(/^\s*,/);
  }
});

test('o corpo da página realmente usa a família escolhida', async ({ page }) => {
  await page.goto('/');

  const { usada, declarada } = await page.evaluate(() => ({
    usada: getComputedStyle(document.body).fontFamily,
    declarada: getComputedStyle(document.documentElement).getPropertyValue('--font-body-family').trim(),
  }));

  // A primeira família da variável precisa aparecer no que o navegador
  // calculou: prova que a variável chegou ao `body`, não só que existe.
  const primeira = declarada.split(',')[0].trim().replace(/^["']|["']$/g, '');
  expect(usada).toContain(primeira);
});

test('o JSON-LD da loja é JSON válido e não afirma um país fixo', async ({ page }) => {
  await page.goto('/');

  const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocos.length, 'nenhum JSON-LD na home').toBeGreaterThan(0);

  const organizacao = blocos
    .map((bruto) => {
      // Parse dentro do map: JSON-LD inválido tem que reprovar ESTE teste, com
      // o texto no erro, em vez de sumir de um `filter` e deixar tudo verde.
      try {
        return JSON.parse(bruto);
      } catch (erro) {
        throw new Error(`JSON-LD inválido na home: ${erro.message}\n${bruto.slice(0, 300)}`);
      }
    })
    .find((dado) => dado['@type'] === 'Organization');

  expect(organizacao, 'sem bloco Organization no JSON-LD').toBeTruthy();

  const idioma = await page.getAttribute('html', 'lang');
  const pais = organizacao.address?.addressCountry;

  // Um código de país de duas letras é o formato certo; o que a regra `mercado`
  // impede é ele ser SEMPRE o mesmo, independentemente da loja. Aqui a
  // verificação possível é que ele bate com o que a loja publica.
  expect(pais, 'addressCountry ausente').toBeTruthy();
  expect(String(pais)).toMatch(/^[A-Z]{2}$/);

  if (organizacao.contactPoint) {
    expect(organizacao.contactPoint.areaServed).toBe(pais);
    expect(organizacao.contactPoint.availableLanguage?.[0]).toBe(idioma);
  }
});

const PAGINAS = [
  ['home', '/'],
  ['coleção', '/collections/all'],
  ['busca', '/search?q=vestido'],
  ['carrinho', '/cart'],
  ['404', '/esta-pagina-nao-existe-de-proposito'],
];

for (const [nome, caminho] of PAGINAS) {
  test(`nenhuma tradução faltando: ${nome}`, async ({ page }) => {
    await page.goto(caminho);

    const texto = await page.locator('body').innerText();
    // A Shopify escreve isto no lugar do texto quando a chave não existe. Ele
    // fica visível para a cliente, e passa despercebido em revisão de diff.
    expect(texto, `"Translation missing" visível em ${nome}`).not.toMatch(/translation missing/i);
  });
}
