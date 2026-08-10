# Unified Tape Implementation Plan — 输入融入磁带

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把输入框从独立 `#inputbar` 容器变成磁带的最后一项 `<li class="h-current">`,程序只控制一个上下拉的磁带面板;输入与历史同款样式、同条分隔符。

**Architecture:** `#expr`/`#result` 从 `#tape-scroll` 的兄弟移到 `#tape-list` 末尾成为 `.h-current`;`render()` 拆成 `renderTape()`(历史)+ `renderCurrentInput()`(末项);AC 改两段式(非空清空/已空回正常态);展开态隐藏 `.h-current` 而非 `#inputbar`;`#result` 删除,回放值+错误并入 `.h-current .h-res`;∨ 键非 replay 时 snap 回底。

**Tech Stack:** 零依赖纯 ES 模块(`js/app.js` 渲染层)、原生 CSS(`styles.css`)、浏览器测试(`tests/test.html` + `tests/assert.js`)。无 npm、无构建。`dev.html` 预览(不注册 SW)。

## Global Constraints

(摘自 spec §2/§3 决策与 CLAUDE.md)
- AC 两段式:输入非空(`editor.atoms.length>0`)→ 清空输入;已空 → `resetToNormal()`(收叠磁带/关展开/显输入行/复位历史)
- 输入同化为磁带条目:字号 18/22px、同样式;仅带闪烁光标、无 `= 结果`(未完成条目)
- Insert 插入到当前光标处(代码现状,不改)
- Model A:输入随磁带滚动;按键插入/点输入行 → `scrollTapeToBottom()` snap 回底;上滑浏览时输入滚出视野
- **无实时预览**:`.h-current .h-res` 只承载回放值(`= <值>`)与错误(红);正常打字时不渲染 `.h-res`;每次按键**不**调用 `evaluate()`
- 不引入 `Date.now()`/`Math.random()`/`new Date()`(workspace 规则);用 `e.timeStamp`
- gentle error model:错误温和显示(并入 `.h-current .h-res` 变红),保留算式,不锁死,不硬重置
- `js/tape.js` `buildTape` 不变(输入不入 history)
- `js/history.js`/`js/state.js`/`js/i18n.js`/`js/keymap.js` 不变
- 测试新增后必须全绿(`open tests/test.html` 读 PASS/FAIL),`node --check --input-type=module` 语法检查全过
- master 直接开发(项目 standing decision,不开 feature branch)
- 安全规则:任何输出里 MCP/Git token 掩码(首1+尾1,中间 `****`)

---

## File Structure

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `dev.html` | 预览页结构 | 删 `#inputbar`+`#expr`+`#result`,只留 `#tape-scroll`+`#tape-list` |
| `js/app.js` | 渲染层 + 调度 + 手势 | 主要改动:渲染拆分、AC 两段式、`resetToNormal`、∨ snap、选择器迁移 |
| `styles.css` | 样式 | 删 `#inputbar`/`#expr`/`#result`;新增 `.h-current`;分隔符统一;展开态隐藏 `.h-current` |
| `tests/test.html` | 浏览器测试 | 新增 AC 两段式、∨ snap、`.h-current` 渲染用例(可 DOM-free 的部分) |
| `js/tape.js` | `buildTape` 纯函数 | 不变 |
| `js/tokens.js` `Editor` | atoms 编辑器 | 不变(已有 `insertAtoms`/`setCursor`/`clear`/`setAtoms`) |
| `js/history.js`/`js/state.js` | 持久化 + 状态 | 不变 |

---

## Task 1: HTML 结构 — 删 `#inputbar`,磁带末项占位 `.h-current`

**Files:**
- Modify: `dev.html:38-44`

**Interfaces:**
- Consumes: 无
- Produces: `#tape-list` 内将出现一个 `<li class="h-current">`(由后续 Task 的 `renderCurrentInput()` 填充);`#expr`/`#result`/`#inputbar` 元素不再存在,后续 Task 据此迁移引用

- [ ] **Step 1: 修改 `dev.html` 的 `#display` 区**

把 `dev.html:38-44`:
```html
    <section id="display">
      <div id="tape-scroll"><ul id="tape-list"></ul></div>
      <div id="inputbar">
        <div id="expr" aria-label="expression"></div>
        <div id="result"></div>
      </div>
    </section>
```
改为:
```html
    <section id="display">
      <div id="tape-scroll"><ul id="tape-list"></ul></div>
    </section>
```

- [ ] **Step 2: 语法/结构检查**

Run: `node --check --input-type=module < js/app.js && echo OK` (app.js 仍能语法解析;此时它仍引用已删的 `#expr`/`#result` 元素,但语法检查不执行,只校验解析)
Expected: `OK`

> 注:此 Task 后页面**功能会暂时坏掉**(app.js 仍 `querySelector('#expr')` 返回 null)。这是预期的中间态,Task 2 修复渲染层后恢复。本 Task 只动结构,独立提交以保持结构/逻辑分离、便于回溯。

