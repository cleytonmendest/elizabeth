/**
 * A documentação do lojista não pode mentir.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * A issue #38 diz que a doc do lojista "não entra no fluxo de linters", e isso
 * está certo: prosa não passa por regra de token. Mas a doc faz AFIRMAÇÕES
 * sobre o tema — quantas seções existem, como cada uma se chama no editor,
 * quantas cores tem um esquema — e afirmação é exatamente o que apodrece
 * quando ninguém mede. É o defeito que matou o `docs/ROADMAP.md`
 * (ver ADR 0001), e escrever 12 páginas de prosa sem verificador seria
 * recriá-lo com outro nome.
 *
 * As três primeiras versões desta doc traziam três mentiras, todas achadas
 * MEDINDO, nenhuma por releitura:
 *
 *   1. "12 seções que já vêm na página" — são 12 sem preset, mas duas delas
 *      (Blog Principal, Artigo do Blog) TÊM preset e aparecem em "Adicionar
 *      seção". O par de números estava certo e a lista, errada.
 *   2. "compra rápida só aparece em produtos de variante única" — falso.
 *      `snippets/card-quick-add.liquid` mostra o botão sempre; o que muda é o
 *      destino (ajax numa variante, link para a PDP em várias).
 *   3. Metade dos títulos da versão em inglês não batia com o nome que a
 *      seção tem no editor ("Featured product" para `Highlighted Product`).
 *      A lojista procuraria por um nome que não existe na lista.
 *
 * O que este arquivo NÃO tenta fazer: julgar se a explicação é boa. Ele mede
 * só o que tem resposta no código — nome, contagem, link, simetria entre os
 * dois idiomas. O resto é revisão humana, e continua sendo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, list, read, readJSONC, extractSchema, flatten } from '../scripts/lint/lib.mjs';

const DOCS = path.join(ROOT, 'docs');

/** As duas traduções da doc, e o locale de schema de cada uma. */
const IDIOMAS = [
  { pasta: 'lojista', locale: 'locales/pt-BR.schema.json', capitulos: 'sections.md' },
  { pasta: 'merchant', locale: 'locales/en.default.schema.json', capitulos: 'sections.md' },
];

/** O nome que cada section tem no editor, resolvido pelo locale de schema. */
function secoes(localePath) {
  const dicionario = flatten(readJSONC(localePath));
  return list('sections')
    .map((arquivo) => {
      const schema = extractSchema(read(arquivo))?.json;
      if (!schema) return null;
      const bruto = schema.name || '';
      const nome = bruto.startsWith('t:') ? dicionario[bruto.slice(2)] : bruto;
      return { arquivo, nome, adicionavel: Boolean(schema.presets) };
    })
    .filter(Boolean);
}

const doc = (relativo) => fs.readFileSync(path.join(DOCS, relativo), 'utf8');

/** O texto de uma seção `## <titulo>`, até a próxima do mesmo nível. */
const trecho = (texto, titulo) => {
  const inicio = texto.indexOf(`## ${titulo}`);
  if (inicio === -1) return '';
  const resto = texto.slice(inicio + 3);
  const fim = resto.indexOf('\n## ');
  return fim === -1 ? resto : resto.slice(0, fim);
};

const paginas = (pasta) =>
  fs
    .readdirSync(path.join(DOCS, pasta))
    .filter((f) => f.endsWith('.md'))
    .sort();

/**
 * O id que o Jekyll (kramdown, `auto_ids`) dá a um heading.
 * Precisa bater com o gerador de verdade, senão o teste de âncora vira teatro.
 */
