/**
 * assets/address-country.js — <address-country>.
 *
 * O bug que este componente existe para não repetir tinha DUAS metades, e a
 * segunda é a que não se vê:
 *
 *   1. O formulário só oferecia o Brasil. Visível, e por isso corrigido.
 *   2. Metade dos países não tem província. Trocar o país sem tirar o
 *      `required` do campo de estado deixa um `<select>` vazio obrigatório no
 *      formulário — o botão salvar não faz nada, e nada na tela diz por quê.
 *
 * A segunda metade é a primeira coisa testada aqui de propósito: ela é a que
 * transformaria "só dá para cadastrar no Brasil" em "não dá para cadastrar em
 * lugar nenhum", que é pior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAsset } from './helpers/load-asset.mjs';

loadAsset('address-country.js');

const BRASIL = [
  ['AC', 'Acre'],
  ['SP', 'São Paulo'],
  ['RJ', 'Rio de Janeiro'],
];
const CANADA = [
  ['AB', 'Alberta'],
  ['QC', 'Quebec'],
];

/**
 * Monta o formulário como o Liquid o entrega: `all_country_option_tags` já
 * escreveu os países, cada um com as províncias no `data-provinces`.
 */
function monta({ paises, selecionado = '', estadoSelecionado = '' } = {}) {
  const opcoes = paises
    .map(
      ([nome, provincias]) =>
        `<option value="${nome}" data-provinces='${JSON.stringify(provincias)}'${
          nome === selecionado ? ' selected' : ''
        }>${nome}</option>`
    )
    .join('');

  document.body.innerHTML = `
    <address-country>
      <select data-address-country name="address[country]">${opcoes}</select>
      <div data-address-province-field hidden>
        <select data-address-province name="address[province]" data-selected="${estadoSelecionado}">
          <option value="">Selecione</option>
        </select>
      </div>
    </address-country>`;

  return {
    pais: document.querySelector('[data-address-country]'),
    estado: document.querySelector('[data-address-province]'),
    campo: document.querySelector('[data-address-province-field]'),
  };
}

const valores = (select) => [...select.options].map((o) => o.value);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('país sem províncias', () => {
  it('some com o campo E tira o required — senão o formulário não envia', () => {
    const { estado, campo } = monta({
      paises: [['Portugal', []]],
      selecionado: 'Portugal',
    });

    expect(campo.hidden).toBe(true);
    expect(estado.required).toBe(false);
  });

  it('trocar do Brasil para um país sem províncias não deixa o estado antigo para trás', () => {
    const { pais, estado, campo } = monta({
      paises: [
        ['Brazil', BRASIL],
        ['Portugal', []],
      ],
      selecionado: 'Brazil',
      estadoSelecionado: 'SP',
    });
    expect(estado.value).toBe('SP');

    pais.value = 'Portugal';
    pais.dispatchEvent(new Event('change'));

    expect(campo.hidden).toBe(true);
    expect(estado.value).toBe('');
    expect(estado.required).toBe(false);
  });
});

describe('país com províncias', () => {
  it('preenche a lista do país escolhido, com a placeholder na frente', () => {
    const { estado, campo } = monta({ paises: [['Brazil', BRASIL]], selecionado: 'Brazil' });

    expect(valores(estado)).toEqual(['', 'AC', 'SP', 'RJ']);
    expect(campo.hidden).toBe(false);
    expect(estado.required).toBe(true);
  });

  it('usa os NOMES que a Shopify manda — é o que traduz o estado', () => {
    const { estado } = monta({ paises: [['Brazil', BRASIL]], selecionado: 'Brazil' });
    expect([...estado.options].map((o) => o.textContent)).toEqual([
      'Selecione',
      'Acre',
      'São Paulo',
      'Rio de Janeiro',
    ]);
  });

  it('restaura o estado salvo do endereço — o formulário de edição depende disso', () => {
    const { estado } = monta({
      paises: [['Brazil', BRASIL]],
      selecionado: 'Brazil',
      estadoSelecionado: 'RJ',
    });
    expect(estado.value).toBe('RJ');
  });

  it('trocar de país troca a lista inteira, sem sobra do anterior', () => {
    const { pais, estado } = monta({
      paises: [
        ['Brazil', BRASIL],
        ['Canada', CANADA],
      ],
      selecionado: 'Brazil',
    });

    pais.value = 'Canada';
    pais.dispatchEvent(new Event('change'));

    expect(valores(estado)).toEqual(['', 'AB', 'QC']);
  });

  it('um estado que não existe no país novo não fica selecionado', () => {
    const { pais, estado } = monta({
      paises: [
        ['Brazil', BRASIL],
        ['Canada', CANADA],
      ],
      selecionado: 'Brazil',
      estadoSelecionado: 'SP',
    });

    pais.value = 'Canada';
    pais.dispatchEvent(new Event('change'));

    expect(estado.value).not.toBe('SP');
    expect(valores(estado)).toContain(estado.value);
  });

  it('volta a mostrar o campo depois de passar por um país sem províncias', () => {
    const { pais, campo, estado } = monta({
      paises: [
        ['Portugal', []],
        ['Canada', CANADA],
      ],
      selecionado: 'Portugal',
    });
    expect(campo.hidden).toBe(true);

    pais.value = 'Canada';
    pais.dispatchEvent(new Event('change'));

    expect(campo.hidden).toBe(false);
    expect(estado.required).toBe(true);
    expect(valores(estado)).toEqual(['', 'AB', 'QC']);
  });
});

