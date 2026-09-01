/**
 * tokens — o guard rail do Design System.
 *
 * Regra única: cor, raio, tipografia e espaçamento saem de token, nunca de
 * valor cru. Em cor isso não é preferência estética — é o que faz o lojista
 * conseguir colocar a cara dele na loja pelo color scheme da Shopify. Um hex
 * escrito no Liquid é uma cor que o lojista nunca vai conseguir mudar.
 *
 * Pipeline que esta regra protege:
 *   config/settings_schema.json  (lojista edita)
 *        ↓ layout/theme.liquid gera
 *   CSS custom properties (--color-*)
 *        ↓ tailwind.config.js consome
 *   tokens semânticos (bg-background, text-foreground, …)
 *        ↓
 *   .liquid usa SÓ token.
 *
 * Exceções legítimas (cor de marca, scrim de imagem, lightbox) vivem em
 * scripts/lint/config/design-exceptions.json e exigem justificativa escrita.
 */
import { allLiquid, lineAt, offense, read, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'tokens',
  title: 'Design tokens',
  description: 'Nenhum hex, cinza ou valor arbitrário fora dos tokens do tema.',
  ratchet: true,
};

const CHECKS = [
  {
    code: 'hex',
    // Hex de 3, 6 ou 8 dígitos. `\b` no fim evita casar prefixo de string maior.
    pattern: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g,
    message: (v) =>
      `Cor fixa ${v} — o lojista não consegue mudar pelo color scheme. Use um token (bg-background, text-foreground, …).`,
  },
  {
    code: 'palette',
    pattern:
      /\b(?:text|bg|border|ring|divide|from|via|to|placeholder|decoration|outline)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g,
    message: (v) => `${v} é da paleta do Tailwind, não do color scheme. Use text-foreground/NN ou bg-foreground/NN.`,
  },
  {
    code: 'bw',
    pattern: /\b(?:text|bg|border|ring|divide|placeholder)-(?:black|white)\b/g,
    message: (v) =>
      `${v} ignora o color scheme. Use text-foreground / bg-background (ou registre a exceção se for scrim de imagem).`,
  },
  {
    code: 'radius',
    // Qualquer rounded que não seja rounded-theme*, rounded-full ou rounded-none.
    // O segundo lookahead cobre a forma POR CANTO (`rounded-br-none`): ela é a
    // maneira correta de tirar um canto só, e sem esta linha a regra a acusava
    // mandando usar `rounded-none` — que tiraria os quatro. O terceiro cobre
    // `rounded-tl-[600px]`: a regra o reportava como "rounded", nome que não
    // existe na linha, enquanto o check `arbitrary` já o reporta com o nome
    // certo. Duas acusações para o mesmo defeito, uma delas ilegível.
    pattern: /\brounded(?!-(?:theme(?:-sm|-lg)?|full|none)\b)(?!-(?:t|r|b|l|tl|tr|br|bl)-(?:theme(?:-sm|-lg)?|full|none)\b)(?!-(?:t|r|b|l|tl|tr|br|bl)-\[)(?:-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))?\b/g,
    message: (v) =>
      `${v} não é token do tema. Use rounded-theme / rounded-theme-sm / rounded-theme-lg (ou rounded-full / rounded-none).`,
  },
  {
    code: 'arbitrary',
    // Valor arbitrário do Tailwind: `tracking-[0.18em]`, `text-[11px]`, `z-[9999]`…
    pattern: /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s"']+\]/g,
    message: (v) => `Valor arbitrário ${v} fora da escala do tema — promova a um token em tailwind.config.js.`,
  },
  // Os dois checks abaixo pegam classe STOCK do Tailwind: ela não é "arbitrária"
  // e passava batida. Foi assim que o raio chegou a 50/50 — metade do tema em
  // `rounded-theme`, metade em `rounded-lg`, ambos valendo 8px e por isso
  // indistinguíveis até o dia em que a lojista mexesse no setting. Definir a
  // escala sem fechar esta porta seria repetir o mesmo erro em outro eixo.
  {
    code: 'tracking',
    // `(?<![-\w])` evita casar dentro de nome maior: `consent-tracking-api`,
    // que é API da Shopify num <script>, não classe do Tailwind.
    pattern: /(?<![-\w])tracking-(?!title\b|label\b|hero\b|\[)[a-z]+\b/g,
    message: (v) =>
      `${v} é degrau do Tailwind, não do tema. Use tracking-title (título), tracking-label (rótulo em caixa alta) ou tracking-hero (kicker sobre mídia). Ver ADR 0005.`,
  },
  {
    code: 'zindex',
    pattern: /(?<![-\w])z-(?!base\b|raised\b|above\b|sticky\b|overlay\b|drawer\b|modal\b|auto\b|\[)\d+\b/g,
    message: (v) =>
      `${v} é degrau numérico do Tailwind, fora da escala nomeada. Use z-base / z-raised / z-above / z-sticky / z-overlay / z-drawer / z-modal. Ver ADR 0005.`,
  },
];

export function run() {
  const offenses = [];

  for (const file of allLiquid()) {
    const src = stripInert(read(file));

    for (const check of CHECKS) {
      for (const match of src.matchAll(check.pattern)) {
        const value = match[0];
        const code = `${check.code}:${value}`;
        if (isAllowed('tokens', file, code)) continue;
        offenses.push(
          offense({
            rule: 'tokens',
            file,
            line: lineAt(src, match.index),
            code,
            message: check.message(value),
          })
        );
      }
    }
  }

  return offenses;
}
