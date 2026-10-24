/**
 * snippets/card-quick-add.liquid — o que o card entrega, e o que ele NÃO pode ter.
 *
 * O snippet tem dois ramos, e a cliente tem de ver o MESMO botão nos dois:
 *
 *   1 variante      <add-to-cart> > button[data-variant-id]   (adiciona por ajax)
 *   várias          <a>                                        (leva à PDP)
 *
 * ── Sem <form>, e por quê ───────────────────────────────────────────────────
 *
 * `sections/main-collection.liquid` e `sections/main-search.liquid` envolvem a
 * grade de cards num `<form data-filter-form>`, e o HTML não aninha formulários:
 * o parser DESCARTA o `<form>` interno. O botão do quick-add passava a ser do
 * form de filtros e enviava `?sort_by=…&id=…&add=` em vez de adicionar ao
 * carrinho — e o `</form>` interno ainda fechava o form de filtros ali, então o
 * defeito aparecia no primeiro card de 1 variante de cada página. O teste de
 * navegador que o pegou estava pulado por falta de produto de variante única.
 *
 * Por isso o snippet não tem form (ADR 0021), e esta suíte trava as duas
 * metades: o markup (o jsdom segue o mesmo parser do navegador) e a CAUSA — que
 * nenhum snippet renderizado por um card traga `<form>`, hoje ou amanhã.
 *
 * ── E a largura ─────────────────────────────────────────────────────────────
 *
 * `<add-to-cart>` é custom element e nasce `display: inline`; no painel do hover
 * (`flex-col items-center`) ele encolhia ao conteúdo, e o botão do produto de 1
 * variante saía com 41px contra 276px do `<a>`. O jsdom não calcula layout, então
 * o teste mede a CAUSA: o `<add-to-cart>` declara `block w-full`, e essas duas
 * classes existem no CSS que a cliente baixa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderizaArquivo } from './helpers/section-liquid.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CLASSE_DO_BOTAO = 'w-full flex items-center justify-center';

const produto = (variantes, id = 42) => ({
  url: '/products/x',
  variants: { size: variantes },
  selected_or_first_available_variant: { id },
});

const quickAdd = (variantes, id) =>
  renderizaArquivo('snippets/card-quick-add.liquid', {
    product: produto(variantes, id),
    button_class: CLASSE_DO_BOTAO,
  });

describe('o ramo de 1 variante', () => {
  const monta = () => {
    document.body.innerHTML = quickAdd(1, 987);
    return document.querySelector('add-to-cart');
  };

  it('é um <add-to-cart> com um botão que carrega a variante', () => {
    const componente = monta();
    const botao = componente.querySelector('button[name="add"]');

    expect(botao, 'o <add-to-cart> perdeu o botão').not.toBeNull();
    // Sem isto o componente enviaria `id=undefined`: não há <input name="id">.
    expect(botao.dataset.variantId).toBe('987');
    expect(botao.className).toBe(CLASSE_DO_BOTAO);
    expect(botao.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('o botão é type="button": dentro de um form, um submit enviaria os filtros', () => {
    expect(monta().querySelector('button[name="add"]').getAttribute('type')).toBe('button');
  });

  it('não tem <form> nem <input>: é o que um form aninhado faria o parser engolir', () => {
    const componente = monta();

    expect(componente.querySelector('form')).toBeNull();
    expect(componente.querySelector('input')).toBeNull();
  });

  it('o <add-to-cart> é bloco e ocupa a largura toda', () => {
    const componente = monta();

    expect(componente.classList.contains('block')).toBe(true);
    expect(componente.classList.contains('w-full')).toBe(true);
  });

  it('as duas classes existem no CSS que a cliente baixa', () => {
    const css = fs.readFileSync(path.join(RAIZ, 'assets', 'application.css'), 'utf8');

    expect(css).toMatch(/\.block\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/\.w-full\s*\{[^}]*width:\s*100%/);
  });
});

describe('o ramo de várias variantes', () => {
  it('é um link para a PDP com a mesma classe, sem <add-to-cart>', () => {
    document.body.innerHTML = quickAdd(3);

    expect(document.querySelector('add-to-cart')).toBeNull();
    const link = document.querySelector('a');
    expect(link.className).toBe(CLASSE_DO_BOTAO);
    expect(link.getAttribute('href')).toBe('/products/x');
  });
});

describe('dentro do form de filtros, como a coleção e a busca o põem', () => {
  /** A grade como `main-collection.liquid` a escreve: cards, e o "Carregar mais" depois. */
  function montaColecao(variantes) {
    document.body.innerHTML = `
      <form id="filtros" data-filter-form method="get">
        <select name="sort_by"><option value="manual">m</option></select>
        <div data-product-grid>
          ${variantes.map((n, i) => `<div class="card">${quickAdd(n, 100 + i)}</div>`).join('')}
        </div>
        <button type="button" id="carregar">Carregar mais</button>
      </form>`;
  }

  it('o form de filtros continua inteiro: nenhum form novo, e o "Carregar mais" segue dentro dele', () => {
    // Com o `<form>` antigo, o parser engolia o do primeiro card e o `</form>`
    // dele FECHAVA o form de filtros: o botão abaixo caía para fora (form null).
    montaColecao([1, 1, 1]);

    expect(document.forms).toHaveLength(1);
    expect(document.getElementById('carregar').form).toBe(document.getElementById('filtros'));
  });

  it('o que o form de filtros enviaria não leva nada do quick-add', () => {
    // O `id=…&quantity=1&add=` que o navegador mandou na URL do CI eram os
    // campos do quick-add dentro do envio dos filtros. Mede-se o FormData, e não
    // `form.elements`: um `<button type="button">` é elemento do form, mas não
    // entra no envio — que é exatamente o que o `type="button"` garante.
    montaColecao([1, 1]);

    expect([...new FormData(document.getElementById('filtros')).keys()]).toEqual(['sort_by']);
  });

  it('vale também para uma coleção sem nenhum produto de 1 variante', () => {
    montaColecao([3, 3]);

    expect(document.forms).toHaveLength(1);
  });
});

describe('a causa: nenhum snippet que o card renderiza traz <form>', () => {
  /** Os snippets que `{% render %}` chama, direta ou indiretamente, a partir de `nome`. */
  function fechamento(nome, visto = new Set()) {
    if (visto.has(nome)) return visto;
    visto.add(nome);
    const arquivo = path.join(RAIZ, 'snippets', `${nome}.liquid`);
    if (!fs.existsSync(arquivo)) return visto;
    const fonte = fs.readFileSync(arquivo, 'utf8');
    for (const [, filho] of fonte.matchAll(/\{%-?\s*render\s+['"]([\w-]+)['"]/g)) fechamento(filho, visto);
    return visto;
  }

  const SNIPPETS_DO_CARD = [...fechamento('card-product-slider')];

  it('o fechamento enxerga o quick-add — o teste não perdeu o alvo', () => {
    expect(SNIPPETS_DO_CARD).toContain('card-product-slider');
    expect(SNIPPETS_DO_CARD).toContain('card-quick-add');
  });

  it.each(SNIPPETS_DO_CARD)('%s não tem <form> nem a tag form do Liquid', (nome) => {
    const fonte = fs
      .readFileSync(path.join(RAIZ, 'snippets', `${nome}.liquid`), 'utf8')
      // Os comentários explicam o defeito e citam `<form>`; só o markup conta.
      .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

    expect(fonte, `${nome}: o card mora dentro de forms (filtros da coleção e da busca); form aninhado é descartado`).not.toMatch(
      /<form[\s>]|\{%-?\s*form\s/
    );
  });
});
