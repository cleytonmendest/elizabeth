---
title: 1. Primeiros passos
alt: /merchant/getting-started.html
---

# 1. Primeiros passos

Siga na ordem. Cada etapa leva de 5 a 15 minutos.

---

## 1.1 Instalar o tema

1. No admin da Shopify, vá em **Loja virtual → Temas**
2. Em **Biblioteca de temas**, clique em **Adicionar tema**
3. Escolha o Elizabeth
4. Clique em **Personalizar** para abrir o editor

> O tema entra como **rascunho**. A loja continua mostrando o tema antigo até você publicar — que é a última etapa deste guia. Você pode mexer à vontade sem ninguém ver.

---

## 1.2 Logo e favicon

No editor, abra **Configurações do tema** (o ícone de engrenagem, na barra lateral) → **Logo**.

| Campo | O que fazer |
| --- | --- |
| **Logo** | Envie um PNG ou SVG **com fundo transparente**. Fundo branco aparece como um retângulo branco quando o cabeçalho usa um esquema escuro. |
| **Largura máxima da Logo** | Entre 50 e 300 px. O padrão é 100. Aumente se o logo ficar pequeno demais; não passe de 200 em logos horizontais, senão o menu aperta no notebook. |
| **Favicon** | O ícone da aba do navegador. Quadrado, pelo menos 96×96 px. |

### Sobre o campo "logo_svg"

Existe um campo de texto para colar o código de um SVG. **Ignore ele** a menos que alguém tenha te dado o código pronto e explicado por quê. O campo **Logo** normal resolve 99% dos casos e é mais seguro.

---

## 1.3 Fontes

**Configurações do tema → Tipografia.**

São duas escolhas: a fonte dos **títulos** e a fonte do **corpo do texto**.

As duas vêm da biblioteca da Shopify — não há upload de arquivo de fonte. Isso é de propósito: fonte da biblioteca carrega mais rápido e não cobra nada à parte.

**Combinação que funciona quase sempre:** uma fonte com serifa nos títulos e uma sem serifa no corpo. Se estiver em dúvida, deixe as duas iguais — é mais seguro que combinar errado.

### Tamanho do texto

**Configurações do tema → Design → Tamanho do texto.**

| Opção | Quando usar |
| --- | --- |
| Compacto | Catálogo grande, muita informação por tela |
| **Padrão** | O normal |
| Grande | Público que prefere texto maior |
| Muito grande | Acessibilidade em primeiro lugar |

Essa escolha multiplica a escala **inteira**: títulos, corpo, legendas, tudo junto. A proporção entre eles não muda. Você não precisa ajustar tamanho em cada seção.

---

## 1.4 Arredondamento e largura

**Configurações do tema → Design → Arredondamento.**

| Opção | Aparência |
| --- | --- |
| Reto (0px) | Anguloso, editorial |
| Sutil (4px) | Quase reto |
| **Suave (8px)** | O padrão |
| Arredondado (16px) | Mais amigável, menos formal |

Vale para botões, cards, campos e modais de uma vez só. Os tamanhos menores e maiores derivam dessa escolha automaticamente.

**Configurações do tema → Layout:**

- **Largura máxima da Loja** — entre 1400 e 2560 px, padrão 1920. Em monitores grandes, esse é o limite até onde o conteúdo se espalha.
- **Espaçamento entre Seções** — de 0 a 100 px. Padrão 0 (cada seção controla o próprio espaço). Aumente se a home ficar apertada.
- **Botão "Voltar ao topo"** — ligado por padrão. Aparece ao rolar a página.

---

## 1.5 Menus

Os menus **não** são configurados no tema — são do admin da Shopify.

1. **Loja virtual → Navegação**
2. Edite o **Menu principal** (aparece no cabeçalho) e o **Menu de rodapé**
3. Volte ao editor do tema

No editor, clique na seção **Header** e escolha o menu em **Menu Principal**.

### Mega menu

Em **Header → Tipo de header desktop** há opções de layout. Se você escolher uma com mega menu, o menu principal passa a abrir em painel com os submenus visíveis.

