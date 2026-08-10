// js/app.js
import { Editor } from './tokens.js';
import { AppState } from './state.js';
import { Store } from './history.js';
import { evaluate } from './engine.js';
import { ACTIONS, SHIFT_ACTIONS, KEYBOARD } from './keymap.js';
import { MATH_CATALOG } from './mathmenu.js';
import { buildTape } from './tape.js';
import { t, cycleLocale, getLocaleMeta } from './i18n.js';

const editor = new Editor();
const state = new AppState();
const store = new Store();

// 磁带：baselineTs=启动时最大 ts（区分本次会话 vs 旧历史）；showOlder=是否已接入旧历史。
let baselineTs = store.history[0]?.ts ?? 0;
let showOlder = false;
let openActionTs = null;   // 当前展开 Action 行的条目 ts（null=无展开）

const $ = (s) => document.querySelector(s);
const badgeEl = $('#badge');
// 当前输入行是磁带末项 <li class="h-current">；列表重建后元素更替，故用 getter 动态取。
// exprEl() 返回 .h-current 内的 .h-expr（光标/拖拽/放大镜的目标）。
const exprEl = () => tapeList.querySelector('.h-current .h-expr');
const toastEl = $('#toast');
const mathPanel = $('#math-panel'), mathBody = $('#math-body');
const langEl = $('#lang'), historyTitleEl = $('#history-title'), mathTitleEl = $('#math-title');

const DISPLAY = {
  '*': '×', '/': '÷', 'pi': 'π', 'sqrt(': '√(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', 'cbrt(': '³√(',
  'nCr': 'C', 'nPr': 'P',
};
const showAtom = (a) => DISPLAY[a] ?? a;

// 渲染磁带末项（当前输入）的 .h-expr：光标 + .tok/.ch spans。目标 = .h-current .h-expr。
function renderCurrentInput() {
  const host = tapeList.querySelector('.h-current .h-expr');
  if (!host) return;                          // 列表未建好(初始化前/重建瞬间)
  host.innerHTML = '';
  const atoms = editor.atoms;
  const cur = editor.cursor, off = editor.offset;
  for (let i = 0; i <= atoms.length; i++) {
    // Cursor at an atom boundary (offset 0): before atoms[i] (or at end if i===len).
    if (i === cur && off === 0) {
      const c = document.createElement('span'); c.className = 'cursor'; host.appendChild(c);
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
      host.appendChild(t);
    }
  }
}
// 薄壳：保留 render() 名，避免改 40+ 调用点。等价于 renderCurrentInput()。
function render() { renderCurrentInput(); }
// A number atom renders char-by-char for hit-testing. DISPLAY-translated atoms like
// 'sin(' are still single spans (no char-level cursor inside them). Only digit/. atoms.
const isNumDisplay = (a) => /^\d*\.?\d*$/.test(a) && a !== '';

const tapeList = $('#tape-list'), tapeScroll = $('#tape-scroll');
function renderTape() {
  tapeList.innerHTML = '';
  openActionTs = null;   // 列表重建后清除悬空引用（下面重新绑定点击）
  for (const item of buildTape(store.history, baselineTs, showOlder)) {
    const li = document.createElement('li');
    li.dataset.ts = item.ts;
    const e = document.createElement('div'); e.className = 'h-expr';
    e.textContent = item.atoms.map(showAtom).join('');
    const r = document.createElement('div'); r.className = 'h-res'; r.textContent = '= ' + item.display;
    li.append(e, r);
    tapeList.appendChild(li);
  }
  // 末项：当前输入占位（.h-expr 由 renderCurrentInput 填充，.h-res 由回放/错误路径填）
  const cur = document.createElement('li');
  cur.className = 'h-current';
  const e = document.createElement('div'); e.className = 'h-expr';
  const r = document.createElement('div'); r.className = 'h-res'; r.hidden = true;
  cur.append(e, r);
  tapeList.appendChild(cur);
}
function scrollTapeToBottom() { tapeScroll.scrollTop = tapeScroll.scrollHeight; }

