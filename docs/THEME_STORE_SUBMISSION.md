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

Estes vivem no `docs/ROADMAP.md` (seção "Requisitos Críticos") e são a **fonte da verdade**. A revisão da Theme Store é rigorosa neles:

- [ ] **i18n** completo (storefront + schema, PT-BR + EN) — sem strings hardcoded
- [ ] **Acessibilidade** WCAG 2.1 AA (Lighthouse A11y > 90) — *gate atingido (93/93)*
- [ ] **Performance** (Lighthouse mobile > 50) — *validar na loja publicada*
- [ ] **Code Quality** (Theme Check 0 offenses) — *mantido em 0*
- [ ] **Documentação Merchant** (ver seção 5)

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

- [ ] Guia de **setup/instalação/configuração** (para lojista leigo).
- [ ] **Overview de features** (sections/settings).
- [ ] **FAQ** e **formulário de contato de suporte** ao lojista prontos e **linkados** na listagem.
- [ ] **Troubleshooting**.
- [ ] Screenshots high-res (1920×1080) e, opcionalmente, vídeo demo (2-3 min).

---

## 6. Envio

- [ ] **Número de versão** + **release notes** destacando as features principais.
- [ ] Metadados da listagem: nome, descrição, lista de features, docs, contato de suporte, preço.
- [ ] URL de cada **loja demo** (uma por preset).
- [ ] Submeter pelo **Partner Dashboard** → aguardar revisão da Shopify (rigorosa nos bloqueadores da seção 0).

---

## Checklist rápido de "pronto para submeter"

- [ ] Bloqueadores de código (seção 0) todos ✅
- [ ] Loja(s) demo criada(s) como client transfer store, uma por preset
- [ ] Catálogo com imagens reais, licenciadas e consistentes
- [ ] Conteúdo 100% autêntico (zero Lorem Ipsum), PT-BR + EN traduzidos
- [ ] Presets nomeados + pasta `/listings` (se múltiplos)
- [ ] Documentação merchant + FAQ + contato de suporte publicados
- [ ] Versão + release notes
- [ ] Revisão final de Lighthouse (Perf/A11y/Best Practices) na loja **publicada**

---

**Desenvolvido com 💜 por Cleyton Mendes**
