# 🗺️ ROADMAP - Tema Elizabeth

**Última atualização:** 2025-11-09 18:30
**Versão do Tema:** 1.0.0
**Status:** Em desenvolvimento ativo

---

## 📊 Visão Geral do Projeto

Este documento apresenta uma análise completa do estado atual do tema Elizabeth e mapeia todas as melhorias, correções e implementações necessárias para torná-lo production-ready e competitivo no mercado de e-commerce.

### Estatísticas Atuais

| Categoria | Total | Completos | Incompletos/Básicos |
|-----------|-------|-----------|---------------------|
| **Seções** | 15 | 12 | 3 |
| **Snippets** | 52 | 52 | 0 |
| **Templates** | 20 | 11 | 9 |
| **Templates Cliente** | 7 | 4 | 3 |
| **Web Components** | 9 | 7 | 2 |
| **Ícones** | 29 | 29 | 0 |

### Nível de Maturidade do Projeto

```
████████░░ 80% - Design & Layout
██████████ 100% - Sistema de Cores/Tipografia
████████░░ 85% - Componentes JavaScript
███████░░░ 70% - Páginas de Cliente ⬆️ (+30%)
██████░░░░ 60% - Templates Principais
███░░░░░░░ 30% - SEO & Acessibilidade
█████░░░░░ 50% - Performance
```

### 🎉 Atualizações Recentes (2025-11-09)

**4 páginas de cliente implementadas com sucesso:**
- ✅ Login (com recuperação de senha integrada)
- ✅ Register (com validador de força de senha)
- ✅ Reset Password (com confirmação e validação)
- ✅ Account (dashboard completo com pedidos e estatísticas)

---

## 🚨 PRIORIDADE CRÍTICA - Pré-Lançamento

Itens **obrigatórios** antes de colocar o tema em produção.

### 1. Páginas de Cliente (Customer Pages)

**Status:** 🟡 Em Progresso - 4 de 7 completas (57%)

#### 1.1 Login (`templates/customers/login.liquid`) ✅ **COMPLETO**
- [x] Criar design moderno para formulário de login
- [x] Adicionar link para recuperação de senha (toggle integrado)
- [x] Adicionar link para criar conta
- [x] Implementar validação visual de formulário
- [x] Formulário de recuperação de senha no mesmo template
- [x] Mensagens de erro/sucesso estilizadas
- [x] Link "Voltar para a loja"
- [ ] Adicionar suporte para login social (futuro)

**Recursos implementados:**
- Toggle entre login e recuperação de senha
- Validação HTML5 + JavaScript
- Design consistente com TailwindCSS
- Totalmente responsivo
- Acessibilidade completa (ARIA labels, roles)

#### 1.2 Cadastro (`templates/customers/register.liquid`) ✅ **COMPLETO**
- [x] Criar formulário de registro estilizado
- [x] Adicionar validação de senha (força, confirmação)
- [x] Implementar checkbox de aceite de termos
- [x] Implementar mensagens de erro amigáveis
- [x] Validação em tempo real
- [x] Checkbox de marketing (accepts_marketing)

**Recursos implementados:**
- **Indicador de força de senha** (5 níveis com barra de progresso)
- Toggle de visibilidade de senha
- Grid responsivo para nome/sobrenome
- Validação customizada de termos
- Links para política de privacidade
- Preservação de dados em caso de erro

#### 1.3 Conta (`templates/customers/account.liquid`) ✅ **COMPLETO**
- [x] Criar dashboard do cliente
- [x] Exibir informações do perfil
- [x] Listar pedidos recentes (5 por página)
- [x] Adicionar botões de ação rápida (endereços, continuar comprando)
- [x] Mostrar total de pedidos e endereços salvos
- [x] Estatísticas do cliente (ano de cadastro)
- [x] Botão de logout
- [x] Endereço padrão exibido
- [x] Estado vazio para sem pedidos
- [ ] Adicionar seção de wishlist (quando implementada)

**Recursos implementados:**
- **Dashboard rico** com estatísticas
- Cards de ações rápidas
- **Listagem de pedidos** com:
  - Badges de status (pagamento e envio)
  - Formatação de data BR (DD/MM/YYYY)
  - Link para detalhes
  - Contagem de itens
  - Valor total
- Paginação estilizada
- Grid responsivo (3 colunas desktop)
- Empty state com CTA

#### 1.4 Endereços (`templates/customers/addresses.liquid`)
- [ ] Criar grid de endereços salvos
- [ ] Adicionar botão para novo endereço
- [ ] Implementar formulário modal para edição
- [ ] Marcar endereço padrão visualmente
- [ ] Adicionar confirmação para exclusão
- [ ] Validação de CEP (Brasil)

