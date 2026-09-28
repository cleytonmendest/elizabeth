// @vitest-environment node

/**
 * Os CSS gerados pelo Tailwind são DOIS: o global e o do checkout acelerado,
 * co-locado na PDP. A regra `build` compara cada par de `scripts/build-css.mjs`
 * com o que está em `assets/`, mas quem GERA é o script `build` do
 * package.json — e as duas listas só concordam se alguém lembrar de mexer nas
 * duas.
 *
 * Um par que a regra conhece e o build não gera reprova todo commit com
 * "desatualizado" sem que `npm run build` conserte nada. O inverso é pior: o
 * build gera um arquivo que a regra nunca confere, e a edição à mão nele
 * sobrevive a tudo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CSS } from '../scripts/build-css.mjs';
import { ROOT } from '../scripts/build-js.mjs';

const build = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.build;
const geradosPeloBuild = [...build.matchAll(/tailwindcss -i \.\/(\S+) -o \.\/(\S+)/g)].map(([, fonte, destino]) => [
  fonte,
  destino,
]);

describe('CSS gerado', () => {
  it('o `build` do package.json gera exatamente os pares que a regra confere', () => {
    expect(geradosPeloBuild).toEqual(CSS);
  });

  it.each(CSS)('%s existe e o artefato %s está commitado', (fonte, destino) => {
    expect(fs.existsSync(path.join(ROOT, fonte))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, destino))).toBe(true);
  });
});
