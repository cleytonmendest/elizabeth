/**
 * <video-section> — o vídeo da section `video`.
 *
 * Dois modos, e eles têm problemas de acessibilidade opostos:
 *
 *   Fundo           vídeo hospedado, autoplay, mudo, em loop, atrás do texto
 *   Clique-para-tocar   poster + botão; o vídeo só entra na DOM depois do clique
 *
 * ── Por que este arquivo saiu de dentro do Liquid ──────────────────────────
 *
 * Era um `<script>` inline em `sections/video.liquid`. Inline não é carregável
 * por `tests/helpers/load-asset.mjs`, então nada aqui era testado — e a section
 * estava marcada como "nunca validada de ponta a ponta" (issue #36).
 *
 * ── prefers-reduced-motion ─────────────────────────────────────────────────
 *
 * O modo Fundo dá autoplay num loop infinito. Para quem pediu menos movimento
 * no sistema, isso é exatamente o que ela desligou — e um vídeo em loop atrás
 * do texto é o caso clássico do WCAG 2.2.2 (Pause, Stop, Hide), nível A.
 *
 * A resposta aqui é pausar e DEVOLVER O CONTROLE: `controls` aparece, e quem
 * quiser assistir aperta play. Só esconder o vídeo tiraria o conteúdo; só
 * pausar sem controle deixaria a pessoa sem saída.
 *
 * A preferência é consultada uma vez, na conexão, e não fica escutando: quem
 * muda essa configuração do sistema no meio da navegação recarrega a página.
 */

if (!customElements.get('video-section')) {
  class VideoSection extends HTMLElement {
    connectedCallback() {
      this.btn = this.querySelector('[data-play-button]');
      if (this.btn) this.btn.addEventListener('click', this.play.bind(this));
      this.respeitaPreferenciaDeMovimento();
    }

    /** O vídeo de fundo não roda sozinho para quem pediu menos movimento. */
    respeitaPreferenciaDeMovimento() {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const fundo = this.querySelector('video[autoplay]');
      if (!fundo) return;

      // O atributo sai ANTES do pause: sem isso, um `load()` posterior — que a
      // troca de fonte do Shopify dispara — voltaria a tocar sozinho.
      fundo.removeAttribute('autoplay');
      fundo.controls = true;
      fundo.pause();
    }

    play() {
      const tpl = this.querySelector('[data-video-template]');
      if (!tpl) return;
      this.appendChild(tpl.content.cloneNode(true));
      ['[data-play-button]', '.video-poster', '[data-video-overlay]', '.video-scrim'].forEach(
        (sel) => {
          const el = this.querySelector(sel);
          if (el) el.remove();
        }
      );
      const video = this.querySelector('video');
      if (video) {
        try {
          video.play();
        } catch (e) {
          /* autoplay bloqueado pelo navegador: o controle nativo resolve */
        }
      }
    }
  }

  customElements.define('video-section', VideoSection);
}
