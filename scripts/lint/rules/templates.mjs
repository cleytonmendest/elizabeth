/**
 * templates — toda página do tema é montada por section.
 *
 * ── O buraco que esta regra fecha ──────────────────────────────────────────
 *
 * `templates/page.liquid` eram DUAS linhas — um `<h1>` e a `{{ page.content }}`
 * solta. Sem `page-width`, sem color scheme, sem section: toda página
 * institucional da loja (Sobre, FAQ, Trocas, Políticas) saía colada na borda
 * da tela, e a lojista não conseguia mexer em nada pelo editor.
 * `templates/page.contact.liquid` eram 14 linhas de boilerplate em inglês.
 *
 * E os dois passavam no `npm run lint` LIMPOS. Zero avisos, zero entradas no
 * baseline. Os dois piores arquivos do tema, impecáveis no gate.
 *
 * O motivo é o mesmo que fez a regra `radius` nascer: os linters procuram
 * estrutura ERRADA — o token que não é token, a chave que não existe, o
 * setting que ninguém lê. Um arquivo de duas linhas não tem estrutura errada;
 * ele tem estrutura AUSENTE. E ausência não é padrão que se ache com regex,
 * porque não há nada escrito para casar.
 *
 * Então a pergunta muda de forma: em vez de procurar o defeito dentro do
 * arquivo, verifica-se uma CO-OCORRÊNCIA — existe template, então existe
 * section. É a mesma virada de `schemecontract` (pintar fundo obriga a pintar
 * texto) e de `radius` (pintar botão obriga a declarar o raio).
 *
 * ── Por que "tem section" e não "é JSON" ───────────────────────────────────
 *
 * Template JSON é o caminho normal no OS 2.0, mas não é o requisito: o que
 * importa é a página ser montada por peças que a lojista arrasta, renomeia e
 * pinta. Um `.liquid` que renderiza `{% section %}` entrega isso; um `.json`
 * entrega por construção. Exigir o formato em vez do resultado reprovaria um
 * arquivo correto por motivo errado.
 *
 * `templates/customers/` fica de fora: os templates de conta são Liquid legado
 * que a Shopify não seciona, e o que eles precisam ter (color scheme, tokens,
 * i18n) já é verificado pelas regras `editable`, `tokens` e `i18n`.
 *
 * Ver issue #26.
 */
import { DIRS, lineAt, list, offense, read, readJSONC } from '../lib.mjs';
import { isAllowed } from '../exceptions.mjs';

export const meta = {
  name: 'templates',
  title: 'Templates montados por section',
  description: 'Toda página é montada por peças que a lojista edita, não por markup solto.',
  ratchet: true,
};

/** `{% section 'x' %}` e `{% sections 'grupo' %}`, com ou sem hífen. */
const RENDERIZA_SECTION = /\{%-?\s*sections?\s+['"]/;

/**
 * O template Liquid monta a página por section? Pura porque `run()` lê o
 * disco, e a regra `remotes` nasceu verde com um regex quebrado justamente por
 * não haver como plantar defeito nela sem tocar no tema.
 */
export function renderizaSection(fonte) {
  return RENDERIZA_SECTION.test(String(fonte ?? ''));
}

/** Quantas sections um template JSON declara. */
export function contaSections(json) {
  return Object.keys(json?.sections ?? {}).length;
}

export function run() {
  const ofensas = [];

  for (const file of list(DIRS.templates, '.liquid')) {
    if (renderizaSection(read(file))) continue;
    if (isAllowed('templates', file, 'sem-section')) continue;

    ofensas.push(
      offense({
        rule: 'templates',
        file,
        code: 'sem-section',
        message:
          'Este template não renderiza section nenhuma: o que ele desenha não existe no ' +
          'editor de tema, e a lojista não consegue mudar cor, texto nem ordem. ' +
          'Troque por um template JSON com uma section `main-*`, ou renderize uma ' +
          'section daqui. Se a Shopify não secionar esta página, registre a exceção ' +
          'com justificativa em design-exceptions.json.',
      })
    );
  }

  // Template JSON que não lista section nenhuma é o mesmo defeito com outra
  // roupa: o arquivo tem a forma certa e a página continua vazia.
  for (const file of list(DIRS.templates, '.json')) {
    let json;
    try {
      json = readJSONC(file);
    } catch {
      continue; // JSON inválido é problema da regra `refs`.
    }

    if (contaSections(json) > 0) continue;

    const src = read(file);
    ofensas.push(
      offense({
        rule: 'templates',
        file,
        line: lineAt(src, Math.max(0, src.indexOf('"sections"'))),
        code: 'json-sem-section',
        message:
          'Template JSON sem nenhuma section em `sections`. A página renderiza vazia, ' +
          'e nada no editor explica por quê.',
      })
    );
  }

  return ofensas;
}
