/**
 * Os filtros facetados da coleção e da busca (#141).
 *
 * Até a #141 o filtro morava inteiro dentro de `main-collection.liquid` — o
 * markup e um `<script>` inline —, e a busca tinha quatro abas que escondiam
 * em JS o que já estava na página. Nada disso era testado: inline não é
 * carregável por `load-asset.mjs`, e `{% if %}` dentro de section não era
 * exercitado por coisa alguma.
 *
 * Agora são duas peças, e este arquivo mede as duas:
 *
 *   snippets/facets.liquid   o markup e as decisões (quantos filtros ativos,
 *                            se o painel tem o que mostrar), via `liquidjs`
 *   assets/facets.js         <facet-filters>: gaveta, auto-envio, aviso
 *
 * ── A marcação vem do snippet, não de uma cópia ────────────────────────────
 *
 * O componente é testado sobre a saída do MESMO `facets.liquid` que a loja
 * serve (ADR 0014: fixture copiada à mão é dívida). O que sobra escrito aqui é
 * só a moldura — `<facet-filters>` e o `<form>` —, que nas sections também
 * fica fora do snippet.
 *
 * ── O que o `liquidjs` não é ───────────────────────────────────────────────
 *
 * Ele não é o Liquid da Shopify. `t` e `money_without_currency` são dublados
 * abaixo, cada um com o comportamento documentado: `t` devolve a chave, e o
 * dinheiro sai no formato da moeda (BRL `1.234,56`, USD `1,234.56`). O que o
 * teste prova é a regra do tema em cima desses valores; que a Shopify os
 * entrega assim é a premissa, e a loja de verdade é medida pelo e2e.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { loadAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });

engine.registerFilter('t', (chave) => chave);
engine.registerFilter('image_url', (imagem) => String(imagem));

/** `money_without_currency` no formato da moeda, como a Shopify entrega. */
let moeda = 'BRL';
engine.registerFilter('money_without_currency', (centavos) =>
  (Number(centavos) / 100).toLocaleString(moeda === 'BRL' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
);

/** Renderiza uma parte do snippet. `cart` é objeto global na Shopify: vai em `globals`. */
function facets(parametros) {
  const cart = { currency: { iso_code: moeda, symbol: moeda === 'BRL' ? 'R$' : '$' } };
  return engine.renderFileSync('facets', parametros, { globals: { cart } });
}

// ── Fábricas de filtro, no formato do objeto `filter` da Shopify ──────────

const valor = (rotulo, { count = 3, active = false, param = 'filter.v.option.tamanho' } = {}) => ({
  label: rotulo,
  value: rotulo.toLowerCase(),
  param_name: param,
  count,
  active,
});

const lista = (rotulo, valores) => ({
  type: 'list',
  label: rotulo,
  presentation: 'text',
  values: valores,
  active_values: valores.filter((v) => v.active),
});

const preco = ({ min = null, max = null, teto = 123456 } = {}) => ({
  type: 'price_range',
  label: 'Preço',
  min_value: { param_name: 'filter.v.price.gte', value: min },
  max_value: { param_name: 'filter.v.price.lte', value: max },
  range_max: teto,
  active_values: [],
});

const contagem = (filters) => facets({ part: 'count', filters });
const relevante = (filters) => facets({ part: 'relevant', filters }) === 'true';

// ── As decisões ───────────────────────────────────────────────────────────

describe('quantos filtros estão ativos', () => {
  it('sem filtro nenhum marcado, zero — e a saída é só o número, para `capture`', () => {
    expect(contagem([lista('Tamanho', [valor('P'), valor('M')]), preco()])).toBe('0');
  });

  it('cada valor marcado numa lista conta um', () => {
    const tamanhos = lista('Tamanho', [valor('P', { active: true }), valor('M', { active: true }), valor('G')]);
    expect(contagem([tamanhos])).toBe('2');
  });

  it('a faixa de preço conta UMA vez, com mínimo, máximo ou os dois', () => {
    expect(contagem([preco({ min: 5000 })])).toBe('1');
    expect(contagem([preco({ max: 9000 })])).toBe('1');
    expect(contagem([preco({ min: 5000, max: 9000 })])).toBe('1');
  });

  it('lista e preço somam', () => {
    const tamanhos = lista('Tamanho', [valor('P', { active: true })]);
    expect(contagem([tamanhos, preco({ min: 5000 })])).toBe('2');
  });
});

describe('o painel só aparece se algum filtro descreve produto', () => {
  // A busca devolve artigo e página junto com produto, e filtro facetado só
  // fala de produto. Sem esta decisão, uma busca que só achou artigos ganhava
  // um painel de "Em estoque (0)" desabilitado.

  it('sem filtro nenhum, não', () => {
    expect(relevante([])).toBe(false);
  });

  it('todos os valores com zero produto: não', () => {
    expect(relevante([lista('Disponibilidade', [valor('Em estoque', { count: 0 })])])).toBe(false);
  });

  it('um valor com produto já basta', () => {
    const disp = lista('Disponibilidade', [valor('Em estoque', { count: 0 }), valor('Esgotado', { count: 2 })]);
    expect(relevante([disp])).toBe(true);
  });

  it('filtro marcado conta mesmo com zero resultado — é quando a cliente precisa desmarcar', () => {
    expect(relevante([lista('Tamanho', [valor('PP', { count: 0, active: true })])])).toBe(true);
  });

  it('faixa de preço: relevante se há preço no resultado, ou se ela está marcada', () => {
    expect(relevante([preco({ teto: 0 })])).toBe(false);
    expect(relevante([preco({ teto: 9900 })])).toBe(true);
    expect(relevante([preco({ teto: 0, min: 100 })])).toBe(true);
  });
});

// ── O markup do painel ────────────────────────────────────────────────────

/** O painel renderizado, já como DOM. */
function painel(parametros) {
  const casca = document.createElement('div');
  casca.innerHTML = facets({ part: 'panel', sort_by: 'manual', clear_url: '/collections/x?sort_by=manual', ...parametros });
  return casca;
}

describe('cada valor vira um checkbox que o form GET entende', () => {
  const tamanhos = lista('Tamanho', [
    valor('P'),
    valor('M', { active: true }),
    valor('G', { count: 0 }),
    valor('GG', { count: 0, active: true }),
  ]);
  const caixa = (casca, v) => casca.querySelector(`input[type=checkbox][value="${v}"]`);

  it('o nome é o param do filtro e o valor é o da Shopify', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 2 });
    const p = caixa(casca, 'p');

    expect(p.name).toBe('filter.v.option.tamanho');
    // O que o GET leva: os marcados, e o desabilitado fica de fora sozinho.
    expect(new FormData(wrapForm(casca)).getAll('filter.v.option.tamanho')).toEqual(['m', 'gg']);
  });

  it('marcado é o que está ativo', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 2 });

    expect(caixa(casca, 'p').checked).toBe(false);
    expect(caixa(casca, 'm').checked).toBe(true);
  });

  it('sem produto fica desabilitado — a menos que esteja marcado, senão não dá para desmarcar', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 2 });

    expect(caixa(casca, 'g').disabled).toBe(true);
    expect(caixa(casca, 'gg').disabled).toBe(false);
  });

  it('a ordenação atual vai junto ao aplicar um filtro', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 2, sort_by: 'price-ascending' });

    expect(new FormData(wrapForm(casca)).get('sort_by')).toBe('price-ascending');
  });
});

