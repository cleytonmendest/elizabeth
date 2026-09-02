/**
 * Onde a suíte de navegador vai medir?
 *
 * Esta é a pergunta que, respondida errado, produz o pior resultado possível
 * neste repositório: uma suíte INTEIRA verde medindo a loja de produção,
 * enquanto o relatório afirma ter medido a branch do PR.
 *
 * O caminho para esse desastre é curto. A `preview_url` que o
 * `shopify theme push --json` devolve carrega `?preview_theme_id=N`; usá-la
 * como `baseURL` do Playwright faz `page.goto('/cart')` descartar a query,
 * porque `baseURL` só contribui com a origem. Nada falha. O tema publicado
 * responde tudo, com 200, e o axe mede a loja de verdade achando que mede a
 * mudança.
 *
 * Por isso a origem e o id viajam separados, e por isso a separação tem teste.
 */
import { describe, it, expect } from 'vitest';
import { origem, idDoTema, decidir } from '../scripts/tema-de-teste.mjs';

const jsonDe = (tema) => JSON.stringify({ theme: tema });
const TEMA = {
  id: 987654321,
  name: 'ci-pr-64',
  role: 'development',
  preview_url: 'https://elizabeth.myshopify.com/?preview_theme_id=987654321',
};

describe('a origem, sem a query', () => {
  it('o defeito que este arquivo existe para impedir: a query não sobrevive', () => {
    expect(origem(TEMA.preview_url)).toBe('https://elizabeth.myshopify.com');
    expect(origem(TEMA.preview_url)).not.toContain('preview_theme_id');
  });

  it('caminho e porta também não passam adiante', () => {
    expect(origem('https://loja.myshopify.com/collections/all?x=1')).toBe('https://loja.myshopify.com');
    expect(origem('http://127.0.0.1:9292/cart')).toBe('http://127.0.0.1:9292');
  });
});

describe('o id do tema a pré-visualizar', () => {
  it('sai da URL, que é o que a Shopify honra', () => {
    expect(idDoTema(TEMA.preview_url)).toBe('987654321');
  });

  it('URL sem o parâmetro devolve vazio, não `null` disfarçado', () => {
    expect(idDoTema('https://loja.myshopify.com/')).toBe('');
  });
});

describe('o veredito', () => {
  it('push bem-sucedido vira as duas variáveis', () => {
    const { ok, medindo, linhas } = decidir({ bruto: jsonDe(TEMA) });

    expect(ok).toBe(true);
    expect(medindo).toBe(true);
    expect(linhas).toEqual([
      'THEME_URL=https://elizabeth.myshopify.com',
      'PREVIEW_THEME_ID=987654321',
    ]);
  });

  /**
   * PR de fork, ou repositório sem os secrets: o push não roda e não deixa
   * JSON. Isso é VERDE — a suíte se declara pulada com o motivo. Confundir
   * "não havia o que fazer" com "deu errado" pinta de vermelho todo PR de
   * fork, e gate que reprova sem motivo é gate que se aprende a ignorar.
   */
  it('sem JSON: verde, sem THEME_URL, com o motivo escrito', () => {
    const { ok, medindo, linhas, recado } = decidir({ bruto: null });

    expect(ok).toBe(true);
    expect(medindo).toBe(false);
    expect(linhas).toEqual([]);
    expect(recado).toMatch(/credencial|fork/i);
  });

  it('JSON quebrado reprova — não passa como "sem credencial"', () => {
    expect(decidir({ bruto: '{isto não é json' }).ok).toBe(false);
  });

  it('tema sem preview_url reprova', () => {
    expect(decidir({ bruto: jsonDe({ ...TEMA, preview_url: '   ' }) }).ok).toBe(false);
  });

  /**
   * O caso mais traiçoeiro: a URL existe e é válida, mas não traz o id, e o
   * JSON também não. Sem id não há como fixar o tema na sessão — e o padrão
   * silencioso seria medir o tema publicado.
   */
  it('sem id em lugar nenhum reprova, em vez de medir o tema publicado', () => {
    const semId = { ...TEMA, id: undefined, preview_url: 'https://loja.myshopify.com/' };
    const { ok, recado } = decidir({ bruto: jsonDe(semId) });

    expect(ok).toBe(false);
    expect(recado).toMatch(/publicado/i);
  });

  it('id só no JSON ainda serve', () => {
    const soNoJson = { ...TEMA, preview_url: 'https://loja.myshopify.com/' };
    expect(decidir({ bruto: jsonDe(soNoJson) }).linhas).toContain('PREVIEW_THEME_ID=987654321');
  });
});
