#!/usr/bin/env node
/**
 * O site publicado é o que o lojista vê. Isto mede ELE.
 *
 *   npm run site
 *
 * ── Por que este script existe ─────────────────────────────────────────────
 *
 * `tests/docs.test.mjs` mede o MARKDOWN: nome de seção, contagem, link entre
 * capítulos, simetria entre os idiomas. Tudo verdade, tudo verde — e o site
 * publicado saiu quebrado assim mesmo.
 *
 * O `docs/_config.yml` declarava `theme: jekyll-theme-primer`, mas o Jekyll só
 * aplica layout quando a página PEDE, e nenhuma pedia. As doze páginas foram
 * publicadas como fragmento de HTML: sem `<!DOCTYPE>`, sem `<head>`, sem CSS,
 * sem `<html lang>`. O `jekyll build` passou. O GitHub Pages publicou. O
 * relatório de build ficou verde. Nada mediu a saída, então nada reclamou.
 *
 * E o defeito que o usuário viu primeiro não foi nenhum desses: foi que o site
 * "só está em português". A página inicial era prosa em pt-BR com o inglês
 * escondido numa célula de tabela, e nenhuma página interna oferecia o outro
 * idioma — quem chega por busca cai no meio do guia, não na raiz.
 *
 * Um verificador que olha para o lugar errado exibe a MESMA cara de quando
 * está tudo certo. É a lição que este repositório já pagou na catraca do
 * baseline, no board e na regra `editable`; aqui ela cobrou de novo.
 *
 * ── O que NÃO dá para verificar aqui ───────────────────────────────────────
 *
 * Se o texto está bom, se a explicação ajuda, se a tradução é fiel. Isso é
 * leitura humana. Este script mede estrutura: idioma declarado, layout
 * aplicado, link que resolve, as duas metades presentes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = path.join(ROOT, 'docs');

/** O idioma que cada pasta do site precisa declarar. */
export const IDIOMA_DA_PASTA = { lojista: 'pt-BR', merchant: 'en' };

/**
 * O que está errado numa página construída.
 *
 * Recebe o HTML já gerado — não o Markdown. É a diferença que fez o defeito
 * passar: o Markdown estava certo o tempo todo.
 */
export function problemasDaPagina(html, caminho) {
  const problemas = [];
  const pasta = caminho.split('/')[0];
  const esperado = IDIOMA_DA_PASTA[pasta];

  if (!/^<!DOCTYPE html>/i.test(html.trim())) {
    problemas.push(
      'não começa com <!DOCTYPE html> — a página saiu como fragmento, sem layout. ' +
        'Quase sempre é `layout` não atribuído no _config.yml.',
    );
  }

  const lang = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1];
  if (!lang) {
    problemas.push('não declara <html lang> — reprova WCAG 2.1 3.1.1, que é nível A');
  } else if (esperado && lang !== esperado) {
    problemas.push(`declara lang="${lang}" e deveria declarar "${esperado}" (está em ${pasta}/)`);
  }

  if (!/<link[^>]+rel="stylesheet"/i.test(html)) {
    problemas.push('não carrega folha de estilo');
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    problemas.push('não tem <title>');
  }

  // Toda página interna precisa oferecer a outra metade. Sem isto, quem chega
  // por busca não descobre que o outro idioma existe.
  if (esperado && !/hreflang="/i.test(html)) {
    problemas.push('não linka a versão no outro idioma (falta `alt` no front matter)');
  }

  return problemas;
}

/** Os destinos internos que um HTML referencia, já sem âncora nem query. */
export function referencias(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((d) => !/^(https?:|mailto:|#|data:)/.test(d))
    .map((d) => d.split('#')[0].split('?')[0])
    .filter(Boolean);
}

/**
 * Resolve uma referência para o arquivo que deveria existir na saída.
 * `baseurl` é o prefixo do projeto no github.io — se ele estiver errado, cada
 * link aponta para a raiz do domínio, e é este cálculo que descobre.
 */
export function destinoNoDisco(destino, deOnde, { saida, baseurl }) {
  let alvo;
  if (destino.startsWith('/')) {
    if (baseurl && !destino.startsWith(`${baseurl}/`) && destino !== baseurl) return null;
    alvo = path.join(saida, destino.slice(baseurl.length));
  } else {
    alvo = path.resolve(path.dirname(path.join(saida, deOnde)), destino);
  }
  return destino.endsWith('/') || (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory())
    ? path.join(alvo, 'index.html')
    : alvo;
}

/** Todo `.html` gerado, em caminho relativo à raiz do site. */
export function paginas(saida) {
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.html')) out.push(path.relative(saida, p).split(path.sep).join('/'));
    }
  };
  anda(saida);
  return out.sort();
}

