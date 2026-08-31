/**
 * assets/countdown-timer.js — <countdown-timer>.
 *
 * O ponto do componente é que TODAS as visitantes contem para o MESMO
 * instante: a data vem do relógio de parede da loja (`data-utc-offset`), não
 * do fuso do navegador. Um erro aqui não aparece para quem desenvolve — só
 * para quem está em outro fuso.
 *
 * O relógio é congelado nos testes (`vi.setSystemTime`): um contador testado
 * contra o relógio real é um teste que muda de resultado sozinho.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('countdown-timer.js');

// Meio-dia UTC = 09:00 no relógio da loja em -03:00.
const AGORA = new Date('2026-08-30T12:00:00Z');
const SAO_PAULO = '-0300';

function monta(dataset = {}) {
  const attrs = Object.entries(dataset)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  document.body.innerHTML = `
    <div class="shopify-section">
      <countdown-timer ${attrs}>
        <div data-unit="days"><span data-value>00</span></div>
        <div data-unit="hours"><span data-value>00</span></div>
        <div data-unit="minutes"><span data-value>00</span></div>
        <div data-unit="seconds"><span data-value>00</span></div>
      </countdown-timer>
    </div>`;
  return document.querySelector('countdown-timer');
}

const lido = () =>
  ['days', 'hours', 'minutes', 'seconds']
    .map((u) => document.querySelector(`[data-unit="${u}"] [data-value]`).textContent)
    .join(':');

const secao = () => document.querySelector('.shopify-section');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  window.Shopify = { designMode: false };
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  delete window.Shopify;
});

describe('parseOffset', () => {
  const parse = (str) => monta().parseOffset(str);

  it('lê o offset no formato da Shopify', () => {
    expect(parse('-0300')).toBe(-180);
    expect(parse('+0530')).toBe(330);
    expect(parse('+0000')).toBe(0);
  });

  it('cai em UTC quando o valor não vem ou não faz sentido', () => {
    // O Liquid pode não ter o dado; contar em UTC é errado por horas, mas é
    // consistente entre visitantes — que é o que importa.
    expect(parse(undefined)).toBe(0);
    expect(parse('')).toBe(0);
    expect(parse('-3')).toBe(0);
    expect(parse('abacaxi')).toBe(0);
  });
});

describe('modo fixed', () => {
  const emUmaHora = {
    'data-mode': 'fixed',
    'data-utc-offset': SAO_PAULO,
    'data-year': 2026,
    'data-month': 8,
    'data-day': 30,
    'data-hour': 10, // 10:00 na loja (-03:00) = 13:00 UTC = daqui a 1 hora
    'data-minute': 0,
  };

  it('conta a partir do relógio da loja, não do navegador', () => {
    monta(emUmaHora);
    expect(lido()).toBe('00:01:00:00');
  });

  it('anda de segundo em segundo', () => {
    monta(emUmaHora);

    vi.advanceTimersByTime(1000);
    expect(lido()).toBe('00:00:59:59');

    vi.advanceTimersByTime(59 * 1000);
    expect(lido()).toBe('00:00:59:00');
  });

  it('preenche cada unidade com dois dígitos', () => {
    monta({ ...emUmaHora, 'data-hour': 9, 'data-minute': 5 });
    // 09:05 na loja = 5 minutos à frente.
    expect(lido()).toBe('00:00:05:00');
  });

  it('mostra os dias quando a data está longe', () => {
    monta({ ...emUmaHora, 'data-month': 9, 'data-day': 2, 'data-hour': 9 });
    // 02/09 09:00 na loja - 30/08 09:00 na loja = 3 dias exatos.
    expect(lido()).toBe('03:00:00:00');
  });

  it('sem "Dias", as horas acumulam em vez de sumir', () => {
    monta({ ...emUmaHora, 'data-month': 9, 'data-day': 2, 'data-hour': 9, 'data-show-days': 'false' });
    expect(lido()).toBe('00:72:00:00');
  });

  it('data impossível vira o último dia do mês em vez de rolar para o mês seguinte', () => {
    // 31 de fevereiro não existe. Rolar daria 03/03; o componente clampa em 28.
    const el = monta({ ...emUmaHora, 'data-year': 2027, 'data-month': 2, 'data-day': 31 });
    expect(el.computeTarget()).toBe(Date.UTC(2027, 1, 28, 10, 0, 0) + 180 * 60000);
  });

  it('data passada: zera, esconde a seção e para o intervalo', () => {
    monta({ ...emUmaHora, 'data-year': 2020 });

    expect(lido()).toBe('00:00:00:00');
    expect(secao().hasAttribute('hidden')).toBe(true);

    // Sem o clearInterval, a seção escondida continuaria consumindo um tick
    // por segundo em toda página onde a section estiver publicada.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('alvo exatamente no instante atual já nasce zerado', () => {
    monta({ ...emUmaHora, 'data-hour': 9, 'data-minute': 0 });
    // 09:00 na loja = exatamente agora → já nasce zerado.
    expect(secao().hasAttribute('hidden')).toBe(true);
  });

  it('configuração incompleta esconde a seção sem tentar contar', () => {
    // Sem ano/mês/dia não há alvo. Deixar o markup na página mostraria
    // "00:00:00:00" para sempre.
    monta({ 'data-mode': 'fixed', 'data-utc-offset': SAO_PAULO, 'data-hour': 10 });

    expect(secao().hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('no editor do tema a seção nunca some', () => {
    // Se sumisse, a lojista não teria como clicar nela para corrigir a data.
    window.Shopify.designMode = true;
    monta({ ...emUmaHora, 'data-year': 2020 });

    expect(secao().hasAttribute('hidden')).toBe(false);
  });
});

describe('modo daily', () => {
  const diario = (hora, minuto = 0) => ({
    'data-mode': 'daily',
    'data-utc-offset': SAO_PAULO,
    'data-hour': hora,
    'data-minute': minuto,
  });

  it('conta até o horário de hoje quando ele ainda não passou', () => {
    monta(diario(10)); // são 09:00 na loja
    expect(lido()).toBe('00:01:00:00');
  });

  it('horário já passado hoje vira o de amanhã', () => {
    monta(diario(8)); // 08:00 na loja já passou
    expect(lido()).toBe('00:23:00:00');
  });

  it('ao zerar, reinicia para o dia seguinte em vez de esconder a seção', () => {
    // É a diferença entre os dois modos: "fixed" é uma data que acaba,
    // "daily" é um prazo que se repete (ex.: "peça até as 14h e enviamos hoje").
    monta(diario(9, 1)); // 09:01 na loja = daqui a 1 minuto

    vi.advanceTimersByTime(60 * 1000); // chega no alvo

    expect(secao().hasAttribute('hidden')).toBe(false);
    // 24h cheias até a próxima ocorrência — "01 dia", não "24 horas".
    expect(lido()).toBe('01:00:00:00');
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('ciclo de vida', () => {
  it('remover o elemento para o intervalo', () => {
    const el = monta({
      'data-mode': 'daily',
      'data-utc-offset': SAO_PAULO,
      'data-hour': 23,
    });
    expect(vi.getTimerCount()).toBe(1);

    el.remove();

    expect(vi.getTimerCount()).toBe(0);
  });
});
