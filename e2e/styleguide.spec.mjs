/**
 * Regressão visual da página de style guide.
 *
 * ⚠ NENHUM TESTE DESTE ARQUIVO JÁ RODOU, e ele não tem baseline commitada:
 * a primeira imagem só pode nascer de uma loja de verdade. Enquanto não
 * existir, o Playwright grava a baseline e REPROVA o run que a gravou — que é
 * o comportamento certo: uma baseline que ninguém olhou não é referência,
 * é só o estado atual promovido a verdade.
 *
 * ── Por que esta página, e não todas ───────────────────────────────────────
 *
 * Ela renderiza os componentes com TODOS os color schemes de
 * `settings.color_schemes` de uma vez. Uma imagem só cobre o eixo inteiro de
 * cor — e é o que destrava a migração de tokens da issue #29: mexer numa
 * escala e ver exatamente o que mudou de aparência.
 *
 * ── O que fica de fora, e por quê ──────────────────────────────────────────
 *
 * A issue #31 pede screenshot "nos 4 presets". Preset não é escolha da
 * visitante: ele vive em `config/settings_data.json` e só muda no admin ou
 * trocando o arquivo antes de subir o `shopify theme dev`. Ou seja, não dá
 * para cobrir os quatro numa execução só — precisa de uma matriz no CI que
 * suba o servidor uma vez por preset. Isso está registrado como próximo passo
 * em vez de fingido aqui: um teste que troca de preset sem trocar de servidor
 * mediria quatro vezes a mesma coisa.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO, STYLEGUIDE_PATH } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

test('a página inteira bate com a baseline', async ({ page }) => {
  await page.goto(STYLEGUIDE_PATH);

  // Sem isto, qualquer animação em curso vira diferença de pixel e o teste
  // oscila — e teste que oscila a gente aprende a ignorar.
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('styleguide.png', {
    fullPage: true,
    // Antialiasing de fonte varia entre máquinas; 1% absorve isso sem esconder
    // uma mudança de token, que move área muito maior.
    maxDiffPixelRatio: 0.01,
  });
});