/** Um <form> em volta do painel, para ler o que ele enviaria. */
function wrapForm(casca) {
  const form = document.createElement('form');
  form.append(...casca.childNodes);
  return form;
}

describe('"limpar todos" só existe quando há o que limpar', () => {
  const tamanhos = lista('Tamanho', [valor('P', { active: true })]);

  it('com filtro ativo, leva para a página sem filtro que a section mandou', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 1, clear_url: '/search?q=vestido&sort_by=relevance' });
    const limpar = [...casca.querySelectorAll('a')].find((a) => a.textContent.includes('collection.filters.clear_all'));

    expect(limpar.getAttribute('href')).toBe('/search?q=vestido&sort_by=relevance');
  });

  it('sem filtro ativo, some', () => {
    const casca = painel({ filters: [tamanhos], active_filter_count: 0 });

    expect(casca.textContent).not.toContain('collection.filters.clear_all');
  });
});

describe('o preço vai no formato que o param da Shopify aceita', () => {
  // O param espera PONTO decimal e nenhum separador de milhar. Em BRL a
  // Shopify formata "1.234,56": mandado cru, o filtro leria outro número.
  const precoDe = (casca, nome) => casca.querySelector(`input[name="filter.v.price.${nome}"]`);

  beforeEach(() => {
    moeda = 'BRL';
  });

  it('em real, a vírgula vira ponto e o ponto de milhar some', () => {
    const casca = painel({ filters: [preco({ min: 5000, teto: 123456 })], active_filter_count: 1 });

    expect(precoDe(casca, 'gte').value).toBe('50.00');
    expect(precoDe(casca, 'gte').max).toBe('1234.56');
    expect(precoDe(casca, 'lte').placeholder).toBe('1234.56');
  });

  it('em dólar, só a vírgula de milhar sai', () => {
    moeda = 'USD';
    const casca = painel({ filters: [preco({ max: 9900, teto: 123456 })], active_filter_count: 1 });

    expect(precoDe(casca, 'lte').value).toBe('99.00');
    expect(precoDe(casca, 'lte').max).toBe('1234.56');
  });

  it('sem preço marcado, os campos nascem vazios', () => {
    const casca = painel({ filters: [preco()], active_filter_count: 0 });

    expect(precoDe(casca, 'gte').value).toBe('');
    expect(precoDe(casca, 'lte').value).toBe('');
  });
});

