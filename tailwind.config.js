/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './layout/*.liquid',
    './sections/*.liquid',
    './snippets/*.liquid',
    './templates/*.liquid',
    './templates/customers/*.liquid'
  ],
  // Classes geradas dinamicamente em Liquid (ex.: lg:grid-cols-{{ products_per_row }})
  // não são detectadas pelo scanner do Tailwind — precisam ser garantidas aqui.
  safelist: [
    { pattern: /grid-cols-([2-6])/, variants: ['md', 'lg'] },
  ],
  theme: {
    extend: {
      // ============================================
      // Design tokens
      // ============================================
      // Cores mapeadas para os color schemes (config no admin → layout/theme.liquid
      // gera as CSS variables → assets/color-scheme.css). Usar estes tokens em vez
      // de hex hardcoded garante que tudo siga o esquema de cores do tema e o
      // dark mode automaticamente. Suporta opacidade: text-foreground/70, bg-text/5.
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        link: 'rgb(var(--color-link) / <alpha-value>)',
        button: {
          DEFAULT: 'rgb(var(--color-button) / <alpha-value>)',
          text: 'rgb(var(--color-button-text) / <alpha-value>)',
        },
        badge: {
          DEFAULT: 'rgb(var(--color-badge-background) / <alpha-value>)',
          text: 'rgb(var(--color-badge-text) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        shadow: 'rgb(var(--color-shadow) / <alpha-value>)',
      },
      // Arredondamento padronizado (ver Design Standards no CLAUDE.md).
      // Usar rounded-theme em botões/cards/inputs/modais centraliza o controle:
      // mudar o nível de arredondamento do tema inteiro = uma linha aqui.
      // Arredondamento — o VALOR vem do lojista (settings.radius_style), estes
      // tokens só dizem ONDE ele se aplica. Ver ADR 0003. Os degraus derivam
      // por calc() em layout/theme.liquid, então mudar o nível de
      // arredondamento do tema inteiro continua sendo uma escolha só.
      borderRadius: {
        theme: 'var(--radius-theme)',
        'theme-sm': 'var(--radius-theme-sm)',
        'theme-lg': 'var(--radius-theme-lg)',
      },
      // Escala tipográfica — ancorada no CORPO = 14px (text-sm) e multiplicada
      // por --font-scale, que o lojista escolhe (settings.font_scale). Um
      // multiplicador único em vez de nove campos: a proporção entre título e
      // corpo fica preservada por construção. Ver ADR 0003.
      // Os valores em px nos comentários são os de --font-scale: 1.
      fontSize: {
        'xs':   ['calc(0.75rem * var(--font-scale))', { lineHeight: 'calc(1rem * var(--font-scale))' }],  // 12px · legendas, labels, textos legais
        'sm':   ['calc(0.875rem * var(--font-scale))', { lineHeight: 'calc(1.25rem * var(--font-scale))' }],  // 14px · CORPO (padrão)
        'base': ['calc(1rem * var(--font-scale))', { lineHeight: 'calc(1.5rem * var(--font-scale))' }],  // 16px · corpo destacado / títulos pequenos
        'lg':   ['calc(1.125rem * var(--font-scale))', { lineHeight: 'calc(1.75rem * var(--font-scale))' }],  // 18px · subtítulo / h6
        'xl':   ['calc(1.25rem * var(--font-scale))', { lineHeight: 'calc(1.75rem * var(--font-scale))' }],  // 20px · h5
        '2xl':  ['calc(1.5rem * var(--font-scale))', { lineHeight: 'calc(2rem * var(--font-scale))' }],  // 24px · h4 / título de seção
        '3xl':  ['calc(1.875rem * var(--font-scale))', { lineHeight: 'calc(2.25rem * var(--font-scale))' }],  // 30px · h3
        '4xl':  ['calc(2.25rem * var(--font-scale))', { lineHeight: 'calc(2.5rem * var(--font-scale))' }],  // 36px · h2
        '5xl':  ['calc(3rem * var(--font-scale))', { lineHeight: '1' }],  // 48px · h1 / hero
      },
      // Letter-spacing — três papéis, e os valores saíram do que o código já
      // fazia, não de gosto. Ver ADR 0005: `text-xs uppercase` carregava
      // QUATRO trackings diferentes, o que prova que a variação era ruído.
      // Ao contrário do raio, o valor aqui não é do lojista: espaçamento de
      // letra é decisão tipográfica do tema, não customização de loja.
      letterSpacing: {
        title: '-0.025em',  // h1–h3 e títulos de seção · era tracking-tight, 45x
        label: '0.18em',    // rótulo curto em CAIXA ALTA · valor dominante, 47x
        hero:  '0.3em',     // kicker sobre mídia de destaque · 4x, sempre no mesmo papel
      },
      // z-index — os degraus são os que o código já usa; o ADR dá nome e ordem
      // a eles, sem renumerar. Renumerar arriscaria o empilhamento contra app
      // de terceiro, que divide a mesma página e não conhece nossa escala.
      zIndex: {
        base:    '0',     // plano da página (véu que fica ATRÁS)
        raised:  '1',     // encostado acima: barra do header, scrim sobre imagem
        above:   '2',     // acima do scrim: botão de play, hotspot do lookbook
        sticky:  '10',    // controle sobre mídia: badge, seta de slider, header grudado
        overlay: '40',    // véu que escurece a página, e o que flutua junto dele
        drawer:  '50',    // gaveta que entra por cima do véu
        modal:   '9999',  // diálogo. Alto de propósito: app de terceiro na mesma página
      },
      // Altura mínima do miolo em página que pode chegar CURTA: carrinho vazio,
      // 404. Sem ela o rodapé sobe até o meio da tela e a página parece
      // quebrada. Não é escolha do lojista — é o piso que impede o layout de
      // colapsar, do mesmo jeito que `tracking-*` não é escolha dele.
      //
      // O valor não foi inventado aqui: `min-h-[60vh]` já estava escrito em
      // dois arquivos, e como valor arbitrário estava no baseline duas vezes.
      minHeight: {
        page: '60vh',
      },
      // Proporções — `video` (16/9) já é degrau do Tailwind e continua valendo.
      aspectRatio: {
        portrait:  '3 / 4',   // mídia editorial em pé
        product:   '2 / 3',   // foto de produto no card de slider
        landscape: '4 / 3',   // mídia deitada
        ultrawide: '21 / 9',  // hero de artigo
      },
    },
  },
  plugins: [],
}