function ancora(titulo) {
  return titulo
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

describe.each(IDIOMAS)('a doc de $pasta nomeia as seções como o editor', ({ pasta, locale, capitulos }) => {
  const texto = doc(`${pasta}/${capitulos}`);
  const todas = secoes(locale);

  it.each(todas)('$arquivo aparece pelo nome do editor', ({ nome }) => {
    // O critério da #38 é explícito: "com o nome que aparece no editor".
    // Descrever a seção com outro nome é pior que não descrever — manda a
    // lojista procurar na lista uma entrada que não existe.
    expect(nome, 'o locale não resolve o nome desta section').toBeTruthy();
    expect(texto).toContain(nome);
  });

  it('não inventa seção que não existe', () => {
    // Direção contrária da anterior. Sem ela, apagar uma section do tema
    // deixaria o capítulo dela na doc, verde, para sempre.
    const conhecidas = new Set(todas.map((s) => s.nome));
    const titulos = [...texto.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim());
    const naTabela = [...texto.matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((m) => m[1].trim());
    for (const nome of [...titulos, ...naTabela]) {
      expect(conhecidas, `"${nome}" não é o nome de nenhuma section`).toContain(nome);
    }
  });

  it('a contagem que o texto afirma é a contagem que existe', () => {
    const adicionaveis = todas.filter((s) => s.adicionavel).length;
    const dePagina = todas.filter(
      (s) => !s.adicionavel && !/sections\/(header|footer)\.liquid/.test(s.arquivo),
    ).length;
    // A linha é achada pelo CONTEÚDO, não pelo índice. A primeira versão lia
    // `split('\n')[6]`, e acrescentar uma chave ao front matter deslocou o
    // arquivo inteiro: o teste ficou vermelho sem nada da doc ter mudado.
    // Teste preso a número de linha mede o arquivo, não a afirmação.
    const linha = texto.split('\n').find((l) => /\*\*\d+ (?:seções|sections)/.test(l));
    expect(linha, 'nenhuma linha afirma uma contagem de seções').toBeTruthy();

    const numeros = [...linha.matchAll(/\*\*(\d+)[^*]*\*\*/g)].map((m) => Number(m[1]));
    expect(numeros, 'a linha de abertura deveria afirmar duas contagens').toEqual([
      adicionaveis,
      dePagina,
    ]);
  });
});

describe('a doc não manda o lojista mexer em código', () => {
  // Critério de aceite da #38, e requisito da Theme Store. Um caminho de
  // arquivo do repositório numa página de lojista é o sintoma: significa que
  // a instrução só funciona para quem abre o tema no editor de código.
  const PROIBIDO = /\.liquid|npm run|\bsnippets\/|\bsections\/|\bassets\/|\{%/;

  it.each(IDIOMAS)('$pasta', ({ pasta }) => {
    for (const pagina of paginas(pasta)) {
      // `{{ amount }}` é a única chave dupla permitida: é o placeholder que a
      // lojista DIGITA no campo da mensagem de frete grátis, não código.
      const texto = doc(`${pasta}/${pagina}`).replaceAll('{{ amount }}', '');
      expect(texto, `${pasta}/${pagina}`).not.toMatch(PROIBIDO);
      expect(texto, `${pasta}/${pagina}`).not.toMatch(/\{\{/);
    }
  });
});

describe('os dois idiomas são a mesma doc', () => {
  it('têm o mesmo número de páginas', () => {
    expect(paginas('merchant').length).toBe(paginas('lojista').length);
  });

  it('os capítulos são numerados igual', () => {
    const numeros = (pasta) =>
      paginas(pasta)
        .map((p) => doc(`${pasta}/${p}`).match(/^title: (\d+)\./m)?.[1])
        .filter(Boolean)
        .sort();
    expect(numeros('merchant')).toEqual(numeros('lojista'));
    expect(numeros('lojista')).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('os links internos da doc resolvem', () => {
  const md = [];
  const varre = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const alvo = path.join(dir, entry.name);
      if (entry.isDirectory()) varre(alvo);
      else if (entry.name.endsWith('.md')) md.push(alvo);
    }
  };
  varre(DOCS);

  /** Os ids de heading de um arquivo, como o Jekyll os geraria. */
  const ancoras = (arquivo) =>
    new Set(
      [...fs.readFileSync(arquivo, 'utf8').matchAll(/^#{1,6}\s+(.*)$/gm)].map((m) => ancora(m[1])),
    );

  it.each(md.map((f) => path.relative(ROOT, f)))('%s', (relativo) => {
    const arquivo = path.join(ROOT, relativo);
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const [, href] of texto.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      // O template de ADR carrega um link de exemplo, com o nome por preencher.
      if (href.includes('NNNN-')) continue;
      const [caminho, fragmento] = decodeURIComponent(href).split('#');

      let destino = arquivo;
      if (caminho) {
        const base = path.resolve(path.dirname(arquivo), caminho);
        destino = caminho.endsWith('.html') ? base.replace(/\.html$/, '.md') : base;
        if (caminho.endsWith('/') || (fs.existsSync(destino) && fs.statSync(destino).isDirectory())) {
          destino = path.join(destino, 'index.md');
        }
      }
      expect(fs.existsSync(destino), `${relativo} → ${href}`).toBe(true);
      if (fragmento) {
        expect([...ancoras(destino)], `${relativo} → ${href}`).toContain(fragmento);
      }
    }
  });
});

describe('o checklist de submissão aponta para a doc publicada', () => {
  // Critério de aceite da #38: "Linkado em docs/THEME_STORE_SUBMISSION.md".
  const checklist = doc('THEME_STORE_SUBMISSION.md');

  it.each(IDIOMAS)('a seção 5 linka $pasta', ({ pasta }) => {
    expect(checklist).toMatch(new RegExp(`\\(${pasta}/[a-z-]+\\.md\\)`));
  });

  it('a seção 5 carrega a URL publicada, montada a partir do _config.yml', () => {
    // O endereço NÃO é digitado à mão nos dois lugares. Ele é montado de `url`
    // + `baseurl`, que é de onde o Jekyll também o monta — então renomear o
    // repositório reprova aqui em vez de deixar o checklist apontando para uma
    // URL que ninguém serve.
    //
    // É o último critério de aceite da #38 ("publicado numa URL pública e
    // estável") virando comando, que é o que este repositório pede de um
    // critério.
    const config = doc('_config.yml');
    const ler = (chave) =>
      config.match(new RegExp(`^${chave}:\\s*(\\S+)`, 'm'))[1].replace(/["']/g, '');
    const publicada = `${ler('url')}${ler('baseurl')}/`;

    expect(publicada).toMatch(/^https:\/\/\S+\.github\.io\/\S+\/$/);

    // A conferência é por SEÇÃO, e não no documento inteiro. A primeira versão
    // procurava a URL em `checklist` e sobreviveu ao defeito plantado: apagar
    // o endereço do §5 deixava o teste VERDE, porque o §6 também o carrega.
    // O teste afirmava uma coisa e media outra — de novo.
    for (const secao of ['5. Documentação merchant', '6. Envio']) {
      expect(trecho(checklist, secao), `a §${secao[0]} deveria linkar ${publicada}`)
        .toContain(publicada);
    }
  });

  it('a seção 4 nomeia os presets que o tema realmente tem', () => {
    // A linha que estava aqui dizia "o tema tem um estilo só" enquanto
    // `settings_data.json` já trazia quatro presets completos, cada um com
    // fonte, cores e arranjo de home próprios. A afirmação nunca foi medida, e
    // por isso sobreviveu ao nascimento dos outros três.
    //
    // Importa além da estética: o §4 diz que CADA preset exige a própria loja
    // demo e o próprio jogo de screenshots. A linha errada escondia que o
    // trabalho de submissão é quatro vezes o que o documento sugeria.
    const presets = Object.keys(readJSONC('config/settings_data.json').presets);
    const secao = trecho(checklist, '4. Presets / estilos');

    expect(presets.length).toBeGreaterThan(0);
    for (const nome of presets) {
      expect(secao, `a §4 não menciona o preset "${nome}"`).toContain(nome);
    }

    // A direção contrária: a §4 não pode listar um preset que não existe mais.
    // Sem isto, apagar um preset do tema deixaria a tabela vendendo quatro
    // estilos quando a loja entrega três.
    const naTabela = [...secao.matchAll(/^\| \*\*([^*]+)\*\* \|/gm)].map((m) => m[1].trim());
    expect(naTabela.sort()).toEqual([...presets].sort());
  });

  it('a §4 não promete que os presets mudam o layout', () => {
    // A primeira versão desta seção dizia que cada preset traz o próprio
    // `content_for_index`, "o arranjo da home é próprio de cada preset".
    // Falso: a chave existe e está VAZIA nos quatro. É legado de tema pré-OS
    // 2.0; a home de verdade é `templates/index.json`, compartilhado.
    //
    // O erro importava porque o §4 exige uma loja demo por preset "com layout
    // espelhando o preset" — e o layout, hoje, não espelha nada.
    const presets = readJSONC('config/settings_data.json').presets;
    const vazios = Object.entries(presets)
      .filter(([, p]) => Array.isArray(p.content_for_index) && p.content_for_index.length === 0)
      .map(([nome]) => nome);

    // Enquanto estiverem vazios, a §4 precisa dizer isso. Se um dia algum
    // preset ganhar seções de verdade, este teste reprova e a prosa acompanha.
    if (vazios.length === Object.keys(presets).length) {
      expect(trecho(checklist, '4. Presets / estilos')).toMatch(/vazio/i);
    } else {
      expect(trecho(checklist, '4. Presets / estilos')).not.toMatch(/está \*\*vazio\*\* nos quatro/);
    }
  });

  it('não sobrou referência ao ROADMAP removido', () => {
    // O arquivo apontava para `docs/ROADMAP.md` como "fonte da verdade" MESES
    // depois de a ADR 0001 removê-lo. Um link morto num checklist é pior que
    // nenhum: quem o segue conclui que o repositório perdeu a informação.
    for (const pagina of ['THEME_STORE_SUBMISSION.md', 'I18N_MIGRATION_GUIDE.md']) {
      expect(doc(pagina), pagina).not.toContain('ROADMAP.md');
    }
  });
});

describe('o guia de cores conta as cores que o esquema tem', () => {
  it('o número de cores bate com o color_scheme_group', () => {
    const grupos = readJSONC('config/settings_schema.json');
    const definicao = grupos
      .flatMap((g) => g.settings || [])
      .find((s) => s.type === 'color_scheme_group').definition;
    // `header` é separador visual do editor, não cor. Contar os dois daria 15
    // e a doc diria um número que a lojista não encontra na tela.
    const cores = definicao.filter((campo) => campo.type !== 'header').length;
    for (const [pasta, arquivo] of [
      ['lojista', 'cores-e-marca.md'],
      ['merchant', 'colors-and-brand.md'],
    ]) {
      const afirmado = Number(doc(`${pasta}/${arquivo}`).match(/(\d+) (?:cores|colors)/)[1]);
      expect(afirmado, pasta).toBe(cores);
    }
  });
});