- [ ] **Step 3: Commit**

```bash
git add dev.html
git commit -m "refactor: drop #inputbar; input becomes tape's last <li class=\"h-current\">
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: CSS — `.h-current` 样式 + 分隔符统一 + 展开态隐藏末项

**Files:**
- Modify: `styles.css:35-63`(磁带条目样式 + `#inputbar`/`#expr`/`#result` 区块)

**Interfaces:**
- Consumes: Task 1 的 `.h-current` 结构
- Produces: `.h-current`(同磁带条目样式 + 光标占位 + `min-height:44px`)、每个 `<li>` 统一 `border-top`、`.h-current .h-res.error{color:var(--red)}`、`#calc.tape-expanded #tape-list .h-current{display:none}`

- [ ] **Step 1: 替换磁带条目样式 + 删 `#inputbar`/`#expr`/`#result` 区块**

把 `styles.css:35-63`:
```css
#tape-list { list-style: none; width: 100%; margin-top: auto; }
#tape-list li { padding: 6px 16px; cursor: pointer; }
#tape-list li:active { background: #141416; }
#tape-list .h-expr { font-size: 18px; text-align: left; word-break: break-all; color: var(--muted); }
#tape-list .h-res  { font-size: 22px; text-align: right; color: var(--text); }
/* 条目操作行：点某条历史后在其下方展开 */
.tape-action { display: flex; gap: 8px; justify-content: flex-end;
  padding: 6px 16px 10px; }
.tape-action button { background: var(--key); color: var(--text); border: none;
  border-radius: 6px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
.tape-action button:active { background: #333; }
.tape-action .label { color: var(--muted); margin-right: auto; align-self: center;
  font-size: 13px; letter-spacing: 1px; }
/* 展开态：磁带变绝对定位覆盖层，盖住其上方键行；bottom 由 JS 按 ↺ 行上沿设置，露出 ↺ 整行 */
#calc.tape-expanded #tape-scroll { position: absolute; left: 0; right: 0;
  top: 0; z-index: 12; background: rgba(0,0,0,.96); }
#calc.tape-expanded #inputbar { display: none; }
/* 底部固定输入行：算式左对齐，结果右对齐 */
#inputbar { flex: none; display: flex; flex-direction: column; align-items: stretch;
  padding: 12px 16px 16px; border-top: 1px solid #1a1a1a; }
#expr { font-size: 32px; line-height: 1.4; word-break: break-all; text-align: left;
  min-height: 44px; width: 100%;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  touch-action: none; cursor: text; }
#expr .cursor { display: inline-block; width: 2px; height: 32px; background: var(--text);
  vertical-align: middle; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
#result { font-size: 24px; color: var(--muted); margin-top: 12px; text-align: right; }
#result.error { color: var(--red); }
```
改为:
```css
#tape-list { list-style: none; width: 100%; margin-top: auto; }
/* 每个 <li> 统一顶分隔符：历史条目之间、历史与当前输入之间一致 */
#tape-list li { padding: 6px 16px; cursor: pointer; border-top: 1px solid #1a1a1a; }
#tape-list li:active { background: #141416; }
#tape-list .h-expr { font-size: 18px; text-align: left; word-break: break-all; color: var(--muted); }
#tape-list .h-res  { font-size: 22px; text-align: right; color: var(--text); }
#tape-list .h-res.error { color: var(--red); }
/* 当前输入（磁带末项，未完成条目）：同磁带条目样式，带闪烁光标，min-height 防塌缩 */
.h-current { min-height: 44px; }
.h-current .h-expr { cursor: text; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; touch-action: none; }
.h-current .cursor { display: inline-block; width: 2px; height: 18px; background: var(--text);
  vertical-align: middle; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
/* 条目操作行：点某条历史后在其下方展开（不附在 .h-current 上） */
.tape-action { display: flex; gap: 8px; justify-content: flex-end;
  padding: 6px 16px 10px; border-top: 1px solid #1a1a1a; }
.tape-action button { background: var(--key); color: var(--text); border: none;
  border-radius: 6px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
.tape-action button:active { background: #333; }
.tape-action .label { color: var(--muted); margin-right: auto; align-self: center;
  font-size: 13px; letter-spacing: 1px; }
/* 展开态：磁带变绝对定位覆盖层；隐藏当前输入条目（替代原隐藏 #inputbar） */
#calc.tape-expanded #tape-scroll { position: absolute; left: 0; right: 0;
  top: 0; z-index: 12; background: rgba(0,0,0,.96); }
#calc.tape-expanded #tape-list .h-current { display: none; }
```

- [ ] **Step 2: 语法检查**

Run: 无(CSS 无语法检查;肉眼核对花括号配对即可)
Expected: 无报错。可 `grep -c '#inputbar\|#expr\b\|#result' styles.css` 确认返回 `0`

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: .h-current as tape's last entry; unify li border-top; hide .h-current when expanded
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 渲染层 — `render()` 拆成 `renderTape()` + `renderCurrentInput()`,选择器迁移

