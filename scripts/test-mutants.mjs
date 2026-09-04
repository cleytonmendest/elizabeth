#!/usr/bin/env node
/**
 * Os testes conseguem falhar?
 *
 *   npm run test:mutants
 *
 * Uma suíte verde diz que os testes passaram. Ela não diz que eles verificam
 * alguma coisa — um `expect(true).toBe(true)` também passa, e um teste que
 * perdeu o alvo (o seletor mudou, o evento trocou de nome) fica verde exibindo
 * o mesmo silêncio de um teste que está funcionando.
 *
 * Este script quebra o tema de propósito, uma quebra por vez, e exige que a
 * suíte fique VERMELHA. Mutante que sobrevive é um teste que não estava
 * olhando para o que dizia olhar.
 *
 * Cada entrada é uma quebra REAL — um bug que já aconteceu neste repositório
 * ou que aconteceria na primeira refatoração distraída. Não é uma varredura
 * automática de operadores: a lista é curta e escolhida a dedo, porque o que
 * ela protege é a intenção do teste, não a cobertura de linhas.
 *
 * Há duas listas, e cada execução roda UMA:
 *
 *   npm run test:mutants          assets/*.js, via Vitest
 *   npm run test:mutants -- --e2e  o verificador de a11y, via Playwright
 *
 * A segunda precisa de Chromium, então vive no job de navegador do CI.
 *
 * A segunda não é luxo. Ela já pagou por si: a primeira versão de
 * `e2e/gate.spec.mjs` afirmava `expect(relatorio(...)).toBe('')`, e um mutante
 * mostrou que um `relatorio` devolvendo '' por engano deixaria o teste passar
 * com a página cheia de violações. O gate verificava o gate — e o teste do
 * gate não verificava nada.
 *
 * O arquivo original é restaurado sempre, inclusive se o processo falhar.
 *
 * ── Um limite deste desenho: ele não muta a si mesmo ───────────────────────
 *
 * Cada `de` é um trecho literal, e o runner exige que ele apareça UMA vez no
 * arquivo alvo. Como a lista mora aqui, qualquer trecho deste arquivo aparece
 * duas vezes — no código e na entrada que o cita —, e o mutante reprova antes
 * de rodar. Descoberto ao tentar cobrir `ambienteDoMutante`, na revisão do PR
 * #75.
 *
 * O que garante essa função é `tests/test-mutants.test.mjs`, que a chama de
 * verdade e ainda confere, lendo a fonte, que o runner a usa. Não é a mesma
 * força de um mutante; é o que este desenho permite, e está escrito para não
 * ser confundido com cobertura.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = path.join(ROOT, 'node_modules', '.bin', 'vitest');
const PLAYWRIGHT = path.join(ROOT, 'node_modules', '.bin', 'playwright');

const comE2E = process.argv.includes('--e2e');

const MUTANTES = [
  {
    porque: 'formatPrice deixa de converter centavos em reais',
    arquivo: 'assets/cart.js',
    de: '.format(value / 100)',
    para: '.format(value)',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'updateQuantity para de avisar o erro para quem escuta',
    arquivo: 'assets/cart.js',
    de: 'publish(PUB_SUB_EVENTS.cartError, error);',
    para: 'void error;',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'addToCart volta a mandar Content-Type e o multipart chega ilegível',
    arquivo: 'assets/cart.js',
    de: "delete config.headers['Content-Type'];",
    para: '// mutante',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'o botão sem data-text-* volta a ser reescrito (apaga o ícone do quick-add)',
    arquivo: 'assets/cart.js',
    de: 'if (!textDesktop || !textMobile) return;',
    para: 'if (false) return;',
    teste: 'tests/add-to-cart.test.mjs',
  },
  {
    porque: 'o mínimo por parcela deixa de ser inclusivo',
    arquivo: 'assets/price-component.js',
    de: 'if (installmentValueCheck >= minValueCents) {',
    para: 'if (installmentValueCheck > minValueCents) {',
    teste: 'tests/price-component.test.mjs',
  },
  {
    // A issue #48 na forma exata em que ela existia: `ceil` no JS contra
    // `divided_by` (inteira) no Liquid. R$ 99,99 virava 1x no HTML e 2x
    // milissegundos depois, com parcelas abaixo do mínimo configurado.
    porque: 'a contagem de parcelas volta a divergir do Liquid (ceil contra divisão inteira)',
    arquivo: 'assets/price-component.js',
    de: 'const installmentValueCheck = Math.floor(price / i)',
    para: 'const installmentValueCheck = Math.ceil(price / i)',
    teste: 'tests/price-component.test.mjs',
  },
  {
    // A outra metade da mesma issue, e a que morde onde a contagem já estava
    // certa: o Liquid imprime centavos inteiros, e a divisão em ponto
    // flutuante deixava o Intl arredondar um centavo para cima.
    porque: 'o valor da parcela volta a divergir do Liquid por um centavo',
    arquivo: 'assets/price-component.js',
    de: 'finalInstallmentValue = Math.floor(price / actualInstallments);',
    para: 'finalInstallmentValue = price / actualInstallments;',
    teste: 'tests/price-component.test.mjs',
  },
  {
    porque: 'o preço riscado aparece justamente quando não há desconto',
    arquivo: 'assets/price-component.js',
    de: "classList.toggle('hidden', !listingPrice)",
    para: "classList.toggle('hidden', listingPrice)",
    teste: 'tests/price-component.test.mjs',
  },
  {
    porque: 'a variante passa a casar com combinação parcial',
    arquivo: 'assets/variations-selector.js',
    de: 'return optionsMatchLength && optionsMatchValues;',
    para: 'return optionsMatchLength || optionsMatchValues;',
    teste: 'tests/variations-selector.test.mjs',
  },
  {
    porque: 'a URL compartilhável perde o parâmetro que a Shopify entende',
    arquivo: 'assets/variations-selector.js',
    de: '?variant=${this.currentVariant.id}',
    para: '?variante=${this.currentVariant.id}',
    teste: 'tests/variations-selector.test.mjs',
  },
  {
    porque: 'datas impossíveis (31/02) voltam a rolar para o mês seguinte',
    arquivo: 'assets/countdown-timer.js',
    de: 'if (d > lastDay) d = lastDay;',
    para: 'if (false) d = lastDay;',
    teste: 'tests/countdown-timer.test.mjs',
  },
  {
    porque: 'o modo diário para de pular para o dia seguinte',
    arquivo: 'assets/countdown-timer.js',
    de: 'if (target <= now) target += 86400000;',
    para: 'if (false) target += 86400000;',
    teste: 'tests/countdown-timer.test.mjs',
  },
  {
    porque: 'o contador vencido volta a rodar para sempre com a seção escondida',
    arquivo: 'assets/countdown-timer.js',
    de: 'this.interval = setInterval(() => this.tick(), 1000);\n    this.tick();',
    para: 'this.tick();\n    this.interval = setInterval(() => this.tick(), 1000);',
    teste: 'tests/countdown-timer.test.mjs',
  },
  {
    porque: 'addToCart volta a publicar o item de linha como se fosse carrinho (issue #4)',
    arquivo: 'assets/cart.js',
    de: 'publish(PUB_SUB_EVENTS.itemAdded, result);',
    para: 'publish(PUB_SUB_EVENTS.cartUpdate, result);',
    teste: 'tests/cart.test.mjs',
  },
  {
    porque: 'a guarda do drawer cai e a bolha volta a receber undefined',
    arquivo: 'assets/cart.js',
    de: '            if (!ehCarrinho(event.detail)) return;',
    para: '            if (false) return;',
    teste: 'tests/cart-drawer.test.mjs',
  },
  {
    porque: 'a barra de frete grátis volta a exibir "Faltam R$ NaN"',
    arquivo: 'assets/cart-extras.js',
    de: '    if (!ehCarrinho(cart)) return;',
    para: '    if (!cart) return;',
    teste: 'tests/cart-extras.test.mjs',
  },
  {
    // O critério de aceite da issue #60, virado do avesso: o job fica verde e
    // comenta "preview pronto" com uma URL que não abre nada. Nenhuma execução
    // do CI mostraria isso — só um revisor clicando.
    porque: 'o comentário de preview é publicado mesmo sem preview_url utilizável',
    arquivo: 'scripts/preview.mjs',
    de: "    parseada = new URL(url);",
    para: "    parseada = { protocol: 'https:' };",
    teste: 'tests/preview.test.mjs',
  },
  {
    // A lição da sonda da loja, na terceira vez que ela aparece: confundir
    // "não havia o que fazer" com "deu errado" pinta de vermelho todo PR de
    // fork, e um gate que reprova sem motivo é um gate que se aprende a ignorar.
    porque: '"sem credencial" volta a ser relatado como falha do preview',
    arquivo: 'scripts/preview.mjs',
    de: '  if (bruto === null || bruto === undefined) {',
    para: '  if (false) {',
    teste: 'tests/preview.test.mjs',
  },
  {
    // Casar o marcador em qualquer posição, em vez de só no início, faz o
    // script adotar o comentário de OUTRA pessoa que tenha citado o preview —
    // e reescrevê-lo. Nenhum erro aparece; só o texto de alguém sumindo.
    porque: 'o marcador passa a casar no meio do texto, e o script sobrescreve comentário alheio',
    arquivo: 'scripts/preview.mjs',
    de: '&& c.body.startsWith(marcador));',
    para: '&& c.body.includes(marcador));',
    teste: 'tests/preview.test.mjs',
  },
  {
    porque: 'espaço em volta da URL passa a fazer parte dela',
    arquivo: 'scripts/preview.mjs',
    de: "  const url = typeof tema.preview_url === 'string' ? tema.preview_url.trim() : '';",
    para: "  const url = typeof tema.preview_url === 'string' ? tema.preview_url : '';",
    teste: 'tests/preview.test.mjs',
  },
  {
    // O defeito que a issue #25 descreve, do outro lado: com o `required`
    // ligado num select vazio, trocar o país para um que não tem província
    // faz o botão salvar parar de funcionar sem dizer nada. Troca um bug
    // visível ("só dá para cadastrar no Brasil") por um invisível.
    porque: 'país sem províncias volta a deixar um select vazio e obrigatório no formulário',
    arquivo: 'assets/address-country.js',
    de: '      this.estado.required = false;',
    para: '      this.estado.required = true;',
    teste: 'tests/address-country.test.mjs',
  },
  {
    // O `maxlength` do CEP tem nove; um ZIP+4 americano tem dez. Mantê-lo
    // ligado fora do Brasil CORTA o que a pessoa digitou, sem aviso — e o
    // formulário salva um código postal incompleto que parece certo.
    porque: 'o limite de tamanho do CEP volta a valer fora do Brasil e trunca o código postal',
    arquivo: 'assets/address-country.js',
    de: "      else campo.removeAttribute('maxlength');",
    para: '      else void campo;',
    teste: 'tests/address-country.test.mjs',
  },
  {
    porque: 'o país gravado deixa de ser reselecionado, e editar um endereço troca o país sozinho',
    arquivo: 'assets/address-country.js',
    de: '    if (salvo) this.pais.value = salvo;',
    para: '    void salvo;',
    teste: 'tests/address-country.test.mjs',
  },
  {
    porque: 'a placeholder vazia passa a contar como lista fixa, e a regra `mercado` acusa markup correto',
    arquivo: 'scripts/lint/rules/mercado.mjs',
    de: "const OPTION_COM_VALOR = /<option\\b[^>]*\\bvalue\\s*=\\s*(['\"])(?!\\1)([^'\"]*)\\1/gi;",
    para: "const OPTION_COM_VALOR = /<option\\b[^>]*\\bvalue\\s*=\\s*(['\"])([^'\"]*)\\1/gi;",
    teste: 'tests/mercado.test.mjs',
  },
  {
    porque: 'a regra `mercado` para de olhar o JSON-LD e só vê o formulário',
    arquivo: 'scripts/lint/rules/mercado.mjs',
    de: "  for (const campo of CAMPOS_JSONLD) {",
    para: "  for (const campo of []) {",
    teste: 'tests/mercado.test.mjs',
  },
  {
    // Afrouxar o regex para casar a palavra solta faria qualquer arquivo
    // passar escrevendo "section" num comentário — que é o tipo de regra que
    // existe, roda e não verifica nada.
    porque: 'a palavra "section" solta passa a contar como section renderizada',
    arquivo: 'scripts/lint/rules/templates.mjs',
    de: "const RENDERIZA_SECTION = /\\{%-?\\s*sections?\\s+['\"]/;",
    para: "const RENDERIZA_SECTION = /sections?/;",
    teste: 'tests/templates.test.mjs',
  },
  {
    porque: 'template JSON sem section nenhuma volta a passar como se estivesse montado',
    arquivo: 'scripts/lint/rules/templates.mjs',
    de: '  return Object.keys(json?.sections ?? {}).length;',
    para: '  return 1;',
    teste: 'tests/templates.test.mjs',
  },
  {
    // O drawer e a página escutam o MESMO evento. O guarda é o que separa os
    // dois; sem ele, `cart-update` passa a varrer a DOM do drawer procurando
    // `.cart-item` por data-key e apaga o que não reconhece.
    porque: 'o guarda da página cai e o evento passa a mexer na DOM do drawer',
    arquivo: 'assets/cart-extras.js',
    de: "    const page = document.querySelector('[data-cart-page]');",
    para: "    const page = document.querySelector('[data-cart-page]') || document.body;",
    teste: 'tests/cart-extras.test.mjs',
  },
  {
    // Item removido em outra aba (ou pelo próprio drawer) continuaria na tela
    // com preço e tudo — e o resumo ao lado já mostrando o total sem ele.
    porque: 'o item que saiu do carrinho continua desenhado na página',
    arquivo: 'assets/cart-extras.js',
    de: '      if (key && keys.indexOf(key) === -1) el.remove();',
    para: '      if (false) el.remove();',
    teste: 'tests/cart-extras.test.mjs',
  },
  {
    // O estado anterior da regra: ela confiava no `ignore` do Theme Check, que
    // usa minimatch — e `**` não atravessa segmento que começa com ponto. Com a
    // raiz em `.claude/worktrees/<nome>`, `node_modules/**` parava de casar e
    // os fixtures de `@shopify/theme-graph` entravam como offense do tema. O
    // mesmo commit ficava verde no CI e vermelho no worktree.
    porque: 'os fixtures dentro de node_modules voltam a contar como arquivo do tema',
    arquivo: 'scripts/lint/rules/themecheck.mjs',
    de: '  return PASTAS_DO_TEMA.some((pasta) => caminho.startsWith(`${pasta}/`));',
    para: '  return caminho.length > 0;',
    teste: 'tests/themecheck.test.mjs',
  },
  {
    // Casar o nome da pasta em qualquer posição faria
    // `node_modules/.../fixtures/skeleton/sections/x.liquid` passar — que é
    // exatamente o caminho que originou o defeito.
    porque: 'a pasta de tema passa a valer no meio do caminho, e o fixture volta a entrar',
    arquivo: 'scripts/lint/rules/themecheck.mjs',
    de: '  return PASTAS_DO_TEMA.some((pasta) => caminho.startsWith(`${pasta}/`));',
    para: '  return PASTAS_DO_TEMA.some((pasta) => caminho.includes(`${pasta}/`));',
    teste: 'tests/themecheck.test.mjs',
  },
  {
    // O defeito exato da #27: a regra lia só o layout, e um asset que mudou
    // para dentro de um snippet sumiu da conta. O orçamento ficou VERDE por
    // ter deixado de olhar — 51 KB de CSS evaporaram do painel sem uma linha
    // a menos chegar ao navegador.
    porque: 'o orçamento para de atravessar o snippet e volta a subnotificar o peso',
    arquivo: 'scripts/lint/rules/budget.mjs',
    de: '      fila.push(`snippets/${match[1]}.liquid`);',
    para: '      void match;',
    teste: 'tests/budget.test.mjs',
  },
  {
    // O outro lado: seguir DEMAIS. Section tem asset co-locado de propósito —
    // contá-lo como global apagaria a diferença que o tema inteiro preserva.
    porque: 'o orçamento passa a contar asset co-locado de section como se fosse global',
    arquivo: 'scripts/lint/rules/budget.mjs',
    de: "    for (const match of src.matchAll(/\\{%-?\\s*render\\s+'([^']+)'/g)) {",
    para: "    for (const match of src.matchAll(/\\{%-?\\s*sections?\\s+'([^']+)'/g)) {",
    teste: 'tests/budget.test.mjs',
  },
  {
    // Se consumir contasse como gerar, `color-scheme.css` se autoautorizaria e
    // a regra nunca acharia nada — que é o defeito com que ela nasceu.
    porque: 'consumir uma CSS variable volta a contar como gerá-la',
    arquivo: 'scripts/lint/rules/schemecontract.mjs',
    de: "  return [...String(fonte ?? '').matchAll(/(--color-[a-z0-9-]+)\\s*:/g)].map((match) => match[1]);",
    para: "  return [...String(fonte ?? '').matchAll(/(--color-[a-z0-9-]+)/g)].map((match) => match[1]);",
    teste: 'tests/schemecontract.test.mjs',
  },
  {
    // O desastre da #64, na forma exata em que ele aconteceria: usar a
    // preview_url inteira como baseURL. `page.goto('/cart')` descarta a query,
    // o tema PUBLICADO responde tudo com 200, e a suíte fica verde medindo a
    // loja de produção enquanto o relatório diz que mediu o PR.
    porque: 'a query da preview_url passa adiante e a suíte volta a medir o tema publicado',
    arquivo: 'scripts/tema-de-teste.mjs',
    de: '  return new URL(url).origin;',
    para: '  return url;',
    teste: 'tests/tema-de-teste.test.mjs',
  },
  {
    // Sem id não há como fixar o tema na sessão. Deixar passar como se
    // estivesse tudo bem é o mesmo silêncio, um passo antes.
    porque: 'push sem preview_theme_id passa como se desse para medir a branch',
    arquivo: 'scripts/tema-de-teste.mjs',
    de: '  if (!id) {',
    para: '  if (false) {',
    teste: 'tests/tema-de-teste.test.mjs',
  },
  {
    // O defeito com que a regra `remotes` nasceu: espalhar um Map dá pares
    // `[chave, valor]`, a alternância vira `settings.(logo_svg,textarea)`, e a
    // regra varre o tema inteiro sem achar nada. Ela passou verde assim.
    porque: 'a alternância volta a ser montada do Map inteiro, e a regra não acha nada',
    arquivo: 'scripts/lint/rules/remotes.mjs',
    de: "  const ids = [...tipos.keys()].join('|');",
    para: "  const ids = [...tipos].join('|');",
    teste: 'tests/remotes.test.mjs',
  },
  {
    porque: 'config volta a poder guardar <link> para domínio externo',
    arquivo: 'scripts/lint/rules/remotes.mjs',
    de: '  const achou = valor.match(SUBRECURSO);',
    para: '  const achou = null;',
    teste: 'tests/remotes.test.mjs',
  },
  {
    porque: '`| escape` deixa de neutralizar, e a regra reprova quem já se protegeu',
    arquivo: 'scripts/lint/rules/remotes.mjs',
    de: '    if (NEUTRALIZA.test(resto)) continue;',
    para: '    if (false) continue;',
    teste: 'tests/remotes.test.mjs',
  },
  {
    // O defeito exato que a versão em shell tinha: comparar o total consigo
    // mesmo e sempre passar. É o mutante mais importante da catraca — a suíte
    // que não o mata é a suíte que deixaria o baseline crescer de novo.
    porque: 'a catraca volta a aprovar qualquer crescimento do baseline',
    arquivo: 'scripts/catraca.mjs',
    de: '  if (atual <= base) {',
    para: '  if (true) {',
    teste: 'tests/catraca.test.mjs',
  },
  {
    porque: 'a exceção de cobertura vira licença geral para crescer',
    arquivo: 'scripts/catraca.mjs',
    de: '  if (cobertura) {',
    para: '  if (true) {',
    teste: 'tests/catraca.test.mjs',
  },
  {
    porque: 'o total da a11y volta a ser LIDO do campo que a mão edita',
    arquivo: 'scripts/catraca.mjs',
    de: '    contar: (json) => Object.keys(json.violacoes ?? {}).length,',
    para: '    contar: (json) => json._total ?? 0,',
    teste: 'tests/catraca.test.mjs',
  },
  {
    porque: 'apagar o baseline deixa de ser reprovado (a catraca some junto)',
    arquivo: 'scripts/catraca.mjs',
    de: '  if (naBase && !aqui) {',
    para: '  if (false) {',
    teste: 'tests/catraca.test.mjs',
  },
  {
    porque: 'entrada de baseline que nenhuma regra produz para de ser apontada',
    arquivo: 'scripts/catraca.mjs',
    de: '  return [...registradas].filter((fingerprint) => !presentes.has(fingerprint)).sort();',
    para: '  return [];',
    teste: 'tests/catraca.test.mjs',
  },
  // ── A guarda de navegação (#64 / ADR 0007) ──────────────────────────────
  //
  // Alvo: o que separa a suíte de uma suíte verde medindo a loja PUBLICADA.
  // Estes rodam em Vitest, contra um `page` falso, porque a decisão não
  // depende de navegador — só de qual resposta a função aceita.
  {
    porque: 'a guarda volta a aceitar qualquer tema nosso — inclusive o publicado',
    arquivo: 'e2e/helpers/loja.mjs',
    de: 'if (visto.ehNosso && String(visto.temaId) === String(esperado) && !visto.barraDePreview) {',
    para: 'if (visto.ehNosso) {',
    teste: 'tests/loja.test.mjs',
  },
  {
    porque: 'o retry vira três tentativas — o gasto some do relatório',
    arquivo: 'e2e/helpers/loja.mjs',
    de: 'for (let tentativa = 1; tentativa <= 2; tentativa += 1) {',
    para: 'for (let tentativa = 1; tentativa <= 3; tentativa += 1) {',
    teste: 'tests/loja.test.mjs',
  },
  {
    porque: 'as duas causas passam a dar a MESMA mensagem, e o diagnóstico some',
    arquivo: 'e2e/helpers/loja.mjs',
    de: '  if (!visto.ehNosso) {',
    para: '  if (false) {',
    teste: 'tests/loja.test.mjs',
  },
  {
    // Mira a DECISÃO, não o `document.querySelector` de dentro do `evaluate`:
    // aquele roda no navegador, e o `page` falso de tests/loja.test.mjs não o
    // executa — um mutante ali sobreviveria por construção, dizendo "o teste
    // não olha" quando o certo é "o teste não alcança". Que o seletor
    // `#preview-bar-iframe` seja o nome certo, só a loja responde.
    porque: 'a barra de preview deixa de reprovar a navegação (volta a valer só na fixação)',
    arquivo: 'e2e/helpers/loja.mjs',
    de: 'String(visto.temaId) === String(esperado) && !visto.barraDePreview) {',
    para: 'String(visto.temaId) === String(esperado)) {',
    teste: 'tests/loja.test.mjs',
  },
  {
    porque: 'a falha de sessão gravada pelo setup deixa de reprovar o teste',
    arquivo: 'e2e/helpers/loja.mjs',
    de: '  const falha = falhaDeSessao();',
    para: '  const falha = null;',
    teste: 'tests/loja.test.mjs',
  },
  // ── O resumo do que NÃO rodou (#74) ─────────────────────────────────────
  {
    // Um describe a mais e o pulo sumia do resumo — reconstruindo em silêncio
    // exatamente o que o resumo existe para quebrar.
    porque: 'o resumo para de descer em suíte aninhada e subnotifica os testes pulados',
    arquivo: 'scripts/e2e.mjs',
    de: '    for (const filha of suite?.suites ?? []) varre(filha);',
    para: '    void suite;',
    teste: 'tests/e2e.test.mjs',
  },
  {
    // O outro lado: contar quem rodou. "23 testes não rodaram" numa execução
    // em que todos rodaram ensina a ignorar o aviso na primeira leitura.
    porque: 'o resumo passa a contar também os testes que rodaram',
    arquivo: 'scripts/e2e.mjs',
    de: "        if (teste.status !== 'skipped') continue;",
    para: '        if (false) continue;',
    teste: 'tests/e2e.test.mjs',
  },
  {
    // A #73 exatamente como ela existia: a guarda cobria `page.goto` e a
    // navegação por CLIQUE entrava sem prova nenhuma. É por clique que a PDP
    // aparece — o começo de quase todo teste de carrinho, e a página que o axe
    // mede na `a11y.spec.mjs`.
    porque: 'a guarda do CLIQUE some, e a navegação por clique volta a poder medir o tema publicado',
    arquivo: 'e2e/helpers/loja.mjs',
    de: '  const falhou = reprovacao({\n    visto: await olha(page),',
    para: '  const falhou = null;\n  void ({\n    visto: await olha(page),',
    teste: 'tests/loja.test.mjs',
  },
  {
    // O `catch` sem filtro que a revisão do PR #75 apontou: `page` fechada e
    // frame destruído sairiam como "a URL não mudou em 15s", que é falso —
    // neste arquivo, o pecado capital.
    porque: 'qualquer erro da espera volta a sair como "a URL não mudou"',
    arquivo: 'e2e/helpers/loja.mjs',
    de: "    if (erro?.name !== 'TimeoutError') throw erro;",
    para: '    void erro;',
    teste: 'tests/loja.test.mjs',
  },
  {
    // O modo sutil de a guarda do clique não guardar nada: perguntar antes de
    // o documento novo existir. A resposta viria da página ANTERIOR, que
    // acabou de passar na guarda — verde sobre a página errada.
    porque: 'o clique deixa de esperar o documento novo, e a guarda pergunta à página anterior',
    arquivo: 'e2e/helpers/loja.mjs',
    de: '    await page.waitForURL((url) => url.href !== antes, {',
    para: '    void antes;\n    void ({',
    teste: 'tests/loja.test.mjs',
  },
];


/**
 * Mutantes do verificador de acessibilidade. Rodam com `--e2e`, porque exigem
 * navegador. Note que aqui o alvo NÃO é o tema: é `e2e/helpers/axe.mjs`, o
 * código que decide se uma página passa ou não.
 */
