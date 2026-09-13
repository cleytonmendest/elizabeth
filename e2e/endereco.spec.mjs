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
import {
  THEME_URL,
  MOTIVO,
  CLIENTE,
  MOTIVO_CLIENTE,
  SENHA_VITRINE,
  clicaNoTema,
} from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);
test.skip(!CLIENTE.email || !CLIENTE.senha, MOTIVO_CLIENTE);

/**
 * ── A #64: por que estes cinco testes ficaram três semanas em `fixme` ──────
 *
 * O sintoma relatado, em quatro execuções de CI:
 *
 *   url=https://<loja>.myshopify.com/account/login
 *   título="Conta – Elizabeth Estudos"
 *   a loja não exibiu erro nenhum
 *
 * Foi lido como "o POST não produz sessão", e esse diagnóstico sobreviveu a
 * duas hipóteses reprovadas. A primeira dizia que o proxy do `shopify theme
 * dev` engolia o login; medir provou o contrário — a migração para tema
 * empurrado (ADR 0007) fez a busca preditiva da #51 passar na primeira
 * execução e não mudou nada aqui. A segunda dizia que era o markup; também
 * não: `{% form 'customer_login' %}` emite os campos ocultos e os `name`
 * batem com o que a Shopify espera.
 *
 * ── A terceira leitura: o teste olhava a página de ANTES do POST ───────────
 *
 * O submit era um clique CRU seguido de `page.waitForLoadState('load')`. Essa
 * espera resolve na hora quando o documento atual já está carregado — e no
 * instante do clique ele está: é a página de login, que acabou de ser medida.
 * O POST sai, a navegação ainda não começou, a espera volta imediatamente, e
 * tudo que se perguntar depois é respondido pelo documento velho.
 *
 * As três observações passam a dizer a mesma coisa, e não é a que se pensava:
 *
 *   url=/account/login        → a URL de ANTES da navegação
 *   título do tema            → a página de login, pré-POST
 *   "não exibiu erro nenhum"  → claro: é a página de antes de enviar
 *
 * E explica o fato que mais incomodava — à mão funciona com as MESMAS
 * credenciais. Uma pessoa espera a página trocar; `waitForLoadState('load')`
 * não esperava.
 *
 * ── A correção estava no repositório, sem ser usada aqui ───────────────────
 *
 * `clicaNoTema`, em `helpers/loja.mjs`, é a porta guardada para clique que
 * traz documento novo: ela carimba o documento ANTES do clique e espera o
 * carimbo morrer — o carimbo vive num `window`, e `window` morre com o
 * documento. Esse é o sinal certo aqui, porque a URL não é: login recusado
 * volta para `/account/login` com `form.errors`, mesma URL e documento novo.
 *
 * `a11y.spec.mjs`, `fluxos.spec.mjs` e `guarda-do-clique.spec.mjs` já a usam.
 * Este arquivo não usava, em três lugares — o login, a tela de senha da
 * vitrine e a exclusão de endereço.
 *
 * ── A resposta, em cinco medições ──────────────────────────────────────────
 *
 * Tirar o `fixme` foi o que destravou: hipótese precisa ser MEDIDA, e medir
 * exige rodar. Cada execução matou uma explicação:
 *
 *   1. não é o teste olhando a página velha — não há navegação NENHUMA
 *   2. nenhum POST sai do navegador — logo é o cliente, não a loja
 *   3. não é a validação — novalidate=true, checkValidity()=true, um submit
 *   4. o submit DISPARA e é CANCELADO — alguém chama preventDefault()
 *   5. a pilha nomeia quem:
 *
 *        at HTMLFormElement.<anonymous>
 *          (cdn.shopify.com/shopifycloud/storefront-forms-hcaptcha/…)
 *
 * É o hCaptcha da própria Shopify, que protege todo formulário de vitrine
 * contra bot. Ele intercepta o submit, cancela, roda o desafio e só então
 * reenvia. Navegador automatizado não completa o desafio, e o POST nunca sai.
 *
 * ── O que isso muda ────────────────────────────────────────────────────────
 *
 * NÃO é defeito do tema. O markup está correto, a conta está correta, e o
 * login à mão funciona — porque uma pessoa passa no captcha. Não há linha de
 * Liquid para consertar, e a #64 deixa de ser bloqueador de Theme Store.
 *
 * É constraint de AMBIENTE, da mesma família de "falta THEME_URL": por isso
 * estes cinco viram PULADO COM MOTIVO em vez de falha, e a detecção é pela
 * PILHA, não por configuração. Se a lojista desligar a proteção contra spam,
 * ou a Shopify trocar de mecanismo, eles voltam a rodar sozinhos — um env var
 * diria o que alguém LEMBROU de declarar; a pilha diz o que o navegador fez.
 *
 * ── Por que a busca no código nunca acharia ────────────────────────────────
 *
 * `addEventListener('submit'` aparece em seis lugares do repositório, e nenhum
 * alcança esta página. O culpado não está no repositório: a Shopify o injeta
 * na vitrine. Três semanas de #64 procuraram no lugar onde não estava, porque
 * o sintoma — tela parada, sem erro — é igual para causas que moram em
 * camadas diferentes.
 *
 * O que não se faz é afrouxar a asserção até passar: isso transformaria em
 * verde um login que não acontece.
 */

