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
| **Acessibilidade** WCAG 2.1 AA | `npm run test:e2e` (axe) + `e2e/a11y-baseline.json` |
| **Performance** (Lighthouse mobile > 50) | validar na loja **publicada** — nenhum gate mede isto |
| **Code Quality** (Theme Check 0 offenses) | `npm run gate` |
| **Documentação merchant** | seção 5 abaixo |

> A checklist marcada à mão foi o que apodreceu antes. Se você sentir vontade
> de escrever aqui "isto já está pronto", o lugar certo é um linter ou um
> teste — não esta linha.

---

## 1. Conta e loja demo

- [ ] **Shopify Partner account** ativa.
- [ ] Criar a loja demo como **"client transfer store"** pelo Partner Dashboard (⚠️ **não** é dev store comum).
- [ ] **Uma loja demo por preset/estilo** do tema (ver seção 4).
- [ ] Cada demo deve bater com a **indústria** (moda feminina) e o **tamanho de catálogo** que o preset mira.
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
- [ ] **Home** "merchandeada" contando a história da marca (hero, coleções em destaque, lookbook, depoimentos, newsletter…).
- [ ] **Páginas:** Sobre, Contato, FAQ (usar a section `collapsible-content`), Política de Privacidade/Termos.
- [ ] **Blog** com posts reais.
- [ ] **Sem funcionalidade dependente de app de terceiros** (exceção: apps **gratuitos** de review e de tradução; se usar tradução, tudo precisa estar 100% traduzido).

---

## 4. Presets / estilos

- [ ] Definir preset(s) do tema. **Um preset usa o nome do tema** ("Elizabeth").
- [ ] Nomes de preset: **1-2 palavras, < 30 caracteres, únicos** na Theme Store.
- [ ] Múltiplos presets exigem **conjuntos de templates distintos** numa pasta **`/listings`** dentro do zip do tema.
- [ ] Cada preset tem **sua própria loja demo**, com layout/cores/tipografia espelhando o preset.

> **Estado atual:** o tema tem um estilo só. Definir a estratégia de presets (quantos, nomes, paletas) antes de submeter.

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
- [ ] URL de cada **loja demo** (uma por preset).
- [ ] Submeter pelo **Partner Dashboard** → aguardar revisão da Shopify (rigorosa nos bloqueadores da seção 0).

---

## Checklist rápido de "pronto para submeter"

- [ ] Bloqueadores de código (seção 0) todos ✅
- [ ] Loja(s) demo criada(s) como client transfer store, uma por preset
- [ ] Catálogo com imagens reais, licenciadas e consistentes
- [ ] Conteúdo 100% autêntico (zero Lorem Ipsum), PT-BR + EN traduzidos
- [ ] Presets nomeados + pasta `/listings` (se múltiplos)
- [ ] Documentação merchant publicada ✅ · URL e contato de suporte na listagem da Theme Store
- [ ] Versão + release notes
- [ ] Revisão final de Lighthouse (Perf/A11y/Best Practices) na loja **publicada**

---

**Desenvolvido com 💜 por Cleyton Mendes**
