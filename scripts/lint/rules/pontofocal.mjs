/**
 * pontofocal — imagem que o tema CORTA respeita o ponto focal da lojista.
 *
 * ── O defeito, medido ──────────────────────────────────────────────────────
 *
 * A lojista marca o ponto focal de uma foto no admin (no editor de tema, ou em
 * Conteúdo › Arquivos) para dizer o que não pode sair do quadro quando o tema
 * corta a imagem. Em moda é a diferença entre cortar o rosto da modelo e
 * cortar a barra do vestido. A Theme Store exige esse suporte.
 *
 * Quem aplica o ponto é o CSS `object-position`, e o filtro `image_tag` o
 * escreve sozinho. Uma tag `<img>` escrita à mão não escreve nada: com
 * `object-cover` o corte fica sempre no centro, e o ponto marcado é ignorado
 * SEM erro nenhum — a foto aparece, só que cortada no lugar errado. Não há
 * sintoma que um teste de "a imagem carregou" veja.
 *
 * Medido em abb6f78 (issue #142): as 13 imagens que vinham de `image_tag`
 * estavam certas, e dez arquivos cortavam com `object-cover` numa tag escrita
 * à mão — o card de produto entre eles, a imagem mais vista da loja. Nenhum
 * linter reclamava, porque nenhum olhava.
 *
 * ── O que a regra exige ────────────────────────────────────────────────────
 *
 * Toda `<img>` escrita à mão com classe que CORTA — `object-cover` ou
 * `object-none`, com ou sem variante (`md:object-cover`), ou `object-fit:
 * cover|none` no `style` — declara `object-position: {{ ….presentation.
 * focal_point }}`. O caminho preferido é não escrever a tag: `image_tag`
 * aplica o ponto focal e ainda gera `srcset`, `width`/`height` coerentes.
 *
 * Imagem que sai de `image_tag` não é `<img` no fonte, então não passa por
 * aqui — e é exatamente por isso que ela está certa.
 *
 * ── O que NÃO conta como ponto focal ───────────────────────────────────────
 *
 * `object-position` com valor FIXO (`object-top`, `object-position: center`).
 * Ele troca o centro por outro ponto que a lojista também não escolheu — é o
 * mesmo defeito com outra coordenada.
 *
 * `object-contain` e `object-fill` não cortam: a foto inteira aparece, e o
 * ponto focal não tem o que decidir. Ficam de fora.
 *
 * ── Onde a tag termina ─────────────────────────────────────────────────────
 *
 * O card de produto tinha `{% if … card_product.images.size > 1 %}` dentro do
 * `class`. Um `<img[^>]*>` ingênuo termina a tag nesse `>`: o que vem antes é
 * lido, o que vem depois some — e um `object-position` escrito depois faria a
 * regra acusar a própria correção.
 *
 * Duas proteções, porque o `>` aparece em dois lugares. O Liquid vira espaço
 * do mesmo tamanho antes de procurar a fronteira (`{% if a > b %}` ENTRE dois
 * atributos), e valor entre aspas não encerra a tag (`sizes="(width > 640px)
 * 33vw"`, que não é Liquid). O texto ORIGINAL é lido entre as fronteiras
 * achadas no mascarado — os índices coincidem porque a máscara preserva o
 * tamanho.
 *
 * ── O limite ───────────────────────────────────────────────────────────────
 *
 * A regra lê Liquid. Imagem cujo `src` só chega em runtime não tem ponto focal
 * para declarar se a fonte dos dados não o traz — e a busca preditiva é o
 * caso: `/search/suggest.json` descreve a imagem com `url`, `alt`, `width`,
 * `height` e `aspect_ratio`, sem ponto focal. Ela vive como exceção registrada
 * em `design-exceptions.json`, com o motivo, e o código traz a ORIGEM da
 * imagem (`img:card_product.featured_image`, `img:src-vazio`) para a exceção
 * liberar aquela tag e não o arquivo inteiro.
 */
import { allLiquid, lineAt, offense, read, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'pontofocal',
  title: 'Ponto focal das imagens',
  description: 'Toda <img> que corta (object-cover) vem de image_tag ou declara object-position com o ponto focal.',
  ratchet: true,
};

/**
 * `{{ … }}` e `{% … %}` viram espaço, preservando o tamanho e as quebras de
 * linha: os índices do texto mascarado valem no original.
 */
export const semLiquid = (src) =>
  src.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, (m) => m.replace(/[^\n]/g, ' '));

/** Uma tag `<img>` inteira: `>` dentro de aspas não a encerra. */
const TAG_IMG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

/**
 * O que corta. `(?<![\w-])` aceita a variante do Tailwind (`md:object-cover`,
 * `!object-cover`) e rejeita nome maior (`not-object-cover`).
 */
export const CORTA = /(?<![\w-])object-(?:cover|none)(?![\w-])|object-fit\s*:\s*(?:cover|none)\b/i;

/** O ponto focal DA LOJISTA: `object-position` cujo valor sai de `focal_point`. */
export const PONTO_FOCAL = /object-position\s*:\s*\{\{[^}]*\bfocal_point\b/;

/** De onde vem a imagem — o que torna o código do fingerprint específico. */
export function origem(tag) {
  const liquid = tag.match(/(?<![\w-])src\s*=\s*["']\s*\{\{-?\s*([^\s|}]+)/);
  if (liquid) return liquid[1];
  const valor = tag.match(/(?<![\w-])src\s*=\s*(["'])([\s\S]*?)\1/);
  if (valor && valor[2].trim() === '') return 'src-vazio';
  return 'src-fixo';
}

/**
 * As violações de UM fonte. Separada de `run()` para o teste injetar a fonte:
 * depois da #142 o tema não tem nenhuma, e teste que só percorre o caminho
 * verde não sabe se o vermelho existe.
 */
export function violacoesEm(file, src) {
  // `stripInert` antes de tudo: `<img>` dentro de `{% comment %}` é exemplo
  // de documentação, não markup que a cliente recebe.
  const limpo = stripInert(src);
  const mascarado = semLiquid(limpo);
  const offenses = [];

  for (const match of mascarado.matchAll(TAG_IMG)) {
    const tag = limpo.slice(match.index, match.index + match[0].length);
    if (!CORTA.test(match[0])) continue;
    if (PONTO_FOCAL.test(tag)) continue;

    const de = origem(tag);
    offenses.push(
      offense({
        rule: 'pontofocal',
        file,
        line: lineAt(limpo, match.index),
        // Sem a linha: mover a tag de lugar não pode virar dívida nova.
        code: `img:${de}`,
        message:
          '<img> que corta (object-cover) sem o ponto focal: o corte fica sempre no centro e ' +
          'ignora o ponto que a lojista marcou no admin — o rosto da modelo sai do quadro. ' +
          'Troque a tag por `{{ imagem | image_url: … | image_tag: … }}`, que aplica o ponto ' +
          'focal sozinho; se o markup não permitir, declare ' +
          'style="object-position: {{ imagem.presentation.focal_point }}". Ver issue #142.',
      })
    );
  }

  return offenses;
}

export function run() {
  const offenses = [];

  for (const file of allLiquid()) {
    for (const achado of violacoesEm(file, read(file))) {
      if (isAllowed('pontofocal', file, achado.code)) continue;
      offenses.push(achado);
    }
  }

  return offenses;
}
