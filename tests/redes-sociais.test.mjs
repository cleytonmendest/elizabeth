/**
 * Toda rede declarada no admin aparece, e todo ícone tem dono.
 *
 * ── O defeito que este arquivo trava ───────────────────────────────────────
 *
 * `config/settings_schema.json` declarava NOVE links de rede social. Quatro
 * deles — TikTok, Snapchat, Tumblr e Vimeo — não eram lidos por arquivo nenhum
 * do tema. A lojista preenchia o campo do TikTok no admin, salvava, e nada
 * acontecia: sem erro, sem aviso, sem ícone (issue #5).
 *
 * A causa foi a repetição: três blocos `{% if %}` quase idênticos no rodapé,
 * um por rede. Acrescentar um setting era uma edição, acrescentar o markup era
 * outra, e as duas podiam sair de sincronia sem ninguém ver — foi o que
 * aconteceu quatro vezes.
 *
 * O que se verifica aqui é a CONTABILIDADE entre três lugares que precisam
 * concordar:
 *
 *     config/settings_schema.json   o campo que a lojista preenche
 *     sections/footer.liquid        o `render` que lê o campo
 *     snippets/icon-social.liquid   o `when` que desenha o ícone
 *
 * ── O que ele não é ────────────────────────────────────────────────────────
 *
 * Não é teste de aparência. Se o ícone está bonito, se o SVG está certo, se o
 * rodapé cabe no celular — nada disso está aqui.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { readJSONC } from '../scripts/lint/lib.mjs';

const footer = fs.readFileSync('sections/footer.liquid', 'utf8');
const despacho = fs.readFileSync('snippets/icon-social.liquid', 'utf8');

/** Os handles que o rodapé renderiza, com o setting que cada um lê. */
const noRodape = [...footer.matchAll(/render 'social-link', url: settings\.(\w+), rede: '(\w+)'/g)]
  .map(([, setting, rede]) => ({ setting, rede }));

/** Os handles que o despacho de ícone conhece. */
const noDespacho = [...despacho.matchAll(/when '(\w+)'/g)].map((m) => m[1]);

/** Os settings de rede social declarados no admin. */
const grupoSocial = readJSONC('config/settings_schema.json').find(
  (g) => g.name === 't:settings_schema.social.name'
);
const declarados = grupoSocial.settings.filter((s) => s.id?.startsWith('social_')).map((s) => s.id);

/**
 * Os dois que alimentam metadados em vez de virar ícone. Não é defeito — é
 * decisão, e por isso o rótulo deles no admin precisa dizer isso (critério de
 * aceite da #5).
 */
const SO_METADADOS = {
  social_twitter_link: 'snippets/meta-tags.liquid',
  social_pinterest_link: 'snippets/schema-organization.liquid',
};

describe('as três listas concordam', () => {
  it('há redes para medir — senão este teste mede o vazio', () => {
    expect(noRodape.length).toBeGreaterThan(0);
    expect(noDespacho.length).toBeGreaterThan(0);
    expect(declarados.length).toBeGreaterThan(0);
  });

  it.each(noRodape)('$rede: o rodapé renderiza e o despacho conhece', ({ rede }) => {
    expect(noDespacho, `snippets/icon-social.liquid não tem "when '${rede}'"`).toContain(rede);
  });

  it.each(noRodape)('$rede: o ícone existe em disco', ({ rede }) => {
    // O `render` do Liquid falha em silêncio: ícone ausente renderiza VAZIO, e
    // a lojista vê um link invisível. A regra `refs` já cobre isso, e aqui a
    // afirmação fica junto das outras duas listas.
    expect(fs.existsSync(`snippets/icon-social-${rede}.liquid`)).toBe(true);
  });

  it('nenhum ícone no despacho fica sem quem o renderize', () => {
    // A direção contrária. Sem ela, remover uma rede do rodapé deixaria o
    // `when` órfão — código morto que parece vivo.
    const renderizados = noRodape.map((r) => r.rede);
    expect(noDespacho.filter((r) => !renderizados.includes(r))).toEqual([]);
  });
});

describe('nenhum setting que a lojista preenche fica mudo', () => {
  it.each(declarados)('%s é lido em algum lugar', (setting) => {
    // O defeito original da #5, exatamente como ele era: quatro campos no
    // admin sem nada que lesse o valor.
    const noFooter = noRodape.some((r) => r.setting === setting);
    const emMetadados = Boolean(SO_METADADOS[setting]);

    expect(
      noFooter || emMetadados,
      `${setting} está declarado no admin e ninguém o lê. Ou renderize, ou remova do schema.`,
    ).toBe(true);
  });

  it('os que só alimentam metadados dizem isso no rótulo', () => {
    // Quem preenche o Pinterest espera um ícone no rodapé. O campo não mente
    // se o `info` avisa — e é critério de aceite da #5.
    for (const id of Object.keys(SO_METADADOS)) {
      const setting = grupoSocial.settings.find((s) => s.id === id);
      expect(setting?.info, `${id} não explica que não vira ícone`).toBeTruthy();
    }
  });

  it.each(Object.entries(SO_METADADOS))('%s é mesmo lido em %s', (setting, arquivo) => {
    // Sem isto, a lista acima viraria uma licença: bastaria acrescentar um
    // setting nela para ele parar de ser cobrado, sem nada lendo o valor.
    expect(fs.readFileSync(arquivo, 'utf8')).toContain(setting);
  });
});

describe('os ícones sociais seguem a cor do color scheme', () => {
  it.each(noRodape)('$rede não crava a própria cor', ({ rede }) => {
    // Eram `fill="black"`. No preset Noir (fundo #14110F) o ícone sumia — o
    // mesmo defeito da sombra da barra fixa, e o linter não pega porque a
    // regra `hex` procura `#rrggbb`, não cor nomeada.
    //
    // Os ícones de PAGAMENTO são o caso oposto e mantêm a cor de marca: ali a
    // cor identifica a bandeira. Ver a issue aberta sobre eles.
    const svg = fs.readFileSync(`snippets/icon-social-${rede}.liquid`, 'utf8');
    const cores = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

    expect(cores).toContain('currentColor');
    for (const cor of cores) {
      expect(['currentColor', 'none'], `fill="${cor}" crava a cor em ${rede}`).toContain(cor);
    }
  });
});
