// js/app.js
import { Editor } from './tokens.js';
import { AppState } from './state.js';
import { Store } from './history.js';
import { evaluate } from './engine.js';
import { ACTIONS, SHIFT_ACTIONS, KEYBOARD } from './keymap.js';
import { MATH_CATALOG } from './mathmenu.js';
import { t, cycleLocale, getLocaleMeta } from './i18n.js';

const editor = new Editor();
const state = new AppState();
const store = new Store();

const $ = (s) => document.querySelector(s);
const exprEl = $('#expr'), resultEl = $('#result'), badgeEl = $('#badge');
const toastEl = $('#toast'), panel = $('#history-panel'), list = $('#history-list');
const mathPanel = $('#math-panel'), mathBody = $('#math-body');
const langEl = $('#lang'), historyTitleEl = $('#history-title'), mathTitleEl = $('#math-title');

const DISPLAY = {
  '*': '×', '/': '÷', 'pi': 'π', 'sqrt(': '√(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', 'cbrt(': '³√(',
  'nCr': 'C', 'nPr': 'P',
};
const showAtom = (a) => DISPLAY[a] ?? a;

function render() {
  exprEl.innerHTML = '';
  const atoms = editor.atoms;
  const cur = editor.cursor, off = editor.offset;
  for (let i = 0; i <= atoms.length; i++) {
    // Cursor at an atom boundary (offset 0): before atoms[i] (or at end if i===len).
    if (i === cur && off === 0) {
      const c = document.createElement('span'); c.className = 'cursor'; exprEl.appendChild(c);
    }
    if (i < atoms.length) {
      const a = atoms[i];
      const t = document.createElement('span'); t.className = 'tok'; t.dataset.i = i;
      if (isNumDisplay(a)) {
        // Number atom: wrap each char in its own .ch span (data-c) so a touch can
        // land between any two chars. If the cursor sits inside this atom, insert
        // it between the right .ch spans.
        const chars = showAtom(a);
        for (let c = 0; c < chars.length; c++) {
          if (i === cur && off === c) {
            const cur2 = document.createElement('span'); cur2.className = 'cursor'; t.appendChild(cur2);
          }
          const ch = document.createElement('span'); ch.className = 'ch'; ch.dataset.c = c;
          ch.textContent = chars[c];
          t.appendChild(ch);
        }
      } else {
        t.textContent = showAtom(a);
      }
      exprEl.appendChild(t);
    }
  }
}
// A number atom renders char-by-char for hit-testing. DISPLAY-translated atoms like
// 'sin(' are still single spans (no char-level cursor inside them). Only digit/. atoms.
const isNumDisplay = (a) => /^\d*\.?\d*$/.test(a) && a !== '';

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

// Apply current locale: button short label + panel titles + <html lang/dir> (RTL for ar).
function applyLocale() {
  const meta = getLocaleMeta();
  if (langEl) langEl.textContent = meta.label;
  if (historyTitleEl) historyTitleEl.textContent = t('historyTitle');
  if (mathTitleEl) mathTitleEl.textContent = t('mathTitle');
  const html = document.documentElement;
  html.lang = meta.code; html.dir = meta.dir;
}

// History recall: ∧ older, ∨ newer. null = not replaying.
function recallUp() {
  const hist = store.history;
  if (!hist.length) { showToast(t('noHistory')); return; }
  const next = state.recall === null ? 0 : state.recall + 1;
  if (next >= hist.length) { showToast(t('noMoreHistory')); return; }
  state.recall = next;
  editor.setAtoms(hist[next].atoms);
  resultEl.textContent = '= ' + hist[next].display;
  resultEl.classList.remove('error');
}
function recallDown() {
  if (state.recall === null) return; // not replaying: ∨ is a safe no-op
  const hist = store.history;
  const next = state.recall - 1;
  if (next < 0) { state.resetRecall(); editor.clear(); resultEl.textContent = ''; return; }
  state.recall = next;
  editor.setAtoms(hist[next].atoms);
  resultEl.textContent = '= ' + hist[next].display;
  resultEl.classList.remove('error');
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
    const h = document.createElement('div'); h.className = 'math-group'; h.textContent = t(group.title);
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
    li.addEventListener('click', () => { editor.setAtoms(item.atoms); state.resetRecall(); panel.hidden = true; render(); });
    list.appendChild(li);
  }
  panel.hidden = false;
}

