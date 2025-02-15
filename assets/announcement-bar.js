class AnnouncementBar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const inner = this.querySelector('.announcement-inner');
    if (!inner) return;

    const containerWidth = this.offsetWidth || window.innerWidth;
    const firstBlockWidth = inner.scrollWidth;
    let totalWidth = firstBlockWidth;

    // Enquanto não atingimos 2x (ou 3x) a largura do container, vamos clonando
    while (totalWidth < containerWidth * 2) {
      const clone = inner.cloneNode(true);
      this.appendChild(clone);
      totalWidth += firstBlockWidth;
    }

    // Agora temos vários .announcement-inner dentro <announcement-bar>,
    // sem precisar duplicar manualmente no HTML.

    // Em seguida, você aplica a animação:
    this.initMarquee(totalWidth);
  }

  initMarquee(totalWidth) {
    const speed = parseFloat(this.dataset.speed) || 60;
    const duration = totalWidth / speed;
    const sectionId = this.dataset.sectionId || Date.now();

    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @keyframes marquee-${sectionId} {
        0% { transform: translateX(0); }
        100% { transform: translateX(-${totalWidth}px); }
      }
      .marquee-${sectionId} {
        animation: marquee-${sectionId} ${duration}s linear infinite;
      }
    `;
    document.head.appendChild(styleTag);

    // Aplica a animação em todos os .announcement-inner gerados
    this.querySelectorAll('.announcement-inner').forEach(inner => {
      inner.classList.add(`marquee-${sectionId}`, 'inline-flex', 'whitespace-nowrap');
    });
  }
}

customElements.define('announcement-bar', AnnouncementBar);
