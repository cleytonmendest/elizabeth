/**
 * Abre a sessão que a suíte inteira usa: passa a senha da vitrine e FIXA o
 * tema empurrado. Ver ADR 0007.
 *
 * ── O defeito que este arquivo existe para não permitir ───────────────────
 *
 * A `preview_url` da Shopify fixa o tema por SESSÃO, não por URL: quem abre
 * `?preview_theme_id=N` uma vez continua vendo o tema N nas páginas seguintes.
 * É por isso que o link do preview funciona para uma pessoa.
 *
 * O reverso é o perigo. Se a fixação não pegar, cada `page.goto('/cart')`
 * mede o tema PUBLICADO — a loja de produção — e o relatório diz que mediu o
 * desta branch. Tudo verde, medindo outra coisa. É a mesma família da sonda
 * que aprovava qualquer 200, e da regra `budget` que ficou verde por ter
 * deixado de olhar.
 *
 * Então aqui não se confia: exige-se a evidência. `window.Shopify.theme.id`
 * vem do `content_for_header`, é escrito pela Shopify e não pelo tema, e diz
 * QUAL tema respondeu. Se ele não for o que empurramos, a suíte não começa.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const ARQUIVO_DE_SESSAO = path.join('e2e', '.auth', 'vitrine.json');

/**
 * `pb=0` desliga a barra de preview que a Shopify desenha sobre temas de
 * desenvolvimento. Não é conveniência: essa barra é markup que a vitrine
 * publicada não tem, e medir acessibilidade com ela seria medir outra página —
 * o mesmo motivo pelo qual o `theme dev` rodava com `--live-reload off`.
 */
export const paginaFixadora = (id) => `/?preview_theme_id=${encodeURIComponent(id)}&pb=0`;

export default async function globalSetup() {
  const base = process.env.THEME_URL;
  const id = process.env.PREVIEW_THEME_ID;
  const senha = process.env.SHOPIFY_STORE_PASSWORD;

  // Sem loja não há sessão a abrir — e `e2e/gate.spec.mjs` não precisa de uma.
  // Escrever um estado vazio mantém o `storageState` do config sempre válido.
  fs.mkdirSync(path.dirname(ARQUIVO_DE_SESSAO), { recursive: true });
  if (!base) {
    fs.writeFileSync(ARQUIVO_DE_SESSAO, JSON.stringify({ cookies: [], origins: [] }));
    console.log('[setup] Sem THEME_URL — a metade de storefront vai se declarar pulada.');
    return;
  }

  // Com THEME_URL e sem id não existe caminho seguro: `paginaFixadora`
  // montaria `preview_theme_id=undefined`, a Shopify ignoraria o parâmetro e
  // serviria o tema PUBLICADO — que também emite `window.shopUrl`, porque
  // também é este tema. A suíte inteira ficaria verde medindo produção.
  // `scripts/tema-de-teste.mjs` já reprova esse caso no CI; aqui a checagem se
  // repete porque este arquivo não confia na fixação nem quando a Shopify a
  // confirma, e confiar no próprio ambiente seria a única exceção.
  if (!id) {
    throw new Error(
      'THEME_URL existe e PREVIEW_THEME_ID não. Sem o id não há como fixar a ' +
        'sessão no tema empurrado, e medir assim daria uma suíte verde sobre o ' +
        'tema publicado. Ver ADR 0007.'
    );
  }

  const navegador = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const contexto = await navegador.newContext({ baseURL: base });
  const page = await contexto.newPage();

  try {
    if (senha) {
      // A senha da VITRINE (a loja inteira), não a de uma conta de cliente.
      // Vem antes da fixação porque, com a loja trancada, todo caminho
      // redireciona para cá — inclusive o que fixa o tema.
      await page.goto('/password');
      const campo = page.locator('input[name="password"]').first();
      if (await campo.count()) {
        await campo.fill(senha);
        // Esperar a NAVEGAÇÃO, não o estado do documento atual: um
        // `waitForLoadState` volta na hora, porque a página que já está
        // carregada já chegou nesse estado. O `goto` seguinte abortaria o POST
        // em voo, a sessão nunca abriria, e o erro sairia lá embaixo falando de
        // fixação de tema — mandando quem lê investigar o lugar errado.
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
          campo.press('Enter'),
        ]);
      }
    }

    await page.goto(paginaFixadora(id));

    const respondeu = await page.evaluate(() => ({
      temaId: window.Shopify?.theme?.id ?? null,
      ehNosso: 'shopUrl' in window,
      naSenha: window.location.pathname.replace(/\/$/, '').endsWith('/password'),
      barraDePreview: Boolean(document.querySelector('#preview-bar-iframe')),
    }));

    if (!respondeu.ehNosso) {
      throw new Error(
        `A loja respondeu, mas a página não é do tema: falta \`window.shopUrl\`. ` +
          `url=${page.url()} título="${await page.title()}". O caso mais comum é a ` +
          'proteção por senha da vitrine — confira o secret SHOPIFY_STORE_PASSWORD.'
      );
    }

    // `ehNosso` NÃO responde "tem sessão". A #27 deu ao tema a sua própria
    // página de senha, e ela emite `window.shopUrl` como qualquer outra — foi
    // exatamente assim que a sonda antiga passou a aprovar loja trancada sem
    // ninguém notar. Sem esta pergunta, uma senha errada (ou ausente numa loja
    // protegida) chegaria como "a sessão não ficou fixada", que é verdade e é
    // inútil: manda investigar a fixação quando o que falta é o secret.
    if (respondeu.naSenha) {
      throw new Error(
        'A loja continua pedindo a senha da vitrine: quem respondeu foi a página ' +
          `de senha DO TEMA (que também emite \`window.shopUrl\`). url=${page.url()}. ` +
          (senha
            ? 'SHOPIFY_STORE_PASSWORD chegou, então ela está errada ou o formulário ' +
              'da vitrine mudou.'
            : 'SHOPIFY_STORE_PASSWORD não chegou ao Playwright — é o secret que falta.')
      );
    }

    if (String(respondeu.temaId) !== String(id)) {
      throw new Error(
        `A sessão NÃO ficou fixada no tema empurrado. Pedimos ${id} e quem respondeu ` +
          `foi ${respondeu.temaId} — provavelmente o tema publicado. Medir assim daria ` +
          'uma suíte inteira verde sobre a loja de produção, e não sobre esta branch. ' +
          'Ver ADR 0007.'
      );
    }

    if (respondeu.barraDePreview) {
      throw new Error(
        'A barra de preview da Shopify está na página, e ela é markup que a vitrine ' +
          'publicada não tem — o axe mediria elementos que o tema não controla. O ' +
          `\`pb=0\` de \`${paginaFixadora(id)}\` deveria desligá-la; se a Shopify mudou ` +
          'esse parâmetro, é aqui que se corrige.'
      );
    }

    await contexto.storageState({ path: ARQUIVO_DE_SESSAO });
    console.log(`[setup] Sessão aberta no tema ${respondeu.temaId}, em ${base}.`);
  } finally {
    await navegador.close();
  }
}
