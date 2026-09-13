/**
 * A guarda do clique consegue reprovar? E ela reprova pelo motivo certo?
 *
 * Este arquivo é irmão de `e2e/gate.spec.mjs`: ele não mede o tema, mede o
 * VERIFICADOR. Não precisa de loja, e por isso roda em toda execução — o que
 * ele serve não é a vitrine, é um servidor HTTP local com duas rotas escolhidas
 * (`e2e/helpers/servidor.mjs`).
 *
 * ── Por que ele não podia ficar em jsdom (#76) ─────────────────────────────
 *
 * `tests/loja.test.mjs` cobre a mesma função com um navegador de mentira, e
 * cobre bem: ele separa documento de URL, porque foi escrito para separar. É
 * essa a armadilha — um falso concorda com quem o escreveu. A afirmação "trocar
 * de documento apaga o `window`, e `history.pushState` não" é sobre o
 * NAVEGADOR, não sobre a nossa função, e nenhum falso pode prová-la.
 *
 * Aqui ela é medida: o Chromium é o mesmo dos outros testes, a navegação é uma
 * navegação de verdade, e as duas rotas são os dois casos em que a URL e o
 * documento se separam.
 *
 *   /mesma-url    form GET que reposta os MESMOS parâmetros → documento novo,
 *                 href idêntico. Medindo a URL, a guarda estourava aqui.
 *   /push-state   botão que só chama `history.pushState`    → href novo,
 *                 documento velho. Medindo a URL, a guarda APROVAVA aqui.
 *
 * O par é o ponto. Uma guarda que reprova tudo também não verifica nada: ela
 * só ensina a ser ignorada.
 */
import { test as base, expect } from '@playwright/test';
import { clicaNoTema, MARCA_DO_TEMA } from './helpers/loja.mjs';
import { servidorDeRotas } from './helpers/servidor.mjs';

/**
 * Ids que não são de tema nenhum. O que importa é serem DOIS e diferentes:
 * um é o que a guarda espera, o outro faz o papel da vitrine publicada
 * respondendo no lugar dela.
 */
const NOSSO = '900000000001';
const PUBLICADO = '900000000002';

/**
 * Uma página que se apresenta como do tema: emite a marca e o id, como
 * `snippets/theme-head.liquid` e o `content_for_header` fazem na loja.
 *
 * A marca vem da constante, e não da string: quem serve a página de teste e
 * quem a inspeciona precisam mudar juntos, senão este arquivo passa a plantar
 * um defeito que a guarda de hoje nem procura mais.
 */
