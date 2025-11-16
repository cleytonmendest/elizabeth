# 📝 Integração de Reviews na PDP

Este tema está preparado para integrar apps de avaliações de clientes na página de produto (PDP).

## Apps Recomendados

### 1. Judge.me ⭐ (Recomendado)
**Por quê escolher:**
- ✅ Plano gratuito robusto
- ✅ Reviews com fotos e vídeos
- ✅ SEO automático (Schema.org)
- ✅ Importação de reviews
- ✅ Moderação de reviews
- ✅ Widgets customizáveis
- ✅ Suporte em português

**Preço:** Gratuito | Awesome ($15/mês) | Pro ($49/mês)

**Link:** https://apps.shopify.com/judgeme

---

### 2. Loox
**Por quê escolher:**
- ✅ Foco em reviews com fotos
- ✅ UI/UX muito bonito
- ✅ Carrossel de fotos de clientes
- ✅ Email automation
- ✅ Referral rewards

**Preço:** $9.99/mês (Beginner) | $34.99/mês (Growth)

**Link:** https://apps.shopify.com/loox

---

## Como Integrar

### Passo 1: Instalar o App
1. Acesse a Shopify App Store
2. Procure por "Judge.me" ou "Loox"
3. Clique em "Add app" (Adicionar app)
4. Siga as instruções de instalação

### Passo 2: Configurar o App
O app irá configurar automaticamente:
- Widget de review stars no card de produto
- Seção de reviews completa na PDP
- Email automation para solicitar reviews

### Passo 3: Adicionar na PDP (se necessário)

**O tema já está preparado!** Ele suporta blocos `@app` que permitem apps se integrarem automaticamente.

#### Se precisar adicionar manualmente:

1. Vá para **Themes > Customize** (Personalizar tema)
2. Abra uma **Página de Produto**
3. Clique em **Add block** (Adicionar bloco)
4. Procure por **Judge.me Reviews** ou **Loox Reviews**
5. Arraste para a posição desejada (recomendado: após a descrição)
6. Salve

### Passo 4: Customizar o Estilo

#### Para Judge.me:
1. No app Judge.me, vá para **Settings > Widget Customization**
2. Ajuste as cores para combinar com o tema:
   - Primary Color: `#000000` (preto)
   - Star Color: `#fbbf24` (dourado)
3. Escolha o layout: **Grid** ou **List**

#### Para Loox:
1. No app Loox, vá para **Settings > Design**
2. Ajuste:
   - Review widget style
   - Photo carousel layout
   - Colors

---

## Localização dos Reviews

### Recomendado:
1. **PDP - Após a descrição**
   - Rating stars: acima do título do produto
   - Reviews completos: após a descrição/abas

2. **Homepage**
   - Widget de reviews em destaque
   - Carrossel de fotos de clientes

3. **Collection Page** (opcional)
   - Rating stars nos cards de produto

---

## Importar Reviews Existentes

### Se você já tem reviews em outro lugar:

#### Judge.me:
1. Vá para **Judge.me > Import**
2. Faça upload de arquivo CSV
3. Formato do CSV:
```csv
email,name,rating,title,body,product_handle,created_at
cliente@email.com,Maria Silva,5,Adorei!,Produto excelente,vestido-floral,2024-01-15
```

#### Loox:
1. Vá para **Loox > Import Reviews**
2. Upload CSV ou conecte outra plataforma
3. Formatos suportados: AliExpress, Amazon, Etsy, etc.

---

## Solicitar Reviews Automaticamente

### Judge.me:
1. Vá para **Settings > Email Requests**
2. Ative **Automatic Email Requests**
3. Configure:
   - Enviar após X dias da compra (recomendado: 7-14 dias)
   - Personalizar template do email
   - Oferecer desconto por review (opcional)

### Loox:
1. Vá para **Settings > Review Requests**
2. Ative **Auto Review Requests**
3. Configure timing e incentivos

---

## Recursos Avançados

### Widgets Disponíveis:

#### Judge.me:
- ✅ Star Rating (cards de produto)
- ✅ Review Widget (PDP completo)
- ✅ Carousel Widget (homepage)
- ✅ Badge Widget (selo de confiança)
- ✅ All Reviews Page (página dedicada)

#### Loox:
- ✅ Product Reviews Widget
- ✅ Photo Carousel
- ✅ Homepage Reviews
- ✅ Floating Widget

---

## Checklist de Configuração

- [ ] App instalado
- [ ] Widget de reviews aparecendo na PDP
- [ ] Rating stars aparecendo nos cards de produto
- [ ] Email automation configurada
- [ ] Cores customizadas para combinar com o tema
- [ ] Importar reviews antigos (se aplicável)
- [ ] Testar envio de review como cliente
- [ ] Configurar moderação de reviews
- [ ] Adicionar widget na homepage (opcional)

---

## Suporte

### Judge.me Support:
- Email: support@judge.me
- Chat: Disponível no painel do app
- Docs: https://judge.me/support

### Loox Support:
- Email: support@loox.io
- Chat: Disponível no painel do app
- Docs: https://help.loox.io

---

## SEO Benefits

Ambos os apps adicionam automaticamente **Schema.org markup** (JSON-LD) para reviews, que:
- Mostra rating stars nos resultados do Google
- Aumenta CTR (click-through rate)
- Melhora confiança e conversão

Exemplo de como aparece no Google:
```
⭐⭐⭐⭐⭐ Rating: 4.8 (127 reviews)
Vestido Floral Midi - Elizabeth Moda
```

---

**Recomendação final:** Comece com o **plano gratuito do Judge.me** para validar. Depois, considere upgrade para o plano Awesome ($15/mês) para recursos avançados como Q&A e Video Reviews.
