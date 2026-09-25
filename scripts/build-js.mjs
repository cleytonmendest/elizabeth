/**
 * build-js — minifica `src/js/*.js` para `assets/*.js`.
 *
 * ── Por que o fonte saiu de `assets/` ──────────────────────────────────────
 *
 * A Shopify serve `assets/` direto, sem passo de build: o arquivo que está no
 * repositório é o arquivo que a cliente baixa. Enquanto o JS foi escrito à
 * mão ali, cada comentário e cada nome de variável longa viajou para o
 * navegador em toda página — 61,7 KB, dos quais 32 KB não eram programa.
 *
 * Minificar no lugar destruiria o fonte. Então o JS passou a seguir o mesmo
 * caminho que o CSS já seguia:
 *
 *     src/tailwind.css → assets/application.css   (Tailwind, desde sempre)
 *     src/js/*.js      → assets/*.js              (esbuild, a partir da #96)
 *
 * `src/` já está no `.shopifyignore`, então a loja recebe só o minificado.
 *
 * ── Por que o ganho sobrevive ao gzip ──────────────────────────────────────
 *
 * A suspeita razoável é que a compressão do CDN já resolvesse: texto repetido
 * é exatamente o que o gzip come. Medido, não: 19,5 KB → 10,6 KB comprimido,
 * 45% a menos. O motivo é que o esbuild RENOMEIA identificadores locais, e
 * compressão nenhuma faz isso — `precoFormatadoDaVariante` continua sendo
 * uma string longa para o gzip, ainda que ele a referencie por ponteiro.
 *
 * ── O que NÃO é gerado ─────────────────────────────────────────────────────
 *
 * `swiper-bundle.min.js` é de terceiro e já vem minificado: não tem fonte
 * neste repositório e não deve ganhar um. `orfaos()` existe para essa
 * distinção não virar convenção oral — qualquer `assets/*.js` que não seja
 * gerado nem declarado aqui reprova o lint.
 */
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = path.join(ROOT, 'src', 'js');
const DESTINO = path.join(ROOT, 'assets');

/**
 * Arquivos em `assets/` que NÃO saem de `src/js/`, com o porquê.
 *
 * É uma lista explícita e não um padrão `*.min.js` de propósito: o padrão
 * deixaria qualquer arquivo entrar em `assets/` sem fonte, bastando o nome
 * terminar certo. A lista obriga a decisão a ser escrita.
 */
export const VENDORIZADOS = {
  'swiper-bundle.min.js': 'Biblioteca de terceiro, baixada já minificada e sob demanda pelo <my-slider> (ADR 0011).',
};

/**
 * O alvo do esbuild.
 *
 * `es2019` e não `esnext`: o tema precisa rodar nos navegadores que a Shopify
 * exige, e o fonte usa encadeamento opcional (`?.`), que é ES2020. Deixar o
 * alvo no padrão publicaria a sintaxe nova como está.
 *
 * Nada de `bundle`. Os assets são scripts CLÁSSICOS — não importam uns aos
 * outros, dependem de globais publicadas na ordem em que o Liquid os injeta
 * (ADR 0010). Empacotar mudaria o programa; minificar não.
 */
const ALVO = 'es2019';

export const fontes = () =>
  fs.existsSync(FONTE) ? fs.readdirSync(FONTE).filter((f) => f.endsWith('.js')).sort() : [];

/** Minifica um arquivo e devolve o texto — sem escrever. */
export function minifica(nome) {
  const src = fs.readFileSync(path.join(FONTE, nome), 'utf8');
  const { code } = esbuild.transformSync(src, { minify: true, target: ALVO, loader: 'js' });
  return code;
}

/** Minifica um arquivo e escreve em `assets/`. Devolve os dois tamanhos. */
export function constroi(nome) {
  const code = minifica(nome);
  fs.writeFileSync(path.join(DESTINO, nome), code);
  return { nome, antes: fs.statSync(path.join(FONTE, nome)).size, depois: Buffer.byteLength(code) };
}

export const constroiTudo = () => fontes().map(constroi);

/**
 * `assets/*.js` que não é gerado nem declarado vendorizado.
 *
 * Sem isto, alguém adiciona `assets/novo.js` à mão, o tema funciona, e o
 * arquivo simplesmente nunca é minificado — o defeito que a #96 corrigiu,
 * voltando de fininho um arquivo por vez.
 */
export function orfaos() {
  const gerados = new Set(fontes());
  return fs
    .readdirSync(DESTINO)
    .filter((f) => f.endsWith('.js') && !gerados.has(f) && !(f in VENDORIZADOS));
}

if (process.argv[1] && process.argv[1].endsWith('build-js.mjs')) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const r = constroiTudo();
  const antes = r.reduce((s, x) => s + x.antes, 0);
  const depois = r.reduce((s, x) => s + x.depois, 0);
  console.log(`${r.length} arquivos: ${kb(antes)} → ${kb(depois)} (${Math.round((1 - depois / antes) * 100)}% menor)`);
  const sobrando = orfaos();
  if (sobrando.length) {
    console.error(`\nassets/*.js sem fonte em src/js/ e sem entrada em VENDORIZADOS: ${sobrando.join(', ')}`);
    process.exit(1);
  }
}