#### 1.5 Pedido (`templates/customers/order.liquid`)
- [ ] Criar página de detalhes do pedido estilizada
- [ ] Exibir timeline de status do pedido
- [ ] Mostrar produtos com imagens
- [ ] Adicionar botão de rastreamento
- [ ] Permitir re-compra com um clique
- [ ] Mostrar informações de pagamento e envio

#### 1.6 Recuperar Senha (`templates/customers/reset_password.liquid`) ✅ **COMPLETO**
- [x] Design moderno para formulário
- [x] Validação de força de senha (indicador visual)
- [x] Confirmação visual de senha (campo separado)
- [x] Mensagens de sucesso/erro estilizadas
- [x] Link para voltar ao login
- [x] Toggle de visibilidade em ambos os campos

**Recursos implementados:**
- **Indicador de força de senha** (mesmo do register)
- **Validador de confirmação** em tempo real:
  - ✓ Verde quando senhas coincidem
  - ✗ Vermelho quando diferentes
  - Borda colorida no campo
- 2 botões de toggle independentes (senha e confirmação)
- Caixa informativa com dicas de segurança
- Validação antes de submit (previne envio se não coincidem)
- Design consistente com outras páginas

#### 1.7 Ativar Conta (`templates/customers/activate_account.liquid`)
- [ ] Design para primeira ativação
- [ ] Explicação clara do processo
- [ ] Validação de senha
- [ ] Redirecionamento automático após ativação

**Estimativa Original:** 24-32 horas de desenvolvimento
**Tempo Gasto:** ~12 horas (4 páginas completas)
**Tempo Restante:** 12-16 horas (3 páginas restantes)

**Progresso:** 57% completo ✅✅✅✅⬜⬜⬜ (4/7 páginas)

---

### 2. Página de Coleção (Collection)

**Status:** 🔴 Crítico - Implementação básica

**Arquivo:** `templates/collection.liquid`

**Problemas atuais:**
- Limitada a 2 produtos por página (linha 1)
- Sem grid responsivo
- Sem filtros ou ordenação
- Sem descrição da coleção

#### Implementações necessárias:

- [ ] **Criar seção `main-collection.liquid`**
  - Grid de produtos responsivo (2/3/4 colunas)
  - Cabeçalho com título e descrição da coleção
  - Imagem de destaque da coleção
  - Contador de produtos

- [ ] **Sistema de Filtros**
  - Filtro por preço (slider de range)
  - Filtro por cor (swatches)
  - Filtro por tamanho
  - Filtro por disponibilidade
  - Filtro por tags/categorias
  - Limpar todos os filtros

- [ ] **Sistema de Ordenação**
  - Mais relevantes
  - Menor preço
  - Maior preço
  - Mais vendidos
  - Novidades
  - A-Z / Z-A
  - Dropdown de ordenação

- [ ] **Paginação**
  - Aumentar para 12-24 produtos por página
  - Opção de "Carregar mais" (infinite scroll)
  - Ou paginação numérica tradicional
  - Preservar filtros/ordenação na navegação

- [ ] **Visualização**
  - Toggle entre grid/lista
  - Opção de 2/3/4 colunas
  - Quick view ao passar o mouse
  - Segunda imagem no hover

- [ ] **SEO**
  - Canonical tags
  - Meta description
  - Structured data (CollectionPage)

**Estimativa:** 16-24 horas de desenvolvimento

---

### 3. Página de Busca (Search)

**Status:** 🔴 Crítico - Implementação básica

**Arquivo:** `templates/search.liquid`

**Problemas atuais:**
- Layout básico sem estilização
- Sem grid de produtos
- Sem filtros
- Sem sugestões

#### Implementações necessárias:

- [ ] **Criar seção `main-search.liquid`**
  - Grid de resultados similar à coleção
  - Exibir query de busca
  - Contador de resultados
  - Mensagem "Nenhum resultado encontrado"

- [ ] **Busca Preditiva/Autocomplete**
  - Completar implementação em `search-component.js` (linhas 41-48)
  - Dropdown de sugestões ao digitar
  - Mostrar produtos, coleções e páginas
  - Destacar termo buscado
  - Adicionar "Ver todos os resultados"
  - Debounce de 300ms

- [ ] **Resultados**
  - Separar por tipo (Produtos, Páginas, Artigos)
  - Grid responsivo para produtos
  - Snippets de páginas/artigos
  - Paginação

- [ ] **Filtros**
  - Filtrar por tipo (Produtos/Páginas/Artigos)
  - Filtros de produto (preço, cor, etc.)
  - Disponibilidade

