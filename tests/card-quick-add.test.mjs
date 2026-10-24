/**
 * snippets/card-quick-add.liquid — a largura do botão "Adicionar" do card.
 *
 * O snippet tem dois ramos, e a cliente tem de ver o MESMO botão nos dois:
 *
 *   1 variante      <add-to-cart> > form > button   (adiciona por ajax)
 *   várias          <a>                              (leva à PDP)
 *
 * O painel do hover do card é `flex-col items-center`. O `<a>` ocupa a largura
 * porque a própria classe dele tem `w-full`. O `<add-to-cart>` é um custom
 * element, e custom element nasce `display: inline`: como item flex ele
 * encolhia ao conteúdo, o `w-full` do form e do botão só enchia esse
 * encolhimento, e o botão do chapéu e da bolsa saía com 41px enquanto o da saia
 * saía com 276px. Só os produtos de uma variante, só no desktop, em todo slider.
 *
 * O jsdom não calcula layout, então o teste não mede a largura — isso é do
 * navegador. Ele mede a CAUSA: o `<add-to-cart>` declara `block w-full`, e essas
 * duas classes existem no CSS que a cliente baixa (sem a segunda condição a
 * primeira passaria verde com uma classe que não pinta nada).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderizaArquivo } from './helpers/section-liquid.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CLASSE_DO_BOTAO = 'w-full flex items-center justify-center';

function renderiza(variantes) {
  const produto = {
    url: '/products/x',
    variants: { size: variantes },
    selected_or_first_available_variant: { id: 42 },
  };
  document.body.innerHTML = renderizaArquivo('snippets/card-quick-add.liquid', {
    product: produto,
    button_class: CLASSE_DO_BOTAO,
  });
}

describe('card-quick-add: o botão enche o painel nos dois ramos', () => {
  it('1 variante: o <add-to-cart> é bloco e ocupa a largura toda', () => {
    renderiza(1);
    const componente = document.querySelector('add-to-cart');
    expect(componente, 'ramo de 1 variante não renderizou <add-to-cart>').not.toBeNull();
    expect(componente.classList.contains('block')).toBe(true);
    expect(componente.classList.contains('w-full')).toBe(true);
  });

  it('1 variante: o botão herda a classe pedida pelo card', () => {
    renderiza(1);
    expect(document.querySelector('add-to-cart button').className).toBe(CLASSE_DO_BOTAO);
  });

  it('várias variantes: é um link com a mesma classe, sem <add-to-cart>', () => {
    renderiza(3);
    expect(document.querySelector('add-to-cart')).toBeNull();
    const link = document.querySelector('a');
    expect(link.className).toBe(CLASSE_DO_BOTAO);
    expect(link.getAttribute('href')).toBe('/products/x');
  });

  it('as duas classes do <add-to-cart> existem no CSS que a cliente baixa', () => {
    const css = fs.readFileSync(path.join(RAIZ, 'assets', 'application.css'), 'utf8');
    expect(css).toMatch(/\.block\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/\.w-full\s*\{[^}]*width:\s*100%/);
  });
});