// ── O componente, sobre o markup do snippet ───────────────────────────────

loadAsset('facets.js');

const FILTROS = [lista('Tamanho', [valor('P'), valor('M')])];

/**
 * A moldura que as sections escrevem em volta do snippet — e só ela. Painel e
 * gatilho saem do `facets.liquid`.
 */
function monta({ comPainel = true, aviso = 'A página será recarregada.' } = {}) {
  const partes = comPainel
    ? facets({ part: 'panel', filters: FILTROS, active_filter_count: 0, sort_by: 'manual', clear_url: '/c' }) +
      facets({ part: 'trigger', active_filter_count: 0 })
    : '';
  document.body.innerHTML = `
    <facet-filters class="block" data-reload-message="${aviso}">
      <form data-filter-form method="get">
        ${partes}
        <select name="sort_by" aria-describedby="a11y-refresh-page-message">
          <option value="manual">destaques</option>
          <option value="price-ascending">preço</option>
        </select>
      </form>
    </facet-filters>`;
  return document.querySelector('facet-filters');
}

const gaveta = () => document.querySelector('[data-filters-panel]');
const veu = () => document.querySelector('[data-filters-overlay]');
const travada = () => document.body.classList.contains('overflow-hidden');
const abre = () => document.querySelector('[data-filters-open]').click();
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const muda = (el) => el.dispatchEvent(new Event('change', { bubbles: true }));

let tela;
let submit;

beforeEach(() => {
  moeda = 'BRL';
  tela = installMatchMedia(false); // celular, até o teste dizer o contrário
  submit = vi.fn();
  HTMLFormElement.prototype.submit = submit;
  document.body.className = '';
  document.getElementById('a11y-refresh-page-message')?.remove();
});