function doSto() {
  const r = evaluate(editor.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  if (!r.ok) { showToast(t('noValueToStore')); return; }
  const name = (prompt(t('stoPrompt')) || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(name)) { showToast(t('invalidVarName')); return; }
  store.setVar(name, r.value);
  showToast(t('storedIn', { name }));
}

// Handles only "insert into editor" actions; caller calls render().
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
  // Shift on but key has no second function: toast unavailable and clear shift (shift key itself excluded)
  if (state.shift && id !== 'shift' && !shifted) {
    showToast(t('unavailable'));
    state.clearShift(); updateShift();
    return;
  }
  const action = shifted || ACTIONS[id];
  if (!action) return;

  if (INSERT_KINDS.has(action.kind)) {
    execAction(action);
    state.clearShift(); updateShift();
    state.resetRecall(); // any insert exits recall; next ∧ starts fresh from newest
    render();
    return;
  }

  switch (action.kind) {
    case 'backspace': editor.backspace(); state.resetRecall(); break;
    case 'clear': editor.clear(); resultEl.textContent = ''; resultEl.classList.remove('error'); state.resetRecall(); break;
    case 'left': editor.moveLeft(); break;
    case 'right': editor.moveRight(); break;
    case 'undo': editor.undo(); state.resetRecall(); break;
    case 'redo': editor.redo(); state.resetRecall(); break;
    case 'equals': doEquals(); state.resetRecall(); break;
    case 'toggleAngle': state.toggleAngleMode(); updateBadge(); return;
    case 'toggleShift': state.toggleShift(); updateShift(); return;
    case 'history': openHistory(); return;
    case 'math': openMath(); return;
    case 'sto': doSto(); return;
    case 'historyUp': recallUp(); updateShift(); render(); return;
    case 'historyDown': recallDown(); updateShift(); render(); return;
    case 'placeholder': showToast(t('unavailable')); return;
  }
  state.clearShift(); updateShift();
  render();
}