**Files:**
- Modify: `js/app.js:21`(元素引用)、`js/app.js:33-67`(`render`)、`js/app.js:69-82`(`renderTape`)

**Interfaces:**
- Consumes: Task 1 的 `#tape-list`(无 `#expr`/`#result`/`#inputbar`)
- Produces:
  - `renderCurrentInput()` —— 渲染 `#tape-list` 末项 `<li class="h-current">`:含 `.h-expr`(光标/`.tok`/`.ch`)+ 可选 `.h-res`(回放值或错误红)
  - `render()` —— 薄壳 `function render(){ renderCurrentInput(); }`
  - `renderTape()` —— 只渲染历史 `<li>`,末尾留 `.h-current` 占位(空 `.h-expr`)
  - `exprEl` —— 改指向 `.h-current`(getter 函数,因列表重建后元素更替;复用现有 `tapeList` 常量)

- [ ] **Step 1: 改元素引用(行 21)**

`js/app.js:69` 已有 `const tapeList = $('#tape-list'), tapeScroll = $('#tape-scroll');`(复用,不新增)。把 `js/app.js:21`:
```js
const exprEl = $('#expr'), resultEl = $('#result'), badgeEl = $('#badge');
```
改为:
```js
const badgeEl = $('#badge');
// 当前输入行是磁带末项 <li class="h-current">；列表重建后元素更替，故用 getter 动态取。
// exprEl() 返回 .h-current 内的 .h-expr（光标/拖拽/放大镜的目标）。
const exprEl = () => tapeList.querySelector('.h-current .h-expr');
```

- [ ] **Step 2: 把 `render()` 改名为 `renderCurrentInput()` 并迁移到 `.h-current`**

把 `js/app.js:33-64` 的 `function render() { ... }` 整体改为 `renderCurrentInput()`,内部把 `exprEl.innerHTML = ''` 改为对 `.h-current .h-expr` 操作。完整替换:

```js
// 渲染磁带末项（当前输入）的 .h-expr：光标 + .tok/.ch spans。目标 = .h-current .h-expr。
function renderCurrentInput() {
  const host = tapeList.querySelector('.h-current .h-expr');
  if (!host) return;                          // 列表未建好(初始化前/重建瞬间)
  host.innerHTML = '';
  const atoms = editor.atoms;
  const cur = editor.cursor, off = editor.offset;
  for (let i = 0; i <= atoms.length; i++) {
    if (i === cur && off === 0) {
      const c = document.createElement('span'); c.className = 'cursor'; host.appendChild(c);
    }
    if (i < atoms.length) {
      const a = atoms[i];
      const t = document.createElement('span'); t.className = 'tok'; t.dataset.i = i;
      if (isNumDisplay(a)) {
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
```

`isNumDisplay`(行 67)保持不动。

- [ ] **Step 3: `renderTape()` 末尾留 `.h-current` 占位**

把 `js/app.js:70-82` 的 `renderTape()`:
```js
function renderTape() {
  tapeList.innerHTML = '';
  openActionTs = null;
  for (const item of buildTape(store.history, baselineTs, showOlder)) {
    const li = document.createElement('li');
    li.dataset.ts = item.ts;
    const e = document.createElement('div'); e.className = 'h-expr';
    e.textContent = item.atoms.map(showAtom).join('');
    const r = document.createElement('div'); r.className = 'h-res'; r.textContent = '= ' + item.display;
    li.append(e, r);
    tapeList.appendChild(li);
  }
}
```
改为(末尾追加空 `.h-current` 占位):
```js
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
```

- [ ] **Step 4: 修回放值/错误路径(用 `.h-current .h-res` 替代 `resultEl`)**

`recallUp`(行 195-204)把 `resultEl.textContent = '= ' + hist[next].display;` 与 `resultEl.classList.remove('error');` 改为操作 `.h-current .h-res`:
```js
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
```

`doEquals`(行 251-261)中 `resultEl.textContent = ''; resultEl.classList.remove('error');`(成功分支)与 `resultEl.textContent = r.error; resultEl.classList.add('error');`(失败分支)改为 `setResultLine`:
```js
function doEquals() {
  const r = evaluate(editor.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  if (r.ok) {
    state.ans = r.value; store.addHistory(editor.atoms, r.display);
    editor.clear();
    setResultLine('', false);              // 提交成功:清结果线(新结果作为历史条目落在 .h-current 正上方)
    renderTape(); renderCurrentInput(); scrollTapeToBottom();
  } else {
    setResultLine(r.error, true);           // 失败:错误红,保留算式,不入库
  }
}
```

- [ ] **Step 5: 删 `dispatch` `case 'clear'` 里的 `resultEl` 引用(行 316)**

把 `js/app.js:316`:
```js
    case 'clear': editor.clear(); resultEl.textContent = ''; resultEl.classList.remove('error'); state.resetRecall(); break;
```
先改为(AC 两段式在 Task 5 落地,本 Task 先把 `resultEl` 去掉、行为暂保持单段清空):
```js
    case 'clear': editor.clear(); setResultLine('', false); state.resetRecall(); break;
```

