// @vitest-environment node

/**
 * snippets/inventory-status.liquid — o aviso de estoque da PDP.
 *
 * O script dele escutava `variant:change` no `document`, e a troca feita pela
 * cliente nunca chegava lá: o evento sai do [product-context] e não borbulha
 * (#157). O aviso ficava para sempre com o estoque da variante com que a
 * página abriu — "Apenas 3 unidades" numa variante esgotada. Ninguém viu,
 * porque o script é inline e nenhum teste o executava.
 *
 * Este teste executa. O snippet é renderizado pelo motor de teste e posto num
 * JSDOM com scripts ligados, que roda o <script> inline como o navegador roda,
 * com `document.currentScript` apontando para ele. O que se mede é o HTML que
 * a Shopify serviria, não uma cópia do script.
 *
 * Os eventos são disparados como `variant-selects` dispara: no contexto do
 * produto, sem `bubbles`. Um ouvinte no `document` não os recebe.
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { motorDaLoja } from './helpers/liquid-loja.mjs';

const motor = motorDaLoja();

const variante = (id, quantidade, { gerida = true, disponivel = quantidade > 0 } = {}) => ({
  id,
  inventory_quantity: quantidade,
  inventory_management: gerida ? 'shopify' : null,
  available: disponivel,
});

const BAIXO = variante(1, 3);
const ALTO = variante(2, 50);
const ESGOTADO = variante(3, 0);
const SEM_GESTAO = variante(4, 5, { gerida: false, disponivel: true });
const VARIANTES = [BAIXO, ALTO, ESGOTADO, SEM_GESTAO];

async function pagina({ atual = BAIXO, settings = {}, unica = false } = {}) {
  const html = await motor.renderFile('inventory-status', {
    block: {
      settings: { inventory_threshold: 10, show_inventory_quantity: true, text_style: 'body', ...settings },
    },
    product: { variants: VARIANTES, selected_or_first_available_variant: atual, has_only_default_variant: unica },
  });

  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <div product-context id="este">${html}</div>
      <div product-context id="outro"></div>
    </body>`,
    { runScripts: 'dangerously' }
  );
  const { document, CustomEvent } = dom.window;
  const raiz = document.querySelector('#este [data-inventory-status]');

  return {
    html,
    raiz,
    /** Como `variant-selects` dispara: no contexto, sem `bubbles`. */
    troca(contexto, variant, { bubbles = false } = {}) {
      document.getElementById(contexto).dispatchEvent(new CustomEvent('variant:change', { detail: { variant }, bubbles }));
    },
    aviso() {
      return {
        visivel: !raiz.hidden,
        titulo: raiz.querySelector('[data-estoque-aviso] [data-titulo]')?.textContent ?? null,
        subtitulo: raiz.querySelector('[data-estoque-aviso] [data-subtitulo]')?.textContent ?? null,
      };
    },
  };
}

describe('na carga', () => {
  it('o aviso da variante inicial vem desenhado do servidor', async () => {
    const p = await pagina();

    expect(p.aviso()).toEqual({
      visivel: true,
      titulo: 'Apenas 3 unidades em estoque!',
      subtitulo: 'Garanta o seu agora antes que acabe',
    });
  });

  it('variante inicial sem aviso deixa o contêiner escondido, mas presente', async () => {
    const p = await pagina({ atual: ALTO });

    expect(p.raiz).not.toBeNull();
    expect(p.aviso()).toEqual({ visivel: false, titulo: null, subtitulo: null });
  });
});

describe('a troca de variante da cliente', () => {
  it('troca o aviso: esgotado, e de volta ao estoque baixo', async () => {
    const p = await pagina();

    p.troca('este', ESGOTADO);
    expect(p.aviso()).toEqual({ visivel: true, titulo: 'Fora de estoque', subtitulo: null });

    p.troca('este', BAIXO);
    expect(p.aviso().titulo).toBe('Apenas 3 unidades em estoque!');
  });

  it('variante acima do limite esconde o aviso, em vez de manter o da anterior', async () => {
    const p = await pagina();

    p.troca('este', ALTO);

    expect(p.aviso()).toEqual({ visivel: false, titulo: null, subtitulo: null });
  });

  it('variante sem gestão de estoque esconde o aviso', async () => {
    const p = await pagina();

    p.troca('este', SEM_GESTAO);

    expect(p.aviso().visivel).toBe(false);
  });

  it('abrindo numa variante sem aviso, trocar para estoque baixo mostra o aviso', async () => {
    const p = await pagina({ atual: ALTO });

    p.troca('este', BAIXO);

    expect(p.aviso()).toMatchObject({ visivel: true, titulo: 'Apenas 3 unidades em estoque!' });
  });

  it('combinação que não existe (variante undefined) não mexe no aviso', async () => {
    const p = await pagina();

    p.troca('este', undefined);

    expect(p.aviso().titulo).toBe('Apenas 3 unidades em estoque!');
  });
});

describe('o escopo', () => {
  it('a troca de variante de OUTRO produto da página não mexe neste aviso, nem borbulhando', async () => {
    const p = await pagina();

    p.troca('outro', ESGOTADO);
    p.troca('outro', ESGOTADO, { bubbles: true });

    expect(p.aviso().titulo).toBe('Apenas 3 unidades em estoque!');
  });
});

describe('as opções do bloco', () => {
  it('"mostrar quantidade" desligado vale — o `default` não o troca por `true`', async () => {
    const p = await pagina({ settings: { show_inventory_quantity: false } });

    expect(p.aviso()).toEqual({
      visivel: true,
      titulo: 'Estoque limitado',
      subtitulo: 'Últimas unidades disponíveis',
    });
  });

  it('limite 0 com quantidade ligada põe a quantidade no texto, também depois da troca', async () => {
    const p = await pagina({ settings: { inventory_threshold: 0 } });

    p.troca('este', ALTO);

    expect(p.aviso()).toMatchObject({ visivel: true, titulo: '50 unidades em estoque' });
  });

  it('o estilo "caixa alta" sobrevive à troca', async () => {
    const p = await pagina({ settings: { text_style: 'uppercase' } });

    p.troca('este', ESGOTADO);

    expect(p.raiz.querySelector('[data-estoque-aviso] [data-titulo]').classList.contains('uppercase')).toBe(true);
  });
});

describe('o que vai para a página', () => {
  it('o mapa só leva o que o aviso mostraria: nada da variante acima do limite', async () => {
    const { html } = await pagina();
    const texto = html.match(/data-estoque-variantes>([^<]*)</)[1];

    expect(Object.keys(JSON.parse(texto)).sort()).toEqual(['1', '3']);
    expect(texto).not.toContain('50');
  });

  it('produto de variante única não leva modelos, mapa nem script', async () => {
    const { html } = await pagina({ unica: true });

    expect(html).not.toContain('<template');
    expect(html).not.toContain('<script');
  });
});
