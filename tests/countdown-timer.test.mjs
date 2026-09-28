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
 *
 * E o contador sempre ACABA. Até a #146 havia um modo "daily" que, ao zerar,
 * recomeçava para o dia seguinte — o "fictitious countdown timer" que a
 * Theme Store reprova. Os testes daqui não verificam só que ele funciona: eles
 * exigem que ele não afirme urgência que não termina (ADR 0016).
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

const emUmaHora = {
  'data-utc-offset': SAO_PAULO,
  'data-year': 2026,
  'data-month': 8,
  'data-day': 30,
  'data-hour': 10, // 10:00 na loja (-03:00) = 13:00 UTC = daqui a 1 hora
  'data-minute': 0,
};

describe('contagem até a data', () => {
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
    monta({ 'data-utc-offset': SAO_PAULO, 'data-hour': 10 });

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

describe('ao zerar, esconde a seção — em toda configuração', () => {
  // A #146: um modo "daily" recomeçava a contagem para o dia seguinte e
  // exibia "Oferta por tempo limitado" com um relógio que nunca acabava. Este
  // bloco não pergunta se o contador funciona; pergunta se ele ACABA. Cada
  // linha abaixo chega a zero daqui a um minuto, e todas precisam terminar do
  // mesmo jeito — inclusive a marcação antiga que ainda dizia `daily`.
  //
  // 09:01 na loja (-03:00) = 12:01 UTC = daqui a 1 minuto.
  const umMinuto = { ...emUmaHora, 'data-hour': 9, 'data-minute': 1 };

  it.each([
    ['com dias', umMinuto],
    ['sem dias', { ...umMinuto, 'data-show-days': 'false' }],
    ['num fuso a leste (+05:30)', { ...umMinuto, 'data-utc-offset': '+0530', 'data-hour': 17, 'data-minute': 31 }],
    ['sem offset (conta em UTC)', { 'data-year': 2026, 'data-month': 8, 'data-day': 30, 'data-hour': 12, 'data-minute': 1 }],
    ['marcação antiga com data-mode="fixed"', { ...umMinuto, 'data-mode': 'fixed' }],
    ['marcação antiga com data-mode="daily"', { ...umMinuto, 'data-mode': 'daily' }],
  ])('%s', (_nome, dataset) => {
    monta(dataset);
    // A linha precisa estar mesmo a um minuto do alvo — senão o resto do teste
    // mede outra coisa.
    expect(lido()).toBe('00:00:01:00');
    expect(secao().hasAttribute('hidden')).toBe(false);

    vi.advanceTimersByTime(60 * 1000); // chega no alvo

    expect(lido()).toBe('00:00:00:00');
    expect(secao().hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    // E continua acabado: nada volta a contar no dia seguinte.
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(lido()).toBe('00:00:00:00');
    expect(secao().hasAttribute('hidden')).toBe(true);
  });
});

describe('loja que tinha salvo o modo diário antes da #146', () => {
  // O setting `countdown_type` saiu do schema e o Liquid não emite mais
  // `data-mode`. A loja que escolheu "Diária" passa a renderizar o que está
  // guardado nos campos de data — que nunca foram apagados, só ignorados
  // naquele modo. O atributo continua aqui para provar que, se chegar (uma
  // cópia antiga da section, uma página em cache), ele não traz o reinício de
  // volta: é ignorado.
  const legado = { 'data-mode': 'daily', 'data-utc-offset': SAO_PAULO };

  it('sem data válida: esconde na loja, sem tentar contar', () => {
    monta({ ...legado, 'data-hour': 14 });

    expect(secao().hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sem data válida, no editor: continua visível para a lojista escolher a data', () => {
    window.Shopify.designMode = true;
    monta({ ...legado, 'data-hour': 14 });

    expect(secao().hasAttribute('hidden')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('com data: conta até a data, não até o horário de hoje', () => {
    // O modo diário contaria 1 hora (10:00 de hoje); a data guardada é 02/09.
    monta({ ...emUmaHora, ...legado, 'data-month': 9, 'data-day': 2 });

    expect(lido()).toBe('03:01:00:00');
  });

  it('com data vencida: esconde em vez de pular para amanhã', () => {
    // O modo diário mostraria 23 horas, até as 08:00 de amanhã.
    monta({ ...emUmaHora, ...legado, 'data-year': 2020, 'data-hour': 8 });

    expect(secao().hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('ciclo de vida', () => {
  it('remover o elemento para o intervalo', () => {
    const el = monta(emUmaHora);
    expect(vi.getTimerCount()).toBe(1);

    el.remove();

    expect(vi.getTimerCount()).toBe(0);
  });
});
