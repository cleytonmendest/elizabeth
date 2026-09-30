/**
 * imagens — toda foto é pedida à CDN numa largura.
 *
 * ── O defeito, medido (#163) ───────────────────────────────────────────────
 *
 * `image_url` sem `width` nem `height` devolve a foto no tamanho ORIGINAL, no
 * formato original. A documentação do filtro trata isso como erro ("You need
 * to specify either a width or height parameter"), e a loja entrega mesmo
 * assim: nenhum sintoma na tela, só bytes.
 *
 * Eram oito chamadas. O slider do topo servia `Banner_1_mobile.png`, 40 KB de
 * PNG, e era o LCP da home no Lighthouse mobile (3,5 s simulados). A galeria
 * do celular da PDP baixava TODAS as fotos do produto no tamanho original, e
 * a primeira é o LCP da página de produto — uma das três que a Theme Store
 * mede. Nenhuma regra olhava: `pontofocal` confere o corte, `budget` o CSS e
 * o JS globais.
 *
 * Com a largura pedida a CDN redimensiona e ainda converte para WebP ou AVIF.
 * O caminho preferido é `image_url: width: N | image_tag: widths: …, sizes: …`,
 * que gera o `srcset` sozinho.
 *
 * ── O que a regra lê ───────────────────────────────────────────────────────
 *
 * Os argumentos do filtro, até o próximo `|` ou o fim da tag, inclusive
 * quando a cadeia quebra linha (`| image_url\n | image_tag:`, que era o caso
 * da galeria de duas colunas). `width` ou `height` com qualquer valor passa;
 * `crop`, `format` ou `pad_color` sozinhos não bastam.
 */
import { allLiquid, lineAt, offense, read, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'imagens',
  title: 'Imagem com largura pedida',
  description: 'Todo image_url pede width ou height: sem isso a CDN entrega a foto original.',
  ratchet: true,
};

const FILTRO = /\|\s*image_url\b(?:\s*:([^|}%]*))?/g;

/** As chamadas de `image_url` sem `width` nem `height`. Pura, para o teste. */
export function semLargura(src) {
  return [...src.matchAll(FILTRO)]
    .filter(([, args = '']) => !/\b(?:width|height)\s*:/.test(args))
    .map((m) => m.index);
}

export function run() {
  const offenses = [];
  for (const file of allLiquid()) {
    const src = stripInert(read(file));
    for (const index of semLargura(src)) {
      const code = 'sem-largura';
      if (isAllowed('imagens', file, code)) continue;
      offenses.push(
        offense({
          rule: 'imagens',
          file,
          line: lineAt(src, index),
          code,
          message:
            '`image_url` sem `width` nem `height`: a CDN entrega a foto no tamanho e no formato ' +
            'originais, e no celular quem paga é o LCP. Peça a largura em que ela aparece e deixe o ' +
            "`image_tag` gerar o srcset: `image_url: width: 1200 | image_tag: widths: '…', sizes: '…'`.",
        })
      );
    }
  }
  return offenses;
}
