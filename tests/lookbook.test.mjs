/**
 * O rótulo de cada ponto do lookbook é o nome do produto, e não um aviso de
 * tradução.
 *
 * O `aria-label` do `<summary>` era `hp.title | default: 'general.see_more' | t`.
 * O Liquid aplica os filtros da esquerda para a direita, então o título do
 * produto ia para o `t`. A Shopify devolve "translation missing" para a chave
 * que não existe, e o leitor de tela anunciava isso em todo ponto com produto.
 * Sem produto, o padrão traduzido aparecia certo, e era só esse o caso que
 * alguém via no editor. Achado na revisão retroativa da #168.
 */
import { describe, it, expect } from 'vitest';
import { renderizaSection } from './helpers/section-liquid.mjs';

function rotulos(blocos) {
  const html = renderizaSection('lookbook.liquid', {
    id: 'lookbook',
    settings: { color_scheme: 'scheme-1', heading: 'Lookbook' },
    blocks: blocos.map((settings) => ({ settings: { horizontal: 50, vertical: 50, ...settings } })),
  });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('summary.hotspot-dot')].map((s) => s.getAttribute('aria-label'));
}

const produto = { title: 'Vestido Midi Linho', url: '/products/vestido-midi-linho', price: 25900 };

describe('o rótulo do ponto do lookbook', () => {
  it('com produto, é o nome do produto', () => {
    expect(rotulos([{ product: produto }])).toEqual(['Vestido Midi Linho']);
  });

  it('nunca é um aviso de tradução', () => {
    for (const rotulo of rotulos([{ product: produto }, {}])) {
      expect(rotulo).not.toMatch(/translation missing/i);
    }
  });

  it('sem produto, é o "Ver mais" do locale', () => {
    expect(rotulos([{}])).toEqual(['Ver mais']);
  });
});
