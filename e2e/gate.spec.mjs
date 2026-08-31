/**
 * O gate de acessibilidade consegue reprovar?
 *
 * Esta é a única parte da suíte de navegador que NÃO precisa da loja, e é a
 * mais importante das duas. Ela não testa o tema: testa o verificador.
 *
 * Sem isto, o dia em que os critérios do axe forem configurados errado — tag
 * digitada errada, filtro que exclui demais, helper que devolve lista vazia
 * por engano — todas as páginas passariam, e o relatório diria "0 violações"
 * com a mesma cara de quando está tudo certo. É o mesmo silêncio da catraca do
 * baseline comparando o total consigo mesma.
 *
 * Cada teste planta um defeito conhecido e exige que o gate o encontre.
 */
import { test, expect } from '@playwright/test';
import { violacoes, regras, relatorio } from './helpers/axe.mjs';
import { avaliar, resolvidas, impressao } from './helpers/baseline.mjs';

/** Documento completo: o axe julga o `<html>`, então `lang` e `<title>` contam. */
const pagina = (corpo, { lang = 'pt-BR' } = {}) => `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>Amostra</title></head>
<body><main>${corpo}</main></body>
</html>`;

test.describe('o gate encontra o defeito plantado', () => {
  test('imagem sem alternativa textual', async ({ page }) => {
    await page.setContent(
      pagina('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40">')
    );
    expect(regras(await violacoes(page))).toContain('image-alt');
  });

  test('botão sem nome acessível', async ({ page }) => {
    // O quick-add do card é exatamente isto quando o ícone perde o rótulo —
    // e foi o que quase aconteceu na barra fixa (ver tests/add-to-cart).
    await page.setContent(pagina('<button type="submit"><svg width="16" height="16"></svg></button>'));
    expect(regras(await violacoes(page))).toContain('button-name');
  });

  test('contraste insuficiente', async ({ page }) => {
    // O defeito que o jsdom NUNCA veria: depende de layout e cor calculada.
    // É a razão de existir a metade de navegador.
    await page.setContent(
      pagina('<p style="color:#bbbbbb;background:#ffffff;font-size:14px">Frete grátis acima de R$ 199</p>')
    );
    expect(regras(await violacoes(page))).toContain('color-contrast');
  });

  test('campo de formulário sem label', async ({ page }) => {
    await page.setContent(pagina('<input type="email" name="email">'));
    expect(regras(await violacoes(page))).toContain('label');
  });

  test('idioma do documento ausente', async ({ page }) => {
    await page.setContent(pagina('<p>Vestido</p>', { lang: '' }));
    expect(regras(await violacoes(page))).toContain('html-has-lang');
  });
});

test.describe('o gate não inventa defeito', () => {
  test('página correta não acusa nada', async ({ page }) => {
    // A outra metade da prova. Um gate que reprova tudo também não verifica
    // nada: ele só ensina a ignorá-lo.
    await page.setContent(
      pagina(`
        <h1>Vestidos</h1>
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Vestido midi preto" width="40" height="40">
        <button type="submit">Adicionar ao carrinho</button>
        <label for="email">E-mail</label>
        <input id="email" type="email" name="email">
        <p style="color:#111111;background:#ffffff;font-size:14px">Frete grátis acima de R$ 199</p>
      `)
    );
    // Afirmar sobre a LISTA, não sobre a string formatada. Na primeira
    // versão isto era `expect(relatorio(...)).toBe('')` — e um `relatorio`
    // que devolvesse '' por engano faria este teste passar com a página cheia
    // de violações. O mutante achou; a mensagem formatada fica só como
    // diagnóstico da falha.
    const encontradas = await violacoes(page);
    expect(regras(encontradas), relatorio(encontradas)).toEqual([]);
  });
});

test.describe('o relatório diz onde está o problema', () => {
  test('nomeia a regra e o seletor do nó afetado', async ({ page }) => {
    // Relatório é diagnóstico, não gate — mas um que não diz nada faz a
    // pessoa reabrir o CI três vezes até desistir.
    await page.setContent(pagina('<button id="comprar" type="submit"></button>'));

    const texto = relatorio(await violacoes(page));

    expect(texto).toContain('button-name');
    expect(texto).toContain('#comprar');
  });
});

test.describe('o filtro de escopo funciona', () => {
  test('excluir tira o trecho da análise', async ({ page }) => {
    // `excluir` é a válvula para conteúdo de terceiro (widget de review, chat)
    // que a lojista instala e o tema não controla. Se ela excluísse demais, o
    // gate ficaria verde por não olhar — então o teste checa os dois lados.
    await page.setContent(pagina('<div id="terceiro"><img src="x.gif" width="1" height="1"></div>'));

    expect(regras(await violacoes(page))).toContain('image-alt');
    expect(regras(await violacoes(page, { excluir: ['#terceiro'] }))).not.toContain('image-alt');
  });
});


test.describe('a catraca separa dívida conhecida de regressão', () => {
  // Lógica pura, sem navegador — mas mora aqui porque este arquivo é o que
  // testa o VERIFICADOR, e a catraca decide quem passa. Um `avaliar` que
  // devolvesse tudo como "conhecida" deixaria qualquer regressão entrar
  // exibindo o mesmo verde de quando está tudo certo.
  const violacao = (id) => ({ id, help: id, nodes: [{ target: ['x'] }] });
  const BASE = { 'carrinho|color-contrast': 'dívida medida' };

  test('violação registrada no baseline não reprova', () => {
    const { conhecidas, novas } = avaliar('carrinho', [violacao('color-contrast')], BASE);
    expect(novas).toEqual([]);
    expect(conhecidas).toHaveLength(1);
  });

  test('regra nova na mesma página reprova', () => {
    const { novas } = avaliar('carrinho', [violacao('button-name')], BASE);
    expect(novas.map((v) => v.id)).toEqual(['button-name']);
  });

  test('a MESMA regra numa página diferente reprova', () => {
    // O que impede o baseline de virar licença geral: ele é por página.
    const { novas } = avaliar('home', [violacao('color-contrast')], BASE);
    expect(novas.map((v) => v.id)).toEqual(['color-contrast']);
  });

  test('baseline vazio: tudo é novo', () => {
    const { novas } = avaliar('carrinho', [violacao('color-contrast')], {});
    expect(novas).toHaveLength(1);
  });

  test('dívida que sumiu é apontada para o baseline poder encolher', () => {
    // Sem isto o número nunca cai: ninguém lembra de regravar o arquivo
    // depois de corrigir.
    expect(resolvidas('carrinho', [], BASE)).toEqual(['carrinho|color-contrast']);
    expect(resolvidas('carrinho', [violacao('color-contrast')], BASE)).toEqual([]);
  });

  test('a impressão digital não carrega o seletor', () => {
    // Seletor de axe tem :nth-child e id gerado pelo Shopify: ele muda quando
    // alguém insere um bloco, sem nada ter piorado.
    expect(impressao('carrinho', 'color-contrast')).toBe('carrinho|color-contrast');
  });
});
