---
title: 5. Perguntas frequentes
alt: /merchant/faq.html
---

# 5. Perguntas frequentes

---

## Configuração

### Preciso saber programar?
Não. Nada neste guia pede para editar código, e nada no tema exige isso para funcionar.

### Posso testar sem que ninguém veja?
Sim. Instale o tema — ele entra como **rascunho**. A loja continua no tema antigo até você clicar em **Publicar**.

### Como volto atrás se estragar tudo?
**Loja virtual → Temas → Ações → Histórico de versões.** A Shopify guarda as versões anteriores do tema. Você também pode duplicar o tema antes de mexer, como cópia de segurança.

### Mudei uma coisa e não vejo diferença na loja
Três causas, nesta ordem: você não salvou; você está editando um tema que não é o publicado; o navegador está com a página em cache (recarregue com Ctrl+F5, ou Cmd+Shift+R no Mac).

---

## Aparência

### Posso usar minha própria fonte?
Não por upload. As fontes vêm da biblioteca da Shopify, que é grande e cobre a maioria das marcas. É de propósito: fonte da biblioteca carrega mais rápido e não tem custo de licença à parte.

### Quantos esquemas de cores devo criar?
Dois ou três. Cinco é o limite antes de virar bagunça. Veja [Cores e identidade](cores-e-marca.html).

### Posso mudar o arredondamento de só um botão?
Não, e é de propósito. O arredondamento é uma escolha da loja inteira — botões, cards, campos e modais de uma vez. Um botão diferente dos outros parece defeito, não intenção.

### O texto está pequeno demais
**Configurações do tema → Design → Tamanho do texto.** Aumenta a escala inteira mantendo a proporção entre títulos e corpo. Você não precisa ajustar seção por seção.

### Posso deixar o site mais largo?
**Configurações do tema → Layout → Largura máxima da Loja**, até 2560 px. Acima de 1920 o conteúdo começa a ficar esparso em monitores comuns.

---

## Produtos e coleções

### Qual o tamanho ideal das fotos?
**Proporção retrato 4:5** e no máximo 2000 px de largura. O mais importante não é o tamanho: é que **todas tenham a mesma proporção**. Fotos de proporções diferentes desalinham a grade.

### Como ativo os filtros?
Instale o app gratuito **Shopify Search & Discovery** e configure os filtros lá. Veja [Problemas comuns](problemas-comuns.html#os-filtros-da-coleção-não-aparecem).

### O que é a "segunda imagem ao passar o mouse"?
Quando ligado, passar o mouse sobre o card mostra a segunda foto do produto. Funciona bem em moda — foto de frente e foto de costas. Só aparece em produtos com **duas ou mais fotos**.

### O que é "compra rápida"?
Um botão no card que dispensa abrir o produto. Ele se comporta de dois jeitos: em produto de **variante única** adiciona ao carrinho ali mesmo; em produto com cor ou tamanho **leva à página do produto**, porque a cliente tem que escolher. Em produto esgotado ele não aparece.

---

## Carrinho e checkout

### Posso mudar a página de checkout?
Não com o tema. O checkout da Shopify é configurado em **Configurações → Checkout** no admin, e o tema não tem acesso a ele.

### A barra de frete grátis cria a regra de frete?
Não. Ela é visual. A regra de verdade é **Configurações → Envio e entrega**. Configure os dois com o mesmo valor.

### Como coloco parcelamento?
Depende do gateway de pagamento, não do tema. Configure em **Configurações → Pagamentos**. Se o gateway expõe parcelamento, ele aparece.

### Como tiro o botão "Compre já" da página de produto?
No editor, abra a página de produto, clique no bloco **Botão Comprar** e desmarque **Mostrar botões de checkout acelerado**. O mesmo controle existe na seção **Produto Destaque**. Quando nenhuma carteira digital está disponível, o botão aparece como "Compre já" e usa as cores do esquema da seção. Os botões de carteira (Shop Pay, Google Pay…) mantêm as cores da marca, que a Shopify não permite mudar.

### Como escondo "Impostos e frete calculados no checkout"?
O texto muda sozinho conforme **Configurações → Impostos e taxas**: se os preços da loja já incluem impostos, ele diz "Impostos incluídos". A regra pode ser diferente por país, e o texto acompanha o país da cliente. Para não mostrar a frase, abra o bloco **Preço do Produto** no editor e desmarque **Mostrar aviso de impostos e frete**.

---

## Blog e páginas

### Como crio a página de FAQ?
**Loja virtual → Páginas → Adicionar página.** Depois, no editor do tema, abra essa página e adicione a seção **FAQ / Conteúdo recolhível**.

### Como crio a página Sobre?
Mesma coisa: crie a página no admin e monte o conteúdo com as seções **Texto rico**, **Seção Destaque** e **Multicolunas**.

---

## Idiomas e moedas

### O tema é traduzido?
Sim, português e inglês. Para adicionar outros idiomas: **Configurações → Idiomas** no admin, e depois traduza pelo app **Translate & Adapt** (gratuito, da Shopify).

### Como mudo o texto do botão "Adicionar ao carrinho"?
Em **Loja virtual → Temas → ⋯ → Editar conteúdo padrão do tema**, busque por "Adicionar ao carrinho". A mudança vale de uma vez para a página de produto, a barra fixa de compra e os cards de produto, e cada idioma tem o seu texto. O card usa a versão curta ("Adicionar"), na mesma tela: mude as duas para o texto ficar igual em toda a loja.

### Mudei a loja para inglês e um texto continuou em português
Texto que você escreveu num campo do editor é conteúdo seu, e não muda sozinho com o idioma: traduza-o no app **Translate & Adapt**. Os campos que dizem **"Deixe em branco para usar o texto traduzido do tema"** (o botão de finalizar compra, o da página 404) acompanham o idioma se ficarem vazios. Apague o texto deles para voltar ao traduzido.

### Como mostro o seletor de idioma e moeda?
Na seção **Footer**, ligue **Mostrar seletor de idioma** e **Mostrar seletor de país/moeda**. Eles só aparecem se a loja tiver mais de um idioma ou mercado configurado em **Configurações → Mercados**.

---

## Acessibilidade e conformidade

### O tema atende LGPD?
Ele traz a faixa de consentimento de cookies, configurável em **Configurações do tema → Privacidade e Cookies**. A **política de privacidade** em si é uma página que você escreve e linka ali. Faixa sem política não cumpre a lei.

### O tema é acessível?
Ele é construído para atender WCAG 2.1 nível AA, e isso é verificado automaticamente a cada mudança. Mas **as suas escolhas importam**: um par de cores com contraste baixo quebra a acessibilidade de uma loja que estava conforme. Veja [Contraste](cores-e-marca.html#contraste-a-regra-que-não-é-opinião).

### As imagens precisam de texto alternativo?
Sim. O campo **Texto alternativo (alt)** existe nas seções de imagem e nas fotos de produto no admin. Descreva o que a imagem mostra — é o que leitores de tela leem, e o que o Google indexa.

---

## Suporte

### Achei um defeito. Onde reporto?
[github.com/cleytonmendest/elizabeth/issues](https://github.com/cleytonmendest/elizabeth/issues/new), com: qual página, qual seção, qual esquema de cores, celular ou computador, o que você esperava e o que aconteceu.

### Posso pedir uma funcionalidade nova?
Pode, no mesmo lugar. Descreva **o problema que você tem**, não a solução que imaginou — muitas vezes existe um jeito com o que já está lá.

---

**Anterior:** [← Problemas comuns](problemas-comuns.html) · [Voltar ao início](index.html)
