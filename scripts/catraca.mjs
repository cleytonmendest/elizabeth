#!/usr/bin/env node
/**
 * A catraca: a dívida registrada só pode cair.
 *
 *   node scripts/catraca.mjs --base-ref main
 *
 * ── Por que isto saiu do ci.yml ────────────────────────────────────────────
 *
 * A catraca do lint morava num bloco de shell dentro do workflow, e o próprio
 * bloco contava, em comentário, que uma versão anterior dele comparava o total
 * CONSIGO MESMO e passava sem verificar nada. É a mesma forma de defeito da
 * sonda da loja: um verificador que não conseguia falhar. A sonda virou
 * `scripts/loja-no-ar.mjs` COM TESTE por essa razão; esta é a mesma mudança.
 *
 * Shell dentro de YAML não tem teste, não roda na máquina de ninguém, e só é
 * exercitado no dia em que já está errado.
 *
 * ── Por que existem DUAS catracas aqui ─────────────────────────────────────
 *
 * O CLAUDE.md afirmava que a acessibilidade seguia "a mesma regra do lint".
 * Seguia pela metade. A regra tem dois lados:
 *
 *   1. violação NOVA reprova       — o lint faz; e2e/a11y.spec.mjs também
 *   2. o baseline não pode CRESCER — só o lint tinha
 *
 * `npm run test:e2e:baseline` está documentado e no package.json. Quem
 * rodasse, commitasse um `a11y-baseline.json` maior e abrisse PR passava
 * verde: nenhum passo lia esse arquivo. Agora os dois passam por aqui.
 *
 * ── O número é DERIVADO, nunca lido ────────────────────────────────────────
 *
 * Os dois arquivos carregam um campo de total (`total`, `_total`) escrito pelo
 * mesmo comando que escreve o conteúdo. Confiar nele é confiar em quem grava:
 * um `"total": 0` editado à mão passava na versão em shell. Aqui o total sai
 * de contar o conteúdo, então o campo pode mentir sem consequência.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * Uma catraca: onde mora o número, como contá-lo, e o que legitima crescer.
 *
 * `cobertura` é a única exceção: melhorar um verificador encontra violações
 * que sempre existiram e ninguém via. Isso é dívida escondida virando visível,
 * não dívida nova. O sinal é objetivo — o diff tocou o verificador?
 */
export const CATRACAS = [
  {
    nome: 'lint',
    arquivo: 'scripts/lint/config/baseline.json',
    contar: (json) => (json.fingerprints ?? []).length,
    cobertura: ['scripts/lint/rules/'],
    comoRegravar: 'npm run lint:baseline',
  },
  {
    nome: 'a11y',
    arquivo: 'e2e/a11y-baseline.json',
    contar: (json) => Object.keys(json.violacoes ?? {}).length,
    cobertura: ['e2e/helpers/axe.mjs', 'e2e/a11y.spec.mjs'],
    comoRegravar: 'npm run test:e2e:baseline',
  },
];

/** O diff tocou algum dos caminhos que legitimam crescimento? */
export function tocouCobertura(arquivosMudados, prefixos) {
  return arquivosMudados.some((arquivo) =>
    prefixos.some((prefixo) => arquivo === prefixo || arquivo.startsWith(prefixo))
  );
}

/**
 * O veredito de uma catraca. Pura: recebe dois números e um booleano, devolve
 * `{ ok, nivel, mensagem }`. É a parte onde dá para errar em silêncio — e já
 * se errou —, então é a parte que tem teste.
 */
export function avaliar({ nome, base, atual, cobertura = false, comoRegravar = '' }) {
  if (atual <= base) {
    return { ok: true, nivel: 'ok', mensagem: `${nome}: ${base} → ${atual} item(ns).` };
  }

  if (cobertura) {
    return {
      ok: true,
      nivel: 'cobertura',
      mensagem:
        `${nome}: o baseline subiu de ${base} para ${atual} itens, mas o verificador mudou neste ` +
        'PR — crescimento tratado como cobertura nova, não dívida nova. Confirme no corpo do PR ' +
        'que o tema não piorou.',
    };
  }

  return {
    ok: false,
    nivel: 'cresceu',
    mensagem:
      `${nome}: o baseline cresceu de ${base} para ${atual} itens sem nenhuma mudança no ` +
      `verificador. Dívida técnica só pode diminuir — corrija a violação em vez de registrá-la. ` +
      `(Regravar com "${comoRegravar}" só é legítimo depois de REDUZIR o número.)`,
  };
}

/**
 * Fingerprints registradas no baseline que nenhuma regra produz mais.
 *
 * Duas causas, e as duas precisam aparecer:
 *   · dívida já paga que ninguém regravou — o número publicado pelo
 *     `npm run status` vira ficção, e sobra folga para dívida nova entrar
 *     debaixo do total antigo sem a catraca notar;
 *   · uma linha adicionada à mão para silenciar uma violação nova — que passa
 *     nos dois lados da catraca, porque o lint a vê como conhecida e o total
 *     não cresce se você apagar junto uma entrada já paga.
 *
 * O cabeçalho do baseline.json PEDE que ninguém edite à mão. Pedido é o que
 * este repositório substitui por verificação.
 */
export function fantasmas(registradas, presentes) {
  return [...registradas].filter((fingerprint) => !presentes.has(fingerprint)).sort();
}

