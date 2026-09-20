---
title: 4. Problemas comuns
alt: /merchant/troubleshooting.html
---

# 4. Problemas comuns

Cada item diz **o sintoma**, **a causa** e **o que fazer**. Nenhuma solução aqui pede para editar código.

---

## Os filtros da coleção não aparecem

**Sintoma:** você ligou **Ativar filtros** na Página de Coleção e nada aparece na loja.

**Causa:** os filtros são da Shopify, não do tema. Eles vêm do app gratuito **Search & Discovery**, e sem ele não existe filtro nenhum para o tema mostrar.

**O que fazer:**

1. Instale o **Shopify Search & Discovery** (gratuito, na App Store da Shopify)
2. Abra o app → **Filters**
3. Adicione os filtros que fazem sentido: Disponibilidade, Preço, Cor, Tamanho
4. Volte à loja e recarregue a página de coleção

> Se você ligou os filtros e eles continuam sumidos com o app instalado: os filtros só aparecem quando **existem produtos com aquela propriedade**. Um filtro de Cor numa coleção sem opção de cor não tem o que mostrar.

---

## A imagem está cortada

**Sintoma:** a foto do produto aparece cortada no card, ou o banner corta a cabeça da modelo.

**Causa:** as áreas do tema têm proporção fixa. Uma imagem de proporção diferente é cortada pelo centro para caber.

**O que fazer:**

- **Nos cards de produto:** use todas as fotos na **mesma proporção**. Retrato 4:5 é o que melhor funciona em moda. Uma foto quadrada no meio de fotos retrato desalinha a grade inteira.
- **No banner:** deixe espaço de sobra em volta do assunto principal ao fotografar ou recortar. O banner corta mais no celular que no desktop, porque a área é mais alta e estreita.
- **Confira no celular** antes de publicar. O corte é diferente nos dois.

> Não existe opção de "não cortar". Proporção uniforme é o que resolve, e é também o que faz a loja parecer profissional.

---

## A seção não aparece na loja

**Sintoma:** você adicionou a seção, ela aparece no editor, mas não na loja publicada.

Verifique, nesta ordem:

1. **Você salvou?** O editor não salva sozinho.
2. **A seção está oculta?** O ícone de olho na barra lateral esconde sem apagar. Um olho riscado significa oculta.
3. **O tema está publicado?** Se você está editando o rascunho, a loja continua no tema antigo. **Loja virtual → Temas** mostra qual está publicado.
4. **A seção depende de conteúdo que não existe?**
   - *Coleção em destaque* sem coleção escolhida não mostra nada
   - *Vistos recentemente* fica vazia até a cliente navegar
   - *Posts do Blog* sem blog com posts fica vazia
   - *Contagem Regressiva* com data no passado **some**

---

## O texto sumiu na imagem

**Sintoma:** o título sobre o banner ou o vídeo está ilegível.

**Causa:** o texto está sobre uma parte clara da imagem, sem separação suficiente.

**O que fazer:** aumente a **opacidade do scrim** na seção. O scrim é a camada entre a imagem e o texto, e existe exatamente para isso.

Se mesmo no máximo continuar ruim, o problema é a foto — escolha uma com área mais uniforme onde o texto vai ficar.

---

## As cores ficaram estranhas depois que troquei o esquema

**Sintoma:** você trocou o esquema de uma seção e algo ficou invisível, ou os botões sumiram.

**Causa:** o par de **Fundo** e **Texto** daquele esquema não tem contraste suficiente, ou a cor do botão ficou parecida demais com o fundo.

**O que fazer:** veja [Cores e identidade → Contraste](cores-e-marca.html#contraste-a-regra-que-não-é-opinião). Em resumo: meça o contraste entre Fundo e Texto e garanta pelo menos **4,5:1**.

Atalho para conferir a loja inteira de uma vez: abra a página do **style guide** da sua loja (o endereço termina em `/pages/style-guide` se você criou a página com esse template). Ela mostra todos os componentes em todos os esquemas ao mesmo tempo.

---

## O logo aparece com um retângulo branco

**Causa:** o arquivo tem fundo branco em vez de transparente.

**O que fazer:** exporte o logo em **PNG com transparência** ou **SVG**. Em esquemas claros ninguém nota; em esquemas escuros o retângulo salta.

---

## O mega menu abre vazio

**Causa:** o menu principal não tem itens de segundo nível.

**O que fazer:** **Loja virtual → Navegação** → abra o menu principal → adicione subitens dentro de cada item. O tema mostra o que existe no menu; ele não inventa hierarquia.

---

## A barra de frete grátis mostra um valor errado

**Causa:** o valor configurado no tema não é o mesmo das regras de envio da loja.

**O que fazer:** a barra é **visual**. Ela lê o valor que você digitou em **Configurações do tema → Carrinho**, não as regras de frete. Ajuste os dois para o mesmo número:

- No tema: Configurações do tema → Carrinho → Valor mínimo
- Na loja: Configurações → Envio e entrega

---

## O modal da newsletter aparece demais

**O que fazer:** em **Modal Newsletter**, aumente:

- **Delay para aparecer** — pelo menos 10 segundos
- **Não mostrar novamente por** — pelo menos 7 dias

E deixe o link **"Não, obrigado"** visível. Modal sem saída clara faz a cliente fechar a aba, não o modal.

---

## Preenchi a rede social e o ícone não apareceu

**Causa:** só **Instagram, Facebook e YouTube** viram ícone no rodapé.

TikTok, Snapchat, Tumblr e Vimeo têm campo mas não aparecem em lugar nenhum. Twitter alimenta a prévia de link no Twitter/X; Pinterest alimenta os dados estruturados que o Google lê — nenhum dos dois vira ícone.

**O que fazer:** confira também se o bloco **Pagamentos e Social** está presente no rodapé e com a opção de social ligada.

---

## A página de conta está com as cores erradas

**Causa:** login, cadastro, conta, pedidos e endereços não aparecem no editor com seções, então não herdam o esquema de nenhuma.

**O que fazer:** **Configurações do tema → Cores → Esquema de cores das páginas de conta**.

---

## A loja está lenta

Antes de suspeitar do tema, verifique:

1. **Tamanho das imagens.** Foto de 5 MB subida direta da câmera é a causa mais comum. Exporte em no máximo 2000 px de largura.
2. **Apps instalados.** Cada app adiciona código. Desinstale o que não usa — desativar não basta, o código costuma ficar.
3. **Vídeo com autoplay** em várias seções da mesma página.
4. **Número de seções na home.** Acima de 10, considere cortar.

---

## Não achei aqui

Abra um chamado em [github.com/cleytonmendest/elizabeth/issues](https://github.com/cleytonmendest/elizabeth/issues/new) dizendo:

- **qual página** (home, produto, coleção…)
- **qual seção**
- **qual esquema de cores**
- **celular ou computador**
- o que você esperava e o que aconteceu

Sem esses cinco itens a maioria dos relatos não é reproduzível, e um problema que não se reproduz não se corrige.

---

**Anterior:** [← As seções](sections.html) · **Próximo:** [Perguntas frequentes →](faq.html)
