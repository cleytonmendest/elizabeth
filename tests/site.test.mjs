/**
 * O verificador do site consegue reprovar?
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * `scripts/site.mjs` nasceu de um defeito que passou por TODOS os gates: o
 * `docs/_config.yml` não atribuía `layout`, e o Jekyll só aplica layout quando
 * a página pede. As doze páginas foram publicadas como fragmento de HTML — sem
 * `<!DOCTYPE>`, sem `<head>`, sem CSS, sem `<html lang>` — e o build do GitHub
 * Pages relatou sucesso, porque construir sem erro é o que ele mede.
 *
 * Um verificador escrito depois do defeito é fácil de escrever e fácil de
 * escrever ERRADO: ele nasce olhando para o caso que já se conhece. Então aqui
 * cada defeito é PLANTADO, no formato do `e2e/gate.spec.mjs` — planta o
 * quebrado e exige que o verificador ache, planta o correto e exige silêncio.
 *
 * O segundo caso é o que quase ninguém escreve, e é metade do valor: um
 * verificador que acusa tudo é tão inútil quanto um que não acusa nada, e os
 * dois deixam a suíte verde quando você olha só para o primeiro.
 *
 * ── O que já foi pego plantando ────────────────────────────────────────────
 *
 * `problemasDoEndereco` existe por causa de um plantio. A conferência de link
 * lia o `baseurl` do `_config.yml` e comparava com os links gerados A PARTIR
 * daquele mesmo valor — configuração contra ela mesma. Trocar `/elizabeth` por
 * `/outro-nome` passava verde com o site inteiro apontando para um endereço
 * que o GitHub Pages nunca serviria. É a forma exata da catraca que comparava
 * o total consigo mesma, descrita em `.github/workflows/ci.yml`.
 */
import { describe, it, expect } from 'vitest';
import {
  problemasDaPagina,
  problemasDaRaiz,
  problemasDoEndereco,
  referencias,
  IDIOMA_DA_PASTA,
} from '../scripts/site.mjs';

/** Uma página inglesa correta: é o silêncio contra o qual tudo se mede. */
const BOA = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Getting started | Elizabeth</title>
    <link rel="stylesheet" href="/elizabeth/assets/css/style.css">
    <link rel="alternate" hreflang="pt-BR" href="/elizabeth/lojista/primeiros-passos.html">
  </head>
  <body><h1>1. Getting started</h1></body>