- [ ] **Buscas Populares**
  - Mostrar quando campo vazio
  - Links rápidos para termos comuns

- [ ] **Analytics**
  - Rastrear termos buscados
  - Identificar buscas sem resultados

**Estimativa:** 12-16 horas de desenvolvimento

---

### 4. Modal de Newsletter

**Status:** 🔴 Crítico - Apenas schema, sem implementação

**Arquivo:** `sections/newsletter-modal.liquid`

**Situação:** Arquivo contém apenas o schema JSON, sem HTML/Liquid

#### Implementações necessárias:

- [ ] **Modal HTML/CSS**
  - Design atrativo com imagem/ilustração
  - Formulário de email
  - Botão de fechar (X)
  - Animação de entrada suave
  - Backdrop com blur

- [ ] **Funcionalidade JavaScript**
  - Trigger baseado em tempo (ex: 5 segundos)
  - Trigger baseado em scroll (ex: 50% da página)
  - Exit intent detection
  - Cookie para "não mostrar novamente" (30 dias)
  - Opção "Não mostrar novamente hoje"
  - Fechar ao clicar fora
  - Fechar com ESC

- [ ] **Integração**
  - Integração com Shopify Customer API
  - Validação de email
  - Mensagem de sucesso
  - Mensagem de erro
  - Loading state

- [ ] **Configurações**
  - Ativar/desativar via settings
  - Configurar delay
  - Configurar frequência
  - Texto customizável
  - Imagem customizável

**Estimativa:** 8-12 horas de desenvolvimento

---

### 5. Correções de Bugs Críticos

#### 5.1 Segurança: HTTP em Meta Tags
**Arquivo:** `snippets/meta-tags.liquid:23`

```liquid
<!-- INCORRETO -->
<meta property="og:image" content="http:{{ page_image | image_url }}">

<!-- CORRETO -->
<meta property="og:image" content="https:{{ page_image | image_url }}">
```

- [ ] Corrigir protocolo para HTTPS

#### 5.2 Remover Console.log de Produção

Arquivos afetados (8 arquivos):
- [ ] `assets/search-component.js`
- [ ] `assets/carousel-manager.js`
- [ ] `assets/cart.js`
- [ ] `assets/quantity-selector.js`
- [ ] `assets/variations-selector.js`
- [ ] `assets/price-component.js`
- [ ] Outros arquivos JS

**Ação:** Criar função de debug que só loga em ambiente de desenvolvimento.

#### 5.3 Remover Arquivo de Teste
**Arquivo:** `sections/product-test.liquid`

- [ ] Deletar arquivo antes de produção
- [ ] Verificar se não está referenciado em templates

#### 5.4 Cores Hardcoded
**Arquivo:** `snippets/add-to-cart.liquid`

- [ ] Substituir `bg-orange-500` por variável de settings
- [ ] Tornar cor do botão configurável

#### 5.5 Typo em Highlighted Product
**Arquivo:** `sections/highlighted-product.liquid:6`

```liquid
{% assign qtd_side_buy = block.settings.sideToBuyButton %}''
```

- [ ] Remover aspas simples extras no final

**Estimativa:** 2-4 horas de desenvolvimento

---

### 6. Acessibilidade (A11y) - Mínimo Necessário

#### 6.1 Alt Texts em Imagens
- [ ] Adicionar alt text descritivo em todas as imagens
- [ ] Sliders de imagem (slider-image.liquid)
- [ ] Cards de produto (card-product-slider.liquid)
- [ ] Imagens de seções
- [ ] Logos e ícones decorativos (alt="")

#### 6.2 ARIA Labels
- [ ] Botões de navegação (prev/next)
- [ ] Ícones sem texto
- [ ] Botão de menu mobile
- [ ] Botão de fechar modal/drawer
- [ ] Botão de busca
- [ ] Botões de quantidade (+/-)

#### 6.3 Skip Links
- [ ] Adicionar "Pular para conteúdo" no início do theme.liquid
- [ ] Estilizar para aparecer apenas no foco do teclado

#### 6.4 Navegação por Teclado
- [ ] Testar menu mobile com teclado
- [ ] Garantir foco visível em todos os elementos interativos
- [ ] Tab order lógico
- [ ] Escape fecha modais/drawers

#### 6.5 Contraste de Cores
- [ ] Verificar todas as combinações texto/fundo
- [ ] Garantir ratio mínimo de 4.5:1 (WCAG AA)
- [ ] Testar com ferramentas automatizadas

**Estimativa:** 8-12 horas de desenvolvimento

---

