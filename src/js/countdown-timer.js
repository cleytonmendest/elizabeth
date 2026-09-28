/**
 * Countdown Timer — <countdown-timer>
 * Conta até uma data/hora específica, ancorada no fuso da loja
 * (data-utc-offset): todas as visitantes contam para o MESMO instante,
 * independente do fuso do navegador.
 *
 * Ao zerar, a seção é escondida — sempre. Não existe modo que recomece a
 * contagem: relógio que volta a 24h ao chegar em zero é o "fictitious
 * countdown timer" que a Theme Store proíbe (ADR 0016, issue #146). No editor
 * do tema (designMode) nunca esconde, para o lojista conseguir editar.
 */
class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.showDays = this.dataset.showDays !== 'false';
    this.offsetMin = this.parseOffset(this.dataset.utcOffset);
    this.designMode = !!(window.Shopify && window.Shopify.designMode);

    this.target = this.computeTarget();

    if (this.target === null) {
      // Configuração inválida/incompleta: esconde no storefront, mantém no editor.
      if (!this.designMode) this.hideSection();
      return;
    }

    // O intervalo é agendado ANTES do primeiro tick de propósito: um alvo já
    // vencido faz o tick chamar clearInterval, e ele precisa ter um id para
    // limpar. Na ordem inversa o clearInterval recebia `undefined`, não
    // limpava nada, e o setInterval logo abaixo deixava a seção escondida
    // contando de segundo em segundo para sempre.
    this.interval = setInterval(() => this.tick(), 1000);
    this.tick();
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

  tick() {
    const diff = this.target - Date.now();

    if (diff <= 0) {
      this.render(0);
      if (this.interval) clearInterval(this.interval);
      if (!this.designMode) this.hideSection();
      return;
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