const paginaDoTema = ({ temaId = NOSSO, corpo, titulo = 'Página servida' }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  <script>
    window[${JSON.stringify(MARCA_DO_TEMA)}] = 'http://127.0.0.1/nao-e-uma-loja';
    window.Shopify = { theme: { id: ${JSON.stringify(temaId)} } };
  </script>
</head>
<body><main>${corpo}</main></body>
</html>`;

/** Form GET que reposta os mesmos parâmetros: documento novo, MESMA URL. */
const FORM_PARA_A_MESMA_URL = `
  <form method="GET" action="/mesma-url">
    <input type="hidden" name="filtro" value="preto">
    <button type="submit">Aplicar de novo</button>
  </form>`;

/** Botão que muda a URL sem trocar o documento. */
const BOTAO_DE_PUSH_STATE = `
  <button type="button" id="empurra">Filtrar por cor</button>
  <script>
    document.getElementById('empurra').addEventListener('click', () => {
      history.pushState({}, '', '/push-state?cor=preto');
    });
  </script>`;

const test = base.extend({
  /**
   * Sobe servidores e os derruba no fim do teste, sem cada teste precisar
   * lembrar do `finally`.
   */
  servir: async ({}, use) => {
    const abertos = [];
    await use(async (rotas) => {
      const servidor = await servidorDeRotas(rotas);
      abertos.push(servidor);
      return servidor;
    });
    for (const servidor of abertos) await servidor.fechar();
  },
});

/**
 * `clicaNoTema` lê `PREVIEW_THEME_ID` do ambiente, e este arquivo precisa que
 * ele valha o id de mentira acima.
 *
 * Escrito por teste e desfeito depois, e não uma vez no topo do módulo: os
 * workers do Playwright rodam VÁRIOS arquivos no mesmo processo, em sequência.
 * Um `process.env` sujo aqui vazaria para `e2e/a11y.spec.mjs` no mesmo worker,
 * e a suíte de storefront reprovaria toda navegação dizendo que o tema é outro
 * — uma falha real, apontando para o lugar errado.
 */
let anterior;
test.beforeEach(() => {
  anterior = process.env.PREVIEW_THEME_ID;
  process.env.PREVIEW_THEME_ID = NOSSO;
});
test.afterEach(() => {
  if (anterior === undefined) delete process.env.PREVIEW_THEME_ID;
  else process.env.PREVIEW_THEME_ID = anterior;
});

test.describe('o clique que traz documento novo', () => {
  test('link para outra URL: a guarda aprova', async ({ page, servir }) => {
    // O caso comum, e o controle dos outros: se ele reprovasse, os testes
    // abaixo estariam medindo uma guarda quebrada e diriam a mesma coisa.
    const { origem } = await servir({
      '/colecao': paginaDoTema({ corpo: '<a href="/produto">Vestido midi</a>' }),
      '/produto': paginaDoTema({ corpo: '<h1>Vestido midi</h1>' }),
    });

    await page.goto(`${origem}/colecao`);
    await expect(
      clicaNoTema(page, page.getByRole('link', { name: 'Vestido midi' }), 'o primeiro produto')
    ).resolves.toBeUndefined();
    await expect(page.locator('h1')).toHaveText('Vestido midi');
  });

  test('form GET que reposta os mesmos parâmetros: MESMA URL, e a guarda aprova', async ({
    page,
    servir,
  }) => {
    // Este é o caso 1 da #76. Medindo a URL, a espera estourava em 15s sobre
    // uma página que existia justamente para ser provada.
    const { origem } = await servir({
      '/mesma-url': paginaDoTema({ corpo: FORM_PARA_A_MESMA_URL }),
    });

    await page.goto(`${origem}/mesma-url?filtro=preto`);
    const antes = page.url();

    await expect(
      clicaNoTema(page, page.getByRole('button', { name: 'Aplicar de novo' }), 'o filtro já aplicado')
    ).resolves.toBeUndefined();

    // A URL não mudou — é o que torna o caso interessante.
    expect(page.url()).toBe(antes);
  });

  test('e o tema provado é o do documento NOVO, não o do anterior', async ({ page, servir }) => {
    // A metade que importa. As duas respostas têm a MESMA URL e temas
    // diferentes: uma guarda que responda pela página anterior fica verde e
    // mente, e nenhuma asserção sobre URL notaria.
    const { origem } = await servir({
      '/mesma-url': [
        paginaDoTema({ corpo: FORM_PARA_A_MESMA_URL }),
        paginaDoTema({ corpo: FORM_PARA_A_MESMA_URL, temaId: PUBLICADO }),
      ],
    });

    await page.goto(`${origem}/mesma-url?filtro=preto`);
    const erro = await clicaNoTema(
      page,
      page.getByRole('button', { name: 'Aplicar de novo' }),
      'o filtro já aplicado'
    ).catch((e) => e);

    expect(erro.message).toMatch(/tema ERRADO/);
    expect(erro.message).toContain(PUBLICADO);
  });
});

test.describe('o clique que NÃO traz documento novo', () => {
  test('`history.pushState` reprova, mesmo tendo mudado a URL', async ({ page, servir }) => {
    // Caso 2 da #76: aqui a guarda aprovava em silêncio, provando de novo o
    // documento que a entrada já tinha provado. Nada quebrava — e é assim que
    // um clique não-navegante seria embrulhado por engano, e a guarda deixaria
    // de guardar sem ninguém notar.
    const { origem } = await servir({
      '/push-state': paginaDoTema({ corpo: BOTAO_DE_PUSH_STATE }),
    });

    await page.goto(`${origem}/push-state`);
    const erro = await clicaNoTema(
      page,
      page.getByRole('button', { name: 'Filtrar por cor' }),
      'o filtro de cor'
    ).catch((e) => e);

    expect(erro.message).toContain('não trouxe DOCUMENTO NOVO');
    expect(erro.message).toContain('A URL até MUDOU');
    // E a URL mudou MESMO: é a prova de que o teste plantou o caso que dizia
    // plantar, e não um botão inerte com outro nome.
    expect(page.url()).toContain('cor=preto');
  });

  test('botão inerte reprova dizendo que a página continua onde estava', async ({
    page,
    servir,
  }) => {
    const { origem } = await servir({
      '/inerte': paginaDoTema({ corpo: '<button type="button">Não faço nada</button>' }),
    });

    await page.goto(`${origem}/inerte`);
    const erro = await clicaNoTema(
      page,
      page.getByRole('button', { name: 'Não faço nada' }),
      'um botão que não navega'
    ).catch((e) => e);

    expect(erro.message).toContain('não trouxe DOCUMENTO NOVO');
    expect(erro.message).toContain('chame-o CRU');
    expect(erro.message).not.toContain('A URL até MUDOU');
  });
});
