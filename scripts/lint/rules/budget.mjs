/**
 * budget — orçamento de performance dos assets globais.
 *
 * Só olha o que `layout/theme.liquid` carrega em TODA página. Asset co-locado
 * (renderizado dentro da section que o usa) não conta, porque só pesa onde é
 * necessário — esse é o padrão do tema e o linter existe para preservá-lo.
 *
 * Motivação: `swiper-bundle.min.js` são 151 KB carregados em toda página,
 * incluindo PDP, carrinho e conta, que não têm carrossel nenhum.
 */
import { bytes, offense, read } from '../lib.mjs';
import { readConfig } from '../exceptions.mjs';

export const meta = {
  name: 'budget',
  title: 'Orçamento de performance',
  description: 'Peso dos assets carregados em toda página, contra o teto declarado.',
  ratchet: false,
};

const THEME = 'layout/theme.liquid';

/**
 * Todo arquivo que o layout puxa em TODA página, seguindo `{% render %}`.
 *
 * Ler só o `theme.liquid` foi o que esta regra fazia até a #27 — e nessa issue
 * `application.css` e `color-scheme.css` saíram do layout para um snippet.
 * A conta caiu de 72 KB para 21 KB sozinha, sem uma linha a menos chegar no
 * navegador. Um orçamento que subnotifica não avisa: ele parabeniza.
 *
 * Seguir o render é o próprio critério da regra escrito direito — snippet que
 * o layout renderiza está em toda página, e por isso pesa em toda página.
 *
 * Conta a mais em um caso: `{% render %}` atrás de `{% if setting %}` (o botão
 * de voltar ao topo, o aviso de cookies) entra sempre. Orçamento erra para o
 * lado pessimista de propósito — o contrário seria descobrir o peso em
 * produção.
 */
export function fontesGlobais(entrada, ler) {
  const vistos = new Set();
  const fila = [entrada];
  const fontes = [];

  while (fila.length) {
    const file = fila.shift();
    if (vistos.has(file)) continue;
    vistos.add(file);

    let src;
    try {
      src = ler(file);
    } catch {
      continue;
    }

    fontes.push(src);
    for (const match of src.matchAll(/\{%-?\s*render\s+'([^']+)'/g)) {
      fila.push(`snippets/${match[1]}.liquid`);
    }
  }

  return fontes;
}

export function run() {
  const budget = readConfig('perf-budget.json');
  const src = fontesGlobais(THEME, read).join('\n');
  const offenses = [];

  const assets = { js: collect(src, /<script[^>]*src="\{\{\s*'([^']+)'\s*\|\s*asset_url/g), css: collect(src, /\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\|\s*stylesheet_tag/g) };

  for (const [kind, files] of Object.entries(assets)) {
    const total = files.reduce((sum, file) => sum + bytes(`assets/${file}`), 0);
    const limit = budget.global?.[kind];
    if (limit == null) continue;

    if (total > limit) {
      const heaviest = files
        .map((file) => ({ file, size: bytes(`assets/${file}`) }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 3)
        .map(({ file, size }) => `${file} (${kb(size)})`)
        .join(', ');
      offenses.push(
        offense({
          rule: 'budget',
          file: THEME,
          code: `global-${kind}`,
          message: `${kind.toUpperCase()} global soma ${kb(total)}, acima do teto de ${kb(limit)}. Maiores: ${heaviest}. Considere co-locar o asset na section que o usa.`,
        })
      );
    }
  }

  // Teto por arquivo individual — pega uma lib nova entrando sem discussão.
  for (const [file, limit] of Object.entries(budget.perAsset ?? {})) {
    const size = bytes(`assets/${file}`);
    if (size > limit) {
      offenses.push(
        offense({
          rule: 'budget',
          file: `assets/${file}`,
          code: `asset:${file}`,
          message: `${file} tem ${kb(size)}, acima do teto de ${kb(limit)}.`,
        })
      );
    }
  }

  return offenses;
}

function collect(src, pattern) {
  return [...src.matchAll(pattern)].map((m) => m[1]);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/**
 * Exposto para o painel de status mostrar os números mesmo quando passa.
 *
 * Usa a MESMA `fontesGlobais` do `run()`. Eram duas leituras independentes do
 * layout, e quando o `run()` foi corrigido para seguir os `{% render %}` o
 * painel continuou publicando o número velho — regra verde e painel mentindo,
 * lado a lado.
 */
export function measure() {
  const src = fontesGlobais(THEME, read).join('\n');
  const js = collect(src, /<script[^>]*src="\{\{\s*'([^']+)'\s*\|\s*asset_url/g);
  const css = collect(src, /\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\|\s*stylesheet_tag/g);
  const sum = (files) => files.reduce((total, file) => total + bytes(`assets/${file}`), 0);
  return { js: sum(js), css: sum(css), files: { js, css } };
}