### 7. SEO Estruturado

#### 7.1 JSON-LD Schema Markup
- [ ] **Product Schema** (main-product.liquid)
  - name, image, description
  - offers (price, availability)
  - brand, sku
  - aggregateRating (quando reviews implementado)

- [ ] **Organization Schema** (theme.liquid)
  - name, logo, url
  - sameAs (redes sociais)
  - contactPoint

- [ ] **Breadcrumb Schema** (breadcrumb.liquid)
  - BreadcrumbList com itemListElement

- [ ] **CollectionPage Schema** (collection)
  - name, description, url
  - numberOfItems

**Estimativa:** 6-8 horas de desenvolvimento

---

## 🟠 PRIORIDADE ALTA - Pós-Lançamento Imediato

Recursos importantes para competitividade no mercado.

### 8. Funcionalidades de Produto Avançadas

#### 8.1 Image Zoom/Lightbox
**Status:** Schema existe mas não implementado

- [ ] Modal de lightbox para galeria
- [ ] Zoom ao passar mouse (desktop)
- [ ] Navegação entre imagens
- [ ] Thumbnails na galeria
- [ ] Suporte para vídeos de produto

#### 8.2 Variant Image Switching
- [ ] Trocar imagem principal ao selecionar variante
- [ ] Smooth transition entre imagens
- [ ] Atualizar galeria completa se variante tiver imagens próprias

#### 8.3 Color Swatches
**Status:** Schema existe (`swatch_picker` em main-product.liquid)

- [ ] Implementar visualização de cores
- [ ] Suporte para imagens de swatch
- [ ] Indicação visual de selecionado
- [ ] Tooltip com nome da cor

#### 8.4 Size Guide Modal
- [ ] Botão "Guia de Tamanhos"
- [ ] Modal com tabela de medidas
- [ ] Conteúdo configurável por produto/coleção
- [ ] Suporte para imagens de guia

#### 8.5 Sticky Add to Cart (Desktop)
**Status:** Mobile implementado, desktop não

- [ ] Barra sticky ao rolar após botão
- [ ] Mostrar variante selecionada
- [ ] Incluir preço
- [ ] Animação suave

**Estimativa:** 16-20 horas de desenvolvimento

---

### 9. Recomendações de Produtos

#### 9.1 "Você Também Pode Gostar"
- [ ] Seção na página de produto
- [ ] Baseado em tags/coleção
- [ ] Slider de produtos relacionados
- [ ] Configurável por número de produtos

#### 9.2 "Produtos Visualizados Recentemente"
- [ ] Armazenar em localStorage
- [ ] Exibir em slider
- [ ] Limitar a 8-12 produtos
- [ ] Snippet reutilizável

#### 9.3 "Complete o Look"
- [ ] Produtos complementares
- [ ] Adicionar múltiplos ao carrinho
- [ ] Desconto para kit (futuro)

**Estimativa:** 12-16 horas de desenvolvimento

---

### 10. Melhorias no Carrinho

#### 10.1 Recursos Adicionais
- [ ] **Notas do Pedido**
  - Campo de texto para instruções especiais
  - Placeholder com exemplos

- [ ] **Gift Wrapping**
  - Checkbox para embrulho
  - Custo adicional opcional

- [ ] **Shipping Calculator**
  - Campo de CEP
  - Exibir opções e prazos
  - Integração com Correios API

- [ ] **Barra de Frete Grátis**
  - "Faltam R$ X para frete grátis"
  - Barra de progresso visual
  - Configurável valor mínimo

- [ ] **Cupom de Desconto**
  - Campo para código
  - Validação visual
  - Mostrar desconto aplicado

- [ ] **Recomendações no Carrinho**
  - "Frequentemente comprados juntos"
  - Mini cards de produtos
  - Add rápido sem sair do carrinho

#### 10.2 Melhorias de UX
- [ ] Botão "Continuar comprando"
- [ ] Link para página da coleção
- [ ] Estimativa de entrega
- [ ] Trust badges (pagamento seguro, etc.)
- [ ] Atualizar automaticamente ao mudar quantidade

**Estimativa:** 16-20 horas de desenvolvimento

---

### 11. Performance - Otimização JavaScript

#### 11.1 Migração de jQuery para Vanilla JS
**Motivação:** Reduzir ~145KB de código jQuery

**Prioridade:**
1. [ ] **theme.js** - Mobile menu (mais simples)
2. [ ] **search-component.js** - Já usa Web Component
3. [ ] **header.js** - Já usa Web Component
4. [ ] **Owl Carousel** - Avaliar alternativas:
   - Swiper.js (mais moderno, 50KB)
   - Splide (mais leve, 30KB)
   - Implementação custom com CSS Grid

