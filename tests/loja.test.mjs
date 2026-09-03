/**
 * `abrePaginaDoTema` consegue reprovar o tema PUBLICADO?
 *
 * Esta é a única pergunta que separa a suíte de navegador de uma suíte verde
 * medindo a loja de produção, e até a #64 ela não precisava ser feita: o
 * `baseURL` era `127.0.0.1:9292` e não existia produção alcançável. Hoje o
 * `baseURL` É a origem da loja, e o tema publicado é ESTE MESMO TEMA — emite
 * `window.shopUrl` igual. A pergunta fraca passou a ter a mesma resposta nos
 * dois casos que ela precisa separar.
 *
 * O `page` aqui é falso de propósito. O que está sob teste é a DECISÃO — o que
 * a função aceita, o que ela reprova e o que ela diz ao reprovar —, e essa
 * decisão não precisa de navegador para estar certa ou errada. Um navegador de
 * verdade só provaria que a Shopify responde; ele está em `e2e/`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { abrePaginaDoTema } from '../e2e/helpers/loja.mjs';

const NOSSO = '158207180978';
const PUBLICADO = '111111111';

/**
 * Um `page` que responde o que o teste mandar, uma resposta por navegação.
 * A lista permite descrever "caiu na primeira tentativa e voltou na segunda",
 * que é o caso que a função trata com retry.
 */
function pageFalso(respostas) {
  const fila = [...respostas];
  return {
    visitou: [],
    async goto(caminho) {
      this.visitou.push(caminho);
    },
    async evaluate() {
      return fila.length > 1 ? fila.shift() : fila[0];
    },
    async getAttribute() {
      return 'pt-BR';
    },
    async title() {
      return 'Elizabeth Estudos';
    },
    url() {
      return 'https://loja.myshopify.com/collections/all';
    },
  };
}

const nossoTema = { ehNosso: true, temaId: NOSSO };
const temaPublicado = { ehNosso: true, temaId: PUBLICADO };
const outroLugar = { ehNosso: false, temaId: null };

beforeEach(() => {
  process.env.PREVIEW_THEME_ID = NOSSO;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('o que passa', () => {
  it('a nossa branch respondeu: segue', async () => {
    const page = pageFalso([nossoTema]);
    await expect(abrePaginaDoTema(page, '/cart')).resolves.toBeUndefined();
    expect(page.visitou).toEqual(['/cart']);
  });

  it('id numérico contra env string: compara o valor, não o tipo', async () => {
    const page = pageFalso([{ ehNosso: true, temaId: Number(NOSSO) }]);
    await expect(abrePaginaDoTema(page, '/')).resolves.toBeUndefined();
  });

  it('queda transitória na 1ª navegação: tenta de novo e passa', async () => {
    const page = pageFalso([outroLugar, nossoTema]);
    await expect(abrePaginaDoTema(page, '/')).resolves.toBeUndefined();
    expect(page.visitou).toHaveLength(2);
  });
});

describe('o que reprova — e com qual diagnóstico', () => {
  // O defeito que este arquivo existe para impedir. Antes da comparação de id,
  // esta chamada RETORNAVA: o tema publicado emite `shopUrl` como o nosso, e a
  // suíte inteira seguiria verde medindo a vitrine de produção.
  it('o tema PUBLICADO respondendo no lugar do nosso reprova', async () => {
    const page = pageFalso([temaPublicado]);
    await expect(abrePaginaDoTema(page, '/')).rejects.toThrow(/tema ERRADO/);
  });

  it('e o erro nomeia os dois ids, para não mandar procurar no lugar errado', async () => {
    const page = pageFalso([temaPublicado]);
    const erro = await abrePaginaDoTema(page, '/').catch((e) => e);
    expect(erro.message).toContain(PUBLICADO);
    expect(erro.message).toContain(NOSSO);
    expect(erro.message).toMatch(/SESSÃO/);
  });

  it('página que não é do tema reprova com a OUTRA mensagem', async () => {
    const page = pageFalso([outroLugar]);
    const erro = await abrePaginaDoTema(page, '/').catch((e) => e);
    expect(erro.message).toContain('window.shopUrl');
    expect(erro.message).toContain('SHOPIFY_STORE_PASSWORD');
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });

  it('desiste na 2ª tentativa: retry não é loop infinito', async () => {
    const page = pageFalso([temaPublicado, temaPublicado, nossoTema]);
    await expect(abrePaginaDoTema(page, '/')).rejects.toThrow();
    expect(page.visitou).toHaveLength(2);
  });
});