const CARIMBO = 'e2e-endereco';

/**
 * Entra com a conta de teste — e, se não entrar, DIZ POR QUÊ.
 *
 * A primeira versão disto terminava num `expect(page).not.toHaveURL(/login/)`.
 * Ele reprovou corretamente, e a mensagem foi "Received string:
 * http://.../account/login" — verdadeira e inútil: não separa "a senha está
 * errada" de "a conta nunca foi ativada" de "o formulário nem foi enviado".
 *
 * É a mesma forma de defeito que `e2e/global-setup.mjs` evita ao dizer QUAL
 * tema respondeu: um verificador que reprova sem informar manda a investigação
 * para o lugar errado. A loja escreve o motivo num `[role="alert"]`; o teste passa a ler
 * esse texto e a colocá-lo na falha.
 */
/**
 * A tela de senha da vitrine, se ela aparecer. Devolve `true` se atravessou.
 *
 * Ela é o suspeito silencioso: renderiza sem erro nenhum, então "caí na tela de
 * senha" e "o formulário não foi enviado" produzem exatamente a mesma falha.
 * Foi o que a primeira execução real devolveu.
 */
async function atravessaSenhaDaVitrine(page) {
  const campo = page.locator('input[name="password"]');
  if ((await campo.count()) === 0) return false;

  if (!SENHA_VITRINE) {
    throw new Error(
      'A vitrine pediu a senha da loja e SHOPIFY_STORE_PASSWORD não chegou ao ' +
        'Playwright. Ela existe no passo "Empurrar o tema de teste"; precisa ' +
        'existir também no passo "Playwright", em .github/workflows/ci.yml.'
    );
  }

  await campo.first().fill(SENHA_VITRINE);
  await page.locator('form[action*="/password"] button[type="submit"]').first().click();
  // Esperar o CAMPO sumir, e não `waitForLoadState('load')`: com o documento
  // velho ainda carregado, aquela espera resolve na hora, e quem pergunta
  // depois pergunta à página de ANTES do POST. Ver a nota da #64 no cabeçalho.
  //
  // `clicaNoTema` não serve aqui: ela prova de que TEMA veio o documento, e a
  // resposta da tela de senha é da Shopify, não nossa. O sinal certo é o campo
  // de senha ter deixado de existir.
  await page.waitForSelector('input[name="password"]', { state: 'detached', timeout: 15000 });
  return true;
}

/** O que a página é, para uma falha dizer onde parou em vez de só que parou. */
async function ondeEstou(page) {
  const titulo = await page.title().catch(() => '(sem título)');
  const h1 = await page
    .locator('h1')
    .first()
    .innerText()
    .catch(() => '(sem h1)');
  const pedeSenhaDaLoja = (await page.locator('input[name="password"]').count()) > 0;

  return `url=${page.url()} · título="${titulo}" · h1="${h1.replace(/\s+/g, ' ').trim()}"${
    pedeSenhaDaLoja ? ' · A PÁGINA PEDE A SENHA DA VITRINE' : ''
  }`;
}

/**
 * O script que a Shopify injeta em TODO formulário de vitrine para barrar bot.
 *
 * O nome do arquivo é a impressão digital, e não a versão: ele já está em
 * `v1.5.3` e vai mudar. O que não muda é o caminho
 * `shopifycloud/storefront-forms-hcaptcha`.
 */
