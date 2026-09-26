/**
 * snakecase — variável de Liquid em `snake_case`.
 *
 * O CLAUDE.md pedia isto em prosa ("Liquid em `snake_case`") e nada verificava.
 * Ver issue #130.
 *
 * Não é preciosismo de estilo. `{% assign temCor %}` e `{% assign tem_cor %}`
 * convivem sem erro nenhum — o Liquid não liga —, e o tema acaba com os dois
 * jeitos de nomear a mesma coisa. Quem lê um snippet e procura `tem_cor` não
 * acha, e escreve a terceira variável.
 *
 * ── O que NÃO é acusado, e por quê ─────────────────────────────────────────
 *
 * Só o nome que ESTE arquivo cria: o alvo de `assign` e de `capture`, e a
 * variável do `for`. O que vem da Shopify (`product.selected_variant`,
 * `forloop.first`, `section.settings.colorScheme` quando o id do setting é
 * assim) não é nosso para renomear, e acusar isso ensinaria a ignorar a regra.
 */
import { list, offense, read, stripInert, lineAt } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'snakecase',
  title: 'Nome de variável em Liquid',
  description: 'Variável criada por assign, capture ou for usa snake_case.',
  ratchet: true,
};

/** `assign x =`, `capture x`, `for x in` — os três lugares onde nomeamos. */
const CRIACOES = [
  { regex: /\{%-?\s*assign\s+([a-zA-Z_][\w]*)\s*=/g, verbo: 'assign' },
  { regex: /\{%-?\s*capture\s+([a-zA-Z_][\w]*)\s*-?%\}/g, verbo: 'capture' },
  { regex: /\{%-?\s*for\s+([a-zA-Z_][\w]*)\s+in\s/g, verbo: 'for' },
];

/** `snake_case` de verdade: minúscula, dígito e sublinhado, e nada mais. */
export const ehSnakeCase = (nome) => /^[a-z][a-z0-9_]*$/.test(nome);

/** O mesmo nome, em snake_case — para o recado dizer o que escrever. */
export const paraSnakeCase = (nome) =>
  nome
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();

/** As violações de um arquivo. Exportada para o teste injetar a fonte. */
export function violacoesEm(file, src) {
  const achados = [];

  for (const { regex, verbo } of CRIACOES) {
    for (const match of src.matchAll(regex)) {
      const nome = match[1];
      if (ehSnakeCase(nome)) continue;
      achados.push({ nome, verbo, index: match.index });
    }
  }

  return achados.map(({ nome, verbo, index }) =>
    offense({
      rule: 'snakecase',
      file,
      line: lineAt(src, index),
      code: `nome:${nome}`,
      message:
        `\`{% ${verbo} ${nome} %}\` não é snake_case — o tema nomeia em snake_case, e os dois ` +
        `jeitos convivendo fazem quem procura \`${paraSnakeCase(nome)}\` não achar e criar a ` +
        `terceira variável. Renomeie para \`${paraSnakeCase(nome)}\`.`,
    })
  );
}

export function run() {
  const offenses = [];

  for (const file of [...list('sections'), ...list('snippets'), ...list('layout'), ...list('templates')]) {
    // `stripInert` antes de olhar: nome dentro de `{% comment %}` é exemplo,
    // não código, e acusá-lo é como o linter aprende a ser ignorado.
    for (const achado of violacoesEm(file, stripInert(read(file)))) {
      if (isAllowed('snakecase', file, achado.code)) continue;
      offenses.push(achado);
    }
  }

  return offenses;
}