</html>`;

describe('a página correta não é acusada de nada', () => {
  it('silêncio', () => {
    expect(problemasDaPagina(BOA, 'merchant/getting-started.html')).toEqual([]);
  });

  it('e a versão em português também', () => {
    const pt = BOA.replace('lang="en"', 'lang="pt-BR"').replace('hreflang="pt-BR"', 'hreflang="en"');
    expect(problemasDaPagina(pt, 'lojista/primeiros-passos.html')).toEqual([]);
  });
});

describe('o defeito que foi publicado de verdade', () => {
  it('página sem layout — o fragmento que o Pages serviu por horas', () => {
    // Exatamente o que saiu: markdown convertido, e nada em volta.
    const fragmento = '<h1 id="1-getting-started">1. Getting started</h1>\n<p>Follow in order.</p>';
    const achados = problemasDaPagina(fragmento, 'merchant/getting-started.html');

    expect(achados.join(' ')).toMatch(/DOCTYPE/);
    expect(achados.join(' ')).toMatch(/lang/);
    expect(achados.join(' ')).toMatch(/estilo/);
    expect(achados.join(' ')).toMatch(/title/);
  });
});

describe('cada defeito é plantado, um por vez', () => {
  it('sem DOCTYPE', () => {
    expect(problemasDaPagina(BOA.replace('<!DOCTYPE html>\n', ''), 'merchant/faq.html').join(' '))
      .toMatch(/DOCTYPE/);
  });

  it('sem <html lang>', () => {
    expect(problemasDaPagina(BOA.replace(' lang="en"', ''), 'merchant/faq.html').join(' '))
      .toMatch(/3\.1\.1/);
  });

  it('idioma errado para a pasta', () => {
    // O defeito mais traiçoeiro: a página EXISTE, o conteúdo está em inglês, e
    // o leitor de tela lê tudo com fonemas portugueses. Nada na tela denuncia.
    const errado = BOA.replace('lang="en"', 'lang="pt-BR"');
    expect(problemasDaPagina(errado, 'merchant/faq.html').join(' ')).toMatch(/deveria declarar "en"/);
  });

  it('sem folha de estilo', () => {
    expect(problemasDaPagina(BOA.replace(/<link rel="stylesheet"[^>]*>/, ''), 'merchant/faq.html').join(' '))
      .toMatch(/estilo/);
  });

  it('sem link para o outro idioma', () => {
    expect(problemasDaPagina(BOA.replace(/hreflang="[^"]*"/g, ''), 'merchant/faq.html').join(' '))
      .toMatch(/outro idioma/);
  });
});

describe('a página inicial é a que a Theme Store abre', () => {
  const RAIZ = `<!DOCTYPE html><html lang="pt-BR"><head><title>Elizabeth</title>
    <link rel="stylesheet" href="/elizabeth/assets/css/style.css"></head>
    <body><a href="lojista/">Guia</a><div lang="en"><a href="merchant/">Guide</a></div></body></html>`;

  it('a correta passa', () => {
    expect(problemasDaRaiz(RAIZ)).toEqual([]);
  });

  it('sem o guia em inglês', () => {
    // O sintoma relatado: "só está em PT-BR".
    expect(problemasDaRaiz(RAIZ.replace(/<div lang="en">.*?<\/div>/, '')).join(' '))
      .toMatch(/não linka merchant/);
  });

  it('bilíngue sem marcar o trecho no outro idioma', () => {
    // WCAG 3.1.2. O texto está lá, em inglês, dentro de uma página declarada
    // pt-BR — e nada diz isso para quem ouve a página em vez de ler.
    expect(problemasDaRaiz(RAIZ.replace('<div lang="en">', '<div>')).join(' '))
      .toMatch(/3\.1\.2/);
  });
});

describe('o endereço é conferido contra o remote, não contra ele mesmo', () => {
  const REMOTE = 'https://github.com/cleytonmendest/elizabeth.git';
  const CERTO = 'url: https://cleytonmendest.github.io\nbaseurl: /elizabeth\n';

  it('a configuração certa passa', () => {
    expect(problemasDoEndereco(CERTO, REMOTE)).toEqual([]);
  });

  it('funciona com remote por SSH também', () => {
    expect(problemasDoEndereco(CERTO, 'git@github.com:cleytonmendest/elizabeth.git')).toEqual([]);
  });

  it('baseurl que não é o nome do repositório', () => {
    // O plantio que criou esta função. Sem ela, isto passava VERDE.
    expect(problemasDoEndereco(CERTO.replace('/elizabeth', '/outro-nome'), REMOTE).join(' '))
      .toMatch(/baseurl/);
  });

  it('url de outro dono', () => {
    expect(problemasDoEndereco(CERTO.replace('cleytonmendest.github.io', 'outro.github.io'), REMOTE).join(' '))
      .toMatch(/url é/);
  });

  it('sem baseurl nenhum', () => {
    expect(problemasDoEndereco('url: https://cleytonmendest.github.io\n', REMOTE).join(' '))
      .toMatch(/baseurl/);
  });

  it('remote ilegível é problema, não silêncio', () => {
    expect(problemasDoEndereco(CERTO, '').join(' ')).toMatch(/remote/);
  });
});

describe('as referências extraídas do HTML', () => {
  it('pega href e src, e descarta o que não é do site', () => {
    const html = `<a href="lojista/faq.html">x</a><img src="/elizabeth/a.png">
      <a href="https://github.com/x">fora</a><a href="mailto:a@b.c">fora</a><a href="#ancora">fora</a>`;
    expect(referencias(html)).toEqual(['lojista/faq.html', '/elizabeth/a.png']);
  });

  it('corta âncora e query, que não existem no disco', () => {
    expect(referencias('<a href="faq.html#pergunta">x</a>')).toEqual(['faq.html']);
    expect(referencias('<link href="style.css?v=1">')).toEqual(['style.css']);
  });
});

describe('as duas pastas do site', () => {
  it('estão declaradas com o idioma de cada uma', () => {
    // Sem isto, renomear uma pasta faria `problemasDaPagina` parar de conferir
    // idioma naquela metade — e o silêncio pareceria aprovação.
    expect(IDIOMA_DA_PASTA).toEqual({ lojista: 'pt-BR', merchant: 'en' });
  });
});
