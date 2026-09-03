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
import fs from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { abrePaginaDoTema, clicaNoTema, falhaDeSessao, reprovacao } from '../e2e/helpers/loja.mjs';
import { ARQUIVO_DE_FALHA } from '../e2e/helpers/sessao.mjs';

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

const nossoTema = { ehNosso: true, temaId: NOSSO, barraDePreview: false };
const temaPublicado = { ehNosso: true, temaId: PUBLICADO, barraDePreview: false };
const outroLugar = { ehNosso: false, temaId: null, barraDePreview: false };
const comBarra = { ehNosso: true, temaId: NOSSO, barraDePreview: true };

beforeEach(() => {
  process.env.PREVIEW_THEME_ID = NOSSO;
  fs.rmSync(ARQUIVO_DE_FALHA, { force: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(ARQUIVO_DE_FALHA, { force: true });
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

describe('a barra de preview da Shopify', () => {
  // `pb=0` é pedido UMA vez, na página fixadora do global-setup. Se ele valesse
  // só para aquela navegação, tudo daqui para a frente traria markup que a
  // vitrine publicada não tem — e o axe mediria outra página exibindo a mesma
  // cara de quando está tudo certo.
  it('barra presente reprova, mesmo sendo o tema certo', async () => {
    const page = pageFalso([comBarra]);
    const erro = await abrePaginaDoTema(page, '/').catch((e) => e);
    expect(erro.message).toContain('#preview-bar-iframe');
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });
});

describe('a sessão que não abriu', () => {
  // O `globalSetup` GRAVA a falha em vez de estourar: estourar lá aborta a
  // execução inteira e leva junto o `gate.spec.mjs`, que não precisa de loja.
  // O preço é este — alguém precisa ler o registro e reprovar por ele.
  it('reprova ANTES de navegar, com o motivo que o setup registrou', async () => {
    fs.mkdirSync('e2e/.auth', { recursive: true });
    fs.writeFileSync(ARQUIVO_DE_FALHA, JSON.stringify({ motivo: 'senha da vitrine recusada' }));

    const page = pageFalso([nossoTema]);
    const erro = await abrePaginaDoTema(page, '/').catch((e) => e);

    expect(erro.message).toContain('senha da vitrine recusada');
    expect(page.visitou).toEqual([]);
  });

  it('sem registro, não inventa falha', () => {
    expect(falhaDeSessao()).toBeNull();
  });

  it('registro corrompido não vira falha fantasma', () => {
    fs.mkdirSync('e2e/.auth', { recursive: true });
    fs.writeFileSync(ARQUIVO_DE_FALHA, 'isto não é json');
    expect(falhaDeSessao()).toBeNull();
  });
});

describe('a decisão, sem navegação nenhuma', () => {
  // Ela era alcançável só por quem navegasse por URL — e foi por isso que a
  // navegação por CLIQUE ficou fora da guarda por uma versão inteira (#73).
  // Estes dois testes existem para que o critério tenha um lugar onde ser lido
  // sem `page` nenhum, falso ou verdadeiro.
  const alvo = 'A página /cart';

  it('a nossa branch aprova', () => {
    expect(reprovacao({ visto: nossoTema, esperado: NOSSO, alvo })).toBeNull();
  });

  it('o tema publicado reprova, e o motivo curto do log diz qual respondeu', () => {
    const falhou = reprovacao({ visto: temaPublicado, esperado: NOSSO, alvo });
    expect(falhou.curto).toContain(PUBLICADO);
    expect(falhou.mensagem).toMatch(/tema ERRADO/);
  });
});

describe('a navegação por CLIQUE', () => {
  /**
   * Um `page` que só troca de documento quando a espera de navegação acontece.
   *
   * É essa troca que dá sentido ao teste: se a guarda perguntar ANTES de
   * esperar, ela pergunta à página que já estava aberta — a que passou na
   * guarda um instante atrás — e responde "está tudo certo" sobre um documento
   * que o teste nem vai medir. Com este falso, esquecer a espera fica vermelho.
   */
  function pageComClique({ antesDoClique, depoisDoClique }) {
    let atual = antesDoClique;
    return {
      cliques: 0,
      esperas: 0,
      url() {
        return 'https://loja.myshopify.com/collections/all';
      },
      async waitForURL() {
        this.esperas += 1;
        atual = depoisDoClique;
      },
      async evaluate() {
        return atual;
      },
      async getAttribute() {
        return 'pt-BR';
      },
      async title() {
        return 'Elizabeth Estudos';
      },
    };
  }

  const linkPara = (page) => ({
    async click() {
      page.cliques += 1;
    },
  });

  it('clique que continua na nossa branch: segue', async () => {
    const page = pageComClique({ antesDoClique: nossoTema, depoisDoClique: nossoTema });
    await expect(clicaNoTema(page, linkPara(page), 'o primeiro produto')).resolves.toBeUndefined();
    expect(page.cliques).toBe(1);
    expect(page.esperas).toBe(1);
  });

  // O defeito da #73 na forma exata em que ele aconteceria: a coleção é nossa,
  // a fixação cai, e a PDP — onde as asserções moram — vem da vitrine
  // publicada respondendo 200.
  it('clique que cai no tema PUBLICADO reprova, e o erro nomeia os dois ids', async () => {
    const page = pageComClique({ antesDoClique: nossoTema, depoisDoClique: temaPublicado });
    const erro = await clicaNoTema(page, linkPara(page), 'o primeiro produto').catch((e) => e);

    expect(erro.message).toMatch(/tema ERRADO/);
    expect(erro.message).toContain(PUBLICADO);
    expect(erro.message).toContain(NOSSO);
    // E diz por onde se chegou lá: "A página /cart" não serviria aqui.
    expect(erro.message).toContain('clique em o primeiro produto');
  });

  it('clique que sai do tema reprova com a OUTRA mensagem', async () => {
    const page = pageComClique({ antesDoClique: nossoTema, depoisDoClique: outroLugar });
    const erro = await clicaNoTema(page, linkPara(page), 'o primeiro filtro').catch((e) => e);

    expect(erro.message).toContain('window.shopUrl');
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });

  // Sem timeout próprio na espera, este caso morria no timeout do TESTE, com
  // "Test timeout of 30000ms exceeded" — verdadeiro e inútil. Medido num
  // navegador antes de virar código.
  it('clique que não navega reprova DIZENDO isso, em vez de morrer no timeout do teste', async () => {
    const page = pageComClique({ antesDoClique: nossoTema, depoisDoClique: nossoTema });
    page.waitForURL = async () => {
      throw new Error('Timeout 15000ms exceeded.');
    };

    const erro = await clicaNoTema(page, linkPara(page), 'um botão que não navega').catch((e) => e);

    expect(erro.message).toContain('não trocou de URL');
    expect(erro.message).toContain('deve ser chamado cru');
    // E não a mensagem de tema errado: o clique não chegou a produzir página
    // nenhuma para ter tema.
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });

  it('a barra de preview no destino do clique também reprova', async () => {
    const page = pageComClique({ antesDoClique: nossoTema, depoisDoClique: comBarra });
    const erro = await clicaNoTema(page, linkPara(page), 'o primeiro produto').catch((e) => e);

    expect(erro.message).toContain('#preview-bar-iframe');
  });
});