**Ganhos esperados:**
- Redução de ~100KB de JavaScript
- Melhoria no FID (First Input Delay)
- Menos dependências

**Estimativa:** 20-24 horas de desenvolvimento

#### 11.2 Lazy Loading
- [ ] Adicionar `loading="lazy"` em imagens abaixo da dobra
- [ ] Implementar intersection observer para sliders
- [ ] Lazy load de vídeos de produto

#### 11.3 Otimização de Imagens
- [ ] Implementar srcset em todas as imagens
- [ ] Suporte para WebP com fallback
- [ ] Tamanhos corretos para cada breakpoint
- [ ] Compressão automática (via Shopify)

**Estimativa:** 8-12 horas de desenvolvimento

---

### 12. Blog Completo

#### 12.1 Main Blog Section (`sections/main-blog.liquid`)
**Status:** Não existe

- [ ] Grid de artigos responsivo
- [ ] Card com imagem, título, excerpt, data, autor
- [ ] Paginação
- [ ] Filtro por tags
- [ ] Busca no blog
- [ ] Featured post em destaque

#### 12.2 Main Article Section (`sections/main-article.liquid`)
**Status:** Não existe

- [ ] Layout do artigo com tipografia otimizada
- [ ] Imagem de destaque
- [ ] Autor e data
- [ ] Tags do artigo
- [ ] Compartilhamento social
- [ ] Artigos relacionados
- [ ] Comentários (Disqus ou nativo)
- [ ] Navegação prev/next

#### 12.3 Schema Markup
- [ ] BlogPosting schema
- [ ] Author schema
- [ ] Breadcrumb

**Estimativa:** 12-16 horas de desenvolvimento

---

## 🟡 PRIORIDADE MÉDIA - Médio Prazo

Recursos que agregam valor mas não são críticos.

### 13. Wishlist (Lista de Desejos)

**Status:** Ícones existem mas funcionalidade não

#### Implementações necessárias:

- [ ] **Sistema de Armazenamento**
  - localStorage para guests
  - Customer metafields para logados
  - Sincronizar ao fazer login

- [ ] **Componente Wishlist**
  - Web Component `<wishlist-button>`
  - Ícone de coração (outline/filled)
  - Adicionar/remover com animação
  - Contador no header

- [ ] **Página de Wishlist**
  - Template `page.wishlist.liquid`
  - Grid de produtos
  - Botão "Mover para carrinho"
  - Remover item
  - Compartilhar wishlist (futuro)

- [ ] **Integração**
  - Botão em card de produto
  - Botão na página de produto
  - Badge "Na wishlist"

**Estimativa:** 16-20 horas de desenvolvimento

---

### 14. Quick View (Visualização Rápida)

- [ ] **Modal de Quick View**
  - Abrir ao clicar em botão no card
  - Mostrar imagem principal + thumbnails
  - Seletor de variantes
  - Preço e disponibilidade
  - Botão "Ver detalhes completos"
  - Botão "Adicionar ao carrinho"
  - Fechar com X, ESC, ou click fora

- [ ] **Integração**
  - Botão em todos os cards de produto
  - Ícone de olho ou "Quick View"
  - Keyboard navigation

**Estimativa:** 12-14 horas de desenvolvimento

---

### 15. Filtros Avançados (Faceted Search)

**Para Collection e Search:**

- [ ] **UI de Filtros**
  - Sidebar ou offcanvas
  - Accordion de categorias
  - Checkboxes para opções múltiplas
  - Range slider para preço
  - Color swatches
  - Tags
  - Contador de produtos por filtro

- [ ] **Lógica de Filtros**
  - Usar Shopify Filter API
  - AJAX para não recarregar página
  - URL parameters para compartilhar
  - "Limpar filtros"
  - Breadcrumb de filtros ativos

- [ ] **Performance**
  - Debounce nas mudanças
  - Loading state
  - Cache de resultados

**Estimativa:** 20-24 horas de desenvolvimento

---

### 16. Recursos de Marketing

#### 16.1 Popup de Email Capture
- [ ] Modal de captura de email (diferente do newsletter)
- [ ] Oferta especial (10% off, etc.)
- [ ] Exit intent detection
- [ ] Cookie para não repetir
- [ ] A/B testing de mensagens

#### 16.2 Promo Banner System
- [ ] Seção de banner promocional
- [ ] Countdown timer configurável
- [ ] Dismissible (pode fechar)
- [ ] Múltiplos banners rotativos
- [ ] Programar por data

