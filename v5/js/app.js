// js/app.js
import { Editor } from './tokens.js';
import { AppState } from './state.js';
import { Store } from './history.js';
import { evaluate } from './engine.js';
import { ACTIONS, SHIFT_ACTIONS, KEYBOARD } from './keymap.js';
import { MATH_CATALOG } from './mathmenu.js';

const editor = new Editor();
const state = new AppState();
const store = new Store();

const $ = (s) => document.querySelector(s);
const exprEl = $('#expr'), resultEl = $('#result'), badgeEl = $('#badge');
const toastEl = $('#toast'), panel = $('#history-panel'), list = $('#history-list');
const mathPanel = $('#math-panel'), mathBody = $('#math-body');

const DISPLAY = {
  '*': '×', '/': '÷', 'pi': 'π', 'sqrt(': '√(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', 'cbrt(': '³√(',
  'nCr': 'C', 'nPr': 'P',
};
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
  document.querySelector('#keypad').classList.toggle('shift-active', state.shift);
}

function injectShiftLabels() {
  for (const [id, act] of Object.entries(SHIFT_ACTIONS)) {
    if (!act.label) continue;
    const btn = document.querySelector(`[data-id="${id}"]`);
    if (!btn) continue;
    btn.classList.add('has-shift');
    const tag = document.createElement('span');
    tag.className = 'second';
    tag.textContent = act.label;
    btn.prepend(tag);
  }
}

function openMath() {
  mathBody.innerHTML = '';
  for (const group of MATH_CATALOG) {
    const h = document.createElement('div'); h.className = 'math-group'; h.textContent = group.title;
    mathBody.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'math-items';
    for (const item of group.items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'math-item';
      b.textContent = item.label;
      b.addEventListener('click', () => {
        execAction(item.action);
        state.clearShift(); updateShift();
        mathPanel.hidden = true;
        render();
      });
      grid.appendChild(b);
    }
    mathBody.appendChild(grid);
  }
  mathPanel.hidden = false;
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

// 只处理「插入到编辑区」的动作；调用方负责 render()
function execAction(action) {
  switch (action.kind) {
    case 'digit': editor.insertDigit(action.payload); break;
    case 'atom': editor.insertAtom(action.payload); break;
    case 'func':
      if (action.payload === 'square') { editor.insertAtom('^'); editor.insertAtom('2'); }
      else if (action.payload === 'cube') { editor.insertAtom('^'); editor.insertAtom('3'); }
      else if (action.payload === 'recip') { editor.insertAtom('^'); editor.insertAtom('('); editor.insertAtom('-'); editor.insertAtom('1'); editor.insertAtom(')'); }
      else if (action.payload === 'tenpow') {
        const left = editor.atoms[editor.cursor - 1];
        if (left !== undefined && left !== '' && /^\d*\.?\d*$/.test(left)) editor.insertAtom('*');
        editor.insertDigit('1'); editor.insertDigit('0'); editor.insertAtom('^');
      }
      else if (action.payload === 'eex') { editor.insertAtom('*'); editor.insertDigit('1'); editor.insertDigit('0'); editor.insertAtom('^'); }
      else if (action.payload === 'epow') { editor.insertAtom('e'); editor.insertAtom('^'); }
      break;
    case 'ans': editor.insertAtom('Ans'); break;
  }
}

const INSERT_KINDS = new Set(['digit', 'atom', 'func', 'ans']);

function dispatch(id) {
  const shifted = state.shift ? SHIFT_ACTIONS[id] : undefined;
  // Shift 开启且该键无第二功能：占位提示并清除 shift（shift 键本身除外）
  if (state.shift && id !== 'shift' && !shifted) {
    showToast('该功能暂未开放');
    state.clearShift(); updateShift();
    return;
  }
  const action = shifted || ACTIONS[id];
  if (!action) return;

  if (INSERT_KINDS.has(action.kind)) {
    execAction(action);
    state.clearShift(); updateShift();
    render();
    return;
  }

  switch (action.kind) {
    case 'backspace': editor.backspace(); break;
    case 'clear': editor.clear(); resultEl.textContent = ''; resultEl.classList.remove('error'); break;
    case 'left': editor.moveLeft(); break;
    case 'right': editor.moveRight(); break;
    case 'undo': editor.undo(); break;
    case 'redo': editor.redo(); break;
    case 'equals': doEquals(); break;
    case 'toggleAngle': state.toggleAngleMode(); updateBadge(); return;
    case 'toggleShift': state.toggleShift(); updateShift(); return;
    case 'history': openHistory(); return;
    case 'math': openMath(); return;
    case 'sto': doSto(); return;
    case 'placeholder': showToast('该功能暂未开放'); return;
  }
  state.clearShift(); updateShift();
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
// MATH 关闭
document.querySelector('#math-close').addEventListener('click', () => { mathPanel.hidden = true; });
// 物理键盘
window.addEventListener('keydown', (e) => {
  const id = KEYBOARD[e.key];
  if (id) { e.preventDefault(); dispatch(id); }
});

// 初始化
injectShiftLabels();
updateBadge(); updateShift(); render();