const MUTANTES_E2E = [
  {
    porque: 'o axe passa a devolver lista vazia — toda página "acessível"',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '  return violations;',
    para: '  return [];',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'os critérios do WCAG viram uma tag que não existe',
    arquivo: 'e2e/helpers/axe.mjs',
    de: "['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']",
    para: "['tag-que-nao-existe']",
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o filtro de escopo deixa de excluir (widget de terceiro reprovaria o PR)',
    arquivo: 'e2e/helpers/axe.mjs',
    de: 'builder = builder.exclude(seletor);',
    para: 'builder = builder;',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o relatório fica vazio e a falha não diz o que quebrou',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '  return violations\n    .map((v) => {',
    para: '  return [].map((v) => {',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'o relatório perde o seletor do nó afetado',
    arquivo: 'e2e/helpers/axe.mjs',
    de: '    em: ${onde}${resto}',
    para: '    em: ???',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'a catraca passa a tratar TODA violação como dívida conhecida',
    arquivo: 'e2e/helpers/baseline.mjs',
    de: '(baseline[impressao(pagina, v.id)] ? conhecidas : novas).push(v);',
    para: 'conhecidas.push(v);',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'a impressão digital perde a página — o baseline vira licença geral',
    arquivo: 'e2e/helpers/baseline.mjs',
    de: 'export const impressao = (pagina, regra) => `${pagina}|${regra}`;',
    para: 'export const impressao = (pagina, regra) => `${regra}`;',
    teste: 'e2e/gate.spec.mjs',
  },
  {
    porque: 'dívida já paga deixa de ser apontada — o baseline nunca encolhe',
    arquivo: 'e2e/helpers/baseline.mjs',
    de: 'return Object.keys(baseline).filter((f) => f.startsWith(`${pagina}|`) && !vistas.has(f));',
    para: 'return [];',
    teste: 'e2e/gate.spec.mjs',
  },
];

// Listas separadas, não somadas: cada uma roda no job de CI que tem as
// ferramentas dela. Somar faria o job de navegador repetir os 11 do unitário.
const LISTA = comE2E ? MUTANTES_E2E : MUTANTES;

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code, text) => (colors ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const red = (t) => paint('31', t);
const green = (t) => paint('32', t);
const dim = (t) => paint('2', t);

/**
 * O ambiente de um mutante — e por que o de navegador precisa ser PODADO.
 *
 * `e2e/gate.spec.mjs` não mede a loja: ele planta uma página com `setContent`
 * e pergunta se o axe a reprova. Mas o `globalSetup` do Playwright é de
 * config, roda em toda invocação, e com `THEME_URL` no ambiente ele sobe
 * Chromium e abre sessão na loja — uma vez por mutante.
 *
 * O custo seria o de menos. O veredito aqui é `resultado.status !== 0`, então
 * um `globalSetup` que estoura (sessão expirada, tema apagado, loja fora do
 * ar) conta como mutante MORTO. Sairia "8 mutantes, 8 mortos" sem o axe ter
 * rodado uma única vez — a exata forma de verde vazio que este script existe
 * para encontrar, dentro do script que a procura.
 *
 * No CI o passo herda `THEME_URL` do `$GITHUB_ENV` que o passo "Onde medir"
 * escreveu, então podar aqui protege a execução real, não só a hipótese.
 */
/**
 * Onde o mutante de navegador escreve os artefatos DELE.
 *
 * Não é arrumação: o Playwright APAGA o diretório de saída no começo de cada
 * execução. Com o padrão (`test-results/`), este passo — que roda depois da
 * suíte, no mesmo job — levava junto screenshot, trace e a imagem gravada por
 * uma baseline que faltava, e o `upload-artifact` subia um artefato sem as
 * evidências da falha que ele existe para carregar.
 *
 * Medido no PR #75, e é o caso que torna isto concreto: a suíte reprovou
 * gravando `styleguide-actual.png` (#74), o passo dos mutantes rodou em
 * seguida, e o artefato subiu com 3 arquivos — nenhum deles a imagem que a
 * mensagem de falha mandava olhar. O verificador tinha voltado a mentir sobre
 * o que entregava.
 *
 * Ele cobre o `outputDir`, que é quase tudo — mas não o relatório do reporter
 * `json`, que sai por `outputFile` e é do config. Essa metade se fecha em
 * `ambienteDoMutante`, e as duas juntas é que significam "o mutante escreve
 * só no diretório dele".
 *
 * É o mesmo cuidado de `ambienteDoMutante`, um degrau adiante: o mutante mede
 * o verificador, e não pode mexer em mais nada da execução real.
 */
export const SAIDA_DO_MUTANTE = 'test-results-mutantes';

export function ambienteDoMutante(env, teste) {
  if (!teste.startsWith('e2e/')) return env;
  const { THEME_URL, PREVIEW_THEME_ID, ...resto } = env;

  // A segunda metade do isolamento, e ela precisa existir aqui porque o
  // `--output` não a alcança: ele desvia o `outputDir`, e o relatório do
  // reporter `json` sai por `outputFile`, que é do CONFIG. Sem esta linha o
  // mutante sobrescreve `test-results/relatorio.json` — o relatório da
  // execução REAL, dentro do artefato —, e quem o abrisse para saber o que
  // não rodou receberia a resposta dos 14 testes do gate.
  //
  // Medido: `playwright test e2e/gate.spec.mjs --output=test-results-mutantes`
  // deixa `test-results/relatorio.json` escrito assim mesmo.
  return { ...resto, RELATORIO_E2E: path.join(SAIDA_DO_MUTANTE, 'relatorio.json') };
}

const sobreviventes = [];

function main() {
  for (const mutante of LISTA) {
    const alvo = path.join(ROOT, mutante.arquivo);
    const original = fs.readFileSync(alvo, 'utf8');

    const ocorrencias = original.split(mutante.de).length - 1;
    if (ocorrencias !== 1) {
      console.error(
        red(`✖ ${mutante.arquivo}: o trecho a mutar aparece ${ocorrencias} vez(es), esperava 1.`)
      );
      console.error(dim(`  ${JSON.stringify(mutante.de)}`));
      console.error(dim('  O arquivo mudou — atualize a lista em scripts/test-mutants.mjs.'));
      process.exit(2);
    }

    let resultado;
    try {
      fs.writeFileSync(alvo, original.replace(mutante.de, mutante.para));
      const navegador = mutante.teste.startsWith('e2e/');
      resultado = navegador
        ? spawnSync(PLAYWRIGHT, ['test', mutante.teste, `--output=${SAIDA_DO_MUTANTE}`], {
            cwd: ROOT,
            encoding: 'utf8',
            env: ambienteDoMutante(process.env, mutante.teste),
          })
        : spawnSync(VITEST, ['run', mutante.teste], { cwd: ROOT, encoding: 'utf8' });
    } finally {
      fs.writeFileSync(alvo, original);
    }

    const morreu = resultado.status !== 0;
    console.log(
      `${morreu ? green('morreu ') : red('SOBREVIVEU')}  ${mutante.porque}`,
      dim(`(${mutante.arquivo} → ${mutante.teste})`)
    );
    if (!morreu) sobreviventes.push(mutante);
  }

  console.log('');
  if (sobreviventes.length) {
    console.error(
      red(`${sobreviventes.length} de ${LISTA.length} mutante(s) sobreviveram.`) +
        ' A suíte ficou verde com o tema quebrado — esses testes não verificam o que dizem verificar.'
    );
    return 1;
  }
  console.log(green(`${LISTA.length} mutantes, ${LISTA.length} mortos.`));
  return 0;
}

// Só executa quando chamado direto; importar para teste não dispara nada.
if (process.argv[1] && process.argv[1].endsWith('test-mutants.mjs')) {
  process.exit(main());
}
