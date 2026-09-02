/**
 * A regra `templates` consegue reprovar?
 *
 * Ela nasce por causa de um silêncio: `templates/page.liquid` eram duas linhas
 * — um `<h1>` e a `{{ page.content }}` solta — e passavam no `npm run lint`
 * IMPECÁVEIS. Zero avisos, zero baseline. O pior arquivo do tema, limpo no
 * gate.
 *
 * Os linters procuram estrutura errada; aquele arquivo tinha estrutura
 * ausente, e ausência não casa com regex nenhum. Uma regra escrita para pegar
 * ausência e que não consiga falhar seria o mesmo silêncio numa camada acima —
 * daí os defeitos plantados aqui no formato exato em que estavam no tema.
 */
import { describe, it, expect } from 'vitest';
import { renderizaSection, contaSections } from '../scripts/lint/rules/templates.mjs';

describe('o template Liquid monta a página por section?', () => {
  it('o defeito original: markup solto, sem section nenhuma', () => {
    const era = '<h1>{{ page.title }}</h1>\n<div>{{ page.content }}</div>';
    expect(renderizaSection(era)).toBe(false);
  });

  it('reconhece `{% section %}`', () => {
    expect(renderizaSection("{% section 'main-page' %}")).toBe(true);
  });

  it('reconhece `{% sections %}` (grupo de sections)', () => {
    expect(renderizaSection("{% sections 'header-group' %}")).toBe(true);
  });

  it('reconhece as duas com hífen de whitespace', () => {
    expect(renderizaSection("{%- section 'main-page' -%}")).toBe(true);
    expect(renderizaSection("{%- sections 'footer-group' -%}")).toBe(true);
  });

  it('aceita aspas simples e duplas', () => {
    expect(renderizaSection('{% section "main-page" %}')).toBe(true);
  });

  /**
   * A palavra aparecendo em prosa ou num comentário não é uma section
   * renderizada. Aceitar isso deixaria qualquer arquivo passar escrevendo
   * "section" numa linha de comentário.
   */
  it('a palavra solta NÃO conta como section renderizada', () => {
    expect(renderizaSection('{%- comment -%} esta section virá depois {%- endcomment -%}')).toBe(false);
    expect(renderizaSection('<p>section</p>')).toBe(false);
    expect(renderizaSection('{% render "algo" %}')).toBe(false);
  });

  it('fonte vazia ou ausente não passa por engano', () => {
    expect(renderizaSection('')).toBe(false);
    expect(renderizaSection(null)).toBe(false);
    expect(renderizaSection(undefined)).toBe(false);
  });
});

describe('o template JSON declara alguma section?', () => {
  it('conta as sections declaradas', () => {
    expect(contaSections({ sections: { main: { type: 'main-page' } } })).toBe(1);
    expect(contaSections({ sections: { a: {}, b: {} } })).toBe(2);
  });

  /**
   * A forma certa com a página vazia: o arquivo existe, o editor abre, e nada
   * aparece. É o mesmo defeito do markup solto com outra roupa.
   */
  it('JSON sem sections é violação, não passe livre', () => {
    expect(contaSections({ sections: {} })).toBe(0);
    expect(contaSections({ order: [] })).toBe(0);
    expect(contaSections({})).toBe(0);
    expect(contaSections(null)).toBe(0);
  });
});