- [ ] **Step 6: 迁移光标拖拽与放大镜的选择器(`#expr` → `exprEl()`)**

`nearestBoundary`(行 416-445)内 `const toks = exprEl.querySelectorAll('.tok');` 改为 `const toks = exprEl().querySelectorAll(':scope > .tok');`(用 `:scope >` 限定只取 `.h-expr` 直接子 `.tok`,不误入嵌套)。其余不变。

`showMagnifier`(行 370-411)内 `const cur = exprEl.querySelector('.cursor');` 与 `const rect = exprEl.getBoundingClientRect();` 改为 `exprEl()` 调用。

`pointerdown` 监听(行 447)的 `exprEl.addEventListener` 改为 `tapeList.addEventListener`(在监听回调内判断 target 是否落在 `.h-current`),见 Task 4。本 Task 先把 `exprEl` 的所有调用改为 `exprEl()` 函数调用。

逐处替换清单(本 Task 范围内):
- 行 371 `const cur = exprEl.querySelector('.cursor');` → `exprEl().querySelector('.cursor')`
- 行 372 `const rect = exprEl.getBoundingClientRect();` → `exprEl().getBoundingClientRect()`
- 行 417 `const toks = exprEl.querySelectorAll('.tok');` → `exprEl().querySelectorAll(':scope > .tok')`

`displayString()`(行 355-365)不引用 `exprEl`,不改。

> 注:`exprEl.addEventListener('pointerdown', ...)` 等监听绑定语句在 Task 4 处理(改为 `tapeList` 委托)。本 Task 不动监听绑定,先让渲染跑通。

- [ ] **Step 7: 语法检查**

Run: `node --check --input-type=module < js/app.js && echo OK`
Expected: `OK`

- [ ] **Step 8: 浏览器手测**

打开 `http://localhost:8000/dev.html`:
- 页面加载无报错(控制台无 `Cannot read properties of null`)
- 磁带区可见,底部有 `.h-current` 空条目 + 闪烁光标
- 输入数字/算式 → `.h-current .h-expr` 显示带光标
- 按 `=` → 结果作为历史条目落到 `.h-current` 上方,`.h-current` 清空
- 按 ∧/∨ 回放 → `.h-current .h-res` 显示 `= 值`
- 故意输入 `1/0` 按 `=` → `.h-current .h-res` 显示红色 `Math Error`

Expected: 以上全过。光标拖拽/放大镜本 Task 后**可能仍坏**(监听未迁移,Task 4 修),不阻塞本 Task。

- [ ] **Step 9: Commit**

