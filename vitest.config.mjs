import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os alvos são Web Components: sem DOM não há o que testar.
    environment: 'jsdom',
    include: ['tests/**/*.test.mjs'],
    // Cada arquivo de teste carrega assets que chamam `customElements.define`.
    // Sem isolamento, o segundo arquivo a definir `cart-drawer` explodiria —
    // e o erro seria do ambiente compartilhado, não do tema.
    isolate: true,
  },
});
