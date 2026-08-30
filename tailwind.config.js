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
    },
  },
  plugins: [],
}