```bash
git add js/app.js
git commit -m "refactor: render() → renderTape() + renderCurrentInput(); result line into .h-current .h-res
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 光标拖拽 + 放大镜 + 双触粘贴 — 委托到 `tapeList`,限定 `.h-current`

**Files:**
- Modify: `js/app.js:446-497`(pointer 监听)

**Interfaces:**
- Consumes: Task 3 的 `exprEl()` getter、`.h-current` 结构
- Produces: pointer 监听委托到 `tapeList`,只在 target 落于 `.h-current .h-expr` 时启动光标拖拽/放大镜/双触;`nearestBoundary`/`showMagnifier`/`pasteAtCursor` 逻辑不变

- [ ] **Step 1: 把 4 个 `exprEl.addEventListener` 改为 `tapeList` 委托**

定位 `js/app.js` 的 `exprEl.addEventListener('pointerdown', ...)`(约 447)、`exprEl.addEventListener('pointermove', ...)`(约 459)、`endDrag`(约 467)、`exprEl.addEventListener('pointerup', ...)`(约 496)、`exprEl.addEventListener('pointercancel', endDrag)`(约 497)。

把 `pointerdown` 绑定从 `exprEl.addEventListener(...)` 改为 `tapeList.addEventListener('pointerdown', ...)` 并在回调开头加守卫:
```js
// 光标拖拽委托到 tapeList：只在 target 落在 .h-current .h-expr 时启动。
tapeList.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const host = exprEl();                       // .h-current .h-expr，或 null
  if (!host || !host.contains(e.target)) return; // 点的是历史条目/Action 行，不启动拖拽
  const pos = nearestBoundary(e.clientX, e.clientY);
  if (pos === null) return;
  e.preventDefault();
  dragging = true;
  try { host.setPointerCapture(e.pointerId); } catch (_) {}   // 在 .h-expr 上捕获
  editor.setCursor(pos.i, pos.o);
  render();
  if (e.pointerType !== 'mouse') { magOn = true; showMagnifier(); }
});
```

`pointermove`(约 459)开头加 `const host = exprEl(); if (!host) return;`(拖拽中列表不应重建,但守卫防意外),其余 `if (!dragging) return; ...` 不变。`setPointerCapture`/`releasePointerCapture` 改为对 `host`(即 `exprEl()`):

`endDrag`(约 467)改为:
```js
const endDrag = (e) => {
  if (!dragging) return;
  dragging = false;
  magOn = false;
  hideMagnifier();
  const host = exprEl();
  if (host) { try { host.releasePointerCapture(e.pointerId); } catch (_) {} }
};
```

`pointerup`(约 496)从 `exprEl.addEventListener` 改 `tapeList.addEventListener('pointerup', ...)`(回调体 `endDrag(e); maybeDoubleTap(e);` 不变,但 `maybeDoubleTap` 内双触粘贴只在拖拽源于 `.h-current` 时有意义——`pasteAtCursor` 直接用当前光标,无需额外守卫,因为非 `.h-current` 的 pointerdown 已在上面 return,不会进入 dragging,双触的 `lastTapT` 也只在 `.h-current` pointerup 后积累。为稳妥,在 `pointerup` 回调开头加 `if (!exprEl() || !exprEl().contains(e.target)) return;` 守卫)。

`pointercancel`(约 497)从 `exprEl.addEventListener` 改 `tapeList.addEventListener('pointercancel', endDrag)`。

完整替换 446-497 区段(以实际行号为准):
```js
let dragging = false;
tapeList.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const host = exprEl();
  if (!host || !host.contains(e.target)) return;
  const pos = nearestBoundary(e.clientX, e.clientY);
  if (pos === null) return;
  e.preventDefault();
  dragging = true;
  try { host.setPointerCapture(e.pointerId); } catch (_) {}
  editor.setCursor(pos.i, pos.o);
  render();
  if (e.pointerType !== 'mouse') { magOn = true; showMagnifier(); }
});
tapeList.addEventListener('pointermove', (e) => {
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
let lastTapT = 0, lastTapX = 0, lastTapY = 0;
async function pasteAtCursor() {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch { showToast(t('pasteFail')); return; }
  const m = (text || '').trim().match(/^-?\d*\.?\d+/);
  if (!m) { showToast(t('pasteFail')); return; }
  for (const ch of m[0]) {
    if (ch === '-') editor.insertAtom('-');
    else editor.insertDigit(ch);
  }
  state.resetRecall(); render();
}
function maybeDoubleTap(e) {
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
```

- [ ] **Step 2: `tapeList` click 监听加 `.h-current` 早返回(行 122-129)**

现 `tapeList.addEventListener('click', ...)`(行 122)已 `if (li.classList.contains('tape-action')) return;` + `entryByTs`。补 `.h-current` 守卫。把:
```js
tapeList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li || li.classList.contains('tape-action')) return;
  const item = entryByTs(li.dataset.ts);
  if (!item) return;
  if (openActionTs === String(item.ts)) { closeAction(); }
  else { openAction(li, item); }
});
```
改为:
```js
tapeList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li || li.classList.contains('tape-action')) return;
  if (li.classList.contains('h-current')) return;   // 当前输入行:走光标拖拽,不弹 Action
  const item = entryByTs(li.dataset.ts);
  if (!item) return;
  if (openActionTs === String(item.ts)) { closeAction(); }
  else { openAction(li, item); }
});
```

- [ ] **Step 3: 语法检查**

Run: `node --check --input-type=module < js/app.js && echo OK`
Expected: `OK`

- [ ] **Step 4: 浏览器手测**

`http://localhost:8000/dev.html`:
- 触摸/鼠标按住 `.h-current` 拖动 → 光标跟随,放大镜(触屏)浮现
- 点历史条目 → 弹 Action 行(Insert/Copy/Retry);点 `.h-current` → 不弹
- 双触 `.h-current` → 粘贴剪贴板数字(若剪贴板有数字)
- 点历史条目 Action 的 Insert → 原子插到当前光标处(`.h-current` 更新)
- 拖拽时手势移出 `.h-current` 不丢(`setPointerCapture` 在 `.h-expr` 上)

Expected: 全过。

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "refactor: delegate pointer/click to tapeList; cursor drag only on .h-current
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: AC 两段式 + `resetToNormal()` + ∨ snap + overscroll 复用

**Files:**
- Modify: `js/app.js:205-214`(`recallDown`)、`js/app.js:160-166`(`resetTapeClean`)、`js/app.js:316`(已由 Task 3 改为 `setResultLine`)、`js/app.js:499-523`(overscroll)

**Interfaces:**
- Consumes: Task 3 的 `setResultLine`、`renderTape`/`renderCurrentInput`/`scrollTapeToBottom`、`setExpanded`/`closeAction`/`state.resetRecall`
- Produces:
  - `resetToNormal()` —— 唯一复位出口:`showOlder=false; if(expanded) setExpanded(false); closeAction(); state.resetRecall(); renderTape(); renderCurrentInput(); scrollTapeToBottom()`
  - AC `case 'clear'` 两段式
  - ∨ 非 replay 时 snap 回底
  - overscroll 底端下拉 → `resetToNormal()`(替代 `resetTapeClean`)

- [ ] **Step 1: 新增 `resetToNormal()`,删 `resetTapeClean()`**

