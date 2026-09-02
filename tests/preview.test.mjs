/**
 * O comentário de preview consegue NÃO ser publicado?
 *
 * A pergunta importa mais que a inversa. Publicar o link quando ele existe é o
 * caminho fácil e visível — qualquer execução verde o exercita. O caminho que
 * ninguém vê é o outro: o `theme push` devolver algo imprestável e o job
 * comentar "preview pronto" assim mesmo. Esse defeito não deixa rastro no CI;
 * ele deixa um revisor clicando num link vazio.
 *
 * É a mesma forma do defeito que `scripts/loja-no-ar.mjs` tinha (afirmar "a
 * loja está no ar" tendo verificado "alguma coisa respondeu"), e por isso a
 * distinção entre "ausente" e "inválido" está testada aqui com o mesmo cuidado.
 */
import { describe, it, expect } from 'vitest';
import { avaliar, comentario, escolherComentario, MARCADOR } from '../scripts/preview.mjs';

const bom = JSON.stringify({
  theme: {
    id: 108267175958,
    name: 'pr-60',
    role: 'development',
    editor_url: 'https://loja.myshopify.com/admin/themes/108267175958/editor',
    preview_url: 'https://loja.myshopify.com/?preview_theme_id=108267175958',
  },
});

describe('ausente não é inválido', () => {
  it('sem JSON nenhum: verde, com o motivo escrito', () => {
    const { estado, motivo } = avaliar({ bruto: null });
    expect(estado).toBe('ausente');
    expect(motivo).toMatch(/credencial|fork/i);
  });

  it('o motivo do "ausente" cita as variáveis que faltam, não um genérico', () => {
    expect(avaliar({ bruto: null }).motivo).toContain('SHOPIFY_CLI_THEME_TOKEN');
  });
});

describe('inválido reprova — o job não pode ficar verde', () => {
  it('JSON quebrado', () => {
    expect(avaliar({ bruto: '{isso não é json' }).estado).toBe('invalido');
  });

  it('JSON sem a chave theme', () => {
    const { estado, motivo } = avaliar({ bruto: '{"erro":"tema não encontrado"}' });
    expect(estado).toBe('invalido');
    expect(motivo).toContain('tema não encontrado'); // a mensagem diz o que veio
  });

  it('theme sem preview_url', () => {
    expect(avaliar({ bruto: '{"theme":{"id":1,"role":"development"}}' }).estado).toBe('invalido');
  });

  /** O caso exato: string não-vazia, falsy nenhuma, e inútil. */
  it('preview_url com só espaços NÃO passa', () => {
    expect(avaliar({ bruto: '{"theme":{"id":1,"preview_url":"   "}}' }).estado).toBe('invalido');
  });

  it('preview_url vazia não passa', () => {
    expect(avaliar({ bruto: '{"theme":{"id":1,"preview_url":""}}' }).estado).toBe('invalido');
  });

  it('preview_url que não é http não passa', () => {
    expect(avaliar({ bruto: '{"theme":{"id":1,"preview_url":"tema-108267"}}' }).estado).toBe(
      'invalido'
    );
  });
});

describe('o caminho feliz', () => {
  it('extrai a URL, o id e o editor', () => {
    const { estado, tema } = avaliar({ bruto: bom });
    expect(estado).toBe('ok');
    expect(tema).toMatchObject({
      id: 108267175958,
      previewUrl: 'https://loja.myshopify.com/?preview_theme_id=108267175958',
      editorUrl: 'https://loja.myshopify.com/admin/themes/108267175958/editor',
    });
  });

  it('espaço em volta da URL não vira parte dela', () => {
    const { tema } = avaliar({ bruto: '{"theme":{"id":1,"preview_url":"  https://x/  "}}' });
    expect(tema.previewUrl).toBe('https://x/');
  });
});

describe('o corpo do comentário', () => {
  const { tema } = avaliar({ bruto: bom });

  /**
   * A primeira linha é o que `escolherComentario` casa. Se ela deixar de ser o
   * marcador, o script para de reconhecer o próprio comentário e passa a
   * empilhar um por push — sem erro nenhum aparecer.
   */
  it('a PRIMEIRA linha é o marcador', () => {
    expect(comentario({ tema, sha: 'abc' }).split('\n')[0]).toBe(MARCADOR);
  });

  it('o marcador é um comentário HTML, invisível no PR', () => {
    expect(MARCADOR.startsWith('<!--')).toBe(true);
    expect(MARCADOR.endsWith('-->')).toBe(true);
  });

  it('carrega a URL clicável', () => {
    expect(comentario({ tema, sha: 'abc' })).toContain(tema.previewUrl);
  });

  it('encurta o sha e não vaza o resto', () => {
    const corpo = comentario({ tema, sha: '0123456789abcdef' });
    expect(corpo).toContain('0123456');
    expect(corpo).not.toContain('0123456789abcdef');
  });

  it('sem sha, não inventa um', () => {
    expect(comentario({ tema })).not.toContain('commit');
  });

  it('avisa que a vitrine pode pedir senha — é a primeira dúvida de quem clica', () => {
    expect(comentario({ tema, sha: 'abc' })).toMatch(/senha/i);
  });
});

describe('qual comentário reescrever', () => {
  const meu = { id: 10, body: `${MARCADOR}\n## Preview desta branch` };
  const alheio = { id: 11, body: 'Pode mergear' };

  it('acha o nosso entre os outros', () => {
    expect(escolherComentario([alheio, meu], MARCADOR)?.id).toBe(10);
  });

  it('sem nenhum nosso, devolve null — o script publica um novo', () => {
    expect(escolherComentario([alheio], MARCADOR)).toBe(null);
  });

  it('lista vazia e lista ausente não quebram', () => {
    expect(escolherComentario([], MARCADOR)).toBe(null);
    expect(escolherComentario(undefined, MARCADOR)).toBe(null);
  });

  /**
   * O caso que faria o PR virar um mural: alguém cita o corpo do preview num
   * comentário próprio. Casar em qualquer posição sobrescreveria o comentário
   * dessa pessoa; casar só no início não.
   */
  it('não confunde com quem apenas CITA o marcador no meio do texto', () => {
    const citando = { id: 12, body: `olha esse preview\n${MARCADOR}\nfunciona?` };
    expect(escolherComentario([citando], MARCADOR)).toBe(null);
  });

  it('comentário sem body não derruba a escolha', () => {
    expect(escolherComentario([{ id: 13 }, meu], MARCADOR)?.id).toBe(10);
  });

  it('havendo mais de um nosso, escolhe SEMPRE o mesmo (o mais antigo)', () => {
    const outro = { id: 99, body: `${MARCADOR}\nduplicado` };
    expect(escolherComentario([outro, meu], MARCADOR)?.id).toBe(10);
    expect(escolherComentario([meu, outro], MARCADOR)?.id).toBe(10);
  });
});