const CAPTCHA_DA_SHOPIFY = 'storefront-forms-hcaptcha';

const MOTIVO_CAPTCHA =
  'issue #64 — o hCaptcha da Shopify (storefront-forms-hcaptcha) intercepta o submit do ' +
  'login e chama preventDefault(). Navegador automatizado não completa o desafio, então o ' +
  'POST nunca sai. NÃO é defeito do tema: o login à mão funciona, e não há nada no Liquid ' +
  'para corrigir. Para medir estes cinco, a proteção contra spam da loja precisa estar ' +
  'desligada — aí a detecção cai sozinha e eles voltam a rodar.';

/**
 * O que a REDE diz quando o clique no submit não navega.
 *
 * As duas metades levam a lugares opostos, e é por isso que a mensagem precisa
 * escolher uma em vez de descrever as duas: "pode ser A ou B" é o formato de
 * diagnóstico que a #64 teve por três semanas.
 */
function veredito(respostas, form, diag) {
  if (respostas.length) {
    return (
      `O POST SAIU, e a loja respondeu: ${respostas.join(' · ')}\n` +
      'Resposta que não navega é da LOJA, não do tema — 204, 4xx sem corpo, ou um 200 ' +
      'servido como se fosse XHR. Olhe o status acima ANTES de mexer no Liquid.'
    );
  }

  // A validação nativa é o suspeito número um, e ela é MUDA aqui: o listener de
  // `invalid` em `templates/customers/login.liquid` chama `preventDefault()`,
  // que esconde a bolha do navegador sem desbloquear o envio. Um campo
  // `required` inválido barra o submit sem deixar rastro na tela — e sem
  // `novalidate` no form nada impede isso de acontecer.
  const barrado = !form.novalidate && !form.valido;

  return (
    'NENHUM POST para /account/login saiu do navegador: o formulário não foi enviado, ' +
    'e a causa está no CLIENTE — é bug de tema, não da loja nem da conta.\n' +
    `O form: action=${form.action} · novalidate=${form.novalidate} · ` +
    `checkValidity()=${form.valido} · submits=${form.submits}\n` +
    (form.invalidos.length ? `Campos inválidos: ${form.invalidos.join(' · ')}\n` : '') +
    (barrado
      ? 'DIAGNÓSTICO: a validação nativa está barrando o envio, e o listener de `invalid` ' +
        'do template engole a mensagem com `preventDefault()`. Corrija o campo acima, ou ' +
        'faça o `novalidate` chegar ao HTML — hoje ele é passado ao `{% form %}` e não ' +
        'está no elemento.\n'
      : 'A validação nativa NÃO é a causa (o form passa em checkValidity, ou tem ' +
        'novalidate).\n') +
    ondeParou(diag) +
    'O trace.zip do artefato mostra se houve requisição — é a prova, não o palpite.'
  );
}

/**
 * Em que degrau o envio morreu: clique → submit → navegação.
 *
 * A ordem importa porque cada degrau acusa um culpado diferente, e a mensagem
 * precisa apontar UM. Sem isto sobra "algum listener intercepta", que é onde a
 * #64 empacou — verdadeiro e sem endereço.
 */
function ondeParou(diag) {
  if (!diag) return 'Sem diagnóstico do navegador (a página pode ter navegado).\n';

  if (!diag.clique) {
    return (
      'O CLIQUE não chegou ao botão de submit. Algo cobre o botão, ou o seletor pega ' +
      'outro elemento — o defeito é do teste, não do tema.\n'
    );
  }
  if (!diag.submitCapturado) {
    return (
      'O clique CHEGOU e o evento `submit` NUNCA disparou. O botão não está submetendo ' +
      'o form: um listener de `click` com `preventDefault()`, ou o botão não pertencer ' +
      'ao form que ele parece pertencer (atributo `form=`, ou markup aninhado que o ' +
      'navegador reparou movendo o botão para fora).\n'
    );
  }
  if (diag.prevenido) {
    return (
      'O `submit` DISPAROU e foi CANCELADO: `defaultPrevented` é true quando o evento ' +
      'chega ao document.\n' +
      (diag.pilha
        ? `Quem chamou preventDefault(), com endereço:\n${diag.pilha}\n`
        : 'A pilha não foi capturada — quem cancelou não passou por ' +
          '`Event.prototype.preventDefault` (pode ter usado `returnValue = false`, ou ' +
          'rodado antes da instrumentação).\n')
    );
  }
  return (
    'O `submit` disparou e NÃO foi cancelado, e ainda assim nenhum POST saiu. O ' +
    'navegador recusou o envio por conta própria — form sem `action` resolvível, ' +
    'ou já em envio.\n'
  );
}