把 `js/app.js:160-166` 的 `resetTapeClean`:
```js
// 复位到干净态：隐藏旧历史 + 收起展开 + 露输入行
function resetTapeClean() {
  showOlder = false;
  if (expanded) setExpanded(false);
  renderTape(); scrollTapeToBottom();
}
```
改为:
```js
// 唯一复位出口：收叠历史(showOlder=false) + 关展开(磁带回原位、显输入行) + 收 Action + 清回放 + 滚底。
function resetToNormal() {
  showOlder = false;
  if (expanded) setExpanded(false);
  closeAction();
  state.resetRecall();
  setResultLine('', false);
  renderTape(); renderCurrentInput(); scrollTapeToBottom();
}
```

- [ ] **Step 2: AC `case 'clear'` 改两段式**

把 `js/app.js:316`(Task 3 已改为 `case 'clear': editor.clear(); setResultLine('', false); state.resetRecall(); break;`)改为:
```js
    case 'clear':
      if (editor.atoms.length > 0) {        // 输入非空 → 清空输入
        editor.clear(); setResultLine('', false); state.resetRecall();
      } else {                               // 输入已空 → 统一回正常态
        resetToNormal();
      }
      break;
```

- [ ] **Step 3: ∨ 非 replay 时 snap 回底**

`recallDown`(Task 3 已改为以 `if (state.recall === null) return;` 开头)改为:
```js
function recallDown() {
  if (state.recall === null) {              // 非 replay:∨ = snap 回底(看输入)
    if (tapeScroll.scrollTop + tapeScroll.clientHeight < tapeScroll.scrollHeight - 1) {
      scrollTapeToBottom();
    }
    return;
  }
  const hist = store.history;
  const next = state.recall - 1;
  if (next < 0) { state.resetRecall(); editor.clear(); setResultLine('', true); return; }
  state.recall = next;
  editor.setAtoms(hist[next].atoms);
  setResultLine('= ' + hist[next].display, false);
}
```

- [ ] **Step 4: overscroll 底端下拉 → `resetToNormal()`**

`js/app.js:499-523` 的 overscroll `touchmove` 与 `wheel` 中 `resetTapeClean()` 调用改为 `resetToNormal()`。把:
```js
  else if (atBottom && dy < -OVER) {                  // 底端继续上拉
    fired = true; resetTapeClean();
  }
```
改为:
```js
  else if (atBottom && dy < -OVER) {                  // 底端继续上拉 → 回正常态
    fired = true; resetToNormal();
  }
```
`wheel` 同理:
```js
  else if (atBottom && e.deltaY > OVER) { resetToNormal(); }
```

- [ ] **Step 5: 确认 `setExpanded` 展开分支仍 `showOlder=true`(不变,核对)**

`js/app.js:134-147` `setExpanded(on)` 的 `if (on)` 分支已有 `showOlder = true;`,本 Task 不改,仅核对仍在(spec §7.1)。

- [ ] **Step 6: 语法检查**

Run: `node --check --input-type=module < js/app.js && echo OK`
Expected: `OK`

- [ ] **Step 7: 浏览器手测**

`http://localhost:8000/dev.html`:
- 输入 `5+3` → 按 AC → 输入清空(`.h-current` 空);再按 AC → 历史收起、滚底、回正常态
- ↺ 展开磁带(覆盖键盘) → 按 AC(输入本就空)→ `setExpanded(false)` 关展开 + `showOlder=false` + 滚底
- 上滑浏览旧历史(输入滚出视野)→ 按 ∨ → snap 回底,输入重现
- 底端再下拉 → `resetToNormal`(回正常态)
- 触发 `loadOlder`(顶端上拉)→ 滚动锚定不跳

Expected: 全过。

- [ ] **Step 8: Commit**

```bash
git add js/app.js
git commit -m "feat: AC two-stage; resetToNormal; ∨ snaps to bottom; overscroll reuses resetToNormal
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 按键插入 snap 回底 + 测试新增

**Files:**
- Modify: `js/app.js:306-311`(INSERT_KINDS 分支)、`tests/test.html`(末尾 `runAll()` 前)

**Interfaces:**
- Consumes: Task 3 的 `renderCurrentInput`/`scrollTapeToBottom`
- Produces: 任意 insert 后 snap 回底;新增测试用例(AC 两段式、∨ snap 逻辑)

- [ ] **Step 1: insert 分支后 snap 回底**

`js/app.js:306-312` 的 INSERT_KINDS 分支:
```js
  if (INSERT_KINDS.has(action.kind)) {
    execAction(action);
    state.clearShift(); updateShift();
    state.resetRecall(); // any insert exits recall; next ∧ starts fresh from newest
    render();
    return;
  }
```
改为:
```js
  if (INSERT_KINDS.has(action.kind)) {
    execAction(action);
    state.clearShift(); updateShift();
    state.resetRecall(); // any insert exits recall; next ∧ starts fresh from newest
    render();
    scrollTapeToBottom();   // Model A: 插入后把末项(.h-current)滚回视野
    return;
  }