/** O relatório inteiro do site construído. Vazio significa aprovado. */
export function problemasDoSite(saida, baseurl = '') {
  const achados = [];
  const todas = paginas(saida);

  if (!todas.length) return ['o build não gerou nenhuma página'];

  const porIdioma = {};
  for (const pagina of todas) {
    const html = fs.readFileSync(path.join(saida, pagina), 'utf8');

    for (const problema of problemasDaPagina(html, pagina)) {
      achados.push(`${pagina}: ${problema}`);
    }

    const lang = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1];
    if (lang) porIdioma[lang] = (porIdioma[lang] ?? 0) + 1;

    for (const destino of referencias(html)) {
      const alvo = destinoNoDisco(destino, pagina, { saida, baseurl });
      if (alvo === null) {
        achados.push(`${pagina}: "${destino}" aponta para fora do baseurl "${baseurl}"`);
      } else if (!fs.existsSync(alvo)) {
        achados.push(`${pagina}: "${destino}" não existe no site gerado`);
      }
    }
  }

  // As duas metades precisam estar publicadas, e com o mesmo tamanho. Um site
  // "bilíngue" com seis páginas de um lado e zero do outro passaria em tudo
  // acima — cada página que EXISTE estaria correta.
  //
  // A conta é por PASTA, e não pelo `lang` declarado: a página inicial é
  // bilíngue e declara o idioma primário, então contá-la pelo `lang` daria 7
  // contra 6 num site perfeitamente simétrico.
  const tamanhos = Object.keys(IDIOMA_DA_PASTA).map((pasta) => ({
    pasta,
    n: todas.filter((p) => p.startsWith(`${pasta}/`)).length,
  }));
  for (const { pasta, n } of tamanhos) {
    if (!n) achados.push(`a metade ${pasta}/ não gerou nenhuma página`);
  }
  const [um, outro] = tamanhos;
  if (um.n && outro.n && um.n !== outro.n) {
    achados.push(
      `os dois idiomas têm tamanhos diferentes: ${um.pasta} tem ${um.n}, ${outro.pasta} tem ${outro.n}`,
    );
  }
  void porIdioma;

  // A raiz é onde a Theme Store manda o revisor. Ela precisa apontar para os
  // dois guias — foi por não fazer isso que o site pareceu existir só em pt-BR.
  const raiz = fs.readFileSync(path.join(saida, 'index.html'), 'utf8');
  achados.push(...problemasDaRaiz(raiz));

  return achados;
}

/**
 * O que está errado na página inicial — a única bilíngue do site.
 *
 * Ela declara UM idioma primário no `<html lang>`, então o bloco no outro
 * idioma precisa se identificar: é o WCAG 2.1 3.1.2 (Language of Parts), nível
 * AA. Sem isso o leitor de tela lê o inglês com fonemas portugueses.
 */
export function problemasDaRaiz(html) {
  const achados = [];
  const primario = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1];

  for (const pasta of Object.keys(IDIOMA_DA_PASTA)) {
    if (!html.includes(`${pasta}/`)) achados.push(`a página inicial não linka ${pasta}/`);
  }

  const outros = Object.values(IDIOMA_DA_PASTA).filter((l) => l !== primario);
  for (const lang of outros) {
    if (!new RegExp(`<[a-z]+[^>]*\\slang="${lang}"`, 'i').test(html)) {
      achados.push(
        `a página inicial é bilíngue mas não marca o trecho em "${lang}" com lang= ` +
          '(WCAG 2.1 3.1.2, nível AA)',
      );
    }
  }

  return achados;
}

/**
 * O `baseurl` precisa ser o NOME DO REPOSITÓRIO, e quem sabe isso é o remote.
 *
 * ── Por que esta função existe ─────────────────────────────────────────────
 *
 * A primeira versão de `destinoNoDisco` lia o `baseurl` do `_config.yml` e
 * conferia os links gerados contra ele. Os links são gerados A PARTIR do mesmo
 * valor, então o teste comparava a configuração consigo mesma: trocar
 * `/elizabeth` por `/outro-nome` deixava o verificador VERDE, com o site
 * inteiro apontando para uma URL que o GitHub Pages nunca serviria.
 *
 * Foi encontrado plantando o defeito de propósito. É a mesma forma da catraca
 * que comparava o total consigo mesma (ver o comentário em `.github/workflows/
 * ci.yml`) — e é por isso que se planta defeito em vez de reler o código.
 *
 * `remote` é a URL do `origin`; de lá saem o dono e o nome, que são os dois
 * valores que o GitHub Pages usa para montar o endereço de um site de projeto.
 */
