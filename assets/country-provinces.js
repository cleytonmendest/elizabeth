/**
 * <country-provinces> — a lista de estados vem do país escolhido.
 *
 * ── O que existia antes ────────────────────────────────────────────────────
 *
 * `templates/customers/addresses.liquid` trazia UM país (`Brasil`, fixo) e os
 * 27 estados brasileiros escritos à mão, duplicados nos dois formulários. Uma
 * loja fora do Brasil não conseguia cadastrar endereço nenhum, e os estados
 * ficavam em português mesmo com a loja em inglês.
 *
 * A Shopify já entrega os dois dados prontos: `all_country_option_tags` emite
 * um `<option>` por país, cada um carregando as províncias daquele país num
 * atributo `data-provinces` — e nos nomes do idioma da loja. Não havia lista a
 * traduzir; havia uma lista a parar de escrever.
 *
 * ── O caso que decide o desenho ────────────────────────────────────────────
 *
 * Metade dos países do mundo não tem província nenhuma (`data-provinces="[]"`).
 * Um `<select required>` vazio ali não é um detalhe estético: o formulário
 * simplesmente não envia, e a pessoa não descobre por quê. Por isso o
 * componente não só preenche o campo — ele o REMOVE do formulário quando o
 * país escolhido não tem províncias, tirando junto o `required`.
 *
 * Sem isso, trocar o país de Brasil para Portugal trocaria um bug ("só dá para
 * cadastrar no Brasil") por outro mais difícil de ver ("o botão salvar não faz
 * nada"). É o que `tests/country-provinces.test.mjs` planta primeiro.
 *
 * ── Sem JavaScript ─────────────────────────────────────────────────────────
 *
 * O país continua funcionando: é um `<select>` nativo com todos os países já
 * no HTML. O estado, não — ele depende deste componente. O template marca o
 * campo com `hidden` e o componente o revela, então quem está sem JS vê um
 * formulário sem estado em vez de um `<select>` vazio que não explica nada. A
 * Shopify aceita endereço sem província para os países que não a exigem.
 */
class CountryProvinces extends HTMLElement {
  connectedCallback() {
    this.pais = this.querySelector('[data-address-country]');
    this.estado = this.querySelector('[data-address-province]');
    this.campo = this.querySelector('[data-address-province-field]');

    // Faltando qualquer uma das três peças, sair calado é melhor que quebrar o
    // formulário inteiro: o país nativo continua funcionando sem nós.
    if (!this.pais || !this.estado || !this.campo) return;

    // A opção vazia é guardada UMA vez, não procurada a cada desenho: redesenhar
    // esvazia o select, e um país sem províncias no meio do caminho levava a
    // placeholder junto — de Portugal para o Canadá o campo voltava sem ela.
    this.placeholder = this.estado.querySelector('option[value=""]');

    // `all_country_option_tags` não sabe qual país está salvo — ele emite a
    // lista inteira sem `selected`. O formulário de edição diz qual é pelo
    // `data-default`, e é aqui que ele volta a ficar escolhido. Sem isto,
    // editar um endereço mostraria o primeiro país da lista, e salvar o
    // MUDARIA sem ninguém ter pedido.
    const salvo = this.pais.dataset.default;
    if (salvo) this.pais.value = salvo;

    this.pais.addEventListener('change', () => this.desenhar());
    this.desenhar(this.estado.dataset.selected);
  }

  /**
   * Redesenha o campo de estado para o país selecionado.
   * @param {string} [preferido] valor a manter selecionado, se ainda existir.
   */
  desenhar(preferido) {
    const escolhido = preferido ?? this.estado.value;
    const provincias = this.provinciasDoPais();

    // Limpar sempre importa: sem isso o formulário mandaria o estado do país
    // anterior junto com o país novo.
    this.estado.innerHTML = '';
    if (this.placeholder) this.estado.append(this.placeholder);

    if (provincias.length === 0) {
      this.campo.hidden = true;
      this.estado.required = false;
      this.estado.value = '';
      return;
    }

    for (const [codigo, nome] of provincias) {
      const opcao = document.createElement('option');
      opcao.value = codigo;
      opcao.textContent = nome;
      this.estado.append(opcao);
    }

    this.campo.hidden = false;
    this.estado.required = true;
    // `value =` num select ignora valor inexistente e deixa o primeiro option
    // selecionado, que é o comportamento certo ao trocar de país.
    if (escolhido) this.estado.value = escolhido;
  }

  /** `[["AC","Acre"], …]` do país selecionado. Lista vazia se não houver. */
  provinciasDoPais() {
    const opcao = this.pais.selectedOptions[0];
    if (!opcao) return [];

    try {
      const lista = JSON.parse(opcao.dataset.provinces || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch {
      // `data-provinces` ilegível é problema da plataforma, não da cliente:
      // esconder o campo deixa o endereço salvável em vez de travar o envio.
      return [];
    }
  }
}

if (!customElements.get('country-provinces')) {
  customElements.define('country-provinces', CountryProvinces);
}