```

`backspace`/`left`/`right`/`undo`/`redo` 等也改输入行,但它们在 `switch` 末尾统一 `render()`(行 332)。在 `render()` 后补 `scrollTapeToBottom()` 不合适(有些操作不需滚)。保守做法:只在 INSERT_KINDS 与 `backspace` 后 snap(它们改变输入内容,可能长出滚动)。把 `case 'backspace'`(行 315)后的 `render()` 调用补滚:
```js
    case 'backspace': editor.backspace(); state.resetRecall(); render(); scrollTapeToBottom(); break;
```
`left`/`right` 不 snap(光标移动不需滚到底,否则会抢用户浏览位置)。`undo`/`redo` 同 `backspace` 处理(可能改内容):
```js
    case 'undo': editor.undo(); state.resetRecall(); render(); scrollTapeToBottom(); break;
    case 'redo': editor.redo(); state.resetRecall(); render(); scrollTapeToBottom(); break;
```
其余 `switch` 分支(`equals`/`toggleAngle`/`history`/`math`/`sto`/`historyUp`/`historyDown`/`placeholder`)不动(`equals` 已自行 `scrollTapeToBottom`;`historyDown` 已 snap)。

- [ ] **Step 2: 测试 — AC 两段式逻辑(DOM-free,用 editor + state 模拟)**

在 `tests/test.html` 的 `runAll();` 之前(约行 514 前)追加。AC 两段式依赖 `editor.atoms.length` 与 `resetToNormal`,但 `resetToNormal` 是 app.js 内部函数、且依赖 DOM。**测可 DOM-free 的部分**:AC 判据逻辑(输入非空 vs 已空)。用 `Editor` 模拟:

```js
  // ---- AC 两段式判据(输入是否为空)----
  // 不测 app.js 的 dispatch(依赖 DOM),只测判据语义:editor.atoms.length>0 → 非空。
  test('AC 判据:空 editor 视为输入已空', () => {
    const e = new Editor();
    assertEqual(e.atoms.length, 0);   // 即 AC 第二段(resetToNormal)的触发条件
  });
  test('AC 判据:有原子视为输入非空', () => {
    const e = new Editor();
    e.insertDigit('5'); e.insertAtom('+'); e.insertDigit('3');
    assertEqual(e.atoms.length, 3);   // 即 AC 第一段(清空)的触发条件
  });
  test('AC 清空后回到空(editor.clear 语义)', () => {
    const e = new Editor();
    e.insertDigit('5'); e.insertAtom('+'); e.insertDigit('3');
    e.clear();
    assertEqual(e.atoms.length, 0);   // 清空后第二段触发条件成立
  });
```

- [ ] **Step 3: 测试 — `.h-current` 渲染结构(DOM 依赖,放浏览器测)**

`renderCurrentInput` 依赖 DOM(`tapeList.querySelector`),`runAll()` 在浏览器跑。加一个**浏览器态**测试(用 `document` 真建 DOM)。但 `test.html` 的 `runAll` 已依赖 `document`,可加。不过 `renderCurrentInput` 依赖 app.js 全局 `editor`/`tapeList`,难以隔离单测。

**决策**:不为 `renderCurrentInput` 写隔离单测(它纯渲染、依赖全局,硬测价值低、成本高);改为**靠 Task 3/4/5 的浏览器手测覆盖**。本 Task 测试只加 Step 2 的判据语义 3 条。

- [ ] **Step 4: 运行测试**

Run: `open tests/test.html`(或浏览器访问 `http://localhost:8000/tests/test.html`),读页底 PASS/FAIL 汇总
Expected: 全 PASS,用例数 = 原 117 + 新增 3 = 120

- [ ] **Step 5: 语法检查全模块**

Run: `for f in js/*.js; do node --check --input-type=module < "$f" || echo "FAIL $f"; done`
Expected: 无 `FAIL`

- [ ] **Step 6: Commit**

```bash
git add js/app.js tests/test.html
git commit -m "feat: snap to bottom on insert/backspace/undo/redo; AC stage tests
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 初始化顺序 + 手测回归 + v7 快照更新

**Files:**
- Modify: `js/app.js:537-540`(Init)、`v7/`(快照同步)

**Interfaces:**
- Consumes: 全部前置 Task
- Produces: 初始化正确建 `.h-current`;v7 快照与 trunk 字节一致

- [ ] **Step 1: 核对 Init 顺序**

`js/app.js:537-540`:
```js
// Init
injectShiftLabels();
applyLocale();
updateBadge(); updateShift(); render(); renderTape(); scrollTapeToBottom();
```
问题:`render()`(即 `renderCurrentInput`)在 `renderTape()` 之前调用,此时 `#tape-list` 里还没有 `.h-current` 占位 → `renderCurrentInput` 内 `tapeList.querySelector('.h-current .h-expr')` 返回 null → 提前 return(无害但浪费一次调用)。改为 `renderTape()` 先建占位,再 `renderCurrentInput()`:
```js
// Init
injectShiftLabels();
applyLocale();
updateBadge(); updateShift();
renderTape(); renderCurrentInput(); scrollTapeToBottom();
```

