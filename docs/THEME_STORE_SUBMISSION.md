# 🏪 Submissão à Shopify Theme Store — Checklist

Guia prático do processo de submissão do tema **Elizabeth** à Shopify Theme Store.
Cobre a **loja demo**, **imagens/conteúdo**, **presets** e o **processo de envio**.

> **Fontes:** [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements) ·
> [Burst (imagens grátis)](https://burst.shopify.com/) ·
> [Client transfer stores](https://help.shopify.com/en/partners/manage-clients-stores/client-transfer-stores/create-client-transfer-stores)
>
> ⚠️ Os requisitos da Theme Store mudam com frequência — **reconfirmar na doc oficial** antes de submeter.

---

## 0. Pré-requisitos de código (bloqueadores)

Estes NÃO vivem num arquivo. A lista aberta é a das issues com a label
`theme-store-blocker`, e o estado de cada uma é **medido**, não escrito —
ver [ADR 0001](adr/0001-guard-rails-executaveis-no-lugar-do-roadmap.md).

```bash
npm run status    # painel de conformidade
npm run gate      # build + linters + testes
```

| Bloqueador | Quem verifica |
| --- | --- |
| **i18n** completo (storefront + schema, PT-BR + EN), sem string hardcoded | `npm run lint -- --rules=i18n` |
| **Recursos obrigatórios** (seção "Features" dos requisitos, e o que as páginas de produto e de carrinho precisam suportar) | `npm run lint -- --rules=themestore` — uma linha por requisito em `scripts/lint/config/theme-store.json`, cada uma com a issue que a acompanha. As abertas: [`label:theme-store-blocker`](https://github.com/cleytonmendest/elizabeth/issues?q=is%3Aopen+label%3Atheme-store-blocker) |
| **Acessibilidade**: WCAG 2.1 AA, **e** Lighthouse de acessibilidade com média **≥ 90**, em **desktop e celular**, na média de home, coleção e produto | WCAG: `npm run test:e2e` (axe) + `e2e/a11y-baseline.json`. Lighthouse: validar na loja **publicada** — nenhum gate mede ainda ([#58](https://github.com/cleytonmendest/elizabeth/issues/58)) |
| **Performance**: Lighthouse de performance com média **≥ 60**, em **desktop e celular**, na média de home, coleção e produto | validar na loja **publicada** — nenhum gate mede ainda ([#58](https://github.com/cleytonmendest/elizabeth/issues/58)) |
| **Code Quality** (Theme Check 0 offenses) | `npm run gate` |
| **Documentação merchant** | seção 5 abaixo |

Os dois limiares do Lighthouse são da Shopify
([requisitos](https://shopify.dev/docs/storefronts/themes/store/requirements),
"Lighthouse performance and accessibility"; conferido em 26/09/2026). A média é
simples, das três páginas, e vale para **cada** dispositivo; a Shopify roda o
teste sobre um conjunto de dados de referência dela, com as seções preenchidas
por imagem e conteúdo reais — seção vazia não serve de medida. A linha de
performance dizia "Lighthouse mobile > 50", e a de acessibilidade não citava o
Lighthouse: um tema com 55 no celular passaria aqui e seria reprovado na
submissão ([#148](https://github.com/cleytonmendest/elizabeth/issues/148)).

A regra `themestore` verifica **presença**, não funcionamento: ela garante que
`payment_button` está na árvore do form de produto, não que o botão compra a
variante certa. O comportamento de cada recurso é dos testes da issue dele.

> A checklist marcada à mão foi o que apodreceu antes. Se você sentir vontade
> de escrever aqui "isto já está pronto", o lugar certo é um linter ou um
> teste — não esta linha.

---

## 1. Conta e loja demo

- [ ] **Shopify Partner account** ativa.
- [ ] Criar a loja demo como **"client transfer store"** pelo Partner Dashboard (⚠️ **não** é dev store comum).
- [ ] **Uma loja demo**, do estilo listado (ver seção 4).
- [ ] A demo deve bater com a **indústria** (moda feminina) e o **tamanho de catálogo** que o estilo listado mira.
- [ ] **Pagamentos:** usar **Bogus Gateway** ou **Shopify Payments em modo teste**; desabilitar as demais opções de checkout.

---

## 2. Imagens (reais, não placeholder)

- [ ] **Direitos garantidos** para toda imagem (Shopify Partner Agreement). Sem marca/logo de terceiros sem permissão do dono.
- [ ] Fonte recomendada: **Shopify Burst** (grátis, licença livre). Alternativas: Unsplash/Pexels (conferir licença/restrições de modelo).
- [ ] **Consistência visual:** mesma proporção (ex.: 4:5 retrato) para a grade da coleção ficar alinhada.

**Como colocar em massa nos produtos (fluxo confiável):**
1. Subir todas as fotos em **Conteúdo → Arquivos** da loja (gera URLs `cdn.shopify.com/...`, que são **diretas** — sem redirect/HMAC que quebra o import, ao contrário de picsum/loremflickr).
2. Montar um CSV mapeando `Handle → Image Src` (só `Handle`, `Image Src`, `Image Position`, `Image Alt Text`).
3. **Produtos → Importar**, com **"Substituir produtos com o mesmo handle"** marcado → anexa as imagens sem tocar em preço/estoque/variantes.

> Para poucos produtos, atribuir manualmente dá melhor controle de qualidade.
> Scripts de geração de CSV ficam em uso pontual (fora do repositório).

---

## 3. Conteúdo autêntico (sem Lorem Ipsum)

A Shopify **proíbe** Lorem Ipsum / texto de onboarding / placeholder / palavrões.

- [ ] **Produtos:** descrições **únicas e autênticas** por produto (não repetir o mesmo texto), com variantes (Cor/Tamanho), preços realistas e alguns com "compare at" (preço riscado).
- [ ] **Coleções** coerentes com o nicho e suficientes para exercitar navegação/filtros (ex.: Vestidos, Blusas, Novidades, Sale). Catálogo com volume convincente (mais que o mínimo de teste).
- [ ] **Menus** (header + footer) montados com hierarquia real.
- [ ] **Home** "merchandeada" contando a história da marca (hero, coleções em destaque, lookbook, depoimentos, newsletter…). Ela mora na branch da loja demo, e não na `main`: a home da `main` é a do tema instalado do zero, com toda section e nenhuma foto ([ADR 0018](adr/0018-a-main-e-o-tema-e-cada-loja-e-uma-branch.md)).
- [ ] **Páginas:** Sobre, Contato, FAQ (usar a section `collapsible-content`), Política de Privacidade/Termos.
- [ ] **Blog** com posts reais.
- [ ] **Sem funcionalidade dependente de app de terceiros** (exceção: apps **gratuitos** de review e de tradução; se usar tradução, tudo precisa estar 100% traduzido).

---

## 4. Presets / estilos

**Decisão: o tema ENTREGA quatro presets e a listagem anuncia UM estilo
("Elizabeth").**

São coisas diferentes, e confundi-las custa caro:

| | O que é | Quantos |
| --- | --- | --- |
| **Preset** em `settings_data.json` | a lojista escolhe no editor | **4**, todos entregues |
| **Style** na listagem | uma vitrine na Theme Store, com demo e screenshots próprios | **1** |

Listar um estilo é o que torna a submissão viável num prazo curto: uma loja
demo em vez de quatro, 5-7 screenshots em vez de 20-28, e a pasta `/listings`
deixa de se aplicar ([issue #114](https://github.com/cleytonmendest/elizabeth/issues/114)).
A lojista não perde nada — os quatro presets continuam no editor.

O tema tem quatro, em `config/settings_data.json`, e cada um sobrescreve os
mesmos settings: as fontes de título e de corpo (`type_header_font`,
`type_body_font`), os color schemes (`color_schemes`), a largura da página e a
do logo (`page_width`, `logo_width`), o valor do frete grátis
(`cart_free_shipping_threshold`), três redes sociais (`social_facebook_link`,
`social_instagram_link`, `social_youtube_link`) e `content_for_index`.

Logo, favicon e `logo_svg` saíram dos presets na fase 3 da
[issue #168](https://github.com/cleytonmendest/elizabeth/issues/168). Eles são
a identidade de uma loja, e um preset que os carregasse trocaria o logo de quem
o escolhe pelo da Elizabeth Estudos. A regra `neutra` reprova quem os puser de
volta.

**O que eles NÃO mudam é o layout.** O último deles é `content_for_index`,
e ele está **vazio** nos quatro — é chave legada de tema pré-OS 2.0, quando o
arranjo da home morava no `settings_data.json`. Aqui a home é o
`templates/index.json`, um só, compartilhado. Trocar de preset muda cor, fonte
e largura; a ordem e o conteúdo das seções são idênticos.

Isso é o problema da [issue #114](https://github.com/cleytonmendest/elizabeth/issues/114),
e é o que a pasta `/listings` existe para resolver:

| Preset | Fonte de título | Fundo | Texto | Botão |
| --- | --- | --- | --- | --- |
| **Elizabeth** | Work Sans | `#ffffff` | `#121212` | `#121212` |
| **Rosé** | Cormorant | `#FCF8F5` | `#3D2C2E` | `#B76E79` |
| **Noir** | Playfair | `#14110F` | `#F2EDE7` | `#C9A227` |
| **Botânico** | Fraunces | `#F4F2EC` | `#2E3A2E` | `#7C8B6E` |

Esta tabela não é escrita à mão sem rede: `tests/docs.test.mjs` compara os
nomes com os de `settings_data.json` e reprova se divergirem, nos dois
sentidos. Ela substitui uma linha que afirmava "o tema tem um estilo só"
enquanto os quatro já existiam no código — o mesmo tipo de afirmação não
medida que a [ADR 0001](adr/0001-guard-rails-executaveis-no-lugar-do-roadmap.md)
descreve.

- [x] Presets definidos. O estilo listado **usa o nome do tema** ("Elizabeth") ✓
- [x] Nome com **1-2 palavras e menos de 30 caracteres** ✓ — falta conferir se é **único** na Theme Store
- [x] Pasta `/listings`: **não se aplica** com um estilo listado
- [ ] **Uma loja demo** (§1-3), montada com o preset Elizabeth
- [ ] Screenshots — [issue #112](https://github.com/cleytonmendest/elizabeth/issues/112)

> Listar mais estilos depois é possível, e aí `/listings`, demo e screenshots
> por estilo voltam à mesa. A ordem certa é submeter primeiro.

> A regra "múltiplos estilos exigem `/listings` e uma demo cada" vem da doc da
> Theme Store citada no topo deste arquivo, e **não** de medição nossa. Com um
> estilo listado ela não morde; se um dia listar mais, reconfirmar antes.

---

## 5. Documentação merchant

**Publicada:** <https://cleytonmendest.github.io/elizabeth/>

Em PT-BR e inglês, por GitHub Pages a partir de `docs/`. Os arquivos ficam em
`docs/lojista/` e `docs/merchant/`; o índice bilíngue é `docs/index.md`.

O endereço acima é o que vai na listagem da Theme Store, e ele não é digitado
à mão em dois lugares: `tests/docs.test.mjs` o monta a partir de `url` +
`baseurl` do `docs/_config.yml` e exige que esta seção o contenha. Renomear o
repositório muda o endereço, e o teste reprova até esta linha acompanhar.

`npm run site` constrói o site e mede o HTML gerado — layout aplicado, idioma
declarado por pasta, links resolvendo. Ele existe porque a primeira publicação
saiu como doze fragmentos sem `<head>`, com o build relatando sucesso.

- [x] Guia de **setup/instalação/configuração** (para lojista leigo) — [`lojista/primeiros-passos.md`](lojista/primeiros-passos.md) · [`merchant/getting-started.md`](merchant/getting-started.md)
- [x] **Overview de features** (sections/settings) — [`lojista/sections.md`](lojista/sections.md) · [`merchant/sections.md`](merchant/sections.md)
- [x] **Cores e identidade**, incluindo o critério de contraste — [`lojista/cores-e-marca.md`](lojista/cores-e-marca.md) · [`merchant/colors-and-brand.md`](merchant/colors-and-brand.md)
- [x] **Troubleshooting** — [`lojista/problemas-comuns.md`](lojista/problemas-comuns.md) · [`merchant/troubleshooting.md`](merchant/troubleshooting.md)
- [x] **FAQ** — [`lojista/faq.md`](lojista/faq.md) · [`merchant/faq.md`](merchant/faq.md)
- [x] **GitHub Pages ligado** e o site de pé nos dois idiomas
- [ ] Screenshots high-res (1920×1080, 5-7 imagens) e, opcionalmente, vídeo demo (2-3 min) — exigem a loja demo montada (seções 1-3).

---

## 6. Envio

- [ ] **Número de versão** + **release notes** destacando as features principais.
- [ ] Metadados da listagem: nome, descrição, lista de features, preço.
- [ ] **URL da documentação** na listagem: <https://cleytonmendest.github.io/elizabeth/>
- [ ] **Contato de suporte** na listagem.
- [ ] URL da **loja demo** — uma só, a do estilo listado (seção 4).
- [ ] Submeter pelo **Partner Dashboard** → aguardar revisão da Shopify (rigorosa nos bloqueadores da seção 0).

---

## Checklist rápido de "pronto para submeter"

- [ ] Bloqueadores de código (seção 0) todos ✅
- [ ] Loja demo criada como client transfer store (seção 1)
- [ ] Catálogo com imagens reais, licenciadas e consistentes
- [ ] Conteúdo 100% autêntico (zero Lorem Ipsum), PT-BR + EN traduzidos
- [ ] Um estilo listado ("Elizabeth"), uma loja demo — os 4 presets seguem entregues no tema
- [ ] Documentação merchant publicada ✅ · URL e contato de suporte na listagem da Theme Store
- [ ] Versão + release notes
- [ ] Revisão final de Lighthouse na loja **publicada**: performance e acessibilidade dentro dos limiares da seção 0, em desktop **e** celular

---

**Desenvolvido com 💜 por Cleyton Mendes**
