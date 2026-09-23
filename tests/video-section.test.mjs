/**
 * assets/video-section.js — <video-section>.
 *
 * A section estava marcada como "nunca validada de ponta a ponta" (issue #36),
 * e o script morava inline dentro do Liquid — onde `load-asset.mjs` não
 * alcança. Nada aqui era testado.
 *
 * ── O que se verifica, e o que não dá para verificar daqui ─────────────────
 *
 * O jsdom não reproduz um `<video>` de verdade: `play()` e `pause()` não
 * existem nele. O que se mede é a DECISÃO — quais atributos o componente tira,
 * quais põe, e o que ele remove da DOM. Se o vídeo realmente toca é trabalho de
 * navegador, e continua sendo QA humano no preview.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';
import { installMatchMedia } from './helpers/dom.mjs';

loadAsset('video-section.js');

/**
 * `play` e `pause` são dublados no PROTÓTIPO, e não na instância.
 *
 * O `connectedCallback` roda durante a atribuição de `innerHTML` — antes de o
 * teste conseguir tocar no elemento. Dublar depois mediria o vazio: a primeira
 * versão deste arquivo fazia isso, e a asserção do `pause()` falhava com o
 * componente correto. (O jsdom também não implementa os dois de verdade.)
 */
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn();
  HTMLMediaElement.prototype.pause = vi.fn();
});

/** Modo Fundo: autoplay, mudo, em loop, sem controles. */
function montaFundo() {
  document.body.innerHTML = `
    <video-section>
      <video autoplay loop muted playsinline></video>
      <div data-video-overlay>título por cima</div>
    </video-section>`;
  return { secao: document.querySelector('video-section'), video: document.querySelector('video') };
}

/** Modo Clique-para-tocar: poster + botão, e o vídeo dentro de um template. */
function montaClique() {
  document.body.innerHTML = `
    <video-section>
      <div class="video-poster">capa</div>
      <div class="video-scrim"></div>
      <div data-video-overlay>título por cima</div>
      <button data-play-button>tocar</button>
      <template data-video-template><video controls></video></template>
    </video-section>`;
  return document.querySelector('video-section');
}

describe('modo Fundo respeita quem pediu menos movimento', () => {
  it('sem preferência: o vídeo continua no autoplay', () => {
    installMatchMedia(false);
    const { video } = montaFundo();
    expect(video.hasAttribute('autoplay')).toBe(true);
    expect(video.controls).toBe(false);
    expect(video.pause).not.toHaveBeenCalled();
  });

  it('com preferência: para de tocar sozinho E devolve o controle', () => {
    // WCAG 2.2.2 (Pause, Stop, Hide) é nível A. Um loop infinito atrás do
    // texto, sem saída, é o caso que o critério descreve.
    installMatchMedia(true);
    const { video } = montaFundo();

    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.pause).toHaveBeenCalled();
    // Só pausar deixaria a pessoa sem como assistir — tirar o vídeo tiraria o
    // conteúdo. As duas metades importam.
    expect(video.controls).toBe(true);
  });

  it('o atributo sai ANTES do pause', () => {
    // Se ficasse só o `pause()`, um `load()` posterior — que a troca de fonte
    // do Shopify dispara — voltaria a tocar sozinho, porque o autoplay ainda
    // estaria declarado.
    installMatchMedia(true);
    const { video } = montaFundo();
    video.load = () => {
      if (video.hasAttribute('autoplay')) video.play();
    };
    video.load();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('a preferência não afeta o modo Clique-para-tocar', () => {
    // Ali nada toca sozinho: o vídeo nem está na DOM antes do clique.
    installMatchMedia(true);
    const secao = montaClique();
    expect(secao.querySelector('video')).toBe(null);
    expect(secao.querySelector('[data-play-button]')).not.toBe(null);
  });
});

describe('o clique troca o poster pelo vídeo', () => {
  beforeEach(() => installMatchMedia(false));

  it('injeta o template e remove o que estava por cima', () => {
    const secao = montaClique();
    secao.querySelector('[data-play-button]').click();

    expect(secao.querySelector('video')).not.toBe(null);
    for (const sel of ['[data-play-button]', '.video-poster', '[data-video-overlay]', '.video-scrim']) {
      expect(secao.querySelector(sel), `${sel} deveria ter saído da DOM`).toBe(null);
    }
  });

  it('sem template, o clique não quebra a página', () => {
    // Acontece quando a lojista não escolheu vídeo nenhum: o Liquid não
    // renderiza o `<template>`, mas o botão pode estar lá.
    document.body.innerHTML = '<video-section><button data-play-button>tocar</button></video-section>';
    expect(() => document.querySelector('[data-play-button]').click()).not.toThrow();
  });
});

describe('a section carrega o asset em vez de script inline', () => {
  it('sections/video.liquid referencia video-section.js', async () => {
    // Sem isto, extrair o script e esquecer a tag deixaria os testes acima
    // verdes com a section morta na loja.
    const { readFileSync } = await import('node:fs');
    const liquid = readFileSync('sections/video.liquid', 'utf8');
    expect(liquid).toContain("'video-section.js' | asset_url");
    expect(liquid).not.toContain('customElements.define');
  });
});
