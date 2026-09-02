#!/usr/bin/env node
/**
 * Onde a suíte de navegador vai medir.
 *
 *   node scripts/tema-de-teste.mjs --json tema.json >> "$GITHUB_ENV"
 *
 * Lê o `tema.json` que `shopify theme push --json` deixou e devolve as duas
 * variáveis que o Playwright precisa: a ORIGEM da loja e o ID do tema a
 * pré-visualizar. Ver ADR 0007.
 *
 * ── Por que a origem e o id, e não a preview_url inteira ──────────────────
 *
 * A `preview_url` vem com `?preview_theme_id=N`. Usá-la como `baseURL` do
 * Playwright não funciona: `page.goto('/cart')` monta a URL a partir da
 * origem e DESCARTA a query — a suíte inteira mediria o tema publicado
 * enquanto o relatório diria que mediu este.
 *
 * Falharia em silêncio, e com a pior cara possível: verde, medindo a loja
 * de produção. Por isso a origem e o id viajam separados, e quem fixa o
 * tema na sessão é `e2e/global-setup.mjs`, uma vez, com asserção.
 *
 * ── Os três desfechos ─────────────────────────────────────────────────────
 *
 *   ausente    o push não rodou (sem credencial, ou PR de fork). Não escreve
 *              THEME_URL, sai 0 — a suíte se declara PULADA com o motivo.
 *   invalido   o push devolveu algo imprestável. Sai 1: afirmar que a loja
 *              está medida sem ter URL seria a mentira que este repositório
 *              já pagou na sonda que aprovava qualquer 200.
 *   ok         escreve THEME_URL e PREVIEW_THEME_ID.
 */
import fs from 'node:fs';
import { avaliar } from './preview.mjs';

/**
 * A origem de uma URL, sem caminho nem query. Pura para poder ser testada:
 * é aqui que mora o defeito silencioso de deixar a query passar adiante.
 */
export function origem(url) {
  return new URL(url).origin;
}

/**
 * O `preview_theme_id` que a URL carrega. O `theme.id` do JSON diz a mesma
 * coisa, mas a URL é o que a Shopify de fato honra — e quando os dois
 * discordam, quem manda é ela.
 */
export function idDoTema(url) {
  const valor = new URL(url).searchParams.get('preview_theme_id');
  return valor ? valor.trim() : '';
}

/** As linhas de `chave=valor` para o $GITHUB_ENV, ou o motivo de não haver. */
export function decidir({ bruto }) {
  const veredito = avaliar({ bruto });

  if (veredito.estado === 'ausente') {
    return { ok: true, medindo: false, recado: veredito.motivo, linhas: [] };
  }

  if (veredito.estado === 'invalido') {
    return { ok: false, medindo: false, recado: veredito.motivo, linhas: [] };
  }

  const url = veredito.tema.previewUrl;
  const id = idDoTema(url) || String(veredito.tema.id ?? '');

  if (!id) {
    return {
      ok: false,
      medindo: false,
      recado:
        `A preview_url não traz \`preview_theme_id\` e o JSON não trouxe \`id\`: ${url}. ` +
        'Sem o id não há como fixar o tema na sessão, e a suíte mediria o tema PUBLICADO ' +
        'achando que mede este.',
      linhas: [],
    };
  }

  return {
    ok: true,
    medindo: true,
    recado: `Medindo o tema ${id} em ${origem(url)}.`,
    linhas: [`THEME_URL=${origem(url)}`, `PREVIEW_THEME_ID=${id}`],
  };
}

// ---------------------------------------------------------------------------

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? padrao : process.argv[i + 1];
}

function main() {
  const caminho = argumento('json', 'tema.json');
  const bruto = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8') : null;

  const { ok, medindo, recado, linhas } = decidir({ bruto });

  // Diagnóstico no stderr, `chave=valor` no stdout. A separação não é estilo:
  // a saída deste script vai para `>> "$GITHUB_ENV"`, e uma frase em português
  // no meio do arquivo de ambiente quebra o passo seguinte com um erro que não
  // fala deste script.
  if (!ok) {
    console.error(`::error::${recado}`);
    return 1;
  }

  console.error(medindo ? recado : `Sem tema para medir: ${recado}`);
  for (const linha of linhas) console.log(linha);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('tema-de-teste.mjs')) {
  process.exit(main());
}
