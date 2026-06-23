# Elizabeth - Tema Shopify

Tema customizado para e-commerce de moda feminina desenvolvido com Shopify Online Store 2.0 + TailwindCSS.

## 📋 Sobre o Projeto

Elizabeth é um tema Shopify moderno e elegante, desenvolvido especificamente para lojas de moda feminina que buscam sofisticação e funcionalidade. O tema utiliza a arquitetura Online Store 2.0 da Shopify, proporcionando máxima flexibilidade através do editor de temas.

**Autor:** Cleyton Mendes
**Versão:** 1.0.0

## ✨ Características Principais

### Design & Estilo
- 🎨 **TailwindCSS** para estilização moderna e responsiva
- 📱 **Design Responsivo** otimizado para desktop, tablet e mobile
- 🎭 **Múltiplos layouts de header** (logo centralizado, menu inferior, etc.)
- 🌈 **Sistema de cores personalizável** via editor de temas
- ✏️ **Tipografia customizável** com suporte a fontes do Google Fonts

### Funcionalidades
- 🛒 **Carrinho lateral (drawer)** com atualização em tempo real
- 🔍 **Busca preditiva** integrada
- 📦 **Sistema de variantes** com indicação visual de disponibilidade
- 💰 **Cálculo de parcelamento** configurável
- 🎠 **Carrosséis de produtos** utilizando Owl Carousel
- 🏷️ **Badges de desconto** personalizáveis
- 📍 **Breadcrumb** automático para navegação
- 🔗 **Integração com redes sociais**

### Componentes Web Modernos
Utiliza Web Components nativos para melhor performance:
- Seletor de variantes (`variant-selects`)
- Componente de preço (`price-component`)
- Seletor de quantidade (`quantity-selector`)
- Componente de busca (`search-component`)

## 🛠️ Tecnologias Utilizadas

- **Shopify Liquid** - Template engine
- **TailwindCSS 3.4.7** - Framework CSS utility-first
- **JavaScript (ES6+)** - Web Components e funcionalidades interativas (vanilla, sem jQuery)
- **Swiper 11.x** - Carrosséis e sliders
- **Shopify Online Store 2.0** - Arquitetura baseada em seções

## 📦 Instalação

### Pré-requisitos

