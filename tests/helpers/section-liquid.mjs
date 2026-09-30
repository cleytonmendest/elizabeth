/**
 * Renderiza uma section ou um snippet do tema pelo liquidjs, com os filtros
 * de imagem da Shopify reproduzidos no que importa para os testes.
 *
 * Parte de `motorDaLoja()` (`t`, `money`, `asset_url`), e acrescenta:
 *
 *   image_url  a foto é um objeto com `src`; a URL leva a largura pedida
 *              (`?width=N`), para o teste ver que largura foi pedida — e ver
 *              quando nenhuma foi (#163).
 *   image_tag  escreve o que a Shopify escreve a partir dos parâmetros:
 *              `srcset` com uma entrada por largura de `widths`, `sizes`,
 *              `loading`, `fetchpriority`. O teste mede a DECISÃO do Liquid
 *              (quais larguras, qual prioridade para qual foto), e não a
 *              Shopify.
 *
 * Usado pela suíte de navegador (`e2e/slider-sem-salto.spec.mjs`) e pelos
 * testes de imagem: um renderizador só, para os dois não medirem sections
 * diferentes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motorDaLoja } from './liquid-loja.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const argumentos = (args) => Object.fromEntries(args.filter(Array.isArray));

export function motorComImagens() {
  const engine = motorDaLoja();
  engine.registerFilter('image_url', (imagem, ...args) => {
    if (!imagem?.src) return '';
    const { width, height } = argumentos(args);
    const largura = width ?? height;
    return largura ? `${imagem.src}?width=${largura}` : imagem.src;
  });
  engine.registerFilter('image_tag', (url, ...args) => {
    const a = argumentos(args);
    const base = String(url).split('?')[0];
    const srcset = a.widths
      ? String(a.widths)
          .split(',')
          .map((w) => `${base}?width=${w.trim()} ${w.trim()}w`)
          .join(', ')
      : '';
    const attrs = [
      ['src', url],
      ['srcset', srcset],
      ['sizes', a.sizes],
      ['alt', a.alt ?? ''],
      ['class', a.class],
      ['loading', a.loading],
      ['fetchpriority', a.fetchpriority],
      ['width', 600],
      ['height', 800],
    ].filter(([, v]) => v !== undefined && v !== '');
    return `<img ${attrs.map(([k, v]) => `${k}="${v}"`).join(' ')}>`;
  });
  return engine;
}

/**
 * Dois ajustes ao que o liquidjs aceita, nenhum no que a section desenha: o
 * `schema` não é Liquid de vitrine, e o bloco `comment … endcomment` DENTRO de
 * `{% liquid %}` é texto livre, que a Shopify aceita e o liquidjs não.
 */
export function renderizaArquivo(caminho, contexto) {
  const fonte = fs
    .readFileSync(path.join(RAIZ, caminho), 'utf8')
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/, '')
    .replace(/^[ \t]*comment[ \t]*\n[\s\S]*?^[ \t]*endcomment[ \t]*\n/gm, '');
  return motorComImagens().parseAndRenderSync(fonte, contexto);
}

export const renderizaSection = (arquivo, section) => renderizaArquivo(`sections/${arquivo}`, { section });
