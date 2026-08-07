// js/app.js
import { Editor } from './tokens.js';
import { AppState } from './state.js';
import { Store } from './history.js';
import { evaluate } from './engine.js';
import { ACTIONS, SHIFT_ACTIONS, KEYBOARD } from './keymap.js';

const editor = new Editor();
const state = new AppState();
const store = new Store();

const $ = (s) => document.querySelector(s);
const exprEl = $('#expr'), resultEl = $('#result'), badgeEl = $('#badge');
const toastEl = $('#toast'), panel = $('#history-panel'), list = $('#history-list');

const DISPLAY = { '*': '×', '/': '÷', 'pi': 'π', 'sqrt(': '√(' };
const showAtom = (a) => DISPLAY[a] ?? a;

function render() {
  exprEl.innerHTML = '';
  const atoms = editor.atoms;
  for (let i = 0; i <= atoms.length; i++) {
    if (i === editor.cursor) {
      const c = document.createElement('span'); c.className = 'cursor'; exprEl.appendChild(c);
    }
    if (i < atoms.length) exprEl.appendChild(document.createTextNode(showAtom(atoms[i])));
  }
}

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false; toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 1200);
}

function updateBadge() {
  badgeEl.textContent = state.angleMode;
  badgeEl.classList.toggle('rad', state.angleMode === 'RAD');
}
function updateShift() {
  document.querySelector('[data-id="shift"]').classList.toggle('active', state.shift);
}

function doEquals() {
  const r = evaluate(editor.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  if (r.ok) {
    resultEl.textContent = r.display; resultEl.classList.remove('error');
    state.ans = r.value; store.addHistory(editor.atoms, r.display);
  } else {
    resultEl.textContent = r.error; resultEl.classList.add('error');
  }
}

function openHistory() {
  list.innerHTML = '';
  for (const item of store.history) {
    const li = document.createElement('li');
    const e = document.createElement('div'); e.className = 'h-expr';
    e.textContent = item.atoms.map(showAtom).join('');
    const res = document.createElement('div'); res.className = 'h-res'; res.textContent = '= ' + item.display;
    li.append(e, res);
    li.addEventListener('click', () => { editor.setAtoms(item.atoms); panel.hidden = true; render(); });
    list.appendChild(li);
  }
  panel.hidden = false;
}

function doSto() {
  const r = evaluate(editor.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  if (!r.ok) { showToast('无有效值可存储'); return; }
  const name = (prompt('存入变量名 (A-Z)：') || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(name)) { showToast('变量名需为 A-Z'); return; }
  store.setVar(name, r.value);
  showToast(`已存入 ${name}`);
}

function dispatch(id) {
  const shifted = state.shift ? SHIFT_ACTIONS[id] : undefined;
  // Shift 处于开启且该键没有真正的第二功能时：占位提示并清除 shift，不执行主功能。
  // 例外：shift 键本身仅用于再次切换，不拦截。
  if (state.shift && id !== 'shift' && !shifted) {
    showToast('该功能暂未开放');
    state.clearShift(); updateShift();
    return;
  }
  const action = shifted || ACTIONS[id];
  if (!action) return;
  switch (action.kind) {
    case 'digit': editor.insertDigit(action.payload); break;
    case 'atom': editor.insertAtom(action.payload); break;
    case 'func':
      if (action.payload === 'square') { editor.insertAtom('^'); editor.insertAtom('2'); }
      else if (action.payload === 'eex') { editor.insertAtom('*'); editor.insertDigit('1'); editor.insertDigit('0'); editor.insertAtom('^'); }
      else if (action.payload === 'epow') { editor.insertAtom('e'); editor.insertAtom('^'); }
      break;
    case 'ans': editor.insertAtom('Ans'); break;
    case 'backspace': editor.backspace(); break;
    case 'clear': editor.clear(); resultEl.textContent = ''; resultEl.classList.remove('error'); break;
    case 'left': editor.moveLeft(); break;
    case 'right': editor.moveRight(); break;
    case 'undo': editor.undo(); break;
    case 'redo': editor.redo(); break;
    case 'equals': doEquals(); break;
    case 'toggleAngle': state.toggleAngleMode(); updateBadge(); break;
    case 'toggleShift': state.toggleShift(); updateShift(); return; // 不重渲染 expr
    case 'history': openHistory(); return;
    case 'sto': doSto(); return;
    case 'placeholder': showToast('该功能暂未开放'); return;
  }
  if (action.kind !== 'toggleAngle') state.clearShift(), updateShift();
  render();
}

// 按钮点击
document.querySelector('#keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (btn) dispatch(btn.dataset.id);
});
// 徽标点击切换角度
badgeEl.addEventListener('click', () => dispatch('deg'));
// 历史关闭
document.querySelector('#history-close').addEventListener('click', () => { panel.hidden = true; });
// 物理键盘
window.addEventListener('keydown', (e) => {
  const id = KEYBOARD[e.key];
  if (id) { e.preventDefault(); dispatch(id); }
});

// 初始化
updateBadge(); updateShift(); render();
