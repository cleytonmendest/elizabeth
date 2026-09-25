/**
 * Cor NOMEADA em SVG — o buraco que a regra `tokens` nunca viu.
 *
 * `tokens` procura `#rrggbb`. `fill="black"` não casa com esse padrão, então
 * passou despercebido por versões inteiras: os ícones sociais estavam assim
 * desde sempre e quem achou foi a #5, olhando — nenhum linter reclamou.
 *
 * Não é uma cor menos cravada que o hex. É uma cor cravada que não PARECE cor:
 * `#000` chama atenção em revisão, `black` parece configuração. E o glifo some
 * no scheme escuro exatamente igual.
 *
 * Medido quando a regra nasceu: 72 ocorrências no tema, todas em ícone de
 * pagamento. Onze deles são logo de bandeira com cor de marca e viraram
 * exceção registrada; `icon-pay-boleto` e `icon-pay-yapay` são monocromáticos
 * de verdade e ficaram como dívida visível.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, violacoesEm } from '../scripts/lint/rules/svgcolors.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const achados = run();
const em = (arquivo) => achados.filter((o) => o.file === arquivo);

describe('o que a regra acusa', () => {
  it('acha cor nomeada onde ela existe', () => {
    expect(achados.length, 'a regra parou de encontrar qualquer coisa').toBeGreaterThan(0);
  });

  it('e aponta os dois ícones monocromáticos', () => {
    // Estes dois não têm cor de marca nenhuma: preto e branco sobre
    // transparente. No preset escuro a marca some.
    expect(em('snippets/icon-pay-boleto.liquid').length).toBeGreaterThan(0);
    expect(em('snippets/icon-pay-yapay.liquid').length).toBeGreaterThan(0);
  });

  it('e o código traz a cor, para a exceção poder ser específica', () => {
    expect(achados.every((o) => /^nomeada:[a-z]+$/.test(o.code))).toBe(true);
  });
});

describe('o que ela deixa passar', () => {
  it('logo de bandeira com cor de marca, por exceção registrada', () => {
    // Visa é azul, Pix é teal, Elo tem três cores. Trocar pelo texto do scheme
    // descaracterizaria marca de terceiro.
    for (const marca of ['visa', 'master', 'elo', 'pix', 'american']) {
      expect(em(`snippets/icon-pay-${marca}.liquid`), marca).toEqual([]);
    }
  });

  it('`none`, `currentColor` e `url(#…)` não são cor cravada', () => {
    // `none` é ausência; `currentColor` é justamente a CORREÇÃO (herda o
    // texto do scheme); `url(#…)` aponta para um gradiente do próprio SVG.
    const usamCurrentColor = fs
      .readdirSync(path.join(RAIZ, 'snippets'))
      .filter((f) => f.startsWith('icon-social-'))
      .map((f) => `snippets/${f}`);

    expect(usamCurrentColor.length, 'os ícones sociais sumiram — o teste perdeu o alvo').toBeGreaterThan(0);
    for (const arquivo of usamCurrentColor) expect(em(arquivo), arquivo).toEqual([]);
  });

  it('e nenhum arquivo fora de ícone de pagamento aparece', () => {
    // Se aparecer, é cor nomeada nova em algum lugar — e a regra existe
    // exatamente para isso não passar batido.
    const forasteiros = [...new Set(achados.map((o) => o.file))].filter(
      (f) => !f.includes('icon-pay-') && !f.includes('payment-icons')
    );

    expect(forasteiros).toEqual([]);
  });
});

/**
 * O padrão em si, contra entrada fabricada.
 *
 * Sem este bloco, `stroke` era cobertura de papel: nada no tema usa stroke
 * nomeado hoje, então tirar `stroke` do padrão não derrubava teste nenhum — e
 * um mutante provou isso antes de este arquivo ir para o repositório. Cobrir
 * só o que a árvore tem hoje é medir a árvore, não a regra.
 */
describe('o padrão, com entrada fabricada', () => {
  const analisa = (src) => violacoesEm('snippets/exemplo.liquid', src);

  it.each([
    ['fill nomeado', '<svg><path fill="black"/></svg>'],
    ['stroke nomeado', '<svg><path stroke="white"/></svg>'],
    ['nome incomum', '<svg><path fill="rebeccapurple"/></svg>'],
  ])('reprova %s', (_, src) => {
    expect(analisa(src)).toHaveLength(1);
  });

  it.each([
    ['currentColor — que é a correção', '<svg><path fill="currentColor"/></svg>'],
    ['none', '<svg><path fill="none"/></svg>'],
    ['transparent', '<svg><path fill="transparent"/></svg>'],
    ['hex, que é da regra tokens', '<svg><path fill="#1434CB"/></svg>'],
    ['gradiente do próprio SVG', '<svg><path fill="url(#g)"/></svg>'],
    ['rgb()', '<svg><path fill="rgb(1 2 3)"/></svg>'],
  ])('aprova %s', (_, src) => {
    expect(analisa(src)).toEqual([]);
  });

  it('o código carrega a cor em minúsculas, para a exceção ser específica', () => {
    expect(analisa('<svg><path fill="Black"/></svg>')[0].code).toBe('nomeada:black');
  });
});
