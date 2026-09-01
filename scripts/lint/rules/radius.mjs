/**
 * radius — estilo que o lojista edita não pode ficar de fora do markup.
 *
 * ── O buraco que esta regra fecha ──────────────────────────────────────────
 *
 * A regra `tokens` procura raio ERRADO: acha `rounded-lg`, `rounded-[8px]`,
 * `rounded-md`. Mas ela é uma busca por padrão, e ausência não é padrão —
 * "este botão deveria ter raio" não está escrito em lugar nenhum do arquivo.
 *
 * Medido antes desta regra existir: dos 25 lugares onde o tema pinta um botão,
 * 12 não traziam classe de raio nenhuma. `.color-button` define só cor, então
 * esses 12 renderizavam quadrados — independente do que a lojista escolhesse
 * em `settings.radius_style`. O setting existia, o token existia, o pipeline
 * inteiro funcionava, e o botão da PDP ignorava tudo.
 *
 * O caso é o mesmo de `schemecontract`, e a forma da regra também: verificar
 * uma CO-OCORRÊNCIA em vez de um valor. Lá, aplicar fundo obriga a aplicar cor
 * de texto. Aqui, pintar um botão obriga a dizer o raio dele.
 *
 * ── `rounded-none` conta ───────────────────────────────────────────────────
 *
 * Botão quadrado é escolha legítima. O que a regra proíbe é a escolha
 * IMPLÍCITA: quem quer quadrado escreve `rounded-none` e fica documentado; sem
 * classe nenhuma, ninguém sabe se foi decisão ou esquecimento — e o resultado
 * é o mesmo botão quadrado numa loja que pediu cantos arredondados.
 */
import { allLiquid, lineAt, offense, read } from '../lib.mjs';

export const meta = {
  name: 'radius',
  title: 'Raio do lojista nos botões',
  description: 'Todo botão declara o raio; nenhum fica quadrado por omissão.',
  ratchet: true,
};

/**
 * Onde as classes de um botão são escritas literalmente: no `class` do
 * elemento, ou no `button_class` passado a um snippet que renderiza o botão.
 * `[\s\S]` porque atributo de classe quebrado em várias linhas é comum aqui.
 */
const ATRIBUTOS = /(?:class|button_class)\s*[:=]\s*(['"])([\s\S]*?)\1/g;

/** `(?<![-\w])` rejeita a CSS variable `--color-button` e aceita `-secondary`. */
const PINTA_BOTAO = /(?<![-\w])(?:color-button|bg-button)(?![\w-]*-text\b)/;

const DECLARA_RAIO = /\brounded-(?:theme(?:-sm|-lg)?|full|none)\b/;

export function run() {
  const offenses = [];

  for (const file of allLiquid()) {
    const src = read(file);

    for (const match of src.matchAll(ATRIBUTOS)) {
      const classes = match[2];
      if (!PINTA_BOTAO.test(classes) || DECLARA_RAIO.test(classes)) continue;

      offenses.push(
        offense({
          rule: 'radius',
          file,
          line: lineAt(src, match.index),
          // O código do fingerprint não carrega a linha: mover o botão de
          // lugar não pode virar dívida nova.
          code: 'botao-sem-raio',
          message:
            'Botão sem token de raio: ele fica quadrado mesmo quando a lojista ' +
            'escolhe cantos arredondados em settings.radius_style. Use ' +
            'rounded-theme (ou rounded-none, se quadrado for a intenção).',
        })
      );
    }
  }

  return offenses;
}
