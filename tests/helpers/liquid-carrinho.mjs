/**
 * Renderiza o Liquid do carrinho e do pedido com `liquidjs` — ADR 0014.
 *
 * ── Por que renderizar, e não escrever o HTML do teste à mão ───────────────
 *
 * O JS da página do carrinho troca regiões `[data-cart-live]` pelo HTML que o
 * servidor devolve. Um fixture escrito à mão testaria o JS contra um markup
 * que eu inventei: se o snippet renomear a região, esquecer a chave da linha
 * no nome dela ou deixar de desenhar o desconto, o teste continua verde
 * medindo um carrinho que não existe. A ADR 0014 já registrou esse modo de
 * falha três vezes no menu.
 *
 * Aqui o "servidor" do teste é o próprio `sections/main-cart.liquid`, e a
 * página viva também: os dois lados do contrato saem do mesmo arquivo que a
 * loja serve.
 *
 * ── O que é de mentira, e por que isso não compromete o que se mede ────────
 *
 * `liquidjs` não é o Liquid da Shopify. Os filtros que só a Shopify tem ganham
 * um substituto mínimo, e nenhum deles é o que está sob teste:
 *
 *   t            lê `locales/pt-BR.json` de verdade e interpola `{{ nome }}`.
 *                Chave que não existe volta como "translation missing", igual
 *                à loja — um teste que procurasse o texto reprovaria.
 *   money        centavos → "R$ 1.234,56" sem espaço especial, para o teste
 *                comparar texto sem depender do ICU do Node.
 *   image_url,   devolvem uma URL qualquer: o teste não olha imagem.
 *   asset_url,
 *   stylesheet_tag
 *
 * `cart`, `shop`, `settings` e `routes` vão como GLOBAIS, porque é assim na
 * Shopify: um snippet chamado por `{% render %}` não enxerga as variáveis de
 * quem o chamou, mas enxerga os objetos globais.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { readJSONC } from '../../scripts/lint/lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALE = readJSONC('locales/pt-BR.json');

function traduz(chave, argumentos) {
  const texto = chave.split('.').reduce((no, parte) => no?.[parte], LOCALE);
  if (typeof texto !== 'string') return `translation missing: pt-BR.${chave}`;
  // Argumento nomeado (`t: link: url`) chega do liquidjs como `[nome, valor]`.
  const valores = Object.fromEntries(argumentos.filter(Array.isArray));
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nome) => valores[nome] ?? '');
}

/** O `money` da Shopify com a moeda da loja de teste: BRL, vírgula decimal. */
export function dinheiro(centavos) {
  const [inteiro, decimal] = (Number(centavos) / 100).toFixed(2).split('.');
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimal}`;
}

function motor() {
  const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });
  engine.registerFilter('t', (chave, ...argumentos) => traduz(chave, argumentos));
  engine.registerFilter('money', dinheiro);
  engine.registerFilter('image_url', () => 'https://cdn.teste/imagem.jpg');
  engine.registerFilter('asset_url', (nome) => `/assets/${nome}`);
  engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);
  return engine;
}

/**
 * Renderiza um arquivo do tema. O `{% schema %}` sai antes: é JSON para o
 * editor, não markup, e o `liquidjs` não conhece a tag.
 */
export function renderiza(arquivo, { globais = {}, escopo = {} } = {}) {
  const fonte = fs
    .readFileSync(path.join(RAIZ, arquivo), 'utf8')
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/, '');
  return motor().parseAndRenderSync(fonte, escopo, { globals: globais });
}

/**
 * Uma linha de carrinho no formato que a Shopify usa nos DOIS lados: o drop do
 * Liquid e o JSON de `/cart.js` têm os mesmos nomes de campo. Por isso o mesmo
 * objeto serve para renderizar a section e para publicar o `cart-update`.
 */
export function linha({ key = '111:aaa', index = 0, preco = 20000, desconto = null, ...resto } = {}) {
  const abatido = desconto ? desconto.valor : 0;
  return {
    key,
    index,
    id: 111,
    product_id: 1,
    url: '/products/vestido-midi',
    vendor: 'Elizabeth',
    image: null,
    product: { title: 'Vestido midi', has_only_default_variant: true },
    variant: { title: 'Default Title', inventory_quantity: 10 },
    quantity: 1,
    properties: {},
    selling_plan_allocation: null,
    unit_price: null,
    unit_price_measurement: null,
    original_line_price: preco,
    final_line_price: preco - abatido,
    line_level_discount_allocations: desconto
      ? [{ amount: desconto.valor, discount_application: { title: desconto.nome } }]
      : [],
    ...resto,
  };
}

/** Um carrinho com os totais coerentes com as linhas e os descontos de pedido. */
export function carrinho(itens, { descontosDoPedido = [], taxes_included = false } = {}) {
  const subtotal = itens.reduce((soma, item) => soma + item.final_line_price, 0);
  const doPedido = descontosDoPedido.reduce((soma, d) => soma + d.valor, 0);
  const deItem = itens.reduce((soma, item) => soma + (item.original_line_price - item.final_line_price), 0);
  return {
    item_count: itens.reduce((soma, item) => soma + item.quantity, 0),
    items: itens,
    items_subtotal_price: subtotal,
    total_discount: deItem + doPedido,
    total_price: subtotal - doPedido,
    taxes_included,
    note: '',
    cart_level_discount_applications: descontosDoPedido.map((d) => ({
      title: d.nome,
      total_allocated_amount: d.valor,
    })),
  };
}

/** Os globais de uma página de carrinho, com o que cada teste quiser trocar. */
export function globaisDaLoja(cart, extras = {}) {
  return {
    cart,
    shop: { shipping_policy: { body: '', url: '/policies/shipping-policy' } },
    settings: { cart_notes: false, customer_color_scheme: 'scheme-1' },
    routes: { cart_url: '/cart', all_products_collection_url: '/collections/all', account_url: '/account', root_url: '/' },
    additional_checkout_buttons: false,
    content_for_additional_checkout_buttons: '',
    ...extras,
  };
}
