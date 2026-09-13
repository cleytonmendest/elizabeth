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
import {
  abrePaginaDoTema,
  clicaNoTema,
  falhaDeSessao,
  reprovacao,
  MARCA_DO_TEMA,
  MARCA_DO_DOCUMENTO,
} from '../e2e/helpers/loja.mjs';
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
   * Um navegador de mentira — pequeno, e do tamanho exato da pergunta.
   *
   * O `page` dos outros describes devolve resposta enlatada: `evaluate` ignora
   * a função que recebe e responde um objeto combinado antes. Isso bastava
   * enquanto o que a guarda media era a URL, e deixou de bastar na #76: a
   * pergunta agora é "chegou DOCUMENTO novo?", e um falso que não tem
   * documento nenhum responderia o que o teste mandasse — verde afirmando o
   * que não mediu, dentro do arquivo que existe para impedir isso.
   *
   * Então este falso tem as duas coisas separadas, como o navegador as tem:
   *
   *   · um `window` por DOCUMENTO — navegar troca o objeto, e o que estava
   *     nele (o carimbo da guarda, inclusive) morre junto;
   *   · uma URL, que `pushState` muda sem trocar documento nenhum.
   *
   * É isso que permite construir aqui os dois casos que a #76 descreve, e que
   * a URL sozinha não distingue: documento novo com a MESMA URL, e URL nova
   * com o MESMO documento.
   *
   * O que ele NÃO prova é que o Chromium se comporta assim — um falso concorda
   * com quem o escreveu. Quem prova isso é `e2e/guarda-do-clique.spec.mjs`,
   * contra um servidor HTTP de verdade, servindo essas duas rotas. Os dois
   * medem a mesma função de propósito: este roda em todo commit, aquele só
   * onde há navegador.
   */

  /** O `window` e o `document` de UM documento, montados do descritor. */
  function documentoDe({ ehNosso, temaId, barraDePreview }) {
    const window = {};
    if (ehNosso) window[MARCA_DO_TEMA] = 'https://loja.myshopify.com';
    // Página que não é nossa não tem `Shopify` nenhum — é o `?? null` do
    // `olha` que transforma a ausência em id nulo, e o teste tem que exercitar
    // a ausência, não uma versão dela com o campo preenchido de `null`.
    if (temaId !== null) window.Shopify = { theme: { id: temaId } };
    return {
      window,
      document: {
        querySelector: (sel) =>
          barraDePreview && sel === '#preview-bar-iframe' ? { tagName: 'IFRAME' } : null,
      },
    };
  }

  /**
   * Roda a função NO documento, como o Playwright roda: serializada.
   *
   * `new Function` a reconstrói a partir do texto, então ela perde o closure —
   * exatamente o que acontece ao atravessar para o navegador. Um falso que
   * simplesmente chamasse `fn(arg)` aceitaria uma callback usando variável de
   * fora, que em produção chegaria como `ReferenceError` na primeira execução.
   */
  const executa = (fn, arg, doc) =>
    new Function('window', 'document', 'arg', `return (${fn})(arg);`)(
      doc.window,
      doc.document,
      arg
    );

  /** O que o Playwright levanta quando a espera estoura — `name` inclusive. */
  const timeout = () =>
    Object.assign(new Error('Timeout 15000ms exceeded.'), { name: 'TimeoutError' });

  const INICIAL = 'https://loja.myshopify.com/collections/all';

  function navegadorFalso(descritorInicial, { url = INICIAL } = {}) {
    return {
      doc: documentoDe(descritorInicial),
      urlAtual: url,
      cliques: 0,
      esperas: 0,
      registro: [],

      /** O efeito que o clique agendou, e que só acontece quando se ESPERA. */
      pendente: null,

      url() {
        return this.urlAtual;
      },

      async evaluate(fn, arg) {
        this.registro.push('avaliou');
        return executa(fn, arg, this.doc);
      },

      /**
       * A espera de verdade — e ela responde ANTES de o efeito acontecer.
       *
       * Um falso que aplicasse o efeito primeiro esconderia o modo mais sutil
       * de a guarda não guardar nada: predicado que já é verdadeiro no
       * documento ANTERIOR (é o que sobra quando alguém tira o carimbo)
       * devolve na hora, e a guarda prova a página que já estava aberta.
       */
      async waitForFunction(fn, arg) {
        this.esperas += 1;
        this.registro.push('esperou');
        if (executa(fn, arg, this.doc)) return;
        this.pendente?.();
        if (executa(fn, arg, this.doc)) return;
        throw timeout();
      },

      /**
       * A espera que a guarda NÃO usa mais.
       *
       * Ela fica porque é assim que o mutante "o sinal volta a ser a URL" tem
       * o que rodar: sem este método ele morreria de `TypeError`, e um mutante
       * que morre por não existir método não prova que o teste olha para o
       * sinal — prova só que o falso é incompleto.
       */
      async waitForURL(predicado) {
        this.esperas += 1;
        this.registro.push('esperou');
        if (predicado(new URL(this.urlAtual))) return;
        this.pendente?.();
        if (predicado(new URL(this.urlAtual))) return;
        throw timeout();
      },

      async getAttribute() {
        return 'pt-BR';
      },
      async title() {
        return 'Elizabeth Estudos';
      },
    };
  }

  /** Clique que TRAZ DOCUMENTO: `window` novo, com a URL que se pedir. */
  const linkQueTraz = (nav, descritor, { para = '/produtos/vestido-midi' } = {}) => ({
    async click() {
      nav.cliques += 1;
      nav.registro.push('clicou');
      nav.pendente = () => {
        nav.doc = documentoDe(descritor);
        nav.urlAtual = new URL(para, INICIAL).href;
      };
    },
  });

  /** Clique que só mexe no histórico: URL nova, MESMO documento. */
  const botaoDePushState = (nav, para) => ({
    async click() {
      nav.cliques += 1;
      nav.registro.push('clicou');
      nav.pendente = () => {
        nav.urlAtual = new URL(para, INICIAL).href;
      };
    },
  });

  /** Clique que não faz nada: nem documento, nem URL. */
  const botaoInerte = (nav) => ({
    async click() {
      nav.cliques += 1;
      nav.registro.push('clicou');
      nav.pendente = null;
    },
  });

  it('clique que continua na nossa branch: segue', async () => {
    const nav = navegadorFalso(nossoTema);
    await expect(
      clicaNoTema(nav, linkQueTraz(nav, nossoTema), 'o primeiro produto')
    ).resolves.toBeUndefined();
    expect(nav.cliques).toBe(1);
    expect(nav.esperas).toBe(1);
  });

  // O carimbo depois do clique seria tarde: navegação que termina dentro do
  // próprio `click()` receberia o carimbo no documento NOVO, e a espera não
  // acabaria nunca — sobre a página certa, que é o jeito mais caro de falhar.
  it('o carimbo é deixado ANTES do clique', async () => {
    const nav = navegadorFalso(nossoTema);
    await clicaNoTema(nav, linkQueTraz(nav, nossoTema), 'o primeiro produto');
    expect(nav.registro.slice(0, 3)).toEqual(['avaliou', 'clicou', 'esperou']);
  });

  // O defeito da #73 na forma exata em que ele aconteceria: a coleção é nossa,
  // a fixação cai, e a PDP — onde as asserções moram — vem da vitrine
  // publicada respondendo 200.
  it('clique que cai no tema PUBLICADO reprova, e o erro nomeia os dois ids', async () => {
    const nav = navegadorFalso(nossoTema);
    const erro = await clicaNoTema(nav, linkQueTraz(nav, temaPublicado), 'o primeiro produto').catch(
      (e) => e
    );

    expect(erro.message).toMatch(/tema ERRADO/);
    expect(erro.message).toContain(PUBLICADO);
    expect(erro.message).toContain(NOSSO);
    // E diz por onde se chegou lá: "A página /cart" não serviria aqui.
    expect(erro.message).toContain('clique em o primeiro produto');
  });

  it('clique que sai do tema reprova com a OUTRA mensagem', async () => {
    const nav = navegadorFalso(nossoTema);
    const erro = await clicaNoTema(nav, linkQueTraz(nav, outroLugar), 'o primeiro filtro').catch(
      (e) => e
    );

    expect(erro.message).toContain('window.shopUrl');
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });

  it('a barra de preview no destino do clique também reprova', async () => {
    const nav = navegadorFalso(nossoTema);
    const erro = await clicaNoTema(nav, linkQueTraz(nav, comBarra), 'o primeiro produto').catch(
      (e) => e
    );

    expect(erro.message).toContain('#preview-bar-iframe');
  });

  // ── Os dois casos em que URL e documento se separam (#76) ────────────────

  describe('documento novo com a MESMA URL', () => {
    // Form GET reenviado com os mesmos parâmetros, POST que redireciona de
    // volta, filtro clicado quando já estava na query. Medindo a URL, a espera
    // estourava em 15s sobre uma página que existia para ser provada: o call
    // site parecia guardado e não guardava nada.
    const MESMA = '/collections/all';

    it('passa, em vez de estourar a espera', async () => {
      const nav = navegadorFalso(nossoTema);
      await expect(
        clicaNoTema(nav, linkQueTraz(nav, nossoTema, { para: MESMA }), 'o filtro já aplicado')
      ).resolves.toBeUndefined();
      expect(nav.url()).toBe(INICIAL);
    });

    // A metade que importa: passar é fácil, passar tendo PROVADO o documento
    // que chegou é o contrato. Aqui as duas páginas têm a mesma URL e temas
    // diferentes — quem responder pela página anterior fica verde e mente.
    it('e o tema provado é o do documento NOVO, não o do anterior', async () => {
      const nav = navegadorFalso(nossoTema);
      const erro = await clicaNoTema(
        nav,
        linkQueTraz(nav, temaPublicado, { para: MESMA }),
        'o filtro já aplicado'
      ).catch((e) => e);

      expect(erro.message).toMatch(/tema ERRADO/);
      expect(erro.message).toContain(PUBLICADO);
    });
  });

  describe('URL nova com o MESMO documento (`pushState`)', () => {
    // O lado silencioso: a guarda APROVAVA, provando de novo o documento que a
    // entrada já tinha provado. Nada quebrava — e era assim que um quarto
    // clique não-navegante seria embrulhado por engano, e a guarda deixaria de
    // guardar sem ninguém notar.
    it('reprova dizendo que não houve documento novo', async () => {
      const nav = navegadorFalso(nossoTema);
      const erro = await clicaNoTema(
        nav,
        botaoDePushState(nav, '/collections/all?cor=preto'),
        'o filtro de cor'
      ).catch((e) => e);

      expect(erro.message).toContain('não trouxe DOCUMENTO NOVO');
      expect(erro.message).toContain('chame-o CRU');
      // E não a mensagem de tema errado: o documento é o mesmo de antes, e o
      // tema dele já estava provado — o que falta é documento, não tema.
      expect(erro.message).not.toMatch(/tema ERRADO/);
    });

    it('e o erro DIZ que a URL mudou, para não mandar procurar no lugar errado', async () => {
      const nav = navegadorFalso(nossoTema);
      const erro = await clicaNoTema(
        nav,
        botaoDePushState(nav, '/collections/all?cor=preto'),
        'o filtro de cor'
      ).catch((e) => e);

      expect(erro.message).toContain('A URL até MUDOU');
      expect(erro.message).toContain('cor=preto');
      expect(erro.message).toContain('pushState');
    });
  });

  // Sem timeout próprio na espera, este caso morria no timeout do TESTE, com
  // "Test timeout of 30000ms exceeded" — verdadeiro e inútil. Medido num
  // navegador antes de virar código.
  it('clique que não faz nada reprova DIZENDO isso, em vez de morrer no timeout do teste', async () => {
    const nav = navegadorFalso(nossoTema);
    const erro = await clicaNoTema(nav, botaoInerte(nav), 'um botão que não navega').catch((e) => e);

    expect(erro.message).toContain('não trouxe DOCUMENTO NOVO');
    expect(erro.message).toContain('chame-o CRU');
    expect(erro.message).toContain('A página continua em');
    expect(erro.message).not.toMatch(/tema ERRADO/);
  });

  // O nome do carimbo aparece no erro porque é o que a pessoa vai procurar no
  // console do navegador. Enquanto a verificação e a mensagem fossem dois
  // literais, um poderia mudar e o outro continuar descrevendo a versão velha.
  it('o erro nomeia o carimbo que a guarda deixou', async () => {
    const nav = navegadorFalso(nossoTema);
    const erro = await clicaNoTema(nav, botaoInerte(nav), 'um botão que não navega').catch((e) => e);

    expect(erro.message).toContain(MARCA_DO_DOCUMENTO);
    // E o carimbo está mesmo lá, no documento que não foi substituído.
    expect(MARCA_DO_DOCUMENTO in nav.doc.window).toBe(true);
  });

  // O `catch` era sem filtro, e qualquer erro da espera saía como "não veio
  // documento novo" — falso, e justamente neste arquivo. Achado na revisão do
  // PR #75.
  it('erro que NÃO é timeout sobe como é, em vez de virar "não trouxe documento"', async () => {
    const nav = navegadorFalso(nossoTema);
    nav.waitForFunction = async () => {
      throw new Error('Target page, context or browser has been closed');
    };

    const erro = await clicaNoTema(nav, linkQueTraz(nav, nossoTema), 'o primeiro produto').catch(
      (e) => e
    );

    expect(erro.message).toContain('has been closed');
    expect(erro.message).not.toContain('DOCUMENTO NOVO');
  });
});
