/**
 * Carrega um arquivo de `assets/` do jeito que o navegador carrega.
 *
 * ── Por que não `import` ───────────────────────────────────────────────────
 *
 * Os assets do tema são scripts CLÁSSICOS: o Liquid os injeta com
 * `<script src="…" defer>`, sem `type="module"`. Eles não exportam nada, e
 * `price-component.js` depende de `formatPrice` ser uma variável GLOBAL
 * criada por `cart.js`. Transformá-los em módulos ES só para poder testá-los
 * mudaria o que está em produção para agradar o teste — e o teste passaria a
 * medir outro programa.
 *
 * Então o carregador reproduz a semântica de script clássico: o fonte é
 * avaliado em modo não-estrito, e o que ele declara no topo pode ser promovido
 * a global (`loadGlobalAsset`), exatamente como `window.formatPrice` no
 * navegador. O que se testa é o arquivo que vai para a loja, byte a byte.
 *
 * O epílogo `return {…}` é o único acréscimo: sem ele não haveria como o teste
 * alcançar `CartManager` (uma `class`, que não vira propriedade do global nem
 * no navegador). Pedir um nome que o arquivo não declara é erro imediato — um
 * teste não pode passar porque o alvo sumiu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadAsset(file, names = []) {
  const filePath = path.join(ROOT, 'assets', file);
  const source = fs.readFileSync(filePath, 'utf8');

  let factory;
  try {
    factory = new Function(`${source}\n;return { ${names.join(', ')} };`);
  } catch (error) {
    throw new Error(`assets/${file} não compila: ${error.message}`);
  }

  const exported = factory();
  const missing = names.filter((name) => exported[name] === undefined);
  if (missing.length) {
    throw new Error(
      `assets/${file} não declara: ${missing.join(', ')}. ` +
        'O teste ficaria verde testando `undefined` — renomeie no teste ou devolva o nome ao arquivo.'
    );
  }
  return exported;
}

/**
 * Igual ao anterior, mas também publica os nomes no objeto global — que é o
 * que uma `function` declarada no topo de um script clássico faz sozinha.
 * É assim que `price-component.js` enxerga `formatPrice`.
 */
export function loadGlobalAsset(file, names = []) {
  const exported = loadAsset(file, names);
  Object.assign(globalThis, exported);
  return exported;
}
