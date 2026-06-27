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
      borderRadius: {
        theme: '8px',
        'theme-sm': '4px',
        'theme-lg': '12px',
      },
      // Escala tipográfica — ancorada no CORPO = 14px (text-sm).
      // Fonte única da verdade para tamanhos; o body herda 14px (layout/theme.liquid).
      // Papel semântico de cada degrau no comentário.
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],     // 12px · legendas, labels, textos legais
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],  // 14px · CORPO (padrão)
        'base': ['1rem',     { lineHeight: '1.5rem' }],   // 16px · corpo destacado / títulos pequenos
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],  // 18px · subtítulo / h6
        'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],  // 20px · h5
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],     // 24px · h4 / título de seção
        '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],  // 30px · h3
        '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],   // 36px · h2
        '5xl':  ['3rem',     { lineHeight: '1' }],        // 48px · h1 / hero
      },
    },
  },
  plugins: [],
}