#### 16.3 Stock Urgency
- [ ] "Apenas X unidades restantes"
- [ ] Configurar threshold mínimo
- [ ] Exibir em produto e cart
- [ ] Cor de alerta

#### 16.4 Countdown Timers
- [ ] Timer de oferta relâmpago
- [ ] Timer de lançamento
- [ ] Configurável por produto/coleção
- [ ] Animação de dígitos

**Estimativa:** 16-20 horas de desenvolvimento

---

### 17. Reviews de Produtos

**Opções:**
1. Integração com app (Shopify Reviews, Loox, Judge.me)
2. Implementação custom

#### 17.1 Se Custom:
- [ ] Modelo de dados (metafields)
- [ ] Formulário de review
- [ ] Exibição de reviews
- [ ] Rating stars
- [ ] Filtro de reviews
- [ ] Ordenação (mais úteis, recentes)
- [ ] Fotos de clientes
- [ ] Review schema markup

#### 17.2 Se App:
- [ ] Escolher app
- [ ] Integrar snippets
- [ ] Estilizar para match do tema

**Estimativa:** 24-30 horas (custom) ou 6-8 horas (app)

---

### 18. Mega Menu

- [ ] Dropdown de múltiplas colunas
- [ ] Suporte para imagens
- [ ] Featured products
- [ ] Call-to-action buttons
- [ ] Configurável via section settings
- [ ] Animação suave de abertura
- [ ] Mobile: accordion style

**Estimativa:** 12-16 horas de desenvolvimento

---

### 19. Recursos de Internacionalização

#### 19.1 Currency Selector
- [ ] Dropdown de moedas
- [ ] Usar Shopify Markets/Currency API
- [ ] Armazenar preferência em cookie
- [ ] Atualizar preços em tempo real

#### 19.2 Language Selector
- [ ] Dropdown de idiomas
- [ ] Estrutura de tradução completa
- [ ] hreflang tags
- [ ] Bandeiras dos países

**Estimativa:** 12-16 horas de desenvolvimento

---

## 🟢 PRIORIDADE BAIXA - Longo Prazo

Features avançadas para diferenciar no mercado.

### 20. Product Comparison

- [ ] Checkbox "Adicionar para comparar"
- [ ] Barra flutuante com produtos selecionados
- [ ] Página/modal de comparação
- [ ] Tabela de especificações
- [ ] Limite de 3-4 produtos
- [ ] localStorage

**Estimativa:** 16-20 horas de desenvolvimento

---

### 21. Back in Stock Notifications

- [ ] Formulário de notificação
- [ ] Integração com email
- [ ] Customer metafield para rastreio
- [ ] Email automático quando restock
- [ ] Admin dashboard (futuro)

**Estimativa:** 20-24 horas de desenvolvimento

---

### 22. Social Features

#### 22.1 Social Sharing
- [ ] Botões de compartilhamento
- [ ] Facebook, Pinterest, Twitter, WhatsApp
- [ ] Native share API (mobile)
- [ ] Personalização de mensagem

#### 22.2 Instagram Feed
- [ ] Integração com Instagram API
- [ ] Grid de posts
- [ ] Lightbox ao clicar
- [ ] Link para perfil
- [ ] Hashtag feed

#### 22.3 User Generated Content
- [ ] Galeria de fotos de clientes
- [ ] Tag de produto nas fotos
- [ ] Moderation system
- [ ] Instagram integration

**Estimativa:** 20-28 horas de desenvolvimento

---

### 23. Store Locator

- [ ] Página de lojas físicas
- [ ] Integração com Google Maps
- [ ] Busca por CEP/Cidade
- [ ] Lista de lojas
- [ ] Informações (endereço, horário, telefone)
- [ ] Direções

**Estimativa:** 16-20 horas de desenvolvimento

---

### 24. Size Chart System

- [ ] Templates de tabelas de medidas
- [ ] Metafields de produto
- [ ] Modal de tabela
- [ ] Suporte para imagens
- [ ] Múltiplas tabelas (tops, bottoms, etc.)

**Estimativa:** 8-12 horas de desenvolvimento

---

### 25. Advanced Admin Features

#### 25.1 Section Presets
- [ ] Presets para cada seção
- [ ] Layouts pré-configurados
- [ ] "Homepage Elegante"
- [ ] "Homepage Moderna"
- [ ] "Homepage Minimalista"

#### 25.2 Documentation
- [ ] Guia de setup do tema
- [ ] Vídeo tutorials
- [ ] FAQ
- [ ] Troubleshooting

#### 25.3 Theme Setup Assistant
- [ ] Wizard de primeira configuração
- [ ] Checklist de tarefas
- [ ] Links rápidos para settings importantes