async function entrar(page) {
  await page.goto('/account/login');

  // Antes de qualquer coisa: se a vitrine estiver trancada, tudo abaixo mede a
  // tela de senha em vez do tema.
  if (await atravessaSenhaDaVitrine(page)) await page.goto('/account/login');

  const formulario = page.locator('form[action*="/account/login"]').first();
  await expect(formulario, 'a página de login não trouxe o formulário do tema').toBeVisible();

  // ── O hCaptcha está na página? Então não há login a medir ─────────────────
  //
  // A detecção é pela PRESENÇA do script, e não pelo `preventDefault()` que ele
  // chama. A primeira versão fazia o contrário — clicava, esperava 15s, e lia a
  // pilha de quem cancelou — e o resultado foi um teste que às vezes pula e às
  // vezes falha: na execução de `799e62a`, QUATRO dos cinco pularam e um caiu
  // como falha, porque `clicaNoTema` estourou antes de o cancelamento
  // acontecer e a pilha ficou nula.
  //
  // Oscilar assim é pior que qualquer um dos dois estados: um gate que muda de
  // cor sem o código mudar é um gate que se aprende a ignorar.
  //
  // O script estar carregado é fato estável sobre a CONFIGURAÇÃO da loja, não
  // sobre o que aconteceu num clique. Se ele está lá, navegador automatizado
  // não completa o desafio e o POST não sai — não há o que medir, e dizer isso
  // antes de tentar economiza 15s de timeout por teste.
  const temCaptcha = await page.evaluate(
    (marca) =>
      [...document.scripts].some((s) => s.src.includes(marca)) ||
      performance.getEntriesByType('resource').some((r) => r.name.includes(marca)),
    CAPTCHA_DA_SHOPIFY
  );
  if (temCaptcha) test.skip(true, MOTIVO_CAPTCHA);

  await formulario.locator('input[name="customer[email]"]').fill(CLIENTE.email);
  await formulario.locator('input[name="customer[password]"]').fill(CLIENTE.senha);
  // ── A escuta que faltava à #64 ────────────────────────────────────────────
  //
  // O PR #100 mediu que o clique no submit não produz documento novo NEM muda
  // a URL, em 15s. Isso separa duas causas que este teste não distinguia, e que
  // pedem correções opostas:
  //
  //   · o POST nunca SAIU do navegador   → a causa está no cliente
  //   · o POST saiu e não navegou        → a causa está na loja
  //
  // Nenhuma se deduz da página: as duas deixam a mesma tela parada, que é
  // exatamente por que a #64 passou três semanas com o diagnóstico errado.
  // Quem responde é a REDE, e ninguém estava olhando para ela.
  const respostas = [];
  const anota = (res) => {
    const req = res.request();
    if (req.method() !== 'POST' || !/\/account\/login/.test(req.url())) return;
    const destino = res.headers().location ?? '(sem Location)';
    respostas.push(`${res.status()} ${res.statusText()} → ${destino}`);
  };
  page.on('response', anota);

  // E o estado do form ANTES do clique, colhido do navegador. Quando o POST não
  // sai, é isto que diz POR QUE: validação nativa barrando (e qual campo), ou
  // não. Perguntar depois do clique não serve — se a página tivesse navegado,
  // o form já não existiria.
  const form = await formulario.evaluate((f) => ({
    action: f.getAttribute('action'),
    novalidate: f.hasAttribute('novalidate'),
    valido: f.checkValidity(),
    submits: f.querySelectorAll('button[type="submit"]').length,
    // O valor vai MASCARADO. O log do CI é público, e um campo inválido aqui
    // é, metade das vezes, o de senha — imprimir `el.value` publicaria o
    // secret `SHOPIFY_CUSTOMER_PASSWORD` em texto puro. O comprimento e o tipo
    // já bastam para diagnosticar (campo vazio, espaço sobrando, e-mail sem @).
    invalidos: [...f.querySelectorAll('input:invalid, select:invalid, textarea:invalid')].map(
      (el) =>
        `${el.name || el.id || el.tagName} [type=${el.type}, ${el.value.length} caracteres] — ` +
        `${el.validationMessage || 'sem mensagem'}`
    ),
  }));

  // ── Os três sinais que fecham a árvore de causas ──────────────────────────
  //
  // A execução de `590ebae` descartou a validação: o form tem `novalidate`,
  // passa em `checkValidity()`, a action está certa e há um só submit. Sobrou
  // "alguém intercepta", e a busca estática não achou ninguém — nenhum listener
  // global de `submit` nem de `click`; os três componentes que escutam `submit`
  // escopam ao próprio custom element.
  //
  // Procurar mais no código seria adivinhar. Estes três listeners respondem a
  // árvore inteira numa execução:
  //
  //   clique não capturado          → o clique não chegou ao botão
  //   clique sim, submit não        → o clique não disparou o envio
  //   submit capturado, prevenido   → alguém no meio cancelou (e o capture
  //                                   roda ANTES de todo listener normal, então
  //                                   o culpado está entre ele e o document)
  //   submit não prevenido          → o navegador recusou por conta própria
  await page.evaluate(() => {
    window.__diagLogin = {
      clique: false,
      submitCapturado: false,
      submitBorbulhou: false,
      prevenido: null,
      pilha: null,
    };

    // ── Quem chama `preventDefault`, com nome e linha ────────────────────────
    //
    // A execução de `8c69614` provou que o submit é CANCELADO, e a busca
    // estática não encontra o culpado: não há listener de `submit` em nenhum
    // arquivo que chegue a esta página. Ou a busca está cega, ou quem cancela
    // não veio do repositório — script da própria Shopify, app de terceiro
    // injetado na vitrine, extensão. As três hipóteses pedem respostas
    // diferentes e nenhuma se resolve lendo mais código nosso.
    //
    // Interceptar o método é o que dá ENDEREÇO em vez de categoria: a pilha
    // nomeia o arquivo e a linha de quem chamou. É diagnóstico de teste, não
    // de produção — vive só nesta página, nesta execução.
    const original = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function interceptado() {
      if (this.type === 'submit' && !window.__diagLogin.pilha) {
        window.__diagLogin.pilha = new Error('preventDefault() num evento submit').stack;
      }
      return original.apply(this, arguments);
    };
    document.addEventListener(
      'click',
      (e) => {
        if (e.target instanceof Element && e.target.closest('button[type="submit"]')) {
          window.__diagLogin.clique = true;
        }
      },
      true
    );
    // Capture: roda antes de qualquer listener de borbulha, então registra que
    // o envio COMEÇOU mesmo que alguém o cancele logo depois.
    document.addEventListener('submit', () => {
      window.__diagLogin.submitCapturado = true;
    }, true);
    // Borbulha no document: o último a rodar. Se `defaultPrevented` for true
    // aqui, o cancelamento veio de um listener entre o form e o document.
    document.addEventListener('submit', (e) => {
      window.__diagLogin.submitBorbulhou = true;
      window.__diagLogin.prevenido = e.defaultPrevented;
    });
  });

  // A porta guardada, e não um clique cru: `clicaNoTema` carimba o documento
  // ANTES do clique e espera o carimbo morrer — a prova de que o documento é
  // OUTRO. Vale exatamente no caso deste POST, em que a URL pode voltar IGUAL
  // (login recusado volta para /account/login com `form.errors`), e medir a
  // URL diria "não saí do lugar" sobre uma página que chegou.
  try {
    await clicaNoTema(page, formulario.locator('button[type="submit"]'), 'Entrar, no login');
  } catch (erro) {
    // Só dá para ler isto porque a página NÃO navegou — `window` morre com o
    // documento. No caminho de sucesso não há nada que ler, e nem faz falta.
    const diag = await page.evaluate(() => window.__diagLogin).catch(() => null);

    // ── O fim da #64 ──────────────────────────────────────────────────────
    //
    // Se quem cancelou o submit foi o hCaptcha da Shopify, estes testes não
    // têm como passar — e não há nada no tema para consertar. É constraint do
    // ambiente, da mesma família de "falta THEME_URL", e por isso vira PULADO
    // COM MOTIVO em vez de falha.
    //
    // A detecção é pela PILHA, não por configuração: se a lojista desligar a
    // proteção contra spam, ou a Shopify mudar de mecanismo, os testes voltam
    // a rodar sozinhos. Um env var diria o que alguém LEMBROU de declarar; a
    // pilha diz o que o navegador fez.
    if (diag?.pilha?.includes(CAPTCHA_DA_SHOPIFY)) {
      test.skip(true, MOTIVO_CAPTCHA);
    }

    throw new Error(`${erro.message}\n\n${veredito(respostas, form, diag)}`);
  } finally {
    page.off('response', anota);
  }

  // O POST pode ter caído na tela de senha da vitrine: atravessa e confere de
  // novo antes de declarar que o login falhou.
  if (await atravessaSenhaDaVitrine(page)) await page.goto('/account/addresses');

  if (!/\/account\/login/.test(page.url())) return;

  const alerta = page.locator('[role="alert"]');
  const dito = (await alerta.count())
    ? (await alerta.first().innerText()).replace(/\s+/g, ' ').trim()
    : '(a loja não exibiu erro nenhum — o formulário pode nem ter sido enviado)';

  throw new Error(
    [
      'O login com a conta de teste não passou.',
      `A loja respondeu: ${dito}`,
      `A página em que parou: ${await ondeEstou(page)}`,
      '',
      'A causa mais comum não é a senha: cliente criado pela lojista no admin',
      'nasce SEM senha e só passa a conseguir entrar depois de aceitar o convite',
      'de ativação. Confirme entrando à mão em /account/login na vitrine — se',
      'você também não entrar, o problema é a conta, não este teste.',
      '',
      'Os secrets são SHOPIFY_CUSTOMER_EMAIL e SHOPIFY_CUSTOMER_PASSWORD.',
    ].join('\n')
  );
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
    await clicaNoTema(page, modal.locator('button[type="submit"]'), 'Salvar, no endereço novo');

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
    await clicaNoTema(
      page,
      page.locator('#delete-form button[type="submit"]'),
      'Excluir, no endereço de teste'
    );
  }

  console.warn(`[${CARIMBO}] dez voltas e ainda há endereço marcado — limpeza incompleta.`);
}