/**
 * Antes de comparar números, decidir se há o que comparar. A tabela existe
 * porque cada linha dela é um jeito de a catraca sumir sem ninguém notar.
 *
 *   na base   aqui   adicionado no diff   →  o que é
 *   ───────────────────────────────────────────────────────────────────────
 *      não     não          –                não existe catraca ainda
 *      sim     sim          –                comparar os totais (o caso normal)
 *      sim     não          –                APAGARAM o baseline neste PR
 *      não     sim         sim               baseline nascendo aqui
 *      não     sim         não               a base não é a que se pensa
 *
 * A última linha é a que importa: um arquivo que existe aqui, não existe na
 * base, e que o diff não adicionou, significa que ele foi apagado NA BASE — ou
 * que `origin/<base>` aponta para outro lugar. Tratar isso como "baseline
 * novo" seria trocar a catraca por um aviso justamente quando ela sumiu.
 */
export function presenca({ nome, arquivo, naBase, aqui, adicionado, baseRef = 'main' }) {
  if (!naBase && !aqui) {
    return { ok: true, nivel: 'ausente', mensagem: `${nome}: sem baseline na base nem aqui.` };
  }

  if (naBase && aqui) return { ok: true, nivel: 'comparar', mensagem: '' };

  if (naBase && !aqui) {
    return {
      ok: false,
      nivel: 'sumiu',
      mensagem:
        `${nome}: ${arquivo} existe em origin/${baseRef} e sumiu neste PR. Apagar o baseline é ` +
        'o jeito mais barato de fazer a catraca sumir junto.',
    };
  }

  if (adicionado) {
    return {
      ok: true,
      nivel: 'novo',
      mensagem: `${nome}: baseline nascendo neste PR. Daqui só pode cair.`,
    };
  }

  return {
    ok: false,
    nivel: 'basefalsa',
    mensagem:
      `${nome}: ${arquivo} existe aqui, não existe em origin/${baseRef}, e o diff não o ` +
      'adicionou — então ele foi apagado na base, ou a ref aponta para outro lugar. Em nenhum ' +
      'dos dois casos a catraca está medindo o que diz medir.',
  };
}

// ---------------------------------------------------------------------------

const git = (args, opcoes = {}) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opcoes });

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? padrao : process.argv[i + 1];
}

const anotar = (nivel, texto) =>
  console.log(process.env.CI ? `::${nivel}::${texto}` : `[${nivel}] ${texto}`);

function main() {
  const baseRef = argumento('base-ref') || 'main';

  // Ler a base NÃO pode falhar em silêncio. A versão em shell caía para
  // `|| echo "$total"` quando o `git show` não achava a ref — o que acontecia
  // SEMPRE, porque o checkout raso não traz `origin/main`. O passo comparava o
  // total consigo mesmo, passava, e não verificava nada. Uma catraca que
  // sempre passa é pior que nenhuma: ela dá a impressão de estar guardando.
  try {
    git(['rev-parse', '--verify', `origin/${baseRef}`]);
  } catch (error) {
    anotar(
      'error',
      `Não consegui resolver origin/${baseRef} — a catraca não pôde ser verificada. ` +
        'Passar assim seria fingir que verificou. (No CI: actions/checkout precisa de ' +
        `fetch-depth: 0.) ${error.message}`
    );
    return 1;
  }

  // `--name-status` e não `--name-only`: a letra distingue um baseline que
  // NASCE neste PR de um que sumiu da base, e a tabela em `presenca()` precisa
  // dessa diferença.
  const diff = git(['diff', '--name-status', `origin/${baseRef}...HEAD`])
    .split('\n')
    .map((linha) => linha.split('\t'))
    .filter(([status, arquivo]) => status && arquivo);

  const mudados = diff.map(([, arquivo]) => arquivo);
  const adicionados = new Set(diff.filter(([s]) => s.startsWith('A')).map(([, a]) => a));

  let falhou = false;

  const relatar = (veredito) => {
    if (veredito.nivel === 'ok' || veredito.nivel === 'ausente') console.log(veredito.mensagem);
    else anotar(veredito.ok ? 'warning' : 'error', veredito.mensagem);
    if (!veredito.ok) falhou = true;
  };

  for (const { nome, arquivo, contar, cobertura, comoRegravar } of CATRACAS) {
    let cruBase = null;
    try {
      // stderr capturado, não herdado: a ausência do caminho é um desfecho
      // previsto aqui, e o `fatal:` do git no meio do log só confunde quem lê.
      cruBase = git(['show', `origin/${baseRef}:${arquivo}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      // A ref existe (checada acima), então o que falta é o CAMINHO nela.
    }

    const onde = presenca({
      nome,
      arquivo,
      naBase: cruBase !== null,
      aqui: fs.existsSync(arquivo),
      adicionado: adicionados.has(arquivo),
      baseRef,
    });

    if (onde.nivel !== 'comparar') {
      relatar(onde);
      continue;
    }

    relatar(
      avaliar({
        nome,
        base: contar(JSON.parse(cruBase)),
        atual: contar(JSON.parse(fs.readFileSync(arquivo, 'utf8'))),
        cobertura: tocouCobertura(mudados, cobertura),
        comoRegravar,
      })
    );
  }

  return falhou ? 1 : 0;
}

// Só executa quando chamado direto; importar para teste não dispara nada.
if (process.argv[1] && process.argv[1].endsWith('catraca.mjs')) {
  process.exit(main());
}
