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
import { allLiquid, lineAt, list, offense, read, stripInert } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';
import { CSS as CSS_GERADO } from '../../build-css.mjs';

export const meta = {
  name: 'tokens',
  title: 'Design tokens',
  description: 'Nenhum hex, cinza ou valor arbitrário fora dos tokens do tema — no Liquid e no CSS escrito à mão.',
  ratchet: true,
};

export const CHECKS = [
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
    message: (v) =>
      `${v} é da paleta do Tailwind, não do color scheme. Use text-foreground (corpo), text-foreground-muted (secundário) ou bg-background.`,
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
    code: 'opacity-contrast',
    // Texto secundário por OPACIDADE, abaixo do piso de contraste.
    //
    // Medido contra os schemes do tema (#105): `text-foreground/50` dá 3,52:1
    // no esquema claro, contra os 4,5:1 que o WCAG AA pede. `/55` dá 4,14:1.
    // O piso real é 58% — abaixo disso reprova em pelo menos um dos dois
    // esquemas, e nenhum valor fixo resolve, porque alfa clareia sobre fundo
    // claro e escurece sobre escuro.
    //
    // O `/` na classe do Tailwind é o mesmo alfa, então a regra lê o número:
    // 0 a 57 reprova, 58 em diante passa. `/60` e `/70` continuam válidos —
    // eram 197 dos 343 usos e sempre estiveram certos. O defeito nunca foi
    // "usar opacidade", foi não haver um degrau decidido.
    pattern: /\btext-foreground\/(?:[0-9]|[1-4][0-9]|5[0-7])\b/g,
    message: (v) =>
      `${v} reprova WCAG AA — abaixo de /58 o contraste cai de 4,5:1 em pelo menos um color scheme. ` +
      'Use text-foreground-muted, que deriva do par que a lojista escolheu. Ver #105.',
  },
  {
    code: 'important',
    // O `!` de importância vem DEPOIS das variantes no Tailwind v3: `lg:!py-12`.
    // Escrito antes, `!lg:py-12` não gera CSS nenhum e não dá erro em lugar
    // nenhum — o desktop fica com o valor do mobile. Blog, destaque, imagens
    // com link e artigo passaram a vida assim, sem o espaçamento de desktop
    // que o próprio markup declarava (#151).
    //
    // O lookbehind exige início de classe (espaço, aspas ou começo do texto),
    // para não casar `!=` do Liquid nem `!x` dentro de JavaScript.
    pattern: /(?<![^\s"'])![a-z0-9-]+:[^\s"'{}]+/g,
    message: (v) => {
      const semBang = v.slice(1);
      const corte = semBang.lastIndexOf(':');
      return (
        `${v} não gera CSS: no Tailwind v3 o ! vem depois das variantes. ` +
        `Escreva ${semBang.slice(0, corte + 1)}!${semBang.slice(corte + 1)}.`
      );
    },
  },
  {
    code: 'zindex',
    pattern: /(?<![-\w])z-(?!base\b|raised\b|above\b|sticky\b|overlay\b|drawer\b|modal\b|auto\b|\[)\d+\b/g,
    message: (v) =>
      `${v} é degrau numérico do Tailwind, fora da escala nomeada. Use z-base / z-raised / z-above / z-sticky / z-overlay / z-drawer / z-modal. Ver ADR 0005.`,
  },
];

/**
 * O CSS escrito à mão também consome o color scheme — e passava batido.
 *
 * A regra só lia `.liquid`. Foi por esse buraco que `assets/variant-selector.css`
 * pintou os seletores de variante da PDP de `#000`, `#666` e `#ddd`: num scheme
 * escuro, a borda do hover era preta sobre fundo preto, e o linter dizia "tudo
 * limpo". No CSS a pergunta é só a de COR: raio, tipografia e espaçamento em
 * CSS cru são julgamento, não contrato — o que pinta é o que a lojista edita.
 */
export const CSS_CHECKS = [
  {
    code: 'hex',
    pattern: CHECKS.find((c) => c.code === 'hex').pattern,
    message: (v) =>
      `Cor fixa ${v} no CSS — o lojista não consegue mudar pelo color scheme. Use a variável do scheme: rgb(var(--color-foreground)), rgb(var(--color-border)), …`,
  },
  {
    code: 'rgb',
    // Só com NÚMERO dentro: `rgb(var(--color-border))` é o jeito certo.
    pattern: /\b(?:rgba?|hsla?)\(\s*[\d.][^)]*\)/g,
    message: (v) =>
      `Cor fixa ${v} no CSS — o lojista não consegue mudar pelo color scheme. Use rgb(var(--color-…)), com alfa se precisar: rgb(var(--color-foreground) / 0.6).`,
  },
  {
    code: 'nomeada',
    // Como valor (`color: black`) ou dentro de um atalho (`1px solid white`).
    // O lookahead exige o fim da declaração, e é o que deixa `white-space` passar.
    pattern: /(?<=[:\s])(?:black|white|gray|grey|silver)(?=\s*(?:;|!|\}))/g,
    message: (v) => `Cor nomeada ${v} no CSS ignora o color scheme. Use rgb(var(--color-foreground)) ou rgb(var(--color-background)).`,
  },
  {
    code: 'palette',
    // No fonte do Tailwind: `theme('colors.gray.400')` é a paleta dele.
    pattern: /theme\(\s*['"]colors\.[^'"]+['"]\s*\)/g,
    message: (v) => `${v} é da paleta do Tailwind, não do color scheme. Use rgb(var(--color-border)) ou outra variável do scheme.`,
  },
];

/**
 * Os CSS que o tema escreve. O GERADO fica de fora porque o fonte dele, em
 * `src/`, já é lido — lê-lo de novo repetiria cada acusação. A lista é a mesma
 * que a regra `build` confere. O Swiper é biblioteca de
 * terceiro, baixada sob demanda pelo `<my-slider>`, e o fonte dele não é nosso.
 */
const CSS_DE_TERCEIRO = new Set(['assets/swiper-bundle.min.css']);

export function cssDoTema() {
  const gerados = new Set(CSS_GERADO.map(([, destino]) => destino));
  return [
    ...list('assets', '.css').filter((f) => !gerados.has(f) && !CSS_DE_TERCEIRO.has(f)),
    ...list('src', '.css'),
  ];
}

/** O que a regra acusa num CSS. Pura: recebe o nome e o texto. */
export function acusaCss(file, texto) {
  // Comentário explica a cor que foi removida; ele não pinta nada. As quebras
  // de linha ficam, para a linha apontada ser a da declaração.
  const src = texto.replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ''));
  const offenses = [];
  for (const check of CSS_CHECKS) {
    for (const match of src.matchAll(check.pattern)) {
      const value = match[0];
      const code = `${check.code}:${value}`;
      if (isAllowed('tokens', file, code)) continue;
      offenses.push(
        offense({ rule: 'tokens', file, line: lineAt(src, match.index), code, message: check.message(value) })
      );
    }
  }
  return offenses;
}

export function run() {
  const offenses = [];

  for (const file of cssDoTema()) offenses.push(...acusaCss(file, read(file)));

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
