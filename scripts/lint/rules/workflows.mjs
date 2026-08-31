/**
 * workflows — o gate protege o gate.
 *
 * ── Por que esta regra existe ──────────────────────────────────────────────
 *
 * Até agora nada verificava `.github/workflows/`. O CI é a autoridade final
 * deste repositório, e era a única parte dele que ninguém checava — o que já
 * custou caro três vezes:
 *
 *   · a catraca do baseline comparava o total consigo mesma e passava vazia
 *   · o job do board apontava para `actions/add-to-project@v1`, tag inexistente
 *   · `if: ${{ secrets.X != '' }}` num passo derrubou o workflow INTEIRO na
 *     validação — o contexto `secrets` não existe em `if:` — levando junto o
 *     lint e os testes unitários, que não têm nada a ver com o secret
 *
 * Os três eram verificáveis por máquina. O terceiro o actionlint pega com a
 * mensagem exata; o segundo não (ele não vai à rede conferir tags), e é por
 * isso que a regra não se anuncia como cobertura total.
 *
 * Roda o actionlint compilado para WASM, sem binário externo e sem rede.
 *
 * ── Uma peculiaridade que custou um susto ──────────────────────────────────
 *
 * A instância do linter NÃO é reutilizável: chamar a mesma duas vezes derruba
 * o runtime WASM com `RuntimeError: unreachable`. Por isso cria-se uma por
 * arquivo. Um `for` ingênuo aqui não falha — ele explode.
 */
import fs from 'node:fs';
import { createLinter } from 'actionlint';
import { ROOT, abs, list, offense } from '../lib.mjs';

export const meta = {
  name: 'workflows',
  title: 'Workflows do GitHub Actions',
  description: 'Os arquivos de .github/workflows/ são válidos para o GitHub.',
  ratchet: true,
};

const DIR = '.github/workflows';

export async function run() {
  const arquivos = [...list(DIR, '.yml'), ...list(DIR, '.yaml')];
  if (!arquivos.length) return [];

  const ofensas = [];
  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(abs(arquivo), 'utf8');

    let achados;
    try {
      const lint = await createLinter();
      achados = lint(conteudo, arquivo);
    } catch (error) {
      ofensas.push(
        offense({
          rule: 'workflows',
          file: arquivo,
          code: 'actionlint-quebrou',
          message:
            `O actionlint não conseguiu analisar este arquivo: ${error.message}. ` +
            'Passar sem conseguir verificar seria fingir que verificou.',
        })
      );
      continue;
    }

    for (const achado of achados) {
      ofensas.push(
        offense({
          rule: 'workflows',
          file: arquivo,
          line: achado.line,
          // O fingerprint da catraca é "regra|arquivo|código", então o código
          // precisa distinguir os tipos de problema sem carregar o número da
          // linha — senão mover uma linha de lugar viraria dívida nova.
          code: achado.kind,
          message: achado.message.replace(/\s*see https:\/\/\S+\s*for more details/i, ''),
        })
      );
    }
  }

  return ofensas;
}