/**
 * A varredura final — e por que ela não pode ESTOURAR.
 *
 * `test.afterAll` roda mesmo quando todos os testes do arquivo foram pulados,
 * e é isto que faz dele uma armadilha. Enquanto a #64 estava em `fixme`, a
 * primeira linha era `if (LOGIN_NAO_COMPLETA) return;` — sem ela o hook
 * chamava `entrar()`, que não passava, e derrubava o job PELO HOOK, anulando
 * o `fixme` que existia para manter o PR verde. Aconteceu duas vezes: quando
 * o `fixme` nasceu, e no PR #72, quando a constante foi removida por engano e
 * cinco testes caíram com `ReferenceError`.
 *
 * A #64 tirou o `fixme`, e com ele a constante. A armadilha não some junto:
 * se `entrar()` falhar, este hook estoura e soma uma falha de INFRAESTRUTURA
 * às falhas dos testes — que já reportaram a mesma causa, melhor. Cinco testes
 * vermelhos mais um hook vermelho não é mais informação, é menos: a mensagem
 * do hook aparece por último e é a que fica na cara do relatório.
 *
 * Então a limpeza avisa em vez de estourar. Não é silêncio: se ela não rodou,
 * é porque o login não passou, e isso está escrito nos cinco testes acima,
 * onde a mensagem é útil. Endereço de teste que sobrar fica com o carimbo
 * deste arquivo, e a volta seguinte o apaga.
 */
test.afterAll(async ({ browser }) => {
  if (!THEME_URL || !CLIENTE.email || !CLIENTE.senha) return;

  const page = await browser.newPage();
  try {
    await entrar(page);
    await limpa(page);
  } catch (erro) {
    console.warn(
      `[${CARIMBO}] a limpeza final não rodou: ${erro.message.split('\n')[0]}\n` +
        'Se foi o login, os testes acima já dizem por quê. Endereço de teste que ' +
        'tenha sobrado leva o carimbo e é apagado na próxima execução.'
    );
  } finally {
    await page.close();
  }
});
