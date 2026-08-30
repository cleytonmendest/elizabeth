# 3. Três níveis de customização

- **Status:** Aceito
- **Data:** 2026-08-29

## Contexto

O tema precisa satisfazer duas exigências que parecem opostas:

1. **Theme Store:** qualquer lojista tem que conseguir colocar a cara da marca
   dele na loja, sem tocar em código.
2. **Design system:** o tema precisa continuar parecendo um tema, e não uma
   colagem, depois que o lojista mexeu em tudo.

Elas só parecem opostas enquanto "customizar" for tratado como uma coisa só. O
próprio tema já provou o contrário num eixo: em cor, o lojista repinta a loja
inteira pelo color scheme, e mesmo assim **nenhum lojista consegue** fazer um
botão usar a cor de badge — porque o `.liquid` escreve `bg-button`, não uma cor
escolhida por section. O lojista controla o valor; o desenvolvedor controla
onde ele se aplica.

Esse arranjo nunca foi escrito, então não foi generalizado. O estado medido
antes desta decisão:

| Eixo | Lojista controla | Como |
| --- | --- | --- |
| Cor | sim | `color_schemes` → CSS vars → tokens Tailwind |
| Largura da página | sim | `page_width` → `--page-width` |
| Espaço entre sections | parcial | `spacing_sections`, via `style=""` inline |
| Raio | **não** | `8px` cravado em `tailwind.config.js` |
| Escala tipográfica | **não** | fixa em `tailwind.config.js` |
| Fonte | parcial | `font_picker` + `<textarea>` com HTML cru (ver #35) |

## Decisão

Todo setting do tema pertence a **exatamente um** de três níveis, e o nível
determina onde ele pode viver.

### Nível 1 — Token global

Vive em `config/settings_schema.json`. Define **o valor** de um eixo do design
para a loja inteira: cor, raio, fonte, escala tipográfica, largura, espaçamento.

Um eixo tem **um** controle. O lojista escolhe um valor e a escala inteira
deriva dele por `calc()`:

```
--radius-theme: 8px                       ← a única escolha do lojista
--radius-theme-sm: calc(… / 2)            ← derivado
--radius-theme-lg: calc(… * 1.5)          ← derivado
```

Derivar em vez de expor cada degrau é o que preserva a coerência: o lojista não
consegue deixar o raio pequeno maior que o grande, porque não existe controle
para isso.

### Nível 2 — Composição

Vive no `{% schema %}` da section. Define **arranjo**, nunca valor: qual color
scheme, alinhamento, número de colunas, grade ou slider, com ou sem imagem.

**Todo setting de nível 2 é `select`, `checkbox` ou `range` com opções
fechadas.** Nunca campo livre que aceite um valor de design.

### Nível 3 — Conteúdo

Vive nos blocos. Texto, imagem, link, produto. Literal é o correto aqui.

### O pipeline

```
config/settings_schema.json          lojista escolhe o VALOR (nível 1)
        ↓ layout/theme.liquid emite
:root { --color-*, --radius-*, --font-scale, --page-width }
        ↓ tailwind.config.js consome
tokens semânticos (bg-background, rounded-theme, text-sm)
        ↓
.liquid escreve o token — e nunca sabe qual é o valor
```

A propriedade que importa: **adicionar customização não exige tocar nas
sections.** Ao ligar o raio ao lojista, as 93 ocorrências de `rounded-theme`
passaram a obedecê-lo sem uma linha de `.liquid` alterada. Se um eixo novo
exigir editar sections, o pipeline está errado, não a section.

### Alternativas descartadas

**Settings de aparência por section** (cada section com seu raio, sua fonte).
É o que a maioria dos temas de marketplace faz, e é o que produz lojas em que
a section A é redonda e a B é quadrada. Customização máxima, design zero. A
Theme Store não proíbe, mas o resultado desqualifica o tema visualmente.

**Nenhuma customização além de cor.** Mantém o design intacto e reprova na
premissa do produto: um tema de Theme Store precisa servir marcas diferentes.

**Expor os 9 degraus da escala tipográfica.** Dá controle real, e garante que
alguém vai quebrar a proporção. Um multiplicador único entrega o benefício
(loja mais compacta ou mais ampla) sem o risco.

## Consequências

**Ganhamos**

- O lojista customiza raio e tamanho de texto pela primeira vez, e a loja
  inteira acompanha de forma coerente.
- Existe um critério objetivo para decidir onde um setting novo vai, em vez de
  "onde pareceu conveniente".
- O linter `tokens` já cobre metade disto: quem escrever `rounded-[10px]` para
  escapar do sistema é reprovado.

**Pagamos**

- O lojista **não** pode deixar uma section com raio diferente das outras.
  É deliberado, e vai gerar pedido de suporte. A resposta é que o tema tem uma
  identidade, e a alternativa é o efeito colagem.
- A metade que falta do linter — impedir que uma section futura exponha um
  setting de nível 1 — ainda não existe. Está registrada como a regra
  `design-scope`; enquanto não existir, a regra depende de revisão.
- `calc()` em `font-size` significa que os tamanhos deixam de ser legíveis como
  constante no CSS compilado. O style guide (#30) passa a ser o lugar de ver a
  escala resolvida.

**Deixamos de fora, por ora**

Um multiplicador de **densidade** sobre a escala de espaçamento do Tailwind.
Seria coerente com esta decisão, mas alteraria toda ocorrência de `p-*`,
`gap-*` e `space-*` do tema — e não há regressão visual (#31) para provar que
nada se moveu onde não devia. Fica para depois do style guide (#30).

## Referências

- `layout/theme.liquid` — onde as CSS variables são emitidas
- `tailwind.config.js` — onde os tokens as consomem
- ADR 0001 — os guard rails que impedem o pipeline de ser furado
- #35 — a fonte ainda entra por `<textarea>` com HTML cru; fecha o eixo tipográfico
