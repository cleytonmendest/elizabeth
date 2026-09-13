import http from 'node:http';

/**
 * Um servidor HTTP de mentira, para testar o que depende da RESPOSTA.
 *
 * ── Por que ele existe (#76) ───────────────────────────────────────────────
 *
 * A metade de navegador desta suíte tinha duas formas de conseguir uma página:
 * `setContent` (`e2e/gate.spec.mjs`, sem servidor nenhum) e a loja de verdade
 * em `THEME_URL`. Nenhuma das duas serve para provar uma guarda de NAVEGAÇÃO:
 * `setContent` não navega, e a loja não tem — nem deveria ter — uma rota que
 * responda documento novo na mesma URL só para o teste conseguir olhar.
 *
 * Daí este arquivo: rotas de mentira, servidas de verdade, por HTTP. O
 * navegador que as recebe é o mesmo Chromium, e a navegação que ele faz é uma
 * navegação real — com documento novo, contexto novo e `window` novo, que é o
 * que estava em questão.
 *
 * Ele não sabe nada sobre o tema, e é de propósito: quem monta a página é o
 * teste, porque é o teste que sabe qual defeito quer plantar.
 *
 * ── A fila por rota, e o que ela permite dizer ─────────────────────────────
 *
 * Cada rota recebe uma resposta ou uma LISTA delas, consumida na ordem (a
 * última se repete — mesma semântica do `pageFalso` de `tests/loja.test.mjs`).
 * É isso que torna possível a pergunta que a #76 pede: servir a MESMA URL duas
 * vezes, com temas diferentes, e exigir que a guarda repare no segundo. Sem a
 * fila, "provou o documento novo" e "provou o anterior" teriam a mesma cara —
 * que é o defeito que a issue inteira descreve.
 */
export async function servidorDeRotas(rotas) {
  const filas = new Map(
    Object.entries(rotas).map(([caminho, resposta]) => [
      caminho,
      Array.isArray(resposta) ? [...resposta] : [resposta],
    ])
  );

  const servidor = http.createServer((req, res) => {
    // Só o caminho: a fila é por ROTA, e é a query que fica igual entre as duas
    // respostas do caso "mesma URL".
    const { pathname } = new URL(req.url, 'http://127.0.0.1');
    const fila = filas.get(pathname);

    if (!fila) {
      // 404 com corpo NOSSO, e não a página em branco do Node: rota escrita
      // errada no teste vira "a guarda reprovou", e alguém procuraria o defeito
      // na guarda. Aqui ela reprova dizendo de onde veio a página.
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
        <title>404</title></head><body>servidorDeRotas: nenhuma resposta para ${pathname}
        </body></html>`);
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      // Sem cache: duas respostas diferentes para a MESMA URL é exatamente o
      // caso sob teste, e um 304 no meio dele mediria o cache do Chromium.
      'cache-control': 'no-store',
    });
    res.end(fila.length > 1 ? fila.shift() : fila[0]);
  });

  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));

  return {
    // Porta zero: o SO escolhe. Porta fixa daria corrida entre os workers do
    // Playwright, que rodam em paralelo por padrão.
    origem: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}
