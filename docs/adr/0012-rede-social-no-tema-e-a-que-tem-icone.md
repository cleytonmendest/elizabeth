# 12. Rede social declarada no tema é a que tem ícone no rodapé

- **Status:** Aceito
- **Data:** 2026-09-23

## Contexto

`config/settings_schema.json` declarava **nove** links de rede social. Quatro
deles não eram lidos por arquivo nenhum do tema:

| Setting | Ícone no rodapé | Usado em metadados | Situação |
| --- | :---: | --- | --- |
| `social_instagram_link` | ✓ | `sameAs` | ok |
| `social_facebook_link` | ✓ | `sameAs` | ok |
| `social_youtube_link` | ✓ | — | ok |
| `social_pinterest_link` | ✗ | `sameAs` | só metadados |
| `social_twitter_link` | ✗ | `twitter:site` | só metadados |
| `social_tiktok_link` | ✗ | ✗ | **morto** |
| `social_snapchat_link` | ✗ | ✗ | **morto** |
| `social_tumblr_link` | ✗ | ✗ | **morto** |
| `social_vimeo_link` | ✗ | ✗ | **morto** |

A lojista preenchia o campo do TikTok no admin, salvava, e nada acontecia — sem
erro, sem aviso, sem ícone. A regra `settings` do linter via os quatro e os
registrava como dívida; eles estavam no baseline havia meses.

A causa não foi descuido isolado. O rodapé tinha **três blocos `{% if %}` quase
idênticos**, um por rede, de seis linhas cada. Acrescentar um setting era uma
edição; acrescentar o markup era outra. As duas saíram de sincronia quatro
vezes, e nada cobrava a diferença.

## Decisão

**Rede social declarada no `settings_schema.json` é rede que o tema RENDERIZA.**
Quem só alimenta metadados diz isso no próprio rótulo.

Aplicando:

- **Entram como ícone:** Instagram, Facebook, YouTube, **TikTok** e
  **WhatsApp**.
- **Saem do schema:** Snapchat, Tumblr e Vimeo.
- **Ficam, com `info` explicando:** Pinterest e Twitter, que alimentam
  `schema-organization` e `meta-tags` sem virar ícone.

### Por que TikTok entra e Snapchat sai

O tema é de moda feminina no Brasil. TikTok é canal de venda relevante nesse
nicho; Snapchat, Tumblr e Vimeo não são — e Vimeo, em particular, é
plataforma de hospedagem de vídeo, não rede onde uma loja tem perfil.

**WhatsApp entra e não estava na lista de nove.** É a rede que mais importa
para varejo brasileiro, e o tema não a oferecia enquanto oferecia Tumblr.

### O que impede a dessincronia de voltar

O markup do link virou `snippets/social-link.liquid`, e o despacho de ícone
virou `snippets/icon-social.liquid`. `tests/redes-sociais.test.mjs` compara as
**três** listas que precisam concordar — o schema, o rodapé e o despacho — nos
dois sentidos: setting sem quem o leia reprova, e `when` sem quem o renderize
também.

O `settings.social_<rede>_link` continua escrito LITERAL no rodapé, de
propósito. A primeira versão desta correção montava a chave com `append`, e o
linter passou a acusar CINCO settings como mortos — chave dinâmica é invisível
para análise estática. Teria trocado um defeito por outro.

### Alternativas descartadas

**Renderizar os quatro.** Era o caminho sem ADR e sem remoção. Mas colocaria
Snapchat, Tumblr e Vimeo no rodapé de toda loja do tema — três redes que a
lojista de moda não usa, ocupando espaço e pedindo três ícones a manter.

**Remover os quatro, sem TikTok.** Menor diff, e deixaria de fora justamente a
rede que o nicho usa.

**Manter o campo e documentar que não aparece.** É o que Pinterest e Twitter
fazem, e ali faz sentido: eles têm efeito REAL, só que invisível. Um campo sem
efeito nenhum não tem o que documentar.

## Consequências

**Ganhamos** — nenhum campo do admin sem efeito; TikTok e WhatsApp entregues; e
quatro entradas a menos no baseline do linter.

**Pagamos** — remoção de setting é mudança pública. Uma loja que tivesse
preenchido Snapchat perde o valor guardado no `settings_data.json`. O tema
nunca foi publicado na Theme Store, então o alcance real é a loja de
desenvolvimento — mas o precedente vale: a [ADR 0004](0004-o-que-ganha-um-toggle.md)
manteve `show_back_to_top` pelo mesmo motivo, e a diferença aqui é que aquele
setting FUNCIONA e estes nunca funcionaram. Remover um campo que nunca teve
efeito não tira nada de ninguém.

**Não ganhamos um linter novo.** A regra `settings` já pegava o sintoma — ela
é que registrou os quatro no baseline. O que faltava não era detecção, era
decisão, e é isso que este ADR é. A contabilidade entre as três listas ficou
em teste, não em regra, porque ela é sobre ESTE conjunto de arquivos e não
sobre uma classe de defeito do tema inteiro.

## Referências

- `sections/footer.liquid`, `snippets/social-link.liquid`, `snippets/icon-social.liquid`
- `tests/redes-sociais.test.mjs` — a contabilidade entre schema, rodapé e despacho
- `scripts/lint/rules/settings.mjs` — a regra que tornou os quatro visíveis
- [ADR 0004](0004-o-que-ganha-um-toggle.md) — quando um setting deve existir
- [Issue #5](https://github.com/cleytonmendest/elizabeth/issues/5)
