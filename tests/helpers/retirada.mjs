/**
 * A retirada na loja (#137) renderizada pelo Liquid do próprio tema.
 *
 * Usado por `tests/pickup-availability.test.mjs` (jsdom) e por
 * `e2e/retirada.spec.mjs` (Chromium). Os dois recebem a SAÍDA dos snippets, e
 * não uma cópia da marcação: uma fixture escrita à mão continuaria com
 * `data-pickup-abrir` depois que o Liquid o renomeasse, e os dois ficariam
 * verdes medindo um botão que a loja não tem. Um módulo só também impede que
 * as duas metades da suíte meçam fixtures diferentes.
 *
 * O limite vale escrito: o `liquidjs` não é o Liquid da Shopify. Os objetos
 * (`store_availabilities`, `location.address`) são montados com os nomes da
 * documentação, e `format_address` é um substituto. O que a loja devolve de
 * verdade é pergunta para o e2e com `THEME_URL` e um local com retirada ativa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const LOCALE = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'locales/pt-BR.json'), 'utf8').replace(/^\/\*[\s\S]*?\*\//, '')
);

/**
 * `t` de verdade: lê a chave do locale e interpola. Chave inexistente ESTOURA —
 * devolver a própria chave deixaria o teste verde exibindo "translation
 * missing", que é o texto que a loja mostraria.
 */
function traduz(chave, ...args) {
  const texto = chave.split('.').reduce((no, parte) => (no ? no[parte] : undefined), LOCALE);
  if (typeof texto !== 'string') throw new Error(`chave ausente em pt-BR.json: ${chave}`);
  const valores = Object.fromEntries(args.filter(Array.isArray));
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nome) => String(valores[nome] ?? ''));
}

const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });
engine.registerFilter('t', traduz);
engine.registerFilter('asset_url', (arquivo) => `/cdn/${arquivo}`);
// Substituto: a Shopify formata por país. Aqui só importa que o endereço saia.
engine.registerFilter('format_address', (a) => `<p>${[a.address1, a.city].filter(Boolean).join('<br>')}</p>`);

export const PRAZO = 'Normalmente fica pronto em 24 horas';

/** Um `store_availability`, com os nomes da documentação da Shopify. */
export const local = (nome, { disponivel = true, retirada = true, telefone = '' } = {}) => ({
  available: disponivel,
  pick_up_enabled: retirada,
  pick_up_time: PRAZO,
  location: { name: nome, address: { address1: `Rua ${nome}, 10`, city: 'São Paulo', phone: telefone } },
});

export const variante = (id, locais, titulo = `Tamanho ${id}`) => ({
  id,
  title: titulo,
  store_availabilities: locais,
  product: { title: 'Vestido Midi', has_only_default_variant: false },
});

/** O que `snippets/pickup-availability-info.liquid` imprime para a variante. */
export const info = (v) => engine.renderFileSync('pickup-availability-info', { variant: v });

/** O que a PDP imprime no carregamento: o hospedeiro, com a variante inicial. */
export const hospedeiro = (v) =>
  engine.renderFileSync('pickup-availability', { product: { selected_or_first_available_variant: v } });

/** O corpo que a Section Rendering API devolve para `?section_id=pickup-availability`. */
export const respostaDaSecao = (v) =>
  `<div id="shopify-section-pickup-availability" class="shopify-section">${info(v)}</div>`;
