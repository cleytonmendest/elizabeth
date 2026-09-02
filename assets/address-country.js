/**
 * <address-country> — o formulário de endereço segue o país escolhido.
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
 * ── A segunda metade: o que é brasileiro fica marcado como brasileiro ──────
 *
 * Corrigir o motor e deixar o painel mentindo é meio conserto. O campo de
 * código postal dizia "CEP", oferecia `00000-000` e prometia "buscaremos o
 * endereço automaticamente" para um endereço canadense; o telefone sugeria
 * `(00) 00000-0000` para qualquer país.
 *
 * O pior deles não era estético: `maxlength="9"` é o tamanho do CEP, e um
 * ZIP+4 americano (`12345-6789`, dez caracteres) era CORTADO na digitação.
 * Perder o que a pessoa escreveu sem avisar é o tipo de defeito que ela
 * descobre quando a encomenda não chega.
 *
 * Então o markup nasce genérico e o brasileiro é a EXCEÇÃO, declarada em
 * atributo: `data-br-placeholder`, `data-br-maxlength`, `data-br-text` e
 * `data-br-only`. Inverter o padrão importa — do jeito anterior, um país novo
 * herdava as regras do Brasil sem ninguém decidir isso.
 *
 * ── Sem JavaScript ─────────────────────────────────────────────────────────
 *
 * O país continua funcionando: é um `<select>` nativo com todos os países já
 * no HTML. O estado, não — ele depende deste componente. O template marca o
 * campo com `hidden` e o componente o revela, então quem está sem JS vê um
 * formulário sem estado em vez de um `<select>` vazio que não explica nada. A
 * Shopify aceita endereço sem província para os países que não a exigem.
 */
class AddressCountry extends HTMLElement {
  connectedCallback() {
    this.pais = this.querySelector('[data-address-country]');
    this.estado = this.querySelector('[data-address-province]');
    this.campo = this.querySelector('[data-address-province-field]');

    // Sem o select de país não há sinal nenhum a seguir.
    if (!this.pais) return;

    // Faltando o campo de estado, o resto ainda vale: o formulário segue
    // corrigindo placeholder e máscara. Sair inteiro aqui seria desligar o
    // que funciona por causa do que falta.
    if (!this.estado || !this.campo) {
      this.pais.addEventListener('change', () => this.seguirOPais());
      this.seguirOPais();
      return;
    }

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

    this.pais.addEventListener('change', () => {
      this.desenhar();
      this.seguirOPais();
    });

    this.desenhar(this.estado.dataset.selected);
    this.seguirOPais();
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

  /**
   * Liga ou desliga o que só vale no Brasil: formato sugerido, limite de
   * tamanho, rótulo e a dica da busca por CEP.
   */
  seguirOPais() {
    const brasil = this.pais.value === 'Brazil';

    for (const campo of this.querySelectorAll('[data-br-placeholder]')) {
      campo.placeholder = brasil ? campo.dataset.brPlaceholder : '';
    }

    for (const campo of this.querySelectorAll('[data-br-maxlength]')) {
      if (brasil) campo.setAttribute('maxlength', campo.dataset.brMaxlength);
      else campo.removeAttribute('maxlength');
    }

    for (const trecho of this.querySelectorAll('[data-br-text]')) {
      // O texto genérico é o que veio do Liquid: guardado na primeira passada,
      // senão a segunda troca já não teria para onde voltar.
      trecho.dataset.textoGenerico ??= trecho.textContent;
      trecho.textContent = brasil ? trecho.dataset.brText : trecho.dataset.textoGenerico;
    }

    for (const so of this.querySelectorAll('[data-br-only]')) {
      so.hidden = !brasil;
    }
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

if (!customElements.get('address-country')) {
  customElements.define('address-country', AddressCountry);
}
