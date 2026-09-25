// @vitest-environment node
//
// Sem DOM: o que se exercita aqui é uma decisão escrita em Liquid, e quem a
// executa é o `liquidjs`.

/**
 * A forma do submenu — a primeira decisão em Liquid que este tema consegue testar.
 *
 * ── Por que isto não existia ───────────────────────────────────────────────
 *
 * Os linters verificam ESTRUTURA (o token existe, a chave existe, o asset
 * existe) e o `theme-check` é estático. O Vitest cobre os Web Components, que
 * são JavaScript. No meio ficava um buraco: `{% if %}` dentro de um `.liquid`
 * não era exercitado por nada, e a única forma de saber se a condição estava
 * certa era abrir a loja e olhar.
 *
 * É esse buraco que produziu a #36 — "entregue e nunca validado de ponta a
 * ponta". Escrever a regra de forma dentro do `main-menu.liquid`, junto com o
 * markup, seria repetir o buraco com a regra nova dentro.
 *
 * ── O que o `liquidjs` mede, e o que não mede ──────────────────────────────
 *
 * Ele NÃO é o Liquid da Shopify: não tem `linklist`, nem `image_url`, nem os
 * drops. Por isso o snippet testado aqui foi extraído para não usar nada
 * disso — só `.size`, `if`, `for` e `echo`, que os dois motores implementam
 * igual.
 *
 * O limite é real e vale escrito: este teste prova que a REGRA está certa. Que
 * o `main-menu.liquid` a chama com os argumentos certos é outra pergunta, e
 * quem responde é `e2e/menu-desktop.spec.mjs`, contra um navegador.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = new Liquid({ root: path.join(RAIZ, 'snippets'), extname: '.liquid' });
const FONTE = fs.readFileSync(path.join(RAIZ, 'snippets/menu-forma.liquid'), 'utf8');

const forma = (link, promo = null) => engine.parseAndRenderSync(FONTE, { link, promo }).trim();

/** Um item de menu com `n` subitens; `comFilhos` diz quantos deles têm 3º nível. */
const item = (n, comFilhos = 0) => ({
  links: Array.from({ length: n }, (_, i) => ({
    links: i < comFilhos ? [{ links: [] }, { links: [] }] : [],
  })),
});

describe('a profundidade decide a forma', () => {
  it('lista plana curta → dropdown', () => {
    expect(forma(item(2))).toBe('dropdown');
    expect(forma(item(5))).toBe('dropdown');
  });

  it('lista plana LONGA continua dropdown — contagem não muda a forma', () => {
    // O ponto da regra. "Mais de N vira painel" seria um número escolhido por
    // alguém; vinte links soltos continuam sendo uma lista, e lista é coluna.
    // Quantas colunas o dropdown tem é layout, e vive noutro lugar.
    expect(forma(item(20))).toBe('dropdown');
  });

  it('um único subitem com terceiro nível já faz painel', () => {
    // Basta UM: o painel existe para mostrar grupos, e a partir do momento em
    // que existe um grupo o arranjo em colunas é o que faz sentido.
    expect(forma(item(4, 1))).toBe('painel');
  });

  it('todos com terceiro nível → painel', () => {
    expect(forma(item(4, 4))).toBe('painel');
  });
});

describe('o promo força painel', () => {
  it('mesmo numa lista plana curta, que sozinha seria dropdown', () => {
    expect(forma(item(2))).toBe('dropdown');
    expect(forma(item(2), { settings: { image: 'x.jpg' } })).toBe('painel');
  });

  it('e não muda nada quando já era painel', () => {
    expect(forma(item(4, 2), { settings: { image: 'x.jpg' } })).toBe('painel');
  });
});

describe('as bordas', () => {
  it('item sem subitem nenhum não chega aqui, mas não pode estourar', () => {
    // `main-menu.liquid` só chama isto dentro de `{% if link.links.size > 0 %}`.
    // Ainda assim: uma regra que estoura com entrada vazia é uma regra que
    // estoura no dia em que alguém a chamar de outro lugar.
    expect(forma({ links: [] })).toBe('dropdown');
  });

  it('e a saída é sempre uma das duas palavras — nunca vazio', () => {
    for (const caso of [item(0), item(1), item(9), item(3, 3)]) {
      expect(['dropdown', 'painel']).toContain(forma(caso));
    }
  });
});
