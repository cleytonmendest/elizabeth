/**
 * Countdown Timer — <countdown-timer>
 * - Modo "fixed": conta até uma data/hora específica (ancorada no fuso da loja).
 * - Modo "daily": reseta todos os dias num horário fixo (recorrente).
 * Todo o alvo é calculado a partir do offset do fuso da loja (data-utc-offset),
 * então todas as visitantes contam para o MESMO instante, independente do fuso
 * do navegador. Ao zerar (modo fixed) a seção é escondida; no editor do tema
 * (designMode) nunca esconde, para o lojista conseguir editar.
 */
class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.mode = this.dataset.mode === 'daily' ? 'daily' : 'fixed';
    this.showDays = this.dataset.showDays !== 'false';
    this.offsetMin = this.parseOffset(this.dataset.utcOffset);
    this.designMode = !!(window.Shopify && window.Shopify.designMode);

    this.target = this.computeTarget();

    if (this.target === null) {
      // Configuração inválida/incompleta: esconde no storefront, mantém no editor.
      if (!this.designMode) this.hideSection();
      return;
    }

    this.tick();
    this.interval = setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    if (this.interval) clearInterval(this.interval);
  }

  /** "-0300" -> -180 (minutos a leste de UTC). Vazio/ inválido -> 0 (UTC). */
  parseOffset(str) {
    const m = String(str || '').match(/^([+-])(\d{2})(\d{2})$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  }

  computeTarget() {
    if (this.mode === 'daily') return this.nextDaily();

    const y = parseInt(this.dataset.year, 10);
    const mo = parseInt(this.dataset.month, 10); // 1-12
    let d = parseInt(this.dataset.day, 10);
    const h = parseInt(this.dataset.hour, 10) || 0;
    const mi = parseInt(this.dataset.minute, 10) || 0;
    if (!y || !mo || !d) return null;

    // Clampa o dia ao último dia válido do mês escolhido — assim datas impossíveis
    // (31/junho, 31/fevereiro) viram o fim do mês em vez de "rolar" ou quebrar.
    // Date.UTC(y, mo, 0) = dia 0 do mês seguinte = último dia do mês "mo".
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d > lastDay) d = lastDay;

    // Date.UTC trata os componentes como UTC; subtrair o offset converte o
    // "relógio de parede" da loja para o instante UTC real.
    return Date.UTC(y, mo - 1, d, h, mi, 0) - this.offsetMin * 60000;
  }

  /** Próxima ocorrência de hour:minute no fuso da loja. */
  nextDaily() {
    const h = parseInt(this.dataset.hour, 10) || 0;
    const mi = parseInt(this.dataset.minute, 10) || 0;
    const now = Date.now();
    const shopNow = new Date(now + this.offsetMin * 60000); // relógio da loja via getUTC*
    let target =
      Date.UTC(shopNow.getUTCFullYear(), shopNow.getUTCMonth(), shopNow.getUTCDate(), h, mi, 0) -
      this.offsetMin * 60000;
    if (target <= now) target += 86400000;
    return target;
  }

  tick() {
    let diff = this.target - Date.now();

    if (diff <= 0) {
      if (this.mode === 'daily') {
        this.target = this.nextDaily();
        diff = this.target - Date.now();
      } else {
        this.render(0);
        if (this.interval) clearInterval(this.interval);
        if (!this.designMode) this.hideSection();
        return;
      }
    }

    this.render(diff);
  }

  render(diff) {
    const totalSec = Math.floor(diff / 1000);
    let days = Math.floor(totalSec / 86400);
    let rem = totalSec - days * 86400;
    let hours = Math.floor(rem / 3600);
    rem -= hours * 3600;
    const minutes = Math.floor(rem / 60);
    const seconds = rem - minutes * 60;

    if (!this.showDays) {
      hours += days * 24; // sem "Dias": acumula tudo em horas
      days = 0;
    }

    this.set('days', days);
    this.set('hours', hours);
    this.set('minutes', minutes);
    this.set('seconds', seconds);
  }

  set(unit, val) {
    const el = this.querySelector('[data-unit="' + unit + '"] [data-value]');
    if (el) el.textContent = String(val).padStart(2, '0');
  }

  hideSection() {
    const section = this.closest('.shopify-section') || this;
    section.setAttribute('hidden', '');
  }
}

if (!customElements.get('countdown-timer')) {
  customElements.define('countdown-timer', CountdownTimer);
}