- [ ] **Step 2: 浏览器全量手测**

`http://localhost:8000/dev.html`,按 spec §5/§6/§7 全过一遍:
- 输入算式 → `.h-current` 显示带光标(18px,左对齐)
- 按 `=` → 结果作为历史条目落到 `.h-current` 上方(22px 右对齐 `= 值`),`.h-current` 清空
- 回放 ∧/∨ → `.h-current .h-res` 显示 `= 值`;∨ 非 replay 时 snap 回底
- AC 两段式(非空清空/已空回正常态)
- ↺ 展开 → `.h-current` 隐藏,磁带覆盖键盘露 ↺ 行;AC → 回正常态
- 光标拖拽/放大镜/双触粘贴(只在 `.h-current`)
- Action 行(Insert/Copy/Retry)只在历史条目
- overscroll 顶端上拉懒加载/展开,底端下拉回正常态
- 分隔符:每条 `<li>` 顶 `1px #1a1a1a`,历史与输入一致

Expected: 全过,无控制台报错。

- [ ] **Step 3: 同步 v7 快照**

本计划基于已发布的 v7 后续修复。按 CLAUDE.md "To release a new version" 流程:本计划改动若要发布,需建 `v8/`。但 spec/本计划**不强制现在发版**——先在 trunk(`dev.html`)验证。

**决策**:本 Task 只**核对 v7 与 trunk 差异**,不自动建 v8(发版是用户决定)。运行:
```bash
diff -r js/ v7/js/ | head -20
diff styles.css v7/styles.css | head -20
```
记录差异(v7 仍是 `f9557cc` 时的状态,缺本计划全部改动 + 此前的 `0683ef6` 修复)。**不修改 v7**(它是冻结快照)。是否发 v8 由用户在实现后定。

- [ ] **Step 4: 运行全部测试**

Run: `open tests/test.html` 读 PASS/FAIL
Expected: 全 PASS(120 用例)

- [ ] **Step 5: 语法检查全模块**

Run: `for f in js/*.js; do node --check --input-type=module < "$f" || echo "FAIL $f"; done`
Expected: 无 `FAIL`

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "fix: init order — renderTape before renderCurrentInput so .h-current exists
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec 覆盖:**
- §4.1 HTML 删 `#inputbar` → Task 1 ✓
- §4.2 渲染拆分 `renderTape`+`renderCurrentInput`,`render()` 薄壳 → Task 3 ✓
- §4.3 选择器迁移(`exprEl()` getter、`:scope > .tok`、放大镜基准)→ Task 3+4 ✓
- §4.4 滚动 snap(插入后 snap 回底)→ Task 6 ✓
- §5.1 `.h-current` 结构(算式+可选 `.h-res`+光标,18/22px)→ Task 2+3 ✓
- §5.2 视觉(复用磁带样式、`min-height:44px` 占位)→ Task 2 ✓
- §5.3 分隔符统一(每 `<li>` `border-top`)→ Task 2 ✓
- §6.1 AC 两段式 → Task 5 ✓
- §6.2 `resetToNormal()` 唯一出口 → Task 5 ✓
- §6.4 边界(展开态 AC、`resetTapeClean`→`resetToNormal`)→ Task 5 ✓
- §6.5 `doEquals` 提交(`resultEl` 删、`renderCurrentInput`)→ Task 3 ✓
- §7.1 展开态隐藏 `.h-current` → Task 2 ✓
- §7.2 overscroll → Task 5 ✓
- §7.3 ∨ snap 回底 → Task 5 ✓
- §7.4 Action 行不附输入、点 `.h-current` 不弹 → Task 4 ✓
- §3 无实时预览(`.h-res` 只回放/错误,不每次 evaluate)→ Task 3 `setResultLine` 仅在回放/`doEquals` 失败调用,insert 路径不调 `evaluate` ✓
- §9 测试(AC 判据 3 条;`renderCurrentInput` 靠手测)→ Task 6 ✓

**2. 占位符扫描:** 无 TBD/TODO/"add error handling"/空代码块。所有步骤含实际代码 ✓

**3. 类型/命名一致性:**
- `renderCurrentInput()` 全程一致 ✓
- `setResultLine(text, isError)` Task 3 定义、Task 5 调用,签名一致 ✓
- `resetToNormal()` Task 5 定义,无他处定义 ✓
- `exprEl` 从"常量元素"变"getter 函数"——所有调用点改为 `exprEl()`(Task 3 列了清单,Task 4 用 `exprEl()`)✓
- 命名:复用现有 `const tapeList = $('#tape-list')`(行 69),不引入 `tapeListEl`;全文 `tapeList` 一致 ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-unified-tape.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 我每 Task 派一个全新 subagent 实现 + 两段 review,任务间快迭代。

**2. Inline Execution** — 在本会话用 executing-plans 批量执行 + 检查点 review。

Which approach?