describe('o país salvo do endereço', () => {
  /**
   * `all_country_option_tags` emite a lista inteira SEM `selected` — ele não
   * sabe o que está salvo. Sem reaplicar o `data-default`, abrir um endereço
   * do Canadá mostraria o primeiro país da lista, e salvar o mudaria sem
   * ninguém ter pedido. É a troca silenciosa, o pior desfecho possível aqui.
   */
  it('volta a selecionar o país gravado, não o primeiro da lista', () => {
    document.body.innerHTML = `
      <address-country>
        <select data-address-country data-default="Canada">
          <option value="Brazil" data-provinces='${JSON.stringify(BRASIL)}'>Brazil</option>
          <option value="Canada" data-provinces='${JSON.stringify(CANADA)}'>Canada</option>
        </select>
        <div data-address-province-field hidden>
          <select data-address-province data-selected="QC"><option value="">Selecione</option></select>
        </div>
      </address-country>`;

    expect(document.querySelector('[data-address-country]').value).toBe('Canada');
    expect(document.querySelector('[data-address-province]').value).toBe('QC');
  });

  /**
   * `shop.address.country` pode não bater com nenhum option — loja sem endereço
   * configurado, por exemplo. Melhor um select em branco que a pessoa preenche
   * do que uma exceção que derruba o resto do componente e leva o campo de
   * estado junto.
   */
  it('data-default que não existe na lista não quebra o componente', () => {
    document.body.innerHTML = `
      <address-country>
        <select data-address-country data-default="Atlântida">
          <option value="Brazil" data-provinces='${JSON.stringify(BRASIL)}'>Brazil</option>
        </select>
        <div data-address-province-field hidden>
          <select data-address-province><option value="">Selecione</option></select>
        </div>
      </address-country>`;

    expect(document.querySelector('[data-address-country]').value).toBe('');
    expect(document.querySelector('[data-address-province-field]').hidden).toBe(true);
  });

  it('sem data-default nenhum, o select se comporta como qualquer select', () => {
    const { pais } = monta({ paises: [['Brazil', BRASIL], ['Canada', CANADA]] });
    expect(pais.value).toBe('Brazil'); // o primeiro, como qualquer select
  });
});

describe('o que não pode derrubar o formulário', () => {
  it('data-provinces ilegível esconde o campo em vez de travar o envio', () => {
    document.body.innerHTML = `
      <address-country>
        <select data-address-country><option value="X" data-provinces="{não é json" selected>X</option></select>
        <div data-address-province-field hidden>
          <select data-address-province required><option value="">Selecione</option></select>
        </div>
      </address-country>`;

    const estado = document.querySelector('[data-address-province]');
    expect(document.querySelector('[data-address-province-field]').hidden).toBe(true);
    expect(estado.required).toBe(false);
  });

  it('sem o campo de estado no DOM, o componente sai calado', () => {
    expect(() => {
      document.body.innerHTML = `
        <address-country>
          <select data-address-country><option value="X" data-provinces="[]" selected>X</option></select>
        </address-country>`;
    }).not.toThrow();
  });
});

/**
 * A segunda metade do mesmo defeito, e a que só apareceu quando alguém ABRIU o
 * formulário: o motor já perguntava o país, mas o painel continuava brasileiro.
 * "CEP", `00000-000`, "buscaremos o endereço automaticamente" e
 * `(00) 00000-0000` apareciam para um endereço canadense.
 *
 * O `maxlength` é o que mais importa aqui. Os outros são texto errado; esse
 * CORTA o que a pessoa digitou — um ZIP+4 americano tem dez caracteres, e o
 * limite era nove. Perder caractere sem avisar é o defeito que só aparece
 * quando a encomenda não chega.
 */
