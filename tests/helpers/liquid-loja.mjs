/**
 * Um motor Liquid com os três filtros da Shopify que os snippets de preço usam.
 *
 * O `liquidjs` NÃO é o Liquid da Shopify (ver tests/menu-forma.test.mjs): não
 * tem drops, nem `money`, nem `t`. Os snippets de preço foram escritos para
 * caber no que os dois motores implementam igual — `if`, `for`, `assign`,
 * `capture`, `render`, `map`, `compact`, `json` —, e os três filtros que
 * faltam entram aqui, com o comportamento que a vitrine tem:
 *
 *   t          lê o locale DE VERDADE (pt-BR) e interpola `{{ var }}`. Chave
 *              que não existe devolve o "translation missing" da Shopify, então
 *              um teste que olha o texto vê a chave errada — e não um eco da
 *              chave que ele mesmo pediu.
 *   money      centavos → "R$ 12,90", o formato da loja de teste.
 *   asset_url  um caminho qualquer; o que importa é o nome do arquivo.
 *
 * O que isto prova é a REGRA escrita no snippet: qual texto, qual preço, qual
 * radio marcado para cada estado do produto. Que a Shopify entrega os campos
 * com esses nomes é outra pergunta — a documentação do objeto responde, e a
 * suíte de navegador contra a loja confere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// O locale abre com o comentário `/* … */` que o editor de idiomas da Shopify
// escreve, e JSON.parse não aceita comentário.
const LOCALE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'locales/pt-BR.json'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, '')
);

function traduz(key, ...args) {
  const vars = Object.fromEntries(args.filter(Array.isArray));
  let valor = key.split('.').reduce((no, parte) => (no == null ? undefined : no[parte]), LOCALE);
  // Chave com plural (`{ one, other }`): a Shopify escolhe pela variável
  // `count`. A regra aqui é a do inglês — 1 é singular —, que basta para o
  // que os testes pedem; o português da loja trata o 0 do mesmo jeito que a
  // Shopify o trataria só se algum teste passar a depender disso.
  if (valor && typeof valor === 'object' && 'count' in vars) {
    valor = Number(vars.count) === 1 ? valor.one : valor.other;
  }
  if (typeof valor !== 'string') return `translation missing: pt-BR.${key}`;
  return valor.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nome) => String(vars[nome] ?? ''));
}

const dinheiro = (centavos) =>
  centavos == null ? '' : `R$ ${(Number(centavos) / 100).toFixed(2).replace('.', ',')}`;

export function motorDaLoja() {
  const engine = new Liquid({ root: path.join(ROOT, 'snippets'), extname: '.liquid' });
  engine.registerFilter('t', traduz);
  engine.registerFilter('money', dinheiro);
  engine.registerFilter('asset_url', (arquivo) => `/cdn/shop/t/1/assets/${arquivo}`);
  engine.registerTag('form', FORM);
  return engine;
}

/**
 * `{% form 'product', product %}…{% endform %}` vira um <form> simples.
 *
 * O `liquidjs` analisa os `{% render %}` de nome fixo ao ler o arquivo, mesmo
 * os que nunca executam — o card de produto não renderiza o quick-add no teste,
 * mas o arquivo dele é lido, e sem esta tag a leitura para no `{% form %}`.
 */
const FORM = {
  parse(_token, remainTokens) {
    this.templates = [];
    const stream = this.liquid.parser
      .parseStream(remainTokens)
      .on('tag:endform', () => stream.stop())
      .on('template', (template) => this.templates.push(template))
      .on('end', () => {
        throw new Error('{% form %} sem {% endform %}');
      });
    stream.start();
  },
  *render(ctx, emitter) {
    emitter.write('<form>');
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    emitter.write('</form>');
  },
};

/** Renderiza `snippets/<nome>.liquid` e devolve um <div> com o resultado. */
export function renderiza(nome, variaveis) {
  const html = motorDaLoja().renderFileSync(nome, variaveis);
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

/**
 * O texto que aparece NA TELA: sem o que é só para leitor de tela (`sr-only`)
 * e sem o `hidden`. Espaço colapsado como o navegador faz.
 */
export function textoVisivel(el) {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('.sr-only, .hidden').forEach((n) => n.remove());
  return copia.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
}