Para colocar imagem no mega menu, adicione o bloco **Imagem no mega menu** dentro da seção Header.

> O mega menu só mostra submenus que **existem na Navegação**. Se o painel abrir vazio, o problema é o menu, não o tema — volte em Loja virtual → Navegação e adicione itens de segundo nível.

---

## 1.6 Cabeçalho fixo

**Header → Header fixo (sticky).** Ligado, o cabeçalho acompanha a rolagem.

Ligue se o seu menu é a principal forma de navegação. Desligue se você quer a tela inteira para o conteúdo — em telas de celular pequenas, o cabeçalho fixo come espaço útil.

---

## 1.7 Montar a home

A home é feita de **seções** que você adiciona, reordena e remove. No editor, na barra lateral:

- **Adicionar seção** — coloca uma nova
- **Arrastar** pelo ícone de seis pontos — reordena
- **Ícone de olho** — esconde sem apagar

O tema tem **23 seções** que você pode adicionar. Cada uma está descrita em **[As seções, uma a uma](sections.html)**.

### Uma home que funciona, na ordem

1. **Barra de Anúncios** — frete grátis, prazo, cupom
2. **Banner de imagem** ou **Slider de Imagens** — a primeira coisa que a cliente vê
3. **Coleção em destaque** — os produtos que você quer vender agora
4. **Seção Destaque** ou **Shop the Look** — a história da marca
5. **Depoimentos de Clientes** — prova social
6. **Trust Badges** — frete, troca, pagamento seguro
7. **Posts do Blog** — se você mantém blog

Não precisa ser exatamente isso. É um ponto de partida que não erra.

---

## 1.8 Carrinho e frete grátis

**Configurações do tema → Carrinho.**

| Campo | O que faz |
| --- | --- |
| **Barra de frete grátis** | Liga a barrinha de progresso no carrinho |
| **Valor mínimo** | O valor que dá frete grátis, em reais |
| **Mensagem** | O texto enquanto falta. Use `{{ amount }}` onde entra o valor que falta |
| **Mensagem de sucesso** | O texto quando a cliente já atingiu |
| **Observações do pedido** | Um campo de texto livre no carrinho |

> A barra de frete grátis é **visual**. Ela não cria a regra de frete — isso é feito em **Configurações → Envio e entrega** no admin. Se os dois não combinarem, a cliente vê "frete grátis" e é cobrada no checkout.

---

## 1.9 Aviso de cookies (LGPD)

**Configurações do tema → Privacidade e Cookies.**

Ligado, mostra a faixa de consentimento. Configure:

- **Mensagem** — o texto da faixa
- **Botão aceitar** e, opcionalmente, **botão recusar**
- **Link da política de privacidade** — aponte para a sua página de política
- **Esquema de cores** — qual paleta a faixa usa

> Crie a página de política de privacidade antes: **Loja virtual → Páginas**. Faixa de cookies com link quebrado é pior que faixa nenhuma.

---

## 1.10 Redes sociais

**Configurações do tema → Redes Sociais.** Cole a URL completa de cada rede.

Os ícones aparecem no rodapé — desde que o bloco **Pagamentos e Social** esteja lá e com a opção de social ligada.

> Nove campos existem, mas apenas **Instagram, Facebook e YouTube** aparecem como ícone no rodapé. Twitter alimenta a prévia de link no Twitter/X; Pinterest, Facebook e Instagram alimentam os dados estruturados que o Google lê. **TikTok, Snapchat, Tumblr e Vimeo não aparecem em lugar nenhum hoje** — preencher não faz nada.

---

## 1.11 Publicar

1. Confira no editor, no modo **celular** e no modo **desktop** (os ícones no topo)
2. Clique em **Salvar**
3. Volte em **Loja virtual → Temas**
4. No Elizabeth, **Ações → Publicar**

Pronto. A loja está no ar com o tema novo.

> **Antes de publicar,** vale abrir o preview num celular de verdade. O editor simula bem, mas não simula dedo grosso em botão pequeno.

---

**Próximo:** [Cores e identidade da marca →](cores-e-marca.html)
