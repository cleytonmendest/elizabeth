/*
 * <selling-plan-picker> — compra única ou plano. Issue #135.
 *
 * O markup (`snippets/selling-plan-picker.liquid`) já faz o essencial sem JS:
 * os radios se chamam `selling_plan` e moram dentro do form de produto, então
 * o submit leva o plano. O que este componente acrescenta é o PREÇO: a cada
 * troca, ele publica no `[product-context]`
 *
 *   selling-plan:change  { sellingPlanId, variantId, prices }
 *
 * em que `prices` é a linha da tabela variante × plano que o Liquid escreveu
 * (`price`, `compare_at_price`, `per_delivery_price`, `unit_price`,
 * `unit_price_measurement`). Variante que não tem o plano marcado recebe a
 * linha da compra única: mostrar o preço de um plano que ela não oferece seria
 * pior que mostrar o dela. `sellingPlanId` é `null` na compra única. Quem pinta
 * é o <price-component>; nenhum dos dois consulta o DOM do outro.
 *
 * O plano escolhido PERSISTE na troca de variante porque ninguém mexe nos
 * radios: o que muda é a linha da tabela, e por isso este componente escuta
 * `variant:change` e republica com a variante nova.
 *
 * Essa republicação espera uma microtarefa, e é de propósito. O
 * <price-component> também escuta `variant:change` e pinta o preço de compra
 * única da variante; a ordem entre dois ouvintes do mesmo evento é a ordem em
 * que se registraram, que depende de qual script o navegador definiu antes.
 * Publicando depois que o despacho inteiro termina, o preço do plano é sempre
 * o ÚLTIMO a ser pintado — e a microtarefa roda antes da próxima pintura, então
 * o preço intermediário nunca chega à tela.
 *
 * Co-locado (só PDP com plano). A classe fica DENTRO da guarda: o editor de
 * tema re-injeta asset co-locado, e uma segunda declaração de `class` no topo
 * de um script clássico lança.
 */
if (!customElements.get('selling-plan-picker')) {
    class SellingPlanPicker extends HTMLElement {
        connectedCallback() {
            this.productContext = this.closest('[product-context]');
            this.variantId = this.dataset.variantId;
            this.prices = this._readPrices();

            this.changeHandler = () => this.publish();
            this.variantChangeHandler = this._onVariantChange.bind(this);

            this.addEventListener('change', this.changeHandler);
            if (this.productContext) {
                this.productContext.addEventListener('variant:change', this.variantChangeHandler);
            } else {
                console.warn('SellingPlanPicker: Contexto do produto [product-context] não encontrado.');
            }

            this.publish();

            // Este script é co-locado e vem ANTES dos globais no documento: na
            // primeira publicação o <price-component> pode ainda não estar
            // escutando. E o navegador restaura o radio marcado ao voltar para
            // a página, depois de o Liquid ter pintado o preço do estado
            // inicial. Os dois se resolvem publicando de novo quando o parse
            // termina — `defer` roda antes do DOMContentLoaded.
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.publish(), { once: true });
            }
        }

        disconnectedCallback() {
            this.removeEventListener('change', this.changeHandler);
            if (this.productContext) {
                this.productContext.removeEventListener('variant:change', this.variantChangeHandler);
            }
        }

        _readPrices() {
            const script = this.querySelector('[data-selling-plan-prices]');
            if (!script) return {};
            try {
                return JSON.parse(script.textContent);
            } catch (error) {
                console.error('SellingPlanPicker: JSON de preços inválido.', error);
                return {};
            }
        }

        _onVariantChange(event) {
            const variant = event.detail && event.detail.variant;
            if (!variant) return;
            this.variantId = String(variant.id);
            queueMicrotask(() => this.publish());
        }

        /** O `value` do radio marcado; compra única é o radio de valor vazio. */
        get sellingPlanId() {
            const checked = this.querySelector('input[name="selling_plan"]:checked');
            return checked && checked.value ? checked.value : null;
        }

        publish() {
            if (!this.productContext) return;

            const sellingPlanId = this.sellingPlanId;
            const variantPrices = this.prices[this.variantId] || {};

            this.productContext.dispatchEvent(
                new CustomEvent('selling-plan:change', {
                    detail: {
                        sellingPlanId,
                        variantId: this.variantId,
                        prices: variantPrices[sellingPlanId || ''] || variantPrices[''] || null,
                    },
                })
            );
        }
    }

    customElements.define('selling-plan-picker', SellingPlanPicker);
}
