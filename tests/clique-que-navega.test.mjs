/**
 * `.click()` seguido de `waitForLoadState` — o padrão que custou a #64.
 *
 * ── O defeito, em duas linhas ──────────────────────────────────────────────
 *
 *   await locator.click();              // dispara um POST
 *   await page.waitForLoadState('load'); // resolve NA HORA
 *
 * `waitForLoadState` devolve imediatamente quando o documento atual já está no
 * estado pedido — e no instante do clique ele está, porque é a página que o
 * teste acabou de medir. A navegação ainda nem começou. Tudo que se perguntar
 * depois é respondido pelo documento VELHO.
 *
 * ── Por que isto é um verificador e não uma preferência de estilo ──────────
 *
 * Em `e2e/endereco.spec.mjs` esse par estava no submit do login. O sintoma que
 * ele produziu:
 *
 *   url=/account/login · título="Conta – Elizabeth Estudos" · sem erro nenhum
 *
 * que foi lido, por quatro execuções de CI e três semanas, como "o POST não
 * produz sessão". Duas hipóteses caras foram levantadas e reprovadas em cima
 * dessa leitura — o proxy do `shopify theme dev` e o markup do formulário —
 * antes de alguém notar que as três observações descrevem a página de ANTES
 * do POST. Cinco testes ficaram em `fixme` esse tempo todo.
 *
 * O defeito nunca esteve escondido: estava em duas linhas seguidas, num
 * arquivo que várias pessoas leram. É o formato de erro que revisão humana não
 * pega, porque cada linha isolada é correta e só o par é errado.
 *
 * ── O que fazer quando este teste reprovar ─────────────────────────────────
 *
 * Se o clique TRAZ documento novo, use `clicaNoTema` de `e2e/helpers/loja.mjs`:
 * ela carimba o documento antes do clique e espera o carimbo morrer, que é o
 * único sinal confiável (a URL não é — POST recusado volta na mesma URL com um
 * documento novo, e `pushState` muda a URL sem documento nenhum).
 *
 * Se o clique NÃO traz documento novo, então não há o que esperar: apague o
 * `waitForLoadState` e espere o que o clique realmente produz — um modal
 * visível, um campo que sumiu, um texto que apareceu.
 *
 * Em nenhum dos dois casos o par acima é a resposta, e é por isso que ele não
 * precisa de exceção configurável.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'e2e');

/** Quantas linhas depois do clique ainda contam como "logo em seguida". */
const JANELA = 3;

const specs = () =>
  fs
    .readdirSync(E2E)
    .filter((nome) => nome.endsWith('.spec.mjs'))
    .map((nome) => ({ nome: `e2e/${nome}`, linhas: fs.readFileSync(path.join(E2E, nome), 'utf8').split('\n') }));

/**
 * Ignora comentário, porque este arquivo e o cabeçalho da #64 CITAM o padrão
 * para explicá-lo. Um verificador que reprovasse a própria explicação seria
 * desligado na primeira semana.
 */
const ehComentario = (linha) => /^\s*(\/\/|\*|\/\*)/.test(linha);

export function paresSuspeitos({ nome, linhas }) {
  const achados = [];

  linhas.forEach((linha, i) => {
    if (ehComentario(linha) || !/\.click\(\s*\)/.test(linha)) return;

    for (let j = i + 1; j <= i + JANELA && j < linhas.length; j += 1) {
      if (ehComentario(linhas[j])) continue;
      if (/waitForLoadState/.test(linhas[j])) {
        achados.push({ arquivo: nome, linha: j + 1, trecho: linhas[j].trim() });
        return;
      }
      // Qualquer outra instrução entre os dois já quebra o par: o que este
      // teste procura é a espera IMEDIATAMENTE depois do clique.
      if (linhas[j].trim() !== '') return;
    }
  });

  return achados;
}

describe('nenhum spec espera navegação com `waitForLoadState` depois de clicar', () => {
  const arquivos = specs();

  it('achou specs para varrer (senão este teste mede o vazio)', () => {
    // Sem isto, renomear a pasta ou a extensão deixaria a varredura vazia, e
    // vazio passa em toda asserção de "não encontrou nada" — o mesmo silêncio
    // de quando está tudo certo.
    expect(arquivos.length, 'nenhum e2e/*.spec.mjs encontrado').toBeGreaterThan(0);
  });

  for (const arquivo of arquivos) {
    it(`${arquivo.nome} está limpo`, () => {
      const achados = paresSuspeitos(arquivo);
      expect(
        achados,
        achados
          .map(
            (a) =>
              `${a.arquivo}:${a.linha} — \`${a.trecho}\` logo depois de um clique. ` +
              'Resolve na hora sobre o documento velho; use `clicaNoTema` se o clique ' +
              'traz documento novo, ou espere o que ele realmente produz se não traz.'
          )
          .join('\n')
      ).toEqual([]);
    });
  }
});

describe('e o verificador acha o padrão quando ele existe', () => {
  /**
   * A varredura acima só reprova se souber achar. Com todos os specs limpos,
   * ela passaria idêntica se o regex estivesse quebrado — que é exatamente a
   * falha que a #64 sofreu um nível acima. Então planta-se o defeito.
   */
  it('acha o par exato que estava no login da #64', () => {
    const achados = paresSuspeitos({
      nome: 'plantado.spec.mjs',
      linhas: [
        "  await formulario.locator('button[type=\"submit\"]').click();",
        "  await page.waitForLoadState('load');",
      ],
    });
    expect(achados).toHaveLength(1);
    expect(achados[0].linha).toBe(2);
  });

  it('acha mesmo com comentário no meio', () => {
    const achados = paresSuspeitos({
      nome: 'plantado.spec.mjs',
      linhas: ['  await botao.click();', '  // uma explicação qualquer', "  await page.waitForLoadState('load');"],
    });
    expect(achados).toHaveLength(1);
  });

  it('não acusa clique sem espera nenhuma', () => {
    const achados = paresSuspeitos({
      nome: 'plantado.spec.mjs',
      linhas: ['  await botao.click();', '  await expect(modal).toBeVisible();'],
    });
    expect(achados).toEqual([]);
  });

  it('não acusa `waitForLoadState` longe do clique', () => {
    // Espera depois de um `goto` é outra coisa, e legítima: ali a navegação
    // já começou e o documento novo é o que se está esperando.
    const achados = paresSuspeitos({
      nome: 'plantado.spec.mjs',
      linhas: [
        '  await botao.click();',
        '  await expect(modal).toBeVisible();',
        "  await page.goto('/outra');",
        "  await page.waitForLoadState('networkidle');",
      ],
    });
    expect(achados).toEqual([]);
  });

  it('não acusa a si mesmo, nem o cabeçalho que explica o defeito', () => {
    const achados = paresSuspeitos({
      nome: 'plantado.spec.mjs',
      linhas: ['  // await locator.click();', "  // await page.waitForLoadState('load');"],
    });
    expect(achados).toEqual([]);
  });
});
