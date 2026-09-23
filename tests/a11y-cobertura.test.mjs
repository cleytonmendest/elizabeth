/**
 * Todo template de cliente está varrido ou nomeado — nenhum apenas esquecido.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * A área de cliente é requisito da Theme Store, e nenhum dos sete templates de
 * `templates/customers/` era aberto por navegador — nem para a11y, nem para
 * regressão visual (issue #101). A única cobertura era `address-country`, em
 * jsdom, que não calcula contraste nem move foco.
 *
 * Acrescentar páginas à varredura resolve metade. A outra metade é o defeito da
 * #74: quando uma página não entra, "não coberta" e "esquecida" ficam
 * indistinguíveis — e um template novo nasce fora da varredura sem ninguém ver.
 *
 * Este teste lê o DIRETÓRIO. Template novo em `templates/customers/` reprova
 * até alguém decidir: entra na varredura, ou entra na lista com o motivo
 * escrito. Nunca fica em silêncio.
 *
 * ── O que ele não é ────────────────────────────────────────────────────────
 *
 * Não é um teste de acessibilidade. Ele não abre navegador nem mede nada da
 * página — isso é `e2e/a11y.spec.mjs`, contra a loja. Aqui só se verifica que
 * a CONTABILIDADE fecha.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CLIENTE_NA_VARREDURA, CLIENTE_FORA_DA_VARREDURA } from '../e2e/helpers/loja.mjs';

const DIR = 'templates/customers';
const SPEC = 'e2e/a11y.spec.mjs';

/** Os templates que existem no disco, sem extensão. */
const templates = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.liquid'))
  .map((f) => path.basename(f, '.liquid'))
  .sort();

/**
 * Os NOMES que o spec mede, e não as URLs que ele visita.
 *
 * A diferença custou um defeito plantado sobrevivente: procurar
 * `/account/login` no arquivo dava verde mesmo com o login fora da varredura,
 * porque o teste de recuperação de senha navega para a mesma URL sem medir a
 * página de login. Navegar não é aferir.
 *
 * Lido do FONTE, e não importado: `e2e/a11y.spec.mjs` chama `test.skip()` no
 * topo do módulo, o que estoura fora do Playwright.
 */
const spec = fs.readFileSync(SPEC, 'utf8');
const medidos = [
  // os nomes das tuplas de PAGINAS
  ...[...spec.matchAll(/^\s*\[\s*'([^']+)',\s*'\//gm)].map((m) => m[1]),
  // e os testes avulsos, que chamam o aferidor direto
  ...[...spec.matchAll(/semViolacaoNova\(page, '([^']+)'\)/g)].map((m) => m[1]),
];
const varridos = Object.keys(CLIENTE_NA_VARREDURA).filter((t) =>
  medidos.includes(CLIENTE_NA_VARREDURA[t])
);

describe('a contabilidade dos templates de cliente fecha', () => {
  it('existe pelo menos um template — senão este teste mede o vazio', () => {
    // Sem isto, renomear o diretório deixaria tudo verde com zero cobertura.
    expect(templates.length).toBeGreaterThan(0);
  });

  it.each(templates)('%s está varrido ou nomeado com motivo', (template) => {
    const naVarredura = varridos.includes(template);
    const motivo = CLIENTE_FORA_DA_VARREDURA[template];

    expect(
      naVarredura || Boolean(motivo),
      `templates/customers/${template}.liquid não é aberto por navegador e não está em ` +
        'CLIENTE_FORA_DA_VARREDURA. Decida: entra na varredura de e2e/a11y.spec.mjs, ' +
        'ou entra na lista com o motivo escrito.',
    ).toBe(true);
  });

  it('nenhum template está nos dois lugares ao mesmo tempo', () => {
    // Uma página varrida E listada como fora seria contradição: a lista diria
    // "não medimos isto" sobre algo que o CI mede toda execução.
    const nos_dois = templates.filter(
      (t) => varridos.includes(t) && CLIENTE_FORA_DA_VARREDURA[t],
    );
    expect(nos_dois).toEqual([]);
  });

  it('a lista não nomeia template que não existe mais', () => {
    // O outro lado da catraca: apagar um template deixaria a justificativa
    // órfã, e a próxima pessoa leria um motivo sobre um arquivo inexistente.
    const orfaos = Object.keys(CLIENTE_FORA_DA_VARREDURA).filter((t) => !templates.includes(t));
    expect(orfaos).toEqual([]);
  });

  it('todo motivo é uma frase, não um marcador vazio', () => {
    // "TODO" ou "" passaria nos testes acima e não informaria nada.
    for (const [template, motivo] of Object.entries(CLIENTE_FORA_DA_VARREDURA)) {
      expect(motivo.length, `o motivo de ${template} é curto demais para explicar algo`)
        .toBeGreaterThan(20);
    }
  });
});

describe('as páginas públicas de cliente entraram mesmo', () => {
  it.each(Object.entries(CLIENTE_NA_VARREDURA))(
    '%s é medido no spec como "%s"',
    (template, nome) => {
      // A #64 provou que o hCaptcha barra o ENVIO do formulário, não o acesso
      // à página. Estas duas entram sem depender de sessão.
      expect(medidos, `nenhum teste de e2e/a11y.spec.mjs afere "${nome}"`).toContain(nome);
    },
  );

  it('a recuperação de senha é medida com o painel ABERTO', () => {
    // Ela não é o `reset_password.liquid` — é um painel `hidden` dentro do
    // login, revelado por clique. Medir o login sem clicar mediria o painel
    // invisível, e o axe ignora o que está oculto.
    expect(spec).toContain("page.locator('#recover-password-link').click()");
    expect(spec).toContain('recuperação de senha');
  });
});
