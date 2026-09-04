/**
 * Regressão visual da página de style guide.
 *
 * ⚠ ESTE TESTE AINDA NÃO TEM BASELINE COMMITADA: a primeira imagem só pode
 * nascer de uma loja de verdade. Enquanto não existir, o Playwright grava a
 * baseline e REPROVA o run que a gravou — que é o comportamento certo: uma
 * baseline que ninguém olhou não é referência, é só o estado atual promovido a
 * verdade.
 *
 * ── O impasse que este arquivo teve, e como ele saiu (#74) ─────────────────
 *
 * Até a #74, o teste se declarava PULADO quando a baseline não existia, e a
 * mensagem mandava baixar `styleguide-actual.png` do artefato do CI. Só que
 * essa imagem é produzida pelo `toHaveScreenshot` — que não rodava, porque o
 * teste estava pulado. Sem baseline não havia imagem; sem imagem não havia
 * baseline. Resultado: desde que o arquivo foi escrito, a regressão visual
 * nunca comparou nada, e o CI ficava verde porque pulo com motivo escrito é o
 * que este repositório trata como aceitável.
 *
 * O pulo saiu. O que fica é o gravar-e-reprovar que este cabeçalho sempre
 * prometeu — agora o código faz o que ele diz.
 *
 * ── Onde a imagem aparece (medido, não suposto) ────────────────────────────
 *
 * Sem baseline, o Playwright escreve em DOIS lugares:
 *
 *   e2e/__screenshots__/styleguide.png                       (a baseline)
 *   test-results/<spec>-<teste>-chromium/styleguide-actual.png (a cópia)
 *
 * e reprova com "A snapshot doesn't exist at …, writing actual". O
 * `upload-artifact` do `ci.yml` já sobe `test-results/` em `if: failure()`,
 * então é de lá que a imagem se baixa. OLHE a imagem antes de commitar a
 * baseline — é a única etapa desta mecânica que uma máquina não faz.
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
 * trocando o arquivo antes do `shopify theme push`. Ou seja, não dá para
 * cobrir os quatro numa execução só — precisa de uma matriz no CI que empurre
 * um tema por preset. Isso está registrado como próximo passo em vez de
 * fingido aqui: um teste que troca de preset sem trocar de tema empurrado
 * mediria quatro vezes a mesma coisa.
 */
import { test, expect } from '@playwright/test';
import { THEME_URL, MOTIVO, STYLEGUIDE_PATH, abrePaginaDoTema } from './helpers/loja.mjs';

test.skip(!THEME_URL, MOTIVO);

test('a página inteira bate com a baseline', async ({ page }) => {
  await abrePaginaDoTema(page, STYLEGUIDE_PATH);

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
