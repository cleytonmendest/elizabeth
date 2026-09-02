/**
 * O formulário de endereço, na loja de verdade e atrás do login.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * `tests/address-country.test.mjs` cobre o componente em jsdom, e cobre bem —
 * mas lá o markup foi escrito por mim. O que ele não pode responder é se o
 * LIQUID entrega o markup que o componente espera, e se
 * `all_country_option_tags` de fato rende os países com as províncias no
 * `data-provinces`. Os dois testes se parecem e medem coisas diferentes: um
 * verifica a lógica, o outro a costura.
 *
 * Também é aqui que moram os dois critérios de aceite da issue #25 que nenhum
 * comando alcançava — "endereço salva com um país que não seja o Brasil" e
 * "estados aparecem no idioma da loja". Eles viraram "conferir no preview
 * depois", que é o mesmo que não conferir.
 *
 * ── O teste que escreve na loja ────────────────────────────────────────────
 *
 * O último salva um endereço de verdade e o apaga. É a única forma de provar
 * que ele SALVA — um formulário que preenche bonito e é recusado pela Shopify
 * passaria em todos os outros. Ele marca o que cria com um carimbo no campo de
 * empresa e limpa no fim, inclusive se a asserção falhar no meio; sem isso a
 * conta de teste juntaria um endereço por execução até ninguém mais conseguir
 * ler a página.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO, CLIENTE, MOTIVO_CLIENTE } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);
test.skip(!CLIENTE.email || !CLIENTE.senha, MOTIVO_CLIENTE);

const CARIMBO = 'e2e-endereco';

async function entrar(page) {
  await page.goto('/account/login');
  await page.fill('input[name="customer[email]"]', CLIENTE.email);
  await page.fill('input[name="customer[password]"]', CLIENTE.senha);
  await page.locator('form[action*="/account/login"] button[type="submit"]').first().click();

  // A conta pode cair em /account ou /account/addresses; o que precisa ser
  // verdade é ter saído da tela de login.
  await expect(page).not.toHaveURL(/\/account\/login/);
}

async function abreFormularioNovo(page) {
  await page.goto('/account/addresses');
  await page.locator('button[onclick="openAddressModal(\'new\')"]').click();
  await expect(page.locator('#address-modal-new')).toBeVisible();
  return page.locator('#address-modal-new');
}

/** Escolhe o país e espera o componente redesenhar o campo de estado. */
async function escolhePais(modal, pais) {
  await modal.locator('#address_country_new').selectOption({ label: pais });
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test('o select de país vem da Shopify, não de uma lista do tema', async ({ page }) => {
  const modal = await abreFormularioNovo(page);

  const quantos = await modal.locator('#address_country_new option').count();
  // O defeito original tinha exatamente UMA option ("Brasil"). Qualquer número
  // grande serve para separar "a lista veio da plataforma" de "alguém escreveu
  // os países à mão de novo" — a regra `mercado` cuida da forma; aqui o que se
  // mede é o resultado na página.
  expect(quantos).toBeGreaterThan(100);
});

test('estado aparece no idioma da loja, vindo do país escolhido', async ({ page }) => {
  const modal = await abreFormularioNovo(page);
  await escolhePais(modal, 'Canada');

  const campo = modal.locator('[data-address-province-field]');
  await expect(campo).toBeVisible();

  const estados = await modal.locator('#address_province_new option').allTextContents();
  // Nomes canadenses em inglês: o tema nunca os escreveu, então eles só podem
  // ter vindo do `data-provinces` que a Shopify emitiu.
  expect(estados).toContain('Saskatchewan');
  expect(estados).toContain('Alberta');
});

test('país sem províncias esconde o campo de estado', async ({ page }) => {
  const modal = await abreFormularioNovo(page);
  await escolhePais(modal, 'Portugal');

  await expect(modal.locator('[data-address-province-field]')).toBeHidden();
});

test('o que é brasileiro só aparece quando o país é o Brasil', async ({ page }) => {
  const modal = await abreFormularioNovo(page);
  const cep = modal.locator('#address_zip_new');
  const dica = modal.locator('[data-br-only]');

  await escolhePais(modal, 'Brazil');
  await expect(cep).toHaveAttribute('maxlength', '9');
  await expect(cep).toHaveAttribute('placeholder', '00000-000');
  await expect(dica).toBeVisible();

  await escolhePais(modal, 'Canada');
  // O que mais importa dos três: `maxlength` 9 CORTA um ZIP+4 (dez caracteres)
  // na digitação, e a pessoa não vê nada acontecer.
  await expect(cep).not.toHaveAttribute('maxlength', /.*/);
  await expect(cep).toHaveAttribute('placeholder', '');
  await expect(dica).toBeHidden();
});

test('um endereço fora do Brasil SALVA — e some depois', async ({ page }) => {
  const modal = await abreFormularioNovo(page);

  await modal.locator('#address_first_name_new').fill('Teste');
  await modal.locator('#address_last_name_new').fill('Automatizado');
  await modal.locator('#address_company_new').fill(CARIMBO);
  await modal.locator('#address_address1_new').fill('123 Rue Sainte-Catherine');
  await modal.locator('#address_city_new').fill('Montréal');
  await modal.locator('#address_zip_new').fill('H3B 1A7');

  await escolhePais(modal, 'Canada');
  await modal.locator('#address_province_new').selectOption('QC');

  try {
    await modal.locator('button[type="submit"]').click();

    // O endereço salvo aparece na lista da página — que é a prova de que a
    // Shopify o aceitou, não só de que o formulário foi enviado.
    await expect(page.getByText(CARIMBO).first()).toBeVisible();
    await expect(page.getByText('Montréal').first()).toBeVisible();
  } finally {
    await limpa(page);
  }
});

/**
 * Apaga todo endereço que carregue o carimbo. Roda no `finally` do teste que
 * cria e também depois de todos, para varrer sobra de execução que morreu no
 * meio — a conta é a mesma em todo PR.
 *
 * ── A armadilha do endereço padrão ─────────────────────────────────────────
 *
 * O tema não desenha botão de excluir no endereço PADRÃO (é a regra do
 * template, não uma limitação daqui). Numa conta sem nenhum endereço, o
 * primeiro criado vira o padrão da Shopify — e ficaria preso, sem forma de
 * apagar pela vitrine, acumulando um por execução.
 *
 * Por isso a conta de teste precisa ter ao menos UM endereço permanente. E por
 * isso esta função AVISA em vez de morrer calada quando encontra o carimbo num
 * cartão sem botão: falhar aqui esconderia o teste que realmente importa, e
 * ficar em silêncio deixaria a conta apodrecer sem ninguém saber.
 */
async function limpa(page) {
  for (let volta = 0; volta < 10; volta += 1) {
    await page.goto('/account/addresses');

    const marcados = page.locator('div.shadow-lg').filter({ hasText: CARIMBO });
    if ((await marcados.count()) === 0) return;

    const excluir = marcados.first().locator('button[onclick^="confirmDeleteAddress"]');
    if ((await excluir.count()) === 0) {
      console.warn(
        `[${CARIMBO}] sobrou um endereço de teste SEM botão de excluir — ele virou o ` +
          'endereço padrão da conta. Apague-o no admin e deixe um endereço permanente ' +
          'na conta de teste, para o próximo criado nunca virar padrão.'
      );
      return;
    }

    await excluir.first().click();
    await page.locator('#delete-form button[type="submit"]').click();
    await page.waitForLoadState('load');
  }

  console.warn(`[${CARIMBO}] dez voltas e ainda há endereço marcado — limpeza incompleta.`);
}

test.afterAll(async ({ browser }) => {
  if (!THEME_URL || !CLIENTE.email || !CLIENTE.senha) return;

  const page = await browser.newPage();
  try {
    await entrar(page);
    await limpa(page);
  } finally {
    await page.close();
  }
});
