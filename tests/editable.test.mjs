/**
 * A regra `editable` pergunta sobre o PORTADOR, ou sobre o arquivo?
 *
 * ── O defeito, na forma em que ele passou ──────────────────────────────────
 *
 * Até a #99 a verificação rodava dois regex sobre o arquivo inteiro:
 *
 *   const paintsBackground = /\b(?:color-background|bg-background)\b/.test(markup);
 *
 * `main-collection` passava com o portador pintando NADA:
 *
 *   <div class="page-width !py-8 color-{{ section.settings.color_scheme }}">
 *
 * O que deixava a regra verde eram duas ocorrências sem relação com a
 * superfície — um `bg-background` numa gaveta de filtros que no desktop vira
 * `lg:bg-transparent`, e um `text-foreground/55` num parágrafo. A página de
 * coleção estava com o defeito da #28, em produção, e o linter ficava verde.
 *
 * É o formato de silêncio que a ADR 0001 nomeia: o verificador exibindo a
 * mesma cara de quando está tudo certo.
 *
 * ── Por que não bastou descer pela subárvore ───────────────────────────────
 *
 * A #99 propunha duas saídas, e medir matou a segunda: os dois tokens de
 * `main-collection` estão DENTRO da subárvore do portador (linhas 56 e 77, sob
 * o `<div>` da linha 26). Aceitar pintura em qualquer descendente deixaria o
 * defeito passar igual.
 *
 * Subárvore responde "o token existe aqui embaixo?". A pergunta que importa é
 * "a superfície da section foi pintada?", e quem responde isso é o portador:
 * ele define as variáveis do scheme E é o elemento que cobre a section.
 */
import { describe, it, expect } from 'vitest';
import { portadores, portadoresSemFundo } from '../scripts/lint/rules/editable.mjs';

describe('quem é portador do color scheme', () => {
  it('a classe com color-{{ ... }} é portadora', () => {
    const markup = '<div class="page-width color-{{ section.settings.color_scheme }}">';
    expect(portadores(markup)).toHaveLength(1);
  });

  it('classe sem color-{{ ... }} não é portadora', () => {
    expect(portadores('<div class="page-width color-background">')).toEqual([]);
  });

  /**
   * Uma section pode ter mais de um portador, e cada um responde pela própria
   * superfície: o `footer` tem o dele e o da newsletter, a
   * `highlighted-section` tem o dela e o do acento de fundo.
   */
  it('acha os dois quando a section tem dois', () => {
    const markup = [
      '<div class="color-{{ section.settings.color_scheme }} color-background color-text">',
      '  <div class="color-{{ section.settings.newsletter_color_scheme }}">',
      '  </div>',
      '</div>',
    ].join('\n');
    expect(portadores(markup)).toHaveLength(2);
  });

  /**
   * O `<aside>` de `main-collection` tem a `class` espalhada por quatro linhas.
   * Um regex que não atravessa `\n` simplesmente não enxerga o atributo — e
   * "não enxerguei" produz o mesmo silêncio de "está tudo certo".
   */
  it('enxerga o atributo que quebra linha', () => {
    const markup = [
      '<section',
      '  class="color-{{ section.settings.color_scheme }}',
      '     py-16 md:py-20',
      '     color-background"',
      '>',
    ].join('\n');

    const achados = portadores(markup);
    expect(achados).toHaveLength(1);
    expect(achados[0].classes).toContain('color-background');
  });

  it('aspas simples também', () => {
    expect(portadores("<div class='color-{{ s.color_scheme }}'>")).toHaveLength(1);
  });

  it('a linha reportada é a do portador, não a do arquivo', () => {
    const markup = ['<p>um</p>', '<p>dois</p>', '<div class="color-{{ s.color_scheme }}">'].join('\n');
    expect(portadores(markup)[0].line).toBe(3);
  });

  it('não quebra com entrada vazia', () => {
    expect(portadores('')).toEqual([]);
    expect(portadores(undefined)).toEqual([]);
    expect(portadores(null)).toEqual([]);
  });
});

describe('qual portador não pinta o próprio fundo', () => {
  it('portador que pinta passa', () => {
    const markup = '<div class="color-{{ s.color_scheme }} color-background color-text">';
    expect(portadoresSemFundo(markup)).toEqual([]);
  });

  it('o token do Tailwind vale igual', () => {
    expect(portadoresSemFundo('<section class="color-{{ s.color_scheme }} bg-background">')).toEqual([]);
  });

  it('portador que não pinta é acusado', () => {
    const achados = portadoresSemFundo('<div class="page-width color-{{ s.color_scheme }}">');
    expect(achados).toHaveLength(1);
  });

  /**
   * O teste que mata a regra de antes da #99, na forma exata da
   * `main-collection`: portador sem pintura, e os tokens presentes em outros
   * elementos do MESMO arquivo. Quem perguntar ao arquivo diz que está tudo
   * certo; quem perguntar ao portador acha o defeito.
   */
  it('token em outro elemento do arquivo NÃO absolve o portador', () => {
    const markup = [
      '<div class="page-width !py-8 color-{{ section.settings.color_scheme }}">',
      '  <div class="text-sm text-foreground/55">descrição da coleção</div>',
      '  <aside class="bg-background p-6 lg:bg-transparent">filtros</aside>',
      '</div>',
    ].join('\n');

    const achados = portadoresSemFundo(markup);
    expect(achados).toHaveLength(1);
    expect(achados[0].line).toBe(1);
  });

  /**
   * E o contrário também precisa valer, senão a regra vira ruído: o portador
   * que pinta continua passando mesmo cercado de elementos que não pintam.
   */
  it('portador que pinta passa mesmo com descendentes sem pintura', () => {
    const markup = [
      '<div class="color-{{ s.color_scheme }} color-background color-text">',
      '  <div class="text-sm text-foreground/55">nada aqui pinta</div>',
      '</div>',
    ].join('\n');

    expect(portadoresSemFundo(markup)).toEqual([]);
  });
});