**Estimativa:** 16-20 horas de desenvolvimento

---

## 🛠️ MELHORIAS TÉCNICAS

### 26. Code Quality

#### 26.1 Refatoração
- [ ] Remover código duplicado
- [ ] Padronizar nomenclatura
- [ ] Consolidar estilos similares
- [ ] Melhorar comentários

#### 26.2 Error Handling
- [ ] Try-catch em todas as operações async
- [ ] Fallbacks para falhas de API
- [ ] Mensagens de erro user-friendly
- [ ] Logging estruturado

#### 26.3 Testing
- [ ] Unit tests para componentes JS
- [ ] Testes de integração
- [ ] Cross-browser testing
- [ ] Responsive testing
- [ ] Performance testing

**Estimativa:** 24-32 horas de desenvolvimento

---

### 27. Performance Avançada

#### 27.1 Critical CSS
- [ ] Extrair CSS crítico above-the-fold
- [ ] Inline critical CSS
- [ ] Lazy load resto do CSS

#### 27.2 Resource Hints
- [ ] Preconnect para CDNs
- [ ] Prefetch para páginas prováveis
- [ ] Preload para assets críticos

#### 27.3 Service Worker
- [ ] Cache de assets estáticos
- [ ] Offline fallback
- [ ] Background sync

#### 27.4 Code Splitting
- [ ] Separar JS por página
- [ ] Lazy load componentes não críticos
- [ ] Dynamic imports

**Estimativa:** 20-24 horas de desenvolvimento

---

### 28. Accessibility Avançada

- [ ] Roving tabindex em menus
- [ ] Live regions para updates dinâmicos
- [ ] Reduced motion support
- [ ] High contrast mode
- [ ] Screen reader testing completo
- [ ] ARIA live para cart updates
- [ ] Focus trap em modais

**Estimativa:** 12-16 horas de desenvolvimento

---

### 29. Analytics & Tracking

- [ ] Google Analytics 4 integration
- [ ] Enhanced ecommerce tracking
- [ ] Facebook Pixel
- [ ] Custom events
- [ ] Conversion tracking
- [ ] Search tracking
- [ ] Error tracking (Sentry)

**Estimativa:** 8-12 horas de desenvolvimento

---

## 📋 BACKLOG DE BUGS CONHECIDOS

### Bugs Confirmados

| ID | Severidade | Arquivo | Linha | Descrição | Status |
|----|------------|---------|-------|-----------|--------|
| BUG-001 | 🔴 Crítico | `snippets/meta-tags.liquid` | 23 | HTTP ao invés de HTTPS em og:image | Pendente |
| BUG-002 | 🟠 Alto | `sections/highlighted-product.liquid` | 6 | Aspas simples extras `}}'` | Pendente |
| BUG-003 | 🟠 Alto | `snippets/add-to-cart.liquid` | - | Cor hardcoded `bg-orange-500` | Pendente |
| BUG-004 | 🟡 Médio | `templates/collection.liquid` | 1 | Limite de 2 produtos | Pendente |
| BUG-005 | 🟡 Médio | `assets/cart.js` | 282-298 | updateCartDrawer fetches HTML ao invés de JSON | Pendente |
| BUG-006 | 🟢 Baixo | Múltiplos arquivos | - | Console.log em produção (8 arquivos) | Pendente |
| BUG-007 | 🟢 Baixo | `sections/product-test.liquid` | - | Arquivo de teste em produção | Pendente |

---

## 📊 ESTIMATIVAS TOTAIS

### Por Prioridade

| Prioridade | Itens | Horas Estimadas | Status |
|------------|-------|-----------------|--------|
| 🚨 **Crítica** | 7 grupos | 96-128h | 0% |
| 🟠 **Alta** | 5 grupos | 84-102h | 0% |
| 🟡 **Média** | 7 grupos | 128-162h | 0% |
| 🟢 **Baixa** | 9 grupos | 148-196h | 0% |
| **TOTAL** | **28 grupos** | **456-588h** | **0%** |

### Por Categoria

| Categoria | Horas Estimadas |
|-----------|-----------------|
| **Templates & Páginas** | 120-150h |
| **Funcionalidades de Produto** | 80-100h |
| **Carrinho & Checkout** | 32-40h |
| **Performance** | 48-60h |
| **SEO & Accessibility** | 44-56h |
| **Marketing & Social** | 52-68h |
| **Code Quality** | 48-62h |
| **Admin & Docs** | 32-52h |

---

## 🎯 ROADMAP SUGERIDO