describe('o que é brasileiro só aparece no Brasil', () => {
  function montaCampos(selecionado) {
    document.body.innerHTML = `
      <address-country>
        <select data-address-country>
          <option value="Brazil" data-provinces='${JSON.stringify(BRASIL)}'${
            selecionado === 'Brazil' ? ' selected' : ''
          }>Brazil</option>
          <option value="Canada" data-provinces='${JSON.stringify(CANADA)}'${
            selecionado === 'Canada' ? ' selected' : ''
          }>Canada</option>
        </select>
        <label><span data-br-text="CEP">Código postal</span> *</label>
        <input data-address-zip data-br-placeholder="00000-000" data-br-maxlength="9">
        <p data-br-only hidden>Buscaremos o endereço automaticamente</p>
        <input data-address-phone data-br-placeholder="(00) 00000-0000">
        <div data-address-province-field hidden>
          <select data-address-province><option value="">Selecione</option></select>
        </div>
      </address-country>`;

    return {
      pais: document.querySelector('[data-address-country]'),
      cep: document.querySelector('[data-address-zip]'),
      telefone: document.querySelector('[data-address-phone]'),
      dica: document.querySelector('[data-br-only]'),
      rotulo: document.querySelector('[data-br-text]'),
    };
  }

  it('no Brasil, tudo ligado', () => {
    const { cep, telefone, dica, rotulo } = montaCampos('Brazil');

    expect(cep.placeholder).toBe('00000-000');
    expect(cep.getAttribute('maxlength')).toBe('9');
    expect(telefone.placeholder).toBe('(00) 00000-0000');
    expect(dica.hidden).toBe(false);
    expect(rotulo.textContent).toBe('CEP');
  });

  it('no Canadá, nada de formato brasileiro', () => {
    const { cep, telefone, dica, rotulo } = montaCampos('Canada');

    expect(cep.placeholder).toBe('');
    expect(telefone.placeholder).toBe('');
    expect(dica.hidden).toBe(true);
    expect(rotulo.textContent).toBe('Código postal');
  });

  /** O que corta dado: sem limite, o ZIP+4 inteiro cabe. */
  it('fora do Brasil o maxlength SAI — senão um ZIP+4 é truncado', () => {
    const { cep } = montaCampos('Canada');
    expect(cep.hasAttribute('maxlength')).toBe(false);

    cep.value = '12345-6789';
    expect(cep.value).toBe('12345-6789');
  });

  it('trocar de país troca os dois sentidos, não só um', () => {
    const { pais, cep, dica, rotulo } = montaCampos('Brazil');

    pais.value = 'Canada';
    pais.dispatchEvent(new Event('change'));
    expect(cep.hasAttribute('maxlength')).toBe(false);
    expect(rotulo.textContent).toBe('Código postal');
    expect(dica.hidden).toBe(true);

    pais.value = 'Brazil';
    pais.dispatchEvent(new Event('change'));
    expect(cep.getAttribute('maxlength')).toBe('9');
    expect(rotulo.textContent).toBe('CEP');
    expect(dica.hidden).toBe(false);
  });

  /**
   * O rótulo genérico vem do Liquid e não está escrito no JS. Voltar da
   * segunda troca em diante depende de ele ter sido guardado na primeira.
   */
  it('o rótulo genérico sobrevive a várias idas e voltas', () => {
    const { pais, rotulo } = montaCampos('Brazil');

    for (const destino of ['Canada', 'Brazil', 'Canada']) {
      pais.value = destino;
      pais.dispatchEvent(new Event('change'));
    }
    expect(rotulo.textContent).toBe('Código postal');
  });

  it('sem campo de estado no DOM, os campos brasileiros ainda seguem o país', () => {
    document.body.innerHTML = `
      <address-country>
        <select data-address-country>
          <option value="Canada" data-provinces="[]" selected>Canada</option>
        </select>
        <input data-address-zip data-br-placeholder="00000-000" data-br-maxlength="9">
      </address-country>`;

    const cep = document.querySelector('[data-address-zip]');
    expect(cep.placeholder).toBe('');
    expect(cep.hasAttribute('maxlength')).toBe(false);
  });
});