- [Shopify CLI](https://shopify.dev/themes/tools/cli/installation) instalado
- Node.js e npm instalados
- Acesso a uma loja Shopify (desenvolvimento ou produção)

### Configuração do Ambiente

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd elizabeth
```

2. **Instale as dependências**
```bash
npm install
```

3. **Conecte à sua loja Shopify**
```bash
shopify theme dev
```

4. **Em outro terminal, inicie o watch do TailwindCSS**
```bash
npm run tail
```

## 🚀 Comandos de Desenvolvimento

### TailwindCSS
```bash
npm run tail
```
Compila `src/tailwind.css` → `assets/application.css` em modo watch

### Shopify Theme
```bash
# Desenvolvimento local com hot reload
shopify theme dev

# Enviar tema para a loja
shopify theme push

# Baixar tema da loja
shopify theme pull

# Publicar tema
shopify theme publish
```

## 📁 Estrutura do Projeto

```
elizabeth/
├── assets/              # Arquivos estáticos (CSS, JS, imagens)
│   ├── application.css  # TailwindCSS compilado
│   ├── cart.js         # Gerenciamento do carrinho
│   ├── variations-selector.js
│   └── ...
├── config/             # Configurações do tema
│   ├── settings_data.json
│   └── settings_schema.json
├── layout/             # Layout base do tema
│   └── theme.liquid
├── locales/            # Traduções (pt-BR)
├── sections/           # Seções reutilizáveis
│   ├── header.liquid
│   ├── footer.liquid
│   ├── main-product.liquid
│   ├── slider-product.liquid
│   └── ...
├── snippets/           # Componentes menores
│   ├── cart-drawer.liquid
│   ├── breadcrumb.liquid
│   ├── price-v2.liquid
│   └── ...
├── src/                # Código fonte
│   └── tailwind.css    # Estilos TailwindCSS
├── templates/          # Templates de páginas
│   ├── index.json
│   ├── product.json
│   ├── collection.liquid
│   └── ...
├── package.json
└── tailwind.config.js
```

## 🎨 Seções Disponíveis

### Layout
- **Header** - Cabeçalho com múltiplos layouts e modo transparente
- **Footer** - Rodapé customizável
- **Announcement Bar** - Barra de anúncios

### Produtos
- **Main Product** - Página de produto completa
- **Slider Product** - Carrossel de produtos
- **Highlighted Product** - Produto em destaque

### Conteúdo
- **Slider Image** - Carrossel de imagens/banners
- **Slider Cards** - Cards deslizantes para categorias
- **Highlighted Section** - Seção destacada com imagem e texto
- **Section Images Link** - Imagens clicáveis lado a lado
- **Newsletter Modal** - Modal de cadastro de newsletter

## 🎛️ Configurações do Tema

Acessíveis via editor de temas da Shopify:

### Logo
- Upload de logo principal ou inserção de SVG
- Largura customizável (50-300px)
- Favicon personalizado

### Parcelamento
- Ativação/desativação da exibição
- Quantidade máxima de parcelas
- Valor mínimo por parcela

### Cores
- Sistema completo de color schemes
- Cores para background, texto, botões e sombras
- Suporte a gradientes

### Layout
- Largura máxima da loja (1400-2560px)
- Espaçamento entre seções

### Tipografia
- Fontes para títulos e corpo do texto
- Suporte a fontes customizadas (Google Fonts)

### Redes Sociais
- Links para Facebook, Instagram, YouTube, TikTok, Twitter, Pinterest, etc.

## 🧩 Componentes JavaScript

### CartManager
Gerencia todas as operações do carrinho com sistema pub/sub:
```javascript
CartManager.getCart()       // Obtém estado do carrinho
CartManager.addToCart(form) // Adiciona produto
CartManager.updateQuantity(line, quantity) // Atualiza quantidade
```

### Eventos Customizados
```javascript
'variant:change'   // Mudança de variante
'cart-update'      // Atualização do carrinho
'quantity-update'  // Atualização de quantidade
'cart-error'       // Erro no carrinho
```

### Web Components
- `<variant-selects>` - Seleção de variantes com validação de disponibilidade
- `<price-component>` - Exibição dinâmica de preços
- `<quantity-selector>` - Controle de quantidade
- `<search-component>` - Busca preditiva

## 🌍 Localização

O tema está configurado para **Português Brasileiro (pt-BR)** com:
- Formatação de moeda em Real (R$)
- Traduções completas nos arquivos de locale
- Datas e números no padrão brasileiro

## 📝 Padrões de Código

### Liquid
- Variáveis em `snake_case`
- Comentários para lógica complexa
- Uso de `liquid` tag para múltiplas atribuições

### CSS
- Preferência por classes utilitárias do TailwindCSS
- Classes customizadas apenas quando necessário
- Estilos em `@layer base` para customizações globais

### JavaScript
- ES6+ com Web Components
- Registro de custom elements com verificação prévia
- Event-driven architecture
- Uso de `defer` para carregamento de scripts

## 🔧 Customização

### Adicionando Nova Seção
1. Crie arquivo em `sections/nome-secao.liquid`
2. Adicione schema JSON com configurações
3. Registre no editor de temas

### Modificando Estilos
1. Edite `src/tailwind.css`
2. O watch do TailwindCSS irá recompilar automaticamente
3. Refresh na página para ver mudanças

### Criando Novo Componente
```javascript
class MeuComponente extends HTMLElement {
  connectedCallback() {
    // Lógica de inicialização
  }
}

if (!customElements.get('meu-componente')) {
  customElements.define('meu-componente', MeuComponente);
}
```

## 📚 Recursos Úteis

- [Documentação Shopify Themes](https://shopify.dev/themes)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Shopify Liquid](https://shopify.dev/docs/api/liquid)
- [Web Components MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components)

## 🐛 Suporte

Para reportar bugs ou solicitar features, entre em contato com o autor ou crie uma issue no repositório.

## 📄 Licença

ISC

---

**Desenvolvido com 💜 por Cleyton Mendes**