// 点条目 → 在其下展开 Action 行（Insert/Copy/Retry）；再点该条或点别处收起。
function entryByTs(ts) { return store.history.find((h) => String(h.ts) === String(ts)); }
function closeAction() {
  openActionTs = null;
  const ex = tapeList.querySelector('.tape-action');
  if (ex) ex.remove();
}
function openAction(li, item) {
  closeAction();
  openActionTs = String(item.ts);
  const row = document.createElement('li');   // 作为兄弟 li 插在被点条目后
  row.className = 'tape-action';
  row.innerHTML = '<span class="label">Action</span>';
  const mk = (txt, fn) => { const b = document.createElement('button'); b.type = 'button';
    b.textContent = txt; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  row.append(
    mk('Insert', () => { editor.insertAtoms(item.atoms); state.resetRecall(); closeAction(); render(); }),
    mk('Copy', () => { copyText(item.display); closeAction(); }),
    mk('Retry', () => { retryEntry(item); }),
  );
  li.after(row);
}

async function copyText(s) {
  try { await navigator.clipboard.writeText(s); showToast(t('copied')); }
  catch { showToast(t('pasteFail')); }   // 复用文案：失败提示（无剪贴板权限）
}

function retryEntry(item) {
  const r = evaluate(item.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  closeAction();
  if (r.ok) {
    state.ans = r.value; store.addHistory(item.atoms, r.display);
    renderTape(); render(); scrollTapeToBottom();   // renderTape 重建 .h-current 后 render() 填光标
  } else { showToast(r.error); }         // Retry 出错：轻提示，不动输入行
}

tapeList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li || li.classList.contains('tape-action')) return;
  if (li.classList.contains('h-current')) return;   // 当前输入行:走光标拖拽,不弹 Action
  const item = entryByTs(li.dataset.ts);
  if (!item) return;
  if (openActionTs === String(item.ts)) { closeAction(); }
  else { openAction(li, item); }
});

const calcEl = $('#calc');
const historyBtn = document.querySelector('.key[data-id="history"]');
let expanded = false;
function setExpanded(on) {
  expanded = on;
  calcEl.classList.toggle('tape-expanded', on);
  if (on) {
    // 展开 = 全量查看历史：接入旧历史(showOlder=true)，覆盖层底沿 = ↺ 行上沿，露出 ↺ 整行可点
    showOlder = true;
    // 覆盖层底沿 = ↺ 按钮那一行的上沿（rect 测量，不硬编码行高）
    const b = historyBtn.getBoundingClientRect().top;
    tapeScroll.style.bottom = (window.innerHeight - b) + 'px';
    renderTape(); render(); scrollTapeToBottom();   // renderTape 重建 .h-current 后 render() 填光标
  } else {
    tapeScroll.style.bottom = '';
    render();   // 收起后补一次光标(renderTape 未重跑，但确保 .h-current 有光标)
  }
}
function toggleTapeExpand() { setExpanded(!expanded); }

// 接入旧历史（顶端懒加载），保持滚动位置不跳
function loadOlder() {
  if (showOlder) return false;
  const older = store.history.filter((h) => h.ts <= baselineTs);
  if (!older.length) return false;
  const oldH = tapeScroll.scrollHeight;
  showOlder = true; renderTape(); render();   // renderTape 重建 .h-current 后 render() 填光标
  tapeScroll.scrollTop += tapeScroll.scrollHeight - oldH;  // 锚定
  return true;
}

