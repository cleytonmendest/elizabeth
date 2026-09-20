---
title: 2. Cores e identidade da marca
---

# 2. Cores e identidade da marca

Esta é a parte do tema que mais muda a cara da loja, e a que mais gente configura errado. Vale ler inteiro — são dez minutos.

---

## A ideia em uma frase

Você não escolhe a cor de cada coisa. Você monta **paletas** (chamadas *esquemas de cores*) e depois diz **qual paleta cada seção usa**.

Uma loja com 30 seções tem 2 ou 3 paletas, não 30 decisões de cor.

---

## Por que assim

Imagine que você quer trocar o tom de rosa da marca.

- **Cor por seção:** você abre 30 seções e troca 30 vezes. Esquece uma. Ela fica com o rosa velho até alguém reparar.
- **Por paleta:** você troca num lugar. As 30 seções acompanham.

E funciona nos dois sentidos: uma seção com fundo escuro recebe automaticamente o texto claro daquela paleta. Você nunca vai ter texto preto sobre fundo preto por esquecimento.

---

## Onde ficam

**Configurações do tema → Cores → Esquemas de cores.**

O tema vem com dois:

| | Fundo | Texto |
| --- | --- | --- |
| **Esquema 1** | Branco | Quase preto |
| **Esquema 2** | Quase preto | Branco |

Clique em **Adicionar esquema** para criar mais.

---

## O que tem dentro de um esquema

Cada esquema tem 13 cores. Você não precisa mexer em todas — as cinco primeiras decidem quase tudo.

### As que importam

| Cor | O que pinta |
| --- | --- |
| **Fundo** | O fundo de toda seção que usar este esquema |
| **Texto** | Títulos, parágrafos, links |
| **Botão primário** | O fundo do botão principal (Comprar, Finalizar) |
| **Texto do botão primário** | A letra dentro dele |
| **Bordas** | Linhas de card, campo e divisória |

### As de apoio

| Cor | O que pinta |
| --- | --- |
| **Gradiente de fundo** | Substitui o fundo chapado, se você preencher |
| **Texto do botão secundário** | Botões de contorno, e a cor dos links |
| **Sombras** | A sombra dos cards e modais |
| **Fundo de badge** / **Texto de badge** | As etiquetas de "Novo", "Promoção" |
| **Sucesso** / **Erro** / **Alerta** | Mensagens do sistema — "adicionado ao carrinho", "campo obrigatório" |

> **Sucesso, Erro e Alerta** têm significado além da estética. Verde, vermelho e amarelo são o que a cliente já entende. Trocar por tons da marca costuma piorar a compreensão.

---

## Contraste: a regra que não é opinião

O tema calcula o texto secundário — legendas, descrições, contadores — a partir do **seu** par de Fundo e Texto. Ele não usa um cinza fixo.

Mas isso só funciona se o par que **você** escolher tiver contraste suficiente.

### Como conferir sem ferramenta

Aperte os olhos e olhe a tela de longe. Se o texto some no fundo, o contraste está baixo.

### Como conferir de verdade

Use um medidor de contraste (busque por "WebAIM contrast checker"). Cole a cor do **Fundo** e a do **Texto**.

| Resultado | Veredito |
| --- | --- |
| **4,5:1 ou mais** | Passa. Pode usar. |
| Entre 3:1 e 4,5:1 | Só serve para texto grande (títulos) |
| Abaixo de 3:1 | Não use |

**Por que importa:** contraste baixo não é só feio. É o item que mais reprova tema na revisão da Shopify, e é o que faz uma cliente de 50 anos desistir de comprar no celular no sol.

### Pares que dão problema

- Cinza médio sobre branco
- Bege sobre creme
- Rosa claro sobre branco
- Qualquer cor pastel como **Texto**

Cor pastel funciona muito bem como **Fundo**, com texto escuro por cima.

---

## Uma receita que funciona

Se você não tem paleta definida, faça assim:

**Esquema 1 — o padrão da loja**
- Fundo: branco ou quase branco
- Texto: quase preto (não use preto puro — `#121212` é mais agradável que `#000000`)
- Botão primário: a cor da sua marca
- Texto do botão: branco ou preto, o que tiver mais contraste com a cor da marca

**Esquema 2 — para destacar**
- Fundo: a cor da sua marca, ou o quase preto
- Texto: branco
- Botão primário: branco
- Texto do botão: a cor de fundo

**Esquema 3 — respiro (opcional)**
- Fundo: um tom bem claro da sua marca (um bege, um rosa muito claro)
- Texto: o mesmo quase preto do Esquema 1
- Botões: iguais aos do Esquema 1

Três esquemas cobrem qualquer loja. Mais que cinco vira bagunça.

---

## Aplicar nas seções

Toda seção tem **Esquema de cores** no topo das opções.

A alternância é o que dá ritmo à página:

```
Banner de imagem        → Esquema 2  (escuro, impacto)
Coleção em destaque     → Esquema 1  (claro, produtos respiram)
Seção Destaque          → Esquema 3  (respiro, muda o ar)
Depoimentos de Clientes → Esquema 1  (volta ao claro)
Trust Badges            → Esquema 2  (fecha escuro)
```

> **Não use um esquema diferente em cada seção.** O olho lê isso como desorganização, não como variedade.

### Seções com dois esquemas

Algumas têm um segundo campo de esquema, para uma parte específica:

| Seção | Segundo esquema |
| --- | --- |
| **Footer** | A faixa da newsletter, separada do resto do rodapé |
| **Seção Destaque** | O fundo curvo decorativo |
| **Depoimentos de Clientes** | Os cards, separados do fundo da seção |

### As páginas de conta

**Configurações do tema → Cores → Esquema de cores das páginas de conta.**

Vale para login, cadastro, conta, pedidos e endereços. Essas páginas não aparecem no editor com seções, então o esquema delas se escolhe aqui.

---

## Testar antes de publicar

No editor, troque o esquema de uma seção e **olhe**:

1. O texto continua legível?
2. Os botões aparecem, ou sumiram no fundo?
3. As bordas dos cards ainda são visíveis?
4. No celular também?

Faça isso com a seção de **Produto** aberta. É a página onde mais elemento diferente convive: preço, preço riscado, badge, botão, seletor de variante, estoque.

---

**Anterior:** [← Primeiros passos](primeiros-passos.html) · **Próximo:** [As seções →](sections.html)
