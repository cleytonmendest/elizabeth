/*
 * <price-component> — repinta o preço que `snippets/price-v2.liquid` pintou.
 *
 * Duas escolhas da cliente mudam o preço, e cada uma chega por um evento no
 * `[product-context]` — o componente não pergunta nada a ninguém:
 *
 *   variant:change       detail.variant: a variante, de <variant-selects>
 *   selling-plan:change  detail.prices: o preço da variante na compra
 *                        escolhida (plano ou compra única), de
 *                        <selling-plan-picker>; `null` quando a variante não
 *                        tem aquele plano
 *
 * Os dois detalhes têm a mesma forma — `price`, `compare_at_price`,
 * `unit_price`, `unit_price_measurement` e, no plano, `per_delivery_price` —,
 * então pintar é uma coisa só. Na troca de variante com um plano marcado, o
 * seletor de plano republica DEPOIS de `variant:change` (ver
 * src/js/selling-plan-picker.js), e o preço do plano é o que fica.
 *
 * `formatMoney` é global e vem de `assets/money.js` (ADR 0010).
 *
 * Co-locado: `snippets/price-v2.liquid` renderiza a tag, então o arquivo só
 * pesa onde há preço de variante (PDP, produto em destaque, barra fixa, style
 * guide) — e pode ser injetado MAIS DE UMA VEZ na mesma página (PDP + barra
 * fixa; e o editor re-injeta a cada mudança de setting). Por isso a classe
 * mora DENTRO da guarda: num script clássico, uma `class` no topo declarada
 * de novo por uma segunda execução é SyntaxError, e a guarda sozinha não
 * chegaria a rodar.
 */
if (!customElements.get('price-component')) {
    class PriceComponent extends HTMLElement {
        connectedCallback() {
            // Seleciona os elementos internos uma vez
            this.listingPriceElement = this.querySelector('.listing-price');
            this.sellingPriceElement = this.querySelector('.selling-price');
            this.unitPriceElement = this.querySelector('[data-unit-price]');
            this.perDeliveryElement = this.querySelector('[data-per-delivery]');

            // Encontra o contexto para escutar o evento
            this.productContext = this.closest('[product-context]');

            if (!this.productContext) {
                console.warn('PriceComponent: Contexto do produto [product-context] não encontrado.');
                return;
            }

            // `undefined` em `variant:change` é a combinação que não existe: o
            // preço que estava fica, e quem avisa é o botão de comprar.
            this.productContext.addEventListener('variant:change', (event) => this._paint(event.detail.variant));
            this.productContext.addEventListener('selling-plan:change', (event) => this._paint(event.detail.prices));
        };

        _paint(source) {
            if (!source) return;
            this._updatePriceDisplay(source.price, source.compare_at_price);
            this._updateUnitPrice(source.unit_price, source.unit_price_measurement);

            // Plano pré-pago: o preço é o total, e esta linha diz quanto sai cada
            // entrega. Igual ao preço (ou compra única, que nem tem o campo): some.
            const perDelivery = source.per_delivery_price;
            this._toggle(this.perDeliveryElement, perDelivery != null && perDelivery !== source.price, '[data-per-delivery-amount]', perDelivery);
        };

        _updatePriceDisplay(price, compare_at_price) {
            //Altera preço
            if (!this.sellingPriceElement) return;
            this.sellingPriceElement.textContent = formatMoney(price);

            //Altera compare_at_price
            if (!this.listingPriceElement) return;
            const listingPrice = compare_at_price > price
            this.listingPriceElement.classList.toggle('hidden', !listingPrice)
            this.listingPriceElement.textContent = formatMoney(compare_at_price);
        };

        /**
         * "R$ 12,90/100ml" — issue #136. Variante sem medida esconde a linha
         * inteira (sem vão), e a próxima que tiver a mostra de novo. O 1 da
         * referência some ("/kg"), como em snippets/price-unit.liquid.
         */
        _updateUnitPrice(unitPrice, measurement) {
            const hasUnitPrice = this._toggle(this.unitPriceElement, measurement && unitPrice != null, '[data-unit-price-amount]', unitPrice);
            if (!hasUnitPrice) return;
            const value = Number(measurement.reference_value) === 1 ? '' : measurement.reference_value;
            this.unitPriceElement.querySelector('[data-unit-price-reference]').textContent = value + measurement.reference_unit;
        };

        /** Mostra ou esconde uma linha opcional e escreve o valor nela. */
        _toggle(element, visible, amountSelector, amount) {
            if (!element) return false;
            element.classList.toggle('hidden', !visible);
            if (visible) element.querySelector(amountSelector).textContent = formatMoney(amount);
            return Boolean(visible);
        };
    }

    customElements.define('price-component', PriceComponent);
}