// 复位到干净态：隐藏旧历史 + 收起展开 + 露输入行
function resetTapeClean() {
  showOlder = false;
  if (expanded) setExpanded(false);
  renderTape(); render(); scrollTapeToBottom();   // renderTape 重建 .h-current 后 render() 填光标
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
  setResultLine('= ' + hist[next].display, false);
}
function recallDown() {
  if (state.recall === null) return; // not replaying: ∨ 由 Task 5 改为 snap 回底
  const hist = store.history;
  const next = state.recall - 1;
  if (next < 0) { state.resetRecall(); editor.clear(); setResultLine('', true); return; }
  state.recall = next;
  editor.setAtoms(hist[next].atoms);
  setResultLine('= ' + hist[next].display, false);
}
// 结果线(回放值/错误)并入磁带末项 .h-current .h-res；正常打字时隐藏。
function setResultLine(text, isError) {
  const r = tapeList.querySelector('.h-current .h-res');
  if (!r) return;
  if (text === '') { r.hidden = true; r.textContent = ''; r.classList.remove('error'); return; }
  r.hidden = false; r.textContent = text;
  r.classList.toggle('error', !!isError);
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
    state.ans = r.value; store.addHistory(editor.atoms, r.display);
    editor.clear();                       // 提交后清空输入行
    setResultLine('', false);             // 提交成功:清结果线(新结果作为历史条目落在 .h-current 正上方)
    renderTape(); renderCurrentInput(); scrollTapeToBottom();
  } else {
    setResultLine(r.error, true);          // 失败:错误红,保留算式,不入库
  }
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
    case 'clear': editor.clear(); setResultLine('', false); state.resetRecall(); break;
    case 'left': editor.moveLeft(); break;
    case 'right': editor.moveRight(); break;
    case 'undo': editor.undo(); state.resetRecall(); break;
    case 'redo': editor.redo(); state.resetRecall(); break;
    case 'equals': doEquals(); state.resetRecall(); break;
    case 'toggleAngle': state.toggleAngleMode(); updateBadge(); return;
    case 'toggleShift': state.toggleShift(); updateShift(); return;
    case 'history': toggleTapeExpand(); return;
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
let magOn = false;
// Full display string + cursor char index. The cursor sits at char curIdx of s;
// it can be at an atom boundary (offset 0) or inside a number atom (offset o).
function displayString() {
  const atoms = editor.atoms, k = editor.cursor, o = editor.offset;
  let s = '', curIdx = 0;
  for (let i = 0; i < atoms.length; i++) {
    if (i === k && o > 0) curIdx = s.length + o;        // cursor inside this number atom
    else if (i === k) curIdx = s.length;               // cursor before this atom
    s += showAtom(atoms[i]);
  }
  if (k === atoms.length) curIdx = s.length;            // cursor at end
  return { s, curIdx };
}
// Loupe above #expr, magnified cursor overlaying the real one. A fixed 9ch-wide
// viewport over one line of the whole expression, translated so the cursor sits
// centered; at the ends the translate is clamped so the cursor rides the near
// border and the far side's half-char peeks at the opposite border (symmetric).
function showMagnifier() {
  const cur = exprEl().querySelector('.cursor');
  const rect = exprEl().getBoundingClientRect();
  const realX = cur ? cur.getBoundingClientRect().left : rect.left + rect.width / 2;
  const vw = window.innerWidth;
  const { s, curIdx } = displayString();
  magEl.style.left = '-9999px';
  magEl.hidden = false;                                    // render off-screen so layout measures
  magContent.textContent = '';
  const line = document.createElement('span'); line.className = 'line';
  const l = document.createElement('span'); l.textContent = s.slice(0, curIdx);
  const c = document.createElement('span'); c.className = 'cursor';
  const r = document.createElement('span'); r.textContent = s.slice(curIdx);
  line.append(l, c, r);
  magContent.appendChild(line);
  const w = magEl.offsetWidth;                              // 9ch + border (fixed by CSS)
  const curX = c.offsetLeft;                                // cursor left edge within the line
  const lineW = line.offsetWidth;
  // Translate the line so the magnified cursor lands where we want inside the
  // 9ch viewport: centered in the middle, parked at the near border at the ends
  // (so the far side's half-char peeks at the opposite border — symmetric).
  const pad = 4;
  let tx;
  if (lineW <= w) {
    tx = (w - lineW) / 2;                                    // short expr: center the whole line
  } else {
    tx = w / 2 - curX;                                       // start: center the cursor
    if (curX + tx < pad) tx = pad - curX;                    // left end: pin cursor to the left border
    if (curX + tx > w - pad) tx = w - pad - curX;            // right end: pin cursor to the right border
    tx = Math.max(w - lineW, Math.min(tx, 0));               // keep the viewport full (line wider than w)
  }
  line.style.transform = `translateX(${tx}px)`;
  // Place the loupe so the magnified cursor overlays the real one, then keep on-screen.
  // curX + tx is the cursor's X within the loupe; loupe left = real cursor X − that.
  let left = realX - (curX + tx);
  left = Math.max(0, Math.min(left, vw - w));
  magEl.style.left = left + 'px';
  const h = magEl.offsetHeight;                              // content 38px + 2×2px border
  let top = rect.top - h - 4;                                 // sit fully above #expr with a 4px gap
  if (top < 2) top = rect.bottom + 4;                         // no room above → drop below the expr
  magEl.style.top = top + 'px';
}
function hideMagnifier() { magEl.hidden = true; }
// Touch expression to move cursor: press-and-hold, drag to position, release
// (iOS-native long-press cursor drag). Cursor follows the finger live; pointer
// is captured so the drag survives moving outside #expr without dropping.
function nearestBoundary(x, y) {
  const toks = exprEl().querySelectorAll(':scope > .tok');
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
// 光标拖拽委托到 tapeList：只在 target 落在 .h-current .h-expr 时启动。
tapeList.addEventListener('pointerdown', (e) => {
  const host = exprEl();
  if (!host || !host.contains(e.target)) return;
  // Only touch/pen/mouse primary press starts a drag (not e.g. right-click).
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const pos = nearestBoundary(e.clientX, e.clientY);
  if (pos === null) return;
  e.preventDefault();                                 // suppress text-selection long-press
  dragging = true;
  try { host.setPointerCapture(e.pointerId); } catch (_) {}
  editor.setCursor(pos.i, pos.o);                       // pure cursor move (no recall reset, like ‹ › keys)
  render();
  if (e.pointerType !== 'mouse') { magOn = true; showMagnifier(); }
});
tapeList.addEventListener('pointermove', (e) => {
  const host = exprEl();
  if (!host || !host.contains(e.target)) return;
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
  const host = exprEl();
  if (host) { try { host.releasePointerCapture(e.pointerId); } catch (_) {} }
};
// double-touch 粘贴：两次 pointerup 间隔≤300ms 且位置相近 → 读剪贴板插到光标处。
// 光标已由本次 pointerdown 的 nearestBoundary 定位，故直接在当前光标插入。
let lastTapT = 0, lastTapX = 0, lastTapY = 0;
async function pasteAtCursor() {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch { showToast(t('pasteFail')); return; }
  const m = (text || '').trim().match(/^-?\d*\.?\d+/);   // 仅取普通十进制数字串
  if (!m) { showToast(t('pasteFail')); return; }
  for (const ch of m[0]) {
    if (ch === '-') editor.insertAtom('-');
    else editor.insertDigit(ch);                          // 复用数字合并/小数点逻辑
  }
  state.resetRecall(); render();
}
function maybeDoubleTap(e) {
  // 用 harness 提供的时间戳；e.timeStamp 单调，避免 Date.now()
  const now = e.timeStamp;
  const near = Math.abs(e.clientX - lastTapX) < 24 && Math.abs(e.clientY - lastTapY) < 24;
  if (now - lastTapT < 300 && near) { lastTapT = 0; pasteAtCursor(); return; }
  lastTapT = now; lastTapX = e.clientX; lastTapY = e.clientY;
}
tapeList.addEventListener('pointerup', (e) => {
  endDrag(e);
  const host = exprEl();
  if (!host || !host.contains(e.target)) return;
  maybeDoubleTap(e);
});
tapeList.addEventListener('pointercancel', endDrag);

// overscroll 手势：顶端到顶再上拉→(先懒加载，再)展开；底端到底再下拉→复位干净态。
const OVER = 48;                 // 触发阈值(px)
let touchY = null, fired = false;
tapeScroll.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; fired = false; }, { passive: true });
tapeScroll.addEventListener('touchmove', (e) => {
  if (touchY === null || fired) return;
  const dy = e.touches[0].clientY - touchY;              // 下拉为正
  const atTop = tapeScroll.scrollTop <= 0;
  const atBottom = tapeScroll.scrollTop + tapeScroll.clientHeight >= tapeScroll.scrollHeight - 1;
  if (atTop && dy > OVER) {                              // 顶端继续下拉(内容下移=看更早)
    fired = true;
    if (!loadOlder()) setExpanded(true);                // 先接旧历史；已无更多则展开
  } else if (atBottom && dy < -OVER) {                  // 底端继续上拉
    fired = true; resetTapeClean();
  }
}, { passive: true });
tapeScroll.addEventListener('touchend', () => { touchY = null; }, { passive: true });

// 桌面 dev 调试：滚轮到端点后同方向再滚
tapeScroll.addEventListener('wheel', (e) => {
  const atTop = tapeScroll.scrollTop <= 0;
  const atBottom = tapeScroll.scrollTop + tapeScroll.clientHeight >= tapeScroll.scrollHeight - 1;
  if (atTop && e.deltaY < -OVER) { if (!loadOlder()) setExpanded(true); }
  else if (atBottom && e.deltaY > OVER) { resetTapeClean(); }
}, { passive: true });

// Badge click toggles angle mode
badgeEl.addEventListener('click', () => dispatch('deg'));
// Language switch: cycle to the next official UN language
langEl.addEventListener('click', () => { cycleLocale(); applyLocale(); });
// MATH close
document.querySelector('#math-close').addEventListener('click', () => { mathPanel.hidden = true; });
// Physical keyboard
window.addEventListener('keydown', (e) => {
  const id = KEYBOARD[e.key];
  if (id) { e.preventDefault(); dispatch(id); }
});

// Init：renderTape 先建 .h-current 占位，再 render()（→ renderCurrentInput）填光标。
injectShiftLabels();
applyLocale();
updateBadge(); updateShift(); renderTape(); render(); scrollTapeToBottom();