describe('a gaveta (celular)', () => {
  it('o gatilho abre gaveta e véu, e trava a rolagem da página', () => {
    monta();
    abre();

    expect(gaveta().classList.contains('is-open')).toBe(true);
    expect(veu().classList.contains('is-open')).toBe(true);
    expect(travada()).toBe(true);
  });

  it('o clique no ÍCONE dentro do gatilho também abre', () => {
    monta();
    document.querySelector('[data-filters-open] svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(gaveta().classList.contains('is-open')).toBe(true);
  });

  it('fecha no botão de fechar, e devolve a rolagem', () => {
    monta();
    abre();
    document.querySelector('[data-filters-close]').click();

    expect(gaveta().classList.contains('is-open')).toBe(false);
    expect(veu().classList.contains('is-open')).toBe(false);
    expect(travada()).toBe(false);
  });

  it('fecha no véu', () => {
    monta();
    abre();
    veu().click();

    expect(gaveta().classList.contains('is-open')).toBe(false);
  });

  it('fecha no Escape', () => {
    monta();
    abre();
    escape();

    expect(gaveta().classList.contains('is-open')).toBe(false);
    expect(travada()).toBe(false);
  });

  it('o Escape com a gaveta FECHADA não mexe na trava de outro componente', () => {
    // O inline fechava em todo Escape, e fechar tira o overflow-hidden: com o
    // carrinho aberto numa coleção, o Escape destravava a rolagem DELE.
    monta();
    document.body.classList.add('overflow-hidden'); // o drawer do carrinho
    escape();

    expect(travada()).toBe(true);
  });

  it('cruzar para o desktop fecha a gaveta aberta', () => {
    monta();
    abre();
    tela.dispatch(true);

    expect(gaveta().classList.contains('is-open')).toBe(false);
    expect(travada()).toBe(false);
  });

  it('cruzar para o desktop com a gaveta fechada não mexe na trava de outro', () => {
    monta();
    document.body.classList.add('overflow-hidden');
    tela.dispatch(true);

    expect(travada()).toBe(true);
  });
});

describe('auto-envio', () => {
  it('no desktop, marcar um filtro envia o form', () => {
    tela.matches = true;
    monta();
    const p = document.querySelector('input[value="p"]');
    p.checked = true;
    muda(p);

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('no celular, marcar NÃO envia — a cliente marca vários e aperta Aplicar', () => {
    monta();
    muda(document.querySelector('input[value="p"]'));

    expect(submit).not.toHaveBeenCalled();
  });

  it('a ordenação envia no celular também: ela não tem botão', () => {
    monta();
    const ordem = document.querySelector('select[name=sort_by]');
    ordem.value = 'price-ascending';
    muda(ordem);

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('sem painel (filtro desligado ou nenhum configurado) a ordenação continua enviando', () => {
    monta({ comPainel: false });
    muda(document.querySelector('select[name=sort_by]'));

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('o hidden de ordenação do painel e o select concordam no que vai', () => {
    // Os dois se chamam `sort_by`; o hidden guarda a ordem atual para quando a
    // cliente só mexe em filtro. O form GET manda os dois, e a Shopify fica
    // com o ÚLTIMO — o select, que vem depois do painel no DOM.
    monta();
    const ordem = document.querySelector('select[name=sort_by]');
    ordem.value = 'price-ascending';

    expect(new FormData(document.querySelector('form')).getAll('sort_by')).toEqual(['manual', 'price-ascending']);
  });
});

describe('o aviso de recarga para leitor de tela', () => {
  const aviso = () => document.getElementById('a11y-refresh-page-message');

  it('existe, é uma região viva, e o texto vem do Liquid', () => {
    monta({ aviso: 'A ordenação foi alterada.' });

    expect(aviso().textContent).toBe('A ordenação foi alterada.');
    expect(aviso().getAttribute('role')).toBe('status');
    expect(aviso().getAttribute('aria-live')).toBe('polite');
  });

  it('é um só por página, mesmo com dois componentes nela', () => {
    // `aria-describedby` aponta para um id: dois elementos com o mesmo id e o
    // leitor de tela escolhe um, e o HTML fica inválido.
    const primeiro = monta();
    document.body.appendChild(primeiro.cloneNode(true));

    expect(document.querySelectorAll('facet-filters')).toHaveLength(2);
    expect(document.querySelectorAll('#a11y-refresh-page-message')).toHaveLength(1);
  });
});

describe('o editor re-renderiza a section, e a gaveta continua viva', () => {
  it('a cópia nova responde ao gatilho', () => {
    monta();
    monta(); // a Shopify troca o HTML da section a cada setting mexido
    abre();

    expect(gaveta().classList.contains('is-open')).toBe(true);
  });

  it('trocar a section com a gaveta aberta devolve a rolagem', () => {
    monta();
    abre();
    document.body.innerHTML = '';

    expect(travada()).toBe(false);
  });

  it('a cópia velha para de ouvir o Escape — senão ela destrava a rolagem de outro', () => {
    monta();
    abre();
    monta(); // a velha sai com a gaveta dela marcada como aberta
    document.body.classList.add('overflow-hidden'); // o drawer do carrinho
    escape();

    expect(travada()).toBe(true);
  });
});
