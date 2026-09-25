/**
 * Menu mobile: a gaveta off-canvas e os submenus que abrem dentro dela.
 *
 * ── Por que delegação, e não `querySelectorAll` no `DOMContentLoaded` ──────
 *
 * Era assim até a #36, e no navegador da cliente funcionava: o script é global
 * com `defer`, então o DOM já existe quando ele roda.
 *
 * Quebrava no EDITOR de tema. A Shopify re-renderiza a section a cada mudança
 * de setting, e os botões novos que ela injeta não têm ouvinte nenhum —
 * `DOMContentLoaded` já disparou e não volta. O menu simplesmente parava de
 * abrir, e a lojista atribuiria isso ao tema estar quebrado.
 *
 * `shopify:section:load` resolveria re-ligando tudo a cada evento. Delegação
 * no `document` resolve sem ter o que re-ligar: o ouvinte está no documento,
 * que não é re-renderizado, e os elementos são procurados no instante do
 * clique. Um caminho a menos para esquecer.
 *
 * ── Por que `inert` e não só `aria-hidden` ────────────────────────────────
 *
 * O submenu fechado tem `height: 0` e `overflow: hidden`. Isso o esconde dos
 * olhos e não o tira da ORDEM DE TABULAÇÃO: quem navega por teclado tabula
 * para dentro de um link invisível, que o leitor de tela não anuncia porque
 * `aria-hidden="true"` o apagou de lá. É `aria-hidden-focus` do axe, e falha
 * o WCAG 4.1.2.
 *
 * A varredura de a11y nunca viu porque na carga a gaveta INTEIRA é `inert` —
 * o defeito só nasce depois do primeiro clique, e a varredura mede páginas
 * paradas. `inert` no submenu é o par que faltava: `aria-hidden` cuida do
 * leitor de tela, `inert` cuida do foco.
 */

const gaveta = () => document.getElementById('mobile-menu');

function abreMenu() {
  const menu = gaveta();
  if (!menu) return;
  menu.classList.remove('-translate-x-full');
  menu.setAttribute('aria-hidden', 'false');
  menu.removeAttribute('inert');
  document.getElementById('mobile-menu-open')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('overflow-hidden');
  document.getElementById('mobile-menu-overlay')?.classList.remove('hidden');
}

function fechaMenu() {
  const menu = gaveta();
  if (!menu) return;
  menu.classList.add('-translate-x-full');
  menu.setAttribute('aria-hidden', 'true');
  menu.setAttribute('inert', '');
  document.getElementById('mobile-menu-open')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('overflow-hidden');
  document.getElementById('mobile-menu-overlay')?.classList.add('hidden');
}

const menuAberto = () => gaveta()?.getAttribute('aria-hidden') === 'false';

/**
 * Abre ou fecha o submenu de um botão `.submenu-toggle`.
 *
 * O estado sai de `aria-expanded`, e não da altura em linha. Lia a altura
 * até a #36: `submenu.style.height && !== '0px'`. Quando `scrollHeight` é 0 —
 * submenu vazio, ancestral com `display: none`, medição antes do layout — o
 * "aberto" gravava `height: 0px`, que é indistinguível de fechado, e o clique
 * seguinte ABRIA de novo em vez de fechar. O botão ficava presto em
 * `aria-expanded="true"` para sempre.
 *
 * `aria-expanded` é o estado que já precisa estar certo para o leitor de tela.
 * Usá-lo como fonte da verdade não acrescenta nada para manter — ao contrário,
 * remove a segunda fonte que podia divergir.
 */
function alternaSubmenu(botao) {
  const submenu = botao.nextElementSibling;
  if (!submenu) return;

  const aberto = botao.getAttribute('aria-expanded') === 'true';
  const seta = botao.querySelector('span');

  if (aberto) {
    submenu.style.height = '0';
    submenu.setAttribute('aria-hidden', 'true');
    submenu.setAttribute('inert', '');
    botao.setAttribute('aria-expanded', 'false');
    if (seta) seta.style.transform = 'rotate(0deg)';
  } else {
    submenu.style.height = `${submenu.scrollHeight}px`;
    submenu.setAttribute('aria-hidden', 'false');
    submenu.removeAttribute('inert');
    botao.setAttribute('aria-expanded', 'true');
    if (seta) seta.style.transform = 'rotate(180deg)';
  }
}

document.addEventListener('click', (evento) => {
  const alvo = evento.target;
  if (!(alvo instanceof Element)) return;

  if (alvo.closest('#mobile-menu-open')) return abreMenu();
  if (alvo.closest('#mobile-menu-close') || alvo.closest('#mobile-menu-overlay')) return fechaMenu();

  const botao = alvo.closest('.submenu-toggle');
  if (botao) alternaSubmenu(botao);
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && menuAberto()) fechaMenu();
});

// O submenu aberto tem altura FIXA em px, calculada no clique. Ao redimensionar,
// o conteúdo reflui e a altura antiga passa a cortar ou sobrar.
window.addEventListener('resize', () => {
  document.querySelectorAll('.submenu').forEach((submenu) => {
    if (submenu.getAttribute('aria-hidden') === 'false') {
      submenu.style.height = `${submenu.scrollHeight}px`;
    }
  });
});
