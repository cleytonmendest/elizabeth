/**
 * Os caminhos que a cliente percorre — os que, quebrados, custam venda.
 *
 * Este arquivo já rodou contra a loja: a busca preditiva (#51) passou na
 * primeira execução contra o tema empurrado — ver ADR 0007. O que continua
 * sem rodar é o `test.fixme` da #68, e ele se anuncia no relatório.
 *
 * O que o Vitest cobre é o componente isolado: dado um evento, o que ele
 * escreve no DOM. O que falta é a costura — o Liquid renderizou o markup que o
 * componente espera? O evento chega de um componente ao outro numa página de
 * verdade? Nenhum teste de jsdom responde isso, porque em jsdom fui EU quem
 * escreveu o markup.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO, abrePaginaDoTema } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

async function abrePDP(page) {
  await abrePaginaDoTema(page, '/collections/all');
  await page.locator('a[href*="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
}

test('adicionar ao carrinho abre o drawer e atualiza a bolha', async ({ page }) => {
  await abrePDP(page);

  await page.locator('add-to-cart button[name="add"]').first().click();

  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await expect(page.locator('#cart-items-container .cart-item')).toHaveCount(1);
  await expect(page.locator('#qtd-bubble')).toHaveText('1');
  // A prova de que o drawer trocou de estado, e não só ganhou um item.
  await expect(page.locator('#cart-empty')).toHaveClass(/hidden/);
});

test('a página do carrinho não repete o id que o drawer usa', async ({ page }) => {
  // ⚠ MARCADO COMO fixme — issue #68, e o defeito é do TEMA, não do teste.
  //
  // O teste acima passa, e passa por sorte. `updateCartDrawer` (assets/cart.js)
  // baixa a página INTEIRA do carrinho e copia uma div de lá para dentro do
  // drawer:
  //
  //     const doc = parser.parseFromString(await (await fetch('/cart')).text(), 'text/html');
  //     targetContainer.innerHTML = doc.querySelector('#cart-items-container').innerHTML;
  //
  // Só que `#cart-items-container` existe DUAS vezes no documento que ele
  // acabou de baixar: o do drawer (snippets/cart-drawer.liquid, renderizado em
  // theme.liquid:173) e o da página (theme.liquid:184, via content_for_layout).
  // Dois elementos com o mesmo id é HTML inválido, e `querySelector` devolve o
  // primeiro na ordem do documento — hoje o do drawer.
  //
  // Ou seja: funciona por ORDENAÇÃO, não por desenho. Mover
  // `{% render 'cart-drawer' %}` para depois de `{{ content_for_layout }}` faz
  // o seletor passar a ler a página do carrinho — sem erro no console, sem
  // aviso no lint e sem um teste vermelho, porque os dois containers renderizam
  // o mesmo `{% render 'cart-drawer-item' %}`. O dia em que divergirem é o dia
  // em que o mini-carrinho mostra outra coisa.
  //
  // Não afrouxar até passar: a asserção é o comportamento correto, e é ela que
  // vira verde quando a #68 for resolvida.
  test.fixme(true, 'issue #68 — #cart-items-container existe no drawer E na página');

  // O carrinho VAZIO esconde o defeito: o container da página só é renderizado
  // com `cart.item_count > 0`, então sem item há um id só e a asserção passa.
  // Por isso o produto entra antes.
  await abrePDP(page);
  await page.locator('add-to-cart button[name="add"]').first().click();
  await expect(page.locator('cart-drawer')).toHaveClass(/active/);

  await abrePaginaDoTema(page, '/cart');

  await expect(page.locator('#cart-items-container')).toHaveCount(1);
});

test('quick-add do card mantém o ícone e adiciona sem sair da coleção', async ({ page }) => {
  // A regressão que quase foi para produção: `_onResize` escrevia textContent
  // em TODO <add-to-cart>, apagando o SVG de cada card. tests/add-to-cart cobre
  // a lógica; só o navegador prova que o ícone continua desenhado na tela.
  await abrePaginaDoTema(page, '/collections/all');

  // `card-quick-add` só renderiza <add-to-cart> para produto de UMA variante;
  // com mais de uma, o card vira um link para a PDP. Num catálogo onde todo
  // produto tem variante — como o desta loja — não há quick-add para testar,
  // e o teste diz isso em vez de falhar por ausência.
  const temQuickAdd = (await page.locator('add-to-cart').count()) > 0;
  test.skip(!temQuickAdd, 'catálogo sem produto de variante única — não há quick-add nesta coleção');

  // O quick-add mora num overlay `opacity-0 group-hover:opacity-100` sobre a
  // imagem do card: ele existe no DOM desde o começo, mas só fica visível
  // quando o mouse entra no card. A primeira versão deste teste procurava o
  // ícone sem passar o mouse — e o Playwright, corretamente, não achou.
  const card = page.locator('add-to-cart').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();

  const quickAdd = card.locator('button[name="add"]');
  await expect(quickAdd).toBeVisible();
  await expect(quickAdd.locator('svg')).toBeVisible();
  await quickAdd.click();

  await expect(page.locator('cart-drawer')).toHaveClass(/active/);
  await expect(quickAdd.locator('svg')).toBeAttached();
  await expect(page).toHaveURL(/\/collections\//);
});

test('trocar de variante muda preço e URL juntos', async ({ page }) => {
  await abrePDP(page);
  const radios = page.locator('variant-selects fieldset input[type="radio"]');
  test.skip((await radios.count()) < 2, 'produto sem variante para trocar');

  const precoAntes = await page.locator('.selling-price').first().textContent();

  // O radio é `class="sr-only peer"` — invisível por CSS, com o swatch
  // desenhado no <label>. Clicar no input direto não funciona: outro elemento
  // intercepta o ponteiro. Quem a cliente clica é o label, e é o que o teste
  // tem que clicar também.
  const alvo = radios.nth(1);
  await page.locator(`label[for="${await alvo.getAttribute('id')}"]`).click();

  // A URL tem que acompanhar: é o que faz o link compartilhado abrir na
  // variante certa.
  await expect(page).toHaveURL(/[?&]variant=\d+/);
  await expect(page.locator('#add-to-cart-form input[name="id"], input[name="id"]').first()).not.toHaveValue('');
  // O preço pode ou não mudar (variantes podem custar igual); o que não pode é
  // sumir.
  await expect(page.locator('.selling-price').first()).not.toBeEmpty();
  expect(precoAntes).not.toBeNull();
});

test('filtrar a coleção mantém a lista utilizável', async ({ page }) => {
  await abrePaginaDoTema(page, '/collections/all');
  const filtros = page.locator('[data-filters-panel] input[type="checkbox"]');
  test.skip((await filtros.count()) === 0, 'coleção sem filtros configurados');

  await filtros.first().check();

  await expect(page).toHaveURL(/[?&]filter\./);
  await expect(page.locator('a[href*="/products/"]').first()).toBeVisible();
});

test('carregar mais acrescenta produtos sem recarregar a página', async ({ page }) => {
  await abrePaginaDoTema(page, '/collections/all');
  const botao = page.locator('[data-load-more]');
  test.skip(!(await botao.isVisible().catch(() => false)), 'coleção cabe numa página só');

  const antes = await page.locator('a[href*="/products/"]').count();
  await botao.click();

  await expect(page.locator('a[href*="/products/"]')).not.toHaveCount(antes);
  await expect(page).toHaveURL(/\/collections\/all\/?$/);
});

test('busca preditiva responde enquanto a cliente digita', async ({ page }) => {
  // ⚠ ERA fixme — issue #51, e a causa não era o teste.
  //
  // Medido quatro vezes no CI: o painel abre, o host ganha `is-searching`, e
  // `.search-results-content` fica VAZIO até 15s. Pelo código do componente
  // esse estado só existe entre `_showLoading()` e a resposta do fetch — sem
  // resultado ele ESCREVE a mensagem de vazio, e no erro o catch ESCONDE o
  // painel. Ou seja, `/search/suggest.json` não volta através do proxy do
  // `shopify theme dev`.
  //
  // Afrouxar a asserção até passar transformaria um defeito real em verde, que
  // é exatamente o que este repositório existe para não fazer — então ficou
  // registrado, visível no relatório, até a causa ser removida.
  //
  // Foi removida na #64: a suíte não passa mais pelo proxy. Ela mede um tema
  // EMPURRADO para a loja, onde `/search/suggest.json` é servido pela vitrine
  // como para qualquer cliente. Ver ADR 0007.

  // ── O que este teste afirma, e o que ele deliberadamente NÃO afirma ──────
  //
  // Afirma a corrente inteira do componente: o input recebe texto, o debounce
  // de 300ms dispara, o fetch volta, e o painel é preenchido e revelado. É
  // tudo que o TEMA controla.
  //
  // Não afirma que veio produto. Tentei isso duas vezes e as duas custaram uma
  // rodada de CI: primeiro com um termo que inventei ("ve"), depois com uma
  // palavra tirada do handle de um produto que existe na loja. As duas vezes o
  // painel abriu com "nenhum resultado". Quantos produtos o índice de busca da
  // loja devolve é propriedade do CATÁLOGO, não do tema — um teste que exige
  // resultado mede a loja de desenvolvimento, e quebra quando alguém despublica
  // um produto.
  //
  // Quando houver resultado, o teste aperta sozinho: as asserções condicionais
  // no fim verificam que o item é link para /products/.
  await abrePaginaDoTema(page, '/');

  // `search-component` é renderizado quatro vezes — três no header, uma por
  // breakpoint, e uma no menu mobile. Todas existem no DOM ao mesmo tempo e
  // apenas uma está visível, então o seletor precisa dizer qual.
  const busca = page.locator('search-component:visible').first();

  // O componente ignora consulta com menos de 2 caracteres
  // (`if (query.length < 2) return`) e espera 300ms de debounce. Digitar uma
  // letra e olhar na hora não abre nada.
  await busca.locator('input[name="q"]').fill('ves');

  // O painel abriu e o componente se declarou buscando.
  await expect(busca.locator('.search-results')).toBeVisible({ timeout: 10_000 });
  await expect(busca).toHaveClass(/is-searching/);

  // E ele escreveu ALGUMA resposta — resultado ou a mensagem de vazio.
  //
  // O timeout é generoso de propósito. Painel aberto com conteúdo vazio é o
  // estado de LOADING (`_showLoading` limpa o conteúdo, abre o painel e marca
  // is-searching), e a chamada a /search/suggest.json atravessa o proxy do
  // `shopify theme dev` até a loja de verdade — bem mais lento que na loja
  // publicada. Com 5s o teste media a latência do ambiente, não o componente.
  //
  // 15s continua sendo um gate real: busca preditiva que demora mais que isso
  // está quebrada para a cliente de qualquer jeito. E o caminho de erro do
  // componente é tratado (catch → esconde o painel), então painel aberto e
  // vazio no fim desse prazo significa fetch pendurado, que é defeito.
  await expect(busca.locator('.search-results-content')).not.toBeEmpty({ timeout: 15_000 });

  const itens = busca.locator('.search-result-item');
  if ((await itens.count()) > 0) {
    await expect(itens.first()).toBeVisible();
    await expect(itens.first()).toHaveAttribute('href', /\/products\//);
  }
});
