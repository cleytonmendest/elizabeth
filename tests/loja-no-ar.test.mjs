/**
 * A sonda consegue reprovar?
 *
 * Este arquivo não testa a loja — testa o VERIFICADOR da loja, pela mesma
 * razão que `e2e/gate.spec.mjs` testa o axe em vez do tema. A sonda anterior
 * passava com a loja trancada; uma sonda nova sem teste teria a mesma forma de
 * defeito, só com um regex diferente.
 *
 * Os dois casos que importam estão plantados aqui contra um servidor HTTP de
 * verdade: a página do tema (tem que passar) e a tela de senha da Shopify
 * (tem que reprovar). As duas respondem 200 — é essa a armadilha.
 */
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { esperarLoja, ehOTema, diagnosticarLog, MARCA_DO_TEMA } from '../scripts/loja-no-ar.mjs';

/** Uma página como o layout/theme.liquid entrega: tem a marca. */
const PAGINA_DO_TEMA = `<!doctype html><html lang="pt-BR"><head><title>Loja</title></head>
<body><script>
  window.shopUrl = 'https://loja.myshopify.com';
  window.routes = { cart_url: '/cart' };
</script><main>produtos</main></body></html>`;

/**
 * A tela de senha da Shopify, no que importa: responde 200, tem `#password`,
 * e NÃO passa pelo nosso layout — então não tem a marca. Foi exatamente ela
 * que o axe mediu durante 80 segundos achando que era o tema.
 */
const TELA_DE_SENHA = `<!doctype html><html lang="en"><head><title>Password</title></head>
<body><form method="post" action="/password">
  <input type="password" id="password" name="password">
  <button>Entrar</button>
</form></body></html>`;

let servidor = null;

function servir(corpo, { status = 200 } = {}) {
  return new Promise((resolve) => {
    servidor = http.createServer((_req, res) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(corpo);
    });
    servidor.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${servidor.address().port}/`);
    });
  });
}

afterEach(() => {
  if (servidor) servidor.close();
  servidor = null;
});

const rapido = { timeoutMs: 300, intervaloMs: 50 };

describe('a sonda distingue o tema de qualquer outra coisa que responda 200', () => {
  it('a página do tema passa', async () => {
    const url = await servir(PAGINA_DO_TEMA);
    await expect(esperarLoja({ url, ...rapido })).resolves.toEqual({ ok: true });
  });

  it('a tela de senha da Shopify REPROVA, mesmo respondendo 200', async () => {
    const url = await servir(TELA_DE_SENHA);
    const { ok, erros } = await esperarLoja({ url, ...rapido });

    expect(ok).toBe(false);

    // O recado precisa das DUAS metades, senão o próximo a ver isto gasta as
    // mesmas duas horas. Um mutante provou que checar só a segunda não basta:
    // "proteção por senha" aparece nas duas frases, então apagar a explicação
    // deixava este teste verde.
    const recado = erros.join(' ');
    // (a) POR QUE aconteceu — a armadilha do 200.
    expect(recado).toMatch(/serve a tela de senha com 200/i);
    // (b) O QUE FAZER — onde a senha mora.
    expect(recado).toContain('SHOPIFY_STORE_PASSWORD');
  });

  it('o recado do caso "não é o tema" carrega a evidência, não só a acusação', async () => {
    const url = await servir(TELA_DE_SENHA);
    const { erros } = await esperarLoja({ url, ...rapido });
    const recado = erros.join(' ');

    expect(recado).toContain('HTTP 200');
    expect(recado).toContain(MARCA_DO_TEMA);
    // Um pedaço do que veio, para o diagnóstico não depender de adivinhação.
    expect(recado).toContain('Password');
  });

  it('uma página do tema que responde 404 ainda é o tema (a 404 usa o layout)', async () => {
    const url = await servir(PAGINA_DO_TEMA, { status: 404 });
    await expect(esperarLoja({ url, ...rapido })).resolves.toEqual({ ok: true });
  });
});

describe('a sonda separa "ninguém respondeu" de "respondeu errado"', () => {
  it('sem ninguém escutando, o recado NÃO acusa a senha', async () => {
    // Porta fechada de propósito: nada sobe aqui.
    const { ok, erros } = await esperarLoja({ url: 'http://127.0.0.1:9/', ...rapido });

    expect(ok).toBe(false);
    expect(erros.join(' ')).toMatch(/Nada respondeu/i);
    expect(erros.join(' ')).not.toMatch(/proteção por senha/i);
  });

  it('processo morto reprova na hora, sem gastar o timeout', async () => {
    const inicio = Date.now();
    const { ok, erros } = await esperarLoja({
      url: 'http://127.0.0.1:9/',
      pid: 2 ** 30, // PID que não existe
      lerLog: () => 'Invalid API key or access token',
      timeoutMs: 5_000,
      intervaloMs: 50,
    });

    expect(ok).toBe(false);
    expect(erros[0]).toMatch(/morreu antes de servir/i);
    expect(Date.now() - inicio).toBeLessThan(1_000);
  });
});

describe('o log do CLI vira recado acionável', () => {
  it('401 aponta o secret do Theme Access', () => {
    expect(diagnosticarLog('Invalid API key or access token').join(' ')).toContain('shptka_');
  });

  it('prompt de senha aponta onde a senha mora no admin', () => {
    expect(diagnosticarLog('Enter your store password:').join(' ')).toContain(
      'SHOPIFY_STORE_PASSWORD'
    );
  });

  it('loja inexistente aponta o formato do domínio', () => {
    expect(diagnosticarLog('Store not found').join(' ')).toContain('myshopify.com');
  });

  it('log que não bate com nada não inventa recado', () => {
    expect(diagnosticarLog('subindo o tema, 12 arquivos')).toEqual([]);
    expect(diagnosticarLog('')).toEqual([]);
  });
});

describe('a marca do tema', () => {
  it('reconhece o layout e recusa markup que não passou por ele', () => {
    expect(ehOTema(PAGINA_DO_TEMA)).toBe(true);
    expect(ehOTema(TELA_DE_SENHA)).toBe(false);
    expect(ehOTema('')).toBe(false);
    expect(ehOTema(undefined)).toBe(false);
  });
});