### Fase 1: PRÉ-LANÇAMENTO (Sprint 1-3)
**Duração:** 3-4 semanas
**Foco:** Funcionalidades críticas para MVP

**Sprint 1 (Semana 1-2):** 🟡 **EM PROGRESSO**
- 🟡 Páginas de Cliente (57% completo - 4 de 7)
  - ✅ Login
  - ✅ Register
  - ✅ Reset Password
  - ✅ Account
  - ⏳ Addresses (próxima)
  - ⏳ Order
  - ⏳ Activate Account
- ⏳ Correção de todos os bugs críticos
- ✅ Acessibilidade básica (implementada nas 4 páginas completas)

**Sprint 2 (Semana 2-3):**
- ✅ Página de Coleção completa
- ✅ Página de Busca completa
- ✅ SEO estruturado básico

**Sprint 3 (Semana 3-4):**
- ✅ Modal de Newsletter
- ✅ Funcionalidades de produto (zoom, variant images)
- ✅ Testes e QA completos

**Entrega:** Tema pronto para lançamento público

---

### Fase 2: PÓS-LANÇAMENTO (Sprint 4-6)
**Duração:** 3-4 semanas
**Foco:** Melhorias de competitividade

**Sprint 4:**
- ✅ Recomendações de produtos
- ✅ Melhorias no carrinho
- ✅ Quick View

**Sprint 5:**
- ✅ Migração de jQuery
- ✅ Performance optimization
- ✅ Blog completo

**Sprint 6:**
- ✅ Wishlist
- ✅ Filtros avançados
- ✅ Reviews (integração)

---

### Fase 3: CRESCIMENTO (Sprint 7-10)
**Duração:** 4-6 semanas
**Foco:** Diferenciação no mercado

**Sprint 7-8:**
- ✅ Recursos de marketing (popups, urgency)
- ✅ Mega menu
- ✅ Internacionalização

**Sprint 9-10:**
- ✅ Social features
- ✅ Features avançadas (comparison, back in stock)
- ✅ Analytics completo

---

### Fase 4: EXCELÊNCIA (Contínuo)
**Foco:** Manutenção e inovação

- ✅ Code quality contínuo
- ✅ Performance monitoring
- ✅ Accessibility audits
- ✅ Feature requests da comunidade
- ✅ A/B testing
- ✅ Otimizações baseadas em dados

---

## 📈 MÉTRICAS DE SUCESSO

### KPIs Técnicos
- [ ] Lighthouse Score > 90 (Performance)
- [ ] Lighthouse Score > 95 (Accessibility)
- [ ] Lighthouse Score > 95 (SEO)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] 0 console errors em produção

### KPIs de Negócio
- [ ] Conversion rate (acompanhar após implementações)
- [ ] Add to cart rate
- [ ] Bounce rate
- [ ] Average session duration
- [ ] Pages per session
- [ ] Search usage rate
- [ ] Filter usage rate

---

## 🔄 PROCESSO DE ATUALIZAÇÃO

Este documento deve ser atualizado:
- ✅ Semanalmente durante desenvolvimento ativo
- ✅ Ao completar cada item
- ✅ Ao identificar novos bugs
- ✅ Ao receber feedback de usuários
- ✅ Após análises de performance
- ✅ Quando Shopify lançar novas features

**Última revisão:** 2025-11-09 18:30
**Próxima revisão:** 2025-11-16 (após completar Addresses, Order, Activate Account)

---

## 📞 NOTAS FINAIS

### Recomendações Estratégicas

1. **Priorize o Lançamento:** Foque na Fase 1 para ter um produto viável
2. **Itere Rápido:** Após lançamento, implemente features baseadas em feedback real
3. **Meça Tudo:** Analytics desde o dia 1 para decisões baseadas em dados
4. **Qualidade > Quantidade:** Melhor ter menos features bem feitas
5. **Performance é Feature:** Usuários abandonam sites lentos

### Recursos Recomendados

- **Testing:** BrowserStack para testes cross-browser
- **Performance:** WebPageTest, Lighthouse CI
- **Accessibility:** axe DevTools, WAVE
- **Analytics:** Google Analytics 4, Hotjar
- **Error Tracking:** Sentry
- **Reviews:** Judge.me ou Loox (apps Shopify)

### Próximos Passos Imediatos

1. ✅ Revisar e aprovar este roadmap
2. ✅ Priorizar itens da Fase 1
3. ✅ Criar issues/tasks no sistema de gerenciamento
4. ✅ Definir sprints e prazos
5. ✅ Começar desenvolvimento!

---

**Desenvolvido com 💜 por Cleyton Mendes**
**Para o Tema Elizabeth - Shopify**
