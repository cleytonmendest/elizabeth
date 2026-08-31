/**
 * A catraca de acessibilidade.
 *
 * ── Por que existe ─────────────────────────────────────────────────────────
 *
 * Quando o gate rodou contra a loja pela primeira vez, encontrou violações que
 * já estavam lá — `color-contrast` em sete páginas, quase todas causadas pelo
 * mesmo breadcrumb. Um gate com tolerância zero nunca ficaria verde, e um gate
 * que nunca fica verde é desligado na primeira sexta-feira corrida.
 *
 * Então vale a mesma regra que o lint deste repositório já usa há tempo:
 * violação que já existia é AVISO, violação nova é ERRO, e o total só pode
 * cair. A dívida fica visível e travada em vez de virar exceção esquecida.
 *
 * ── Por que a impressão digital é `página|regra`, sem o seletor ────────────
 *
 * Mesma escolha que o baseline do lint fez ao travar ITENS e não OCORRÊNCIAS:
 * o que se trava precisa ser estável. Seletor de axe carrega `:nth-child`, id
 * gerado pelo Shopify e classe utilitária escapada — ele muda quando alguém
 * insere um bloco, sem que nada tenha piorado. Contagem de nós muda quando o
 * catálogo muda.
 *
 * `página|regra` só muda quando surge um tipo NOVO de violação, ou quando um
 * tipo conhecido aparece numa página onde não aparecia. As duas coisas são
 * piora de verdade.
 *
 * O custo, dito na cara: uma segunda violação de contraste na mesma página
 * entra escondida atrás da primeira. É o mesmo custo que o baseline do lint
 * aceita, e a saída é a mesma — o número tem que cair até zerar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ARQUIVO = path.join(AQUI, '..', 'a11y-baseline.json');

export const impressao = (pagina, regra) => `${pagina}|${regra}`;

/**
 * Separa o que é dívida conhecida do que é regressão. Pura: recebe fatos,
 * devolve dois arrays. É a parte onde dá para errar em silêncio, então ela
 * tem teste próprio em `e2e/gate.spec.mjs`.
 */
export function avaliar(pagina, violacoes, baseline = {}) {
  const conhecidas = [];
  const novas = [];
  for (const v of violacoes) {
    (baseline[impressao(pagina, v.id)] ? conhecidas : novas).push(v);
  }
  return { conhecidas, novas };
}

/** Impressões do baseline que ninguém mais viola — dívida que já foi paga. */
export function resolvidas(pagina, violacoes, baseline = {}) {
  const vistas = new Set(violacoes.map((v) => impressao(pagina, v.id)));
  return Object.keys(baseline).filter((f) => f.startsWith(`${pagina}|`) && !vistas.has(f));
}

export function carregar() {
  if (!fs.existsSync(ARQUIVO)) return {};
  return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).violacoes ?? {};
}
