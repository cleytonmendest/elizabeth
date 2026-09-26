/**
 * Renderiza o `snippets/add-to-cart.liquid` DE VERDADE, com o `liquidjs`.
 *
 * ── Por que renderizar em vez de escrever a DOM à mão ──────────────────────
 *
 * O form de produto é onde três requisitos da Theme Store se encontram — o
 * checkout acelerado (#134), o Shop Pay Installments (#138) e o destinatário do
 * vale-presente (#139) — e o que decide cada um é um `{% if %}` no Liquid: o
 * acelerado some em vale-presente, nasce escondido em variante esgotada, e os
 * campos do destinatário nascem no estado sem JavaScript. Uma fixture escrita
 * à mão testaria a fixture. Esta aqui testa o arquivo que vai para a loja.
 *
 * ── O que é de mentira, e por quê ──────────────────────────────────────────
 *
 * O `liquidjs` não é o Liquid da Shopify (ver `tests/menu-forma.test.mjs`).
 * Faltam três peças, e cada uma é substituída pelo mínimo que ainda MEDE:
 *
 *   {% form %}        vira `<form>` e põe um objeto `form` no escopo — o que
 *                     o teste passar (valores e erros do último envio).
 *   payment_button    devolvem um marcador. E RECUSAM qualquer coisa que não
 *   payment_terms     seja o `form` de um `{% form 'product' %}`: fora do form
 *                     a Shopify não renderiza nada, em silêncio; aqui o teste
 *                     fica vermelho.
 *   t                 lê `locales/pt-BR.json` e reprova chave inexistente — o
 *                     "translation missing" que a vitrine mostraria.
 *
 * O `id:` do `{% form %}` não é reproduzido: ele é da Shopify, não deste tema.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag } from 'liquidjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const lerJSONC = (arquivo) =>
  JSON.parse(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));

const LOCALE = lerJSONC('locales/pt-BR.json');

function traduz(chave, ...args) {
  const texto = chave.split('.').reduce((no, parte) => (no == null ? no : no[parte]), LOCALE);
  if (typeof texto !== 'string') throw new Error(`translation missing: pt-BR.${chave}`);
  // Os argumentos do filtro chegam como pares [nome, valor].
  const vars = Object.fromEntries(args.filter(Array.isArray));
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nome) => String(vars[nome] ?? ''));
}

/** Os valores do último envio que o `{% form %}` expõe. Trocado a cada render. */
let formDoEnvio = {};

class FormTag extends Tag {
  constructor(token, remainTokens, liquid, parser) {
    super(token, remainTokens, liquid);
    this.tipo = /^\s*'([^']+)'/.exec(token.args)?.[1];
    this.classe = /class:\s*'([^']*)'/.exec(token.args)?.[1] ?? '';
    this.templates = [];
    while (remainTokens.length) {
      const proximo = remainTokens.shift();
      if (proximo.name === 'endform') return;
      this.templates.push(parser.parseToken(proximo, remainTokens));
    }
    throw new Error(`${token.getText()} sem {% endform %}`);
  }

  *render(ctx, emitter) {
    ctx.push({ form: { ...formDoEnvio, __tipo: this.tipo } });
    emitter.write(`<form method="post" action="/cart/add" class="${this.classe}" novalidate>`);
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    emitter.write('</form>');
    ctx.pop();
  }
}

function soDentroDoFormDeProduto(filtro, marcador) {
  return (form) => {
    if (form?.__tipo !== 'product') {
      throw new Error(`{{ form | ${filtro} }} fora de um {% form 'product' %}`);
    }
    return marcador;
  };
}

const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });
engine.registerTag('form', FormTag);
engine.registerFilter('t', traduz);
engine.registerFilter('asset_url', (arquivo) => `/assets/${arquivo}`);
engine.registerFilter(
  'payment_button',
  soDentroDoFormDeProduto('payment_button', '<shopify-accelerated-checkout data-teste="payment_button"></shopify-accelerated-checkout>'),
);
engine.registerFilter(
  'payment_terms',
  soDentroDoFormDeProduto('payment_terms', '<shopify-payment-terms data-teste="payment_terms"></shopify-payment-terms>'),
);

/** Um produto como o Liquid o vê. */
export const produto = ({ giftCard = false, disponivel = true, id = 7, variante = 42 } = {}) => ({
  id,
  'gift_card?': giftCard,
  selected_or_first_available_variant: { id: variante, available: disponivel },
});

/** O bloco `buy_button`. Os settings que o teste não disser ficam de fora. */
export const bloco = (settings = {}, id = 'buy_button_HnrRzY') => ({ id, settings });

/**
 * `form.errors` da Shopify: uma lista com os NOMES dos campos que falharam
 * (é o que `contains` testa) e, em `messages`, o texto de cada um.
 */
export const errosDoEnvio = (mensagens) => Object.assign(Object.keys(mensagens), { messages: mensagens });

/** O HTML que `{% render 'add-to-cart' %}` produz. */
export function renderizaFormDeProduto({ product = produto(), block = bloco(), hasQtd = false, form = {} } = {}) {
  formDoEnvio = form;
  return engine.renderFileSync('add-to-cart', { product, block, hasQtd });
}

/**
 * Os defaults do bloco `buy_button` no schema de uma section — o que a
 * lojista ganha ao adicionar o bloco sem mexer em nada.
 */
export function defaultsDoBotaoDeCompra(section) {
  const fonte = fs.readFileSync(path.join(RAIZ, 'sections', section), 'utf8');
  const schema = JSON.parse(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(fonte)[1]);
  const buyButton = schema.blocks.find((b) => b.type === 'buy_button');
  return Object.fromEntries(
    buyButton.settings.filter((s) => s.id && 'default' in s).map((s) => [s.id, s.default]),
  );
}