// Button clicks
document.querySelector('#keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (btn) dispatch(btn.dataset.id);
});
// Magnifier loupe: while dragging on touch/pen, float a magnified horizontal
// window directly above #expr, centered on the cursor (not the finger) so the
// magnified cursor overlays the real one. Shows only the chars around the
// cursor (≤3 each side) on a single line — no vertical context. Mouse drags are
// precise enough to skip it.
const magEl = document.createElement('div');
magEl.id = 'magnifier';
magEl.hidden = true;
const magContent = document.createElement('div');
magContent.className = 'content';
magEl.appendChild(magContent);
document.body.appendChild(magEl);
const MAG_W = 220, MAG_N = 4;                            // window: ≤4 chars each side (+0.5 via overflow clip)
let magOn = false;
// Build the ≤MAG_N chars left and right of the cursor from the display string.
// Cursor can sit at an atom boundary (offset 0) or inside a number atom (offset o).
function loupeWindow() {
  const atoms = editor.atoms, k = editor.cursor, o = editor.offset;
  let s = '', curIdx = 0;
  for (let i = 0; i < atoms.length; i++) {
    if (i === k && o > 0) curIdx = s.length + o;        // cursor inside this number atom
    else if (i === k) curIdx = s.length;               // cursor before this atom
    s += showAtom(atoms[i]);
  }
  if (k === atoms.length) curIdx = s.length;            // cursor at end
  return {
    left: s.slice(Math.max(0, curIdx - MAG_N), curIdx),
    right: s.slice(curIdx, Math.min(s.length, curIdx + MAG_N)),
  };
}
// Place the loupe above #expr, horizontally centered on the real cursor's X.
function showMagnifier() {
  const cur = exprEl.querySelector('.cursor');
  const rect = exprEl.getBoundingClientRect();
  let cx = cur ? cur.getBoundingClientRect().left : rect.left + rect.width / 2;
  const vw = window.innerWidth;
  cx = Math.max(MAG_W / 2, Math.min(cx, vw - MAG_W / 2));   // keep on screen at the edges
  let top = rect.top - 6;                                   // directly above the digit line (loupe height = content)
  if (top < 2) top = 2;                                     // clamp into the viewport
  magEl.style.left = cx + 'px';
  magEl.style.top = top + 'px';
  const { left, right } = loupeWindow();
  magContent.textContent = '';
  const l = document.createElement('span'); l.className = 'left'; l.textContent = left;
  const c = document.createElement('span'); c.className = 'cursor';
  const r = document.createElement('span'); r.className = 'right'; r.textContent = right;
  magContent.append(l, c, r);
  magEl.hidden = false;
}
function hideMagnifier() { magEl.hidden = true; }
// Touch expression to move cursor: press-and-hold, drag to position, release
// (iOS-native long-press cursor drag). Cursor follows the finger live; pointer
// is captured so the drag survives moving outside #expr without dropping.
function nearestBoundary(x, y) {
  const toks = exprEl.querySelectorAll('.tok');
  if (!toks.length) return null;                      // empty expr: nothing to do
  let best = null, bestLine = Infinity, bestDx = Infinity;
  // Collect candidate (x, {i,o}) pairs per token line fragment. For a number atom
  // the .ch spans give a boundary between every two chars (plus the outer edges);
  // non-number atoms expose only their outer edges (cursor snaps at atom boundaries).
  for (const tok of toks) {
    const i = +tok.dataset.i;
    const chs = tok.querySelectorAll(':scope > .ch');
    for (const rect of tok.getClientRects()) {
      const dy = Math.max(0, rect.top - y, y - rect.bottom); // 0 when y is on this line
      if (dy > bestLine) continue;                    // a nearer line already found
      const edges = chs.length
        ? [{ ex: rect.left, o: 0 }, ...Array.from(chs).map((ch, c) => ({ ex: ch.getBoundingClientRect().right, o: c + 1 }))]
        : [{ ex: rect.left, o: 0 }, { ex: rect.right, o: 0 }];
      for (const { ex, o } of edges) {
        const dx = Math.abs(ex - x);
        if (dy < bestLine || (dy === bestLine && dx < bestDx)) {
          bestLine = dy; bestDx = dx;
          // offset === atom length (right edge) → canonical next boundary (i+1, 0)
          const ni = (o > 0 && o === chs.length) ? i + 1 : i;
          const no = (o > 0 && o === chs.length) ? 0 : o;
          best = { i: ni, o: no };
        }
      }
    }
  }
  return best;
}
let dragging = false;
exprEl.addEventListener('pointerdown', (e) => {
  // Only touch/pen/mouse primary press starts a drag (not e.g. right-click).
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const pos = nearestBoundary(e.clientX, e.clientY);
  if (pos === null) return;
  e.preventDefault();                                 // suppress text-selection long-press
  dragging = true;
  try { exprEl.setPointerCapture(e.pointerId); } catch (_) {}
  editor.setCursor(pos.i, pos.o);                       // pure cursor move (no recall reset, like ‹ › keys)
  render();
  if (e.pointerType !== 'mouse') { magOn = true; showMagnifier(); }
});
exprEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const pos = nearestBoundary(e.clientX, e.clientY);
  if (pos === null) return;
  editor.setCursor(pos.i, pos.o);
  render();
  if (magOn) showMagnifier();
});
const endDrag = (e) => {
  if (!dragging) return;
  dragging = false;
  magOn = false;
  hideMagnifier();
  try { exprEl.releasePointerCapture(e.pointerId); } catch (_) {}
};
exprEl.addEventListener('pointerup', endDrag);
exprEl.addEventListener('pointercancel', endDrag);
// Badge click toggles angle mode
badgeEl.addEventListener('click', () => dispatch('deg'));
// Language switch: cycle to the next official UN language
langEl.addEventListener('click', () => { cycleLocale(); applyLocale(); });
// History close
document.querySelector('#history-close').addEventListener('click', () => { panel.hidden = true; });
// MATH close
document.querySelector('#math-close').addEventListener('click', () => { mathPanel.hidden = true; });
// Physical keyboard
window.addEventListener('keydown', (e) => {
  const id = KEYBOARD[e.key];
  if (id) { e.preventDefault(); dispatch(id); }
});

// Init
injectShiftLabels();
applyLocale();
updateBadge(); updateShift(); render();