export function problemasDoEndereco(config, remote) {
  const achados = [];
  const ler = (chave) =>
    (config.match(new RegExp(`^${chave}:\\s*(\\S+)`, 'm'))?.[1] ?? '').replace(/["']/g, '');

  const m = remote?.match(/github\.com[:/]([^/]+)\/([^/.\s]+)/);
  if (!m) {
    achados.push(`não consegui ler dono/repositório do remote (${remote || 'ausente'})`);
    return achados;
  }
  const [, dono, repo] = m;

  if (ler('baseurl') !== `/${repo}`) {
    achados.push(
      `baseurl é "${ler('baseurl')}" e o GitHub Pages serve este projeto em "/${repo}" — ` +
        'com ele errado, todo link e a folha de estilo apontam para fora do site',
    );
  }
  if (ler('url') !== `https://${dono}.github.io`) {
    achados.push(`url é "${ler('url')}" e deveria ser "https://${dono}.github.io"`);
  }

  return achados;
}

/**
 * Onde o Jekyll está, já que ele não costuma estar no PATH do npm.
 *
 * `bundle exec` primeiro: `docs/Gemfile` fixa a versão, e rodar uma solta do
 * sistema mediria um Jekyll diferente do que o CI e o GitHub Pages usam. Se o
 * bundle não estiver instalado, a tentativa falha e o `jekyll` do sistema
 * assume — que é o caso de quem só quer construir o site uma vez.
 */
function achaJekyll() {
  const comGemfile = fs.existsSync(path.join(FONTE, 'Gemfile'));
  const candidatos = [
    ...(comGemfile ? [['bundle', 'exec', 'jekyll']] : []),
    'jekyll',
    ...['/opt/rbenv/versions', `${process.env.HOME}/.rbenv/versions`].flatMap((base) => {
      if (!fs.existsSync(base)) return [];
      return fs.readdirSync(base).map((v) => path.join(base, v, 'bin', 'jekyll'));
    }),
  ];
  for (const c of candidatos) {
    const [cmd, ...pre] = Array.isArray(c) ? c : [c];
    const r = spawnSync(cmd, [...pre, '--version'], { stdio: 'ignore', cwd: FONTE });
    if (r.status === 0) return Array.isArray(c) ? c : [c];
  }
  return null;
}

function main() {
  const saida = path.join(ROOT, '.site');
  const jekyll = achaJekyll();

  if (!jekyll) {
    // Sem pular em silêncio: o script REPROVA. Um "pulado" aqui devolveria
    // exatamente o verde vazio que deixou o site quebrado ser publicado.
    console.error('Jekyll não encontrado. Instale com:\n');
    console.error('  gem install jekyll jekyll-theme-primer jekyll-seo-tag\n');
    process.exit(1);
  }

  fs.rmSync(saida, { recursive: true, force: true });
  const [cmd, ...pre] = jekyll;
  const build = spawnSync(cmd, [...pre, 'build', '--source', FONTE, '--destination', saida], {
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
    cwd: FONTE,
  });
  if (build.status !== 0) {
    console.error(build.stderr);
    process.exit(1);
  }

  const baseurl = (fs.readFileSync(path.join(FONTE, '_config.yml'), 'utf8')
    .match(/^baseurl:\s*(\S+)/m)?.[1] ?? '').replace(/["']/g, '');

  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout?.trim();

  const problemas = [
    ...problemasDoEndereco(fs.readFileSync(path.join(FONTE, '_config.yml'), 'utf8'), remote),
    ...problemasDoSite(saida, baseurl),
  ];
  const total = paginas(saida).length;

  if (problemas.length) {
    console.error(`\n✖ ${problemas.length} problema(s) no site construído:\n`);
    for (const p of problemas) console.error(`  ${p}`);
    console.error('');
    process.exit(1);
  }

  console.log(`✔ site construído: ${total} páginas, layout aplicado, idioma declarado, links resolvem`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
