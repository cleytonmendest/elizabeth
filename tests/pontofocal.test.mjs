/**
 * O ponto focal da lojista chega ao corte da imagem? (issue #142)
 *
 * A lojista marca no admin o que não pode sair do quadro — o rosto da modelo,
 * e não a barra do vestido. O `image_tag` transforma isso em
 * `object-position`; uma `<img>` escrita à mão não transforma nada, e com
 * `object-cover` corta sempre pelo centro. Sem erro, sem imagem quebrada: só
 * o corte errado, que nenhum teste de "a imagem carregou" vê.
 *
 * Medido em abb6f78: dez arquivos assim, o card de produto entre eles.
 *
 * A fonte é quase toda INJETADA: depois da correção o tema não tem nenhuma
 * violação, e um teste que só varre o tema real percorreria só o caminho verde
 * — sem saber se o vermelho existe.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { origem, run, violacoesEm } from '../scripts/lint/rules/pontofocal.mjs';
import { isAllowed } from '../scripts/lint/exceptions.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const le = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');

const achados = (src) => violacoesEm('snippets/x.liquid', src);
const codigos = (src) => achados(src).map((o) => o.code);

const FOCO = 'style="object-position: {{ produto.featured_image.presentation.focal_point }}"';
const img = (atributos) =>
  `<img src="{{ produto.featured_image | image_url: width: 400 }}" alt="" ${atributos}>`;

describe('a regra reprova o corte sem ponto focal', () => {
  it('a tag escrita à mão com object-cover — o defeito da #142', () => {
    expect(codigos(img('class="w-full aspect-product object-cover"'))).toEqual([
      'img:produto.featured_image',
    ]);
  });

  it('e aponta a linha da tag, não a do arquivo', () => {
    const src = ['<div>', '  <p>x</p>', `  ${img('class="object-cover"')}`, '</div>'].join('\n');
    expect(achados(src).map((o) => o.line)).toEqual([3]);
  });

  it.each([
    ['object-none', 'class="w-12 h-12 object-none"'],
    ['variante responsiva', 'class="object-contain md:object-cover"'],
    ['object-fit no style', 'style="object-fit: cover"'],
  ])('%s também corta', (_, atributos) => {
    expect(achados(img(atributos))).toHaveLength(1);
  });

  it.each([
    ['classe de posição fixa', 'class="object-cover object-top"'],
    ['object-position com valor cravado', 'class="object-cover" style="object-position: top"'],
    ['nem o centro escrito à mão', 'class="object-cover" style="object-position: 50% 50%"'],
  ])('%s não é o ponto da lojista', (_, atributos) => {
    // Trocar o centro por outro ponto que a lojista também não escolheu é o
    // mesmo defeito com outra coordenada.
    expect(achados(img(atributos))).toHaveLength(1);
  });

  it('o código traz a origem, para a exceção liberar UMA tag e não o arquivo', () => {
    const src = [img('class="object-cover"'), '<img src="" alt="" class="object-cover">'].join('\n');
    expect(codigos(src)).toEqual(['img:produto.featured_image', 'img:src-vazio']);
  });
});

describe('e fica quieta onde o ponto focal chega', () => {
  it('object-position que sai de presentation.focal_point', () => {
    expect(achados(img(`class="w-full object-cover" ${FOCO}`))).toEqual([]);
  });

  it('imagem que vem de image_tag — ele aplica o ponto sozinho', () => {
    // Não é `<img` no fonte: é exatamente por isso que está certa.
    const src =
      "{{ produto.featured_image | image_url: width: 600 | image_tag: class: 'w-full object-cover', alt: '' }}";
    expect(achados(src)).toEqual([]);
  });

  it.each([
    ['object-contain', 'class="w-full object-contain"'],
    ['object-fill', 'class="w-full object-fill"'],
    ['sem classe de ajuste', 'class="w-full h-auto"'],
  ])('%s não corta, e o ponto focal não tem o que decidir', (_, atributos) => {
    expect(achados(img(atributos))).toEqual([]);
  });

  it.each([
    ['{% comment %}', `{%- comment -%}\n  Antes: ${img('class="object-cover"')}\n{%- endcomment -%}`],
    ['<!-- -->', `<!-- ${img('class="object-cover"')} -->`],
  ])('exemplo dentro de %s é documentação, não markup', (_, src) => {
    expect(achados(src)).toEqual([]);
  });
});

describe('um `>` no meio não encerra a tag', () => {
  // Um `<img[^>]*>` termina a tag no primeiro `>`: o que vem antes é lido, o
  // que vem depois some. Cada caso abaixo põe o `>` ANTES do corte e do ponto
  // focal, e cada um depende de UMA proteção da regra — por isso são três.
  it.each([
    // O do card de produto: Liquid dentro do `class`, entre aspas.
    ['Liquid dentro de um atributo', 'class="w-full {% if produto.images.size > 1 %}group-hover:opacity-0{% endif %} object-cover"'],
    // Liquid ENTRE atributos: só a máscara do Liquid o protege.
    ['Liquid entre atributos', '{% if produto.images.size > 1 %}data-segunda{% endif %} class="object-cover"'],
    // Valor entre aspas que não é Liquid: só a leitura das aspas o protege.
    ['valor literal entre aspas', 'sizes="(width > 640px) 33vw, 100vw" class="object-cover"'],
  ])('%s: o object-cover escrito depois do `>` é visto', (_, atributos) => {
    expect(achados(img(atributos))).toHaveLength(1);
  });

  it.each([
    ['Liquid dentro de um atributo', 'class="{% if produto.images.size > 1 %}group-hover:opacity-0{% endif %} object-cover"'],
    ['Liquid entre atributos', '{% if produto.images.size > 1 %}data-segunda{% endif %} class="object-cover"'],
    ['valor literal entre aspas', 'sizes="(width > 640px) 33vw, 100vw" class="object-cover"'],
  ])('%s: e o ponto focal depois dele também — senão a correção seria acusada', (_, atributos) => {
    expect(achados(img(`${atributos} ${FOCO}`))).toEqual([]);
  });
});

describe('a origem da imagem', () => {
  it.each([
    ['{{ card_product.featured_image | image_url: width: 400 }}', 'card_product.featured_image'],
    ['{{- media.preview_image | image_url -}}', 'media.preview_image'],
    ['', 'src-vazio'],
    ['/cdn/loja.jpg', 'src-fixo'],
  ])('src="%s" → %s', (src, esperado) => {
    expect(origem(`<img src="${src}" alt="">`)).toBe(esperado);
  });

  it('data-src e srcset não se passam pelo src', () => {
    const tag = '<img data-src="{{ outro | image_url }}" srcset="{{ outro | image_url }} 1x" src="" alt="">';
    expect(origem(tag)).toBe('src-vazio');
  });
});

describe('o tema', () => {
  it('nasce sem nenhuma violação', () => {
    expect(run().map((o) => `${o.file}:${o.line} ${o.code}`)).toEqual([]);
  });

  it('os dez arquivos da #142 ainda cortam — o teste não perdeu o alvo', () => {
    // Se alguém trocar `object-cover` por `object-contain`, a regra fica
    // quieta por não haver corte, e o "nasce limpo" acima continua verde sem
    // provar nada sobre o ponto focal.
    const arquivos = [
      'snippets/card-product-slider.liquid',
      'snippets/product-gallery.liquid',
      'snippets/sticky-add-to-cart.liquid',
      'sections/main-collection.liquid',
      'sections/main-search.liquid',
      'snippets/search-component.liquid',
      'sections/main-article.liquid',
      'snippets/card-article.liquid',
      'snippets/testimonial-card.liquid',
      'templates/customers/order.liquid',
    ];
    for (const arquivo of arquivos) expect(le(arquivo), arquivo).toMatch(/object-cover/);
  });

  it('a miniatura do sticky declara o ponto focal à mão, no lugar do image_tag', () => {
    // Ela não usa image_tag por causa do `aria-hidden` (ver o comentário no
    // snippet). Se o `style` sumir, o "nasce limpo" acima reprova; este teste
    // diz POR QUE ela é diferente das outras.
    expect(le('snippets/sticky-add-to-cart.liquid')).toMatch(
      /style="object-position: \{\{ product\.featured_image\.presentation\.focal_point \}\}"/
    );
  });
});

describe('a exceção da busca preditiva', () => {
  const ARQUIVO = 'snippets/search-component.liquid';

  it('existe uma violação real sendo liberada — a exceção não é linha morta', () => {
    // `/search/suggest.json` não traz o ponto focal: a tag é preenchida em JS
    // e não há `object-position` para declarar. Ver o comentário no snippet.
    expect(violacoesEm(ARQUIVO, le(ARQUIVO)).map((o) => o.code)).toEqual(['img:src-vazio']);
    expect(isAllowed('pontofocal', ARQUIVO, 'img:src-vazio')).toBe(true);
  });

  it('e ela não vira licença para o arquivo inteiro', () => {
    // Uma <img> com src em Liquid, sem ponto focal, plantada neste mesmo
    // arquivo continua reprovando: o código traz a origem, e a exceção só
    // casa `img:src-vazio`.
    const plantada = `${le(ARQUIVO)}\n${img('class="object-cover"')}`;
    const restantes = violacoesEm(ARQUIVO, plantada).filter(
      (o) => !isAllowed('pontofocal', ARQUIVO, o.code)
    );

    expect(restantes.map((o) => o.code)).toEqual(['img:produto.featured_image']);
  });
});
