# 实时历史磁带 + 空间利用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把算式区改造成商业式实时历史磁带——输入行钉底部、结果逐条向上冒、两端 overscroll 手势 + ↺ 展开、点条目出 Insert/Copy/Retry、光标处双触粘贴——填满短算式下方的空白。

**Architecture:** 无引擎改动。新增一个 DOM-free 纯函数模块 `js/tape.js`（会话/旧历史切分），其余为 `app.js` / `styles.css` / `dev.html` 内的布局与交互扩展。`doEquals` 由"保留算式"改为"提交入库并清空"。发布走 CLAUDE.md 的版本闸流程（trunk → v7 快照 → 翻根 gate）。

**Tech Stack:** 纯 HTML / CSS / 原生 ES modules，零依赖零构建。测试为浏览器内 `tests/test.html`（`assert.js` 的 `test/assertEqual/assertThrows` + `runAll`），DOM-free 模块可 `node --input-type=module` headless 验证。

## Global Constraints

- **零依赖、零构建**：不得引入 npm / bundler / framework；仅 HTML/CSS/native ES modules。
- **所有路径相对**：部署在任意子路径下不变。
- **引擎链只读**：`lex→parse→evaluate→formatNumber` 及 `∧/∨` REPLAY、STO/MATH/i18n/角度模式行为**不得改动**（本计划唯一的既有行为变更是 `doEquals` 改为提交并清空）。
- **温柔错误模型**：求值错误只在结果位显示 `Syntax Error`/`Math Error`、保留算式、不锁定；不新增错误 UI。
- **保留 `#expr` / `#result` 的 id 与既有能力**：光标渲染、按住拖动移光标、放大镜 loupe 代码零改动，仅容器位置变化。
- **DISPLAY 映射唯一出口**：新增显示字形只在 `app.js` 的 `DISPLAY` 表，不进引擎。
- **发布版本闸**：新版本号 **v7**。`sw.js` `CACHE` 当前为 `"calc-v6x"` → 必须 bump 到 `"calc-v7"` 并把 `./js/tape.js` 加入 `ASSETS`；v7/ 快照 JS 必须与 trunk 字节一致。
- **i18n 全覆盖**：任何新用户可见文案必须在 `js/i18n.js` 的 6 种语言（en/zh/fr/es/ru/ar）全部提供。
- **测试green gate**：每个引入 atom/kind/纯函数的 Task 必须在 `tests/test.html` 加用例并保持全绿后才提交。

---

## File Structure

| 文件 | 职责 | 本计划改动 |
|------|------|-----------|
| `js/tape.js` | **新建**。纯函数：给定 `history` + `baselineTs` + `showOlder`，算出磁带从上到下（oldest-first）的显示条目。DOM-free、可 headless 测试。 | 全新 |
| `js/app.js` | 控制脊柱。渲染磁带、`doEquals` 提交清空、overscroll 手势、↺ 展开、Action 行、双触粘贴、`insertAtoms`。 | 大改（新增多段、移除 `openHistory`） |
| `js/i18n.js` | 文案字典。 | 新增 `copied` / `pasteFail` 两条（6 语言） |
| `dev.html` | trunk 预览页。 | `#display` 拆为 `#tape-scroll`+`#inputbar`；移除 `#history-panel`；版本标签 v7 |
| `styles.css` | 样式。 | 磁带滚动区/输入行/展开覆盖层/Action 行样式；清理历史面板样式 |
| `sw.js` | 服务worker缓存。 | `CACHE`→`calc-v7`；`ASSETS` 加 `./js/tape.js` |
| `index.html`（根） | 版本闸。 | 全部 v6 标记→v7 |
| `v7/`（新建目录） | 冻结快照。 | 拷贝 trunk 全套 + 上版 icons |
| `tests/test.html` | 测试页。 | 新增 `buildTape` / `insertAtoms` 用例 |

依赖顺序：Task 1（`tape.js` 纯函数，可独立测试）→ Task 2（`insertAtoms` 编辑器辅助，纯逻辑）→ Task 3（布局骨架 dev.html+css）→ Task 4（磁带渲染 + `doEquals` 提交清空）→ Task 5（overscroll 手势 + ↺ 展开）→ Task 6（Action 行 Insert/Copy/Retry + i18n）→ Task 7（双触粘贴）→ Task 8（发布 v7）。

Task 1–2 为纯函数 TDD（浏览器测试页红→绿）；Task 3–7 为 DOM/UI，交付物用 `dev.html` 人工验证清单；Task 8 为发布。

---

## Task 1: `js/tape.js` — 会话/旧历史切分纯函数

**Files:**
- Create: `js/tape.js`
- Test: `tests/test.html`（在 `runAll();` 之前插入用例；顶部 import 区加入 `buildTape`）

**Interfaces:**
- Consumes: 无（纯函数）。`history` 数组元素形如 `{ atoms, display, ts }`（见 `js/history.js`，newest-first，`ts` 单调递增）。
- Produces: `buildTape(history, baselineTs, showOlder) -> Entry[]`，返回**从上到下**（oldest-first）的条目数组，元素为 history 原对象的引用（不复制）。语义：
  - `session = history.filter(h => h.ts > baselineTs)`（本次会话新算）
  - `older = history.filter(h => h.ts <= baselineTs)`（启动前保存）
  - `showOlder=false` → 只返回 session（oldest-first）；`showOlder=true` → `[...older(oldest-first), ...session(oldest-first)]`

- [ ] **Step 1: 在 `tests/test.html` 顶部 import 区加入 `buildTape`**

在第 17 行 `import { MATH_CATALOG } ...` 之后加一行：

```js
  import { buildTape } from '../js/tape.js';
```

- [ ] **Step 2: 写失败测试**

在 `tests/test.html` 的 `runAll();`（约第 466 行）**之前**插入：

```js
  // ---- tape.buildTape ----
  const mkHist = (...items) => items.map(([display, ts]) => ({ atoms: [display], display, ts }));
  // history 为 newest-first（ts 大在前），模拟 store.history
  const H = mkHist(['d4', 4], ['d3', 3], ['d2', 2], ['d1', 1]);

  test('buildTape 默认只含会话(ts>baseline)、oldest-first', () => {
    // baseline=2 ⇒ session = d3,d4 ；showOlder=false
    const r = buildTape(H, 2, false).map(e => e.display).join(',');
    assertEqual(r, 'd3,d4');
  });
  test('buildTape showOlder 拼接 older 在前，均 oldest-first', () => {
    // baseline=2 ⇒ older = d1,d2 ; session = d3,d4
    const r = buildTape(H, 2, true).map(e => e.display).join(',');
    assertEqual(r, 'd1,d2,d3,d4');
  });
  test('buildTape baseline=0 全为会话', () => {
    assertEqual(buildTape(H, 0, false).map(e => e.display).join(','), 'd1,d2,d3,d4');
  });
  test('buildTape 全为 older 时 showOlder=false 返回空', () => {
    // baseline=4（≥ 所有 ts）⇒ session 为空
    assertEqual(buildTape(H, 4, false).length, 0);
  });
  test('buildTape 空 history 返回空', () => {
    assertEqual(buildTape([], 0, true).length, 0);
  });
```

- [ ] **Step 3: 运行确认失败**

在浏览器打开 `http://localhost:8000/tests/test.html`（需先 `python3 -m http.server 8000`）。
Expected: 5 条 `buildTape` 用例 FAIL（`buildTape` 模块不存在 → import 报错，整页红）。

- [ ] **Step 4: 写最小实现**

创建 `js/tape.js`：

```js
// js/tape.js
// 磁带显示模型（DOM-free 纯函数）。
// history 为 newest-first（见 history.js），每条含单调递增 ts。
// baselineTs = 启动时的最大 ts；ts>baseline 为本次会话新算，ts<=baseline 为旧历史。
// 返回从上到下（oldest-first）的显示顺序。
export function buildTape(history, baselineTs, showOlder) {
  const session = history.filter((h) => h.ts > baselineTs);
  const older = history.filter((h) => h.ts <= baselineTs);
  const oldestFirst = (arr) => arr.slice().reverse();
  return showOlder
    ? [...oldestFirst(older), ...oldestFirst(session)]
    : oldestFirst(session);
}
```

- [ ] **Step 5: 运行确认通过**

刷新 `tests/test.html`。Expected: 全部 PASS（含 5 条新用例）。
另跑 headless 语法检查：

Run: `node --check --input-type=module < js/tape.js && echo OK`
Expected: `OK`

- [ ] **Step 6: 提交**

```bash
git add js/tape.js tests/test.html
git commit -m "feat: add tape.buildTape session/older split (pure)"
```

---

## Task 2: `Editor.insertAtoms` — 批量插入原子（供 Insert 复用）

**Files:**
- Modify: `js/tokens.js`（在 `insertAtom` 之后新增 `insertAtoms`）
- Test: `tests/test.html`（Editor 用例区，`runAll();` 之前）

**Interfaces:**
- Consumes: `Editor.insertAtom(atom)`（已存在，逐个插入并处理数字分裂/光标）。
- Produces: `Editor.insertAtoms(atoms)` — 按顺序把 `atoms`（字符串数组）逐个 `insertAtom` 插到当前光标处；空数组为 no-op。Task 6 的 Insert 按钮消费它。

- [ ] **Step 1: 写失败测试**

在 `tests/test.html` 的 Editor 用例区（`insertAtom 数字内分裂` 用例之后、`runAll();` 之前）插入：

```js
  test('insertAtoms 批量插入到光标处', () => {
    const e = new Editor();
    e.insertDigit('3'); e.insertAtom('*');            // ["3","*"] 光标在末尾
    e.insertAtoms(['12', '+', '8']);
    assertEqual(e.atoms.join(','), '3,*,12,+,8');
  });
  test('insertAtoms 空数组 no-op', () => {
    const e = new Editor();
    e.insertDigit('5');
    e.insertAtoms([]);
    assertEqual(e.atoms.join(','), '5');
  });
```

- [ ] **Step 2: 运行确认失败**

刷新 `http://localhost:8000/tests/test.html`。
Expected: 2 条新用例 FAIL（`e.insertAtoms is not a function`）。

- [ ] **Step 3: 写最小实现**

在 `js/tokens.js` 的 `insertAtom(atom) { ... }` 方法之后插入：

```js
  // 批量插入：把一串原子按顺序插到当前光标处（复用 insertAtom 的数字分裂/合并逻辑）。
  insertAtoms(atoms) { for (const a of atoms) this.insertAtom(a); }
```

- [ ] **Step 4: 运行确认通过**

刷新 `tests/test.html`。Expected: 全部 PASS（含 2 条新用例）。

Run: `node --check --input-type=module < js/tokens.js && echo OK`
Expected: `OK`

- [ ] **Step 5: 提交**

```bash
git add js/tokens.js tests/test.html
git commit -m "feat: add Editor.insertAtoms for batch insert"
```

---

## Task 3: 布局骨架 — `#display` 拆成磁带滚动区 + 底部输入行

把 `#display` 从"顶部大数字 + 底部黑"改为"上方可滚动磁带 `#tape-scroll` + 底部固定输入行 `#inputbar`（含现 `#expr`/`#result`）"。本 Task 只搭 DOM + CSS 骨架并移除全屏历史面板；磁带条目的真实渲染在 Task 4。

**Files:**
- Modify: `dev.html`（`#display` 段、移除 `#history-panel`、版本标签）
- Modify: `styles.css`（`#display` / 新增 `#tape-scroll` `#inputbar` / 清理 `#history-panel`）

**Interfaces:**
- Consumes: 无。
- Produces: DOM 里存在 `#tape-scroll`（空的可滚动区）与 `#inputbar`（内含原样 `#expr`、`#result`）；`#history-panel` 及 `#history-close` 已从 `dev.html` 移除（Task 4 会一并移除 app.js 里对它们的引用）。

- [ ] **Step 1: 改 `dev.html` 的 `#display` 段**

把 `dev.html` 第 38–41 行：

```html
    <section id="display">
      <div id="expr" aria-label="expression"></div>
      <div id="result"></div>
    </section>
```

替换为：

```html
    <section id="display">
      <div id="tape-scroll"><ul id="tape-list"></ul></div>
      <div id="inputbar">
        <div id="expr" aria-label="expression"></div>
        <div id="result"></div>
      </div>
    </section>
```

- [ ] **Step 2: 移除 `dev.html` 的全屏历史面板**

删除 `dev.html` 第 43–49 行整段：

```html
    <div id="history-panel" hidden>
      <div class="history-head">
        <span id="history-title">History</span>
        <button id="history-close" type="button">✕</button>
      </div>
      <ul id="history-list"></ul>
    </div>
```

（`#toast` 与 `#math-panel` 保留不动。）

- [ ] **Step 3: 升 `dev.html` 版本标签**

把 `dev.html` 第 35 行 `<div id="version">v6 · dev</div>` 改为 `<div id="version">v7 · dev</div>`。

- [ ] **Step 4: 改 `styles.css` 的 `#display` 及新增结构样式**

把 `styles.css` 第 26–36 行（`#display` / `#expr` / `#result` 那几条）中的 `#display` 规则替换，并新增磁带样式。具体：

将第 26–27 行：

```css
#display { flex: 1; display: flex; flex-direction: column; justify-content: flex-start;
  align-items: flex-end; padding: 16px; overflow: hidden; }
```

替换为：

```css
#display { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
/* 磁带：可滚动历史区。用 #tape-list 的 margin-top:auto 把少量条目推到底，
   而不是 #tape-scroll 的 justify-content:flex-end —— 后者在 Chromium 下会让
   溢出内容的顶部不可达(scrollTop 卡 0)，磁带滚不动。min-height:0 允许收缩滚动。 */
#tape-scroll { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
#tape-list { list-style: none; width: 100%; margin-top: auto; }
#tape-list li { padding: 6px 16px; cursor: pointer; }
#tape-list li:active { background: #141416; }
#tape-list .h-expr { font-size: 18px; text-align: right; word-break: break-all; color: var(--muted); }
#tape-list .h-res  { font-size: 22px; text-align: right; color: var(--text); }
/* 底部固定输入行（原 #expr/#result 移入，靠右对齐保持不变） */
#inputbar { flex: none; display: flex; flex-direction: column; align-items: flex-end;
  padding: 12px 16px 16px; border-top: 1px solid #1a1a1a; }
```

（第 28–36 行 `#expr` / `#expr .cursor` / `@keyframes blink` / `#result` 规则**保持不动** —— 它们靠 id 选择，容器变了也仍生效。）

- [ ] **Step 5: 清理 `styles.css` 的 `#history-panel` 样式**

`#history-panel` 已不再使用。删除 `styles.css` 第 62–75 行整段（`#history-panel` 起，到 `#history-list .h-res { ... }` 止）。

> 注意：`#history-close` 与 `#math-close` 共享第 66–70 行的规则；该段属于要删的区间，但 `#math-close` 仍需样式。删除后**立即**在 `#math-panel` 样式区（约原第 87 行附近）补回 `#math-close` 的等价规则：

```css
#math-close { font-size: inherit; width: 1.2em; height: 1.2em;
  display: flex; align-items: center; justify-content: center;
  background: var(--key); border: none; border-radius: 6px; color: var(--text);
  cursor: pointer; padding: 0; }
#math-close:active { background: #333; }
```

- [ ] **Step 6: 人工验证骨架**

启动 `python3 -m http.server 8000`，开 `http://localhost:8000/dev.html`。
Expected（此时磁带尚无渲染逻辑，Task 4 才填）：
- 页面不报错（控制台无 `#history-panel`/`openHistory` 相关报错——若报错，是 app.js 仍引用，Task 4 会修；本 Task 先允许 console 出现该引用错误但页面结构应可见）。
- 输入区在**底部**（紧贴键盘上沿），上方是空白滚动区。
- 输入数字，`#expr`/`#result` 在底部输入行内正常显示、光标正常。

> 若 Step 6 因 app.js 仍 `querySelector('#history-panel')`/`#history-close` 报错导致页面白屏，先跳到 Task 4 Step 1（移除这些引用）再回看。两者相邻、由同一实现者连续完成即可。

- [ ] **Step 7: 提交**

```bash
git add dev.html styles.css
git commit -m "feat: restructure #display into scrollable tape + bottom inputbar"
```

---

## Task 4: 磁带渲染 + `doEquals` 提交并清空 + 移除全屏历史

把 `store.history` 经 `buildTape` 渲染进 `#tape-list`；`=` 改为"求值成功则入库、清空输入行、滚到底"；移除 `openHistory`/`#history-panel`/`#history-close` 相关代码。↺ 暂时先绑成"重渲染磁带并滚到底"（展开逻辑在 Task 5）。

**Files:**
- Modify: `js/app.js`（新增 `baselineTs`/`showOlder` 状态、`renderTape()`、`scrollTapeToBottom()`；改 `doEquals`；改 history-close 监听；改 `history` kind 路由；移除 `openHistory`）

**Interfaces:**
- Consumes: `buildTape(history, baselineTs, showOlder)`（Task 1）；`store.history`（含 `ts`）；`store.addHistory`；`editor.clear`；现有 `showAtom`。
- Produces: 模块级 `renderTape()`（重建 `#tape-list` 条目）；`scrollTapeToBottom()`；模块级可变量 `baselineTs`（`let`，Task 5 的复位手势会重置它）、`showOlder`（`let`，Task 5 会切换）。条目 `<li>` 带 `dataset.ts`（Task 6 用它定位被点条目）。

- [ ] **Step 1: 移除 app.js 对全屏历史面板的引用**

在 `js/app.js`：
1. 删除第 16 行里的 `panel = $('#history-panel'), list = $('#history-list')` 两个绑定（保留同一行的 `toastEl`）。改为：

```js
const toastEl = $('#toast');
```

2. 删除整个 `openHistory()` 函数（第 156–168 行）。
3. 删除 history-close 监听（第 388 行 `document.querySelector('#history-close')...`）。
4. 把 `dispatch` 里 `case 'history': openHistory(); return;`（第 231 行）改为：

```js
    case 'history': toggleTapeExpand(); return;
```

（`toggleTapeExpand` 在 Task 5 定义；本 Task 先加一个临时空实现避免报错——见 Step 4 说明。）

- [ ] **Step 2: 新增磁带状态与渲染函数**

在 `js/app.js` 顶部 import 区加入（第 7 行 `import { MATH_CATALOG }...` 之后）：

```js
import { buildTape } from './tape.js';
```

在 `const store = new Store();`（第 12 行）之后加入磁带状态：

```js
// 磁带：baselineTs=启动时最大 ts（区分本次会话 vs 旧历史）；showOlder=是否已接入旧历史。
let baselineTs = store.history[0]?.ts ?? 0;
let showOlder = false;
```

在 `render()` 函数之后新增磁带渲染（放在 `showToast` 之前）：

```js
const tapeList = $('#tape-list'), tapeScroll = $('#tape-scroll');
function renderTape() {
  tapeList.innerHTML = '';
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
function scrollTapeToBottom() { tapeScroll.scrollTop = tapeScroll.scrollHeight; }
```

- [ ] **Step 3: 改 `doEquals` 为提交并清空**

把 `doEquals()`（第 146–154 行）替换为：

```js
function doEquals() {
  const r = evaluate(editor.atoms, { angleMode: state.angleMode, ans: state.ans, vars: store.vars });
  if (r.ok) {
    state.ans = r.value; store.addHistory(editor.atoms, r.display);
    editor.clear();                       // 提交后清空输入行
    resultEl.textContent = ''; resultEl.classList.remove('error');
    renderTape(); scrollTapeToBottom();   // 新条目落到磁带底部
  } else {
    resultEl.textContent = r.error; resultEl.classList.add('error');  // 失败：保留算式，不入库
  }
}
```

> 注意：`store.addHistory` 内部 `this._seq++`，新条目 `ts > baselineTs`，故经 `buildTape` 归入 session、出现在磁带底部。`editor.clear()` 会 `_snapshot()`，故 `=` 后仍可 undo 回算式（与既有 undo 语义一致）。

- [ ] **Step 4: 加临时 `toggleTapeExpand` 占位**

Task 5 会实现真正的展开。本 Task 先加占位（放在 `renderTape` 附近），使 `dispatch` 的 `history` 分支不报错：

```js
// Task 5 将替换为真正的展开/收起；此处先做安全占位。
function toggleTapeExpand() { renderTape(); scrollTapeToBottom(); }
```

- [ ] **Step 5: 初始化时渲染磁带**

把文件末尾初始化行（第 400 行）`updateBadge(); updateShift(); render();` 改为：

```js
updateBadge(); updateShift(); render(); renderTape(); scrollTapeToBottom();
```

- [ ] **Step 6: 人工验证**

`http://localhost:8000/dev.html`（DevTools 里 Application → Local Storage 可先清掉 `calc.history` 看首屏空态）。
Expected:
- **首屏**：磁带为空（若 localStorage 有旧历史，因 `showOlder=false` 且它们 `ts<=baseline`，也**不显示** → 首屏干净）。输入行在底。
- 输入 `12+8` 按 `=`：磁带底部冒出 `12+8 / = 20`，输入行清空，`Ans` 更新（输入 `Ans` 得 20）。
- 再算 `3*3=`：磁带累积两条，自动滚到底。
- 控制台无 `#history-panel`/`openHistory` 报错。
- headless：`node --check --input-type=module < js/app.js` 不报错（app.js 触 `document`，只做语法检查）。

- [ ] **Step 7: 提交**

```bash
git add js/app.js
git commit -m "feat: render history tape; = commits and clears input; drop full-screen history"
```

---

## Task 5: overscroll 手势 + ↺ 展开/收起（盖住键盘）

三段手势：顶端到顶懒加载旧历史；已在顶端再 overscroll → 展开；已在底端 overscroll → 复位干净态。↺ 与顶端 overscroll 展开互为入口。

**Files:**
- Modify: `js/app.js`（替换 Task 4 的 `toggleTapeExpand` 占位；新增 `loadOlder()`、`resetTapeClean()`、`setExpanded()`、overscroll 触摸/滚轮监听）
- Modify: `styles.css`（`.tape-expanded` 覆盖层样式）

**Interfaces:**
- Consumes: Task 4 的 `renderTape` / `scrollTapeToBottom` / `tapeScroll` / `baselineTs` / `showOlder`；`#history` 按钮 DOM（`.key[data-id="history"]`）。
- Produces: `setExpanded(on)`、`toggleTapeExpand()`（真实实现）、`loadOlder()`、`resetTapeClean()`。展开态 = `#calc` 上有 `.tape-expanded` 类且 `#tape-scroll` 覆盖层 `bottom` 已按 ↺ 按钮 rect 设置。

- [ ] **Step 1: CSS 展开覆盖层**

在 `styles.css` 磁带样式区（`#tape-list` 规则附近）新增：

```css
/* 展开态：磁带变绝对定位覆盖层，盖住其下键行；bottom 由 JS 按 ↺ 行【上沿】设置 */
#calc.tape-expanded #tape-scroll { position: absolute; left: 0; right: 0;
  top: 0; z-index: 12; background: rgba(0,0,0,.96); }
#calc.tape-expanded #inputbar { display: none; }
```

> `top:0` 让覆盖层从状态栏顶起（状态栏在 `#calc` 内、非 fixed，故覆盖层压在其上无妨，视觉上磁带占满上部）；`bottom` 由 JS 设为 ↺ 行【上沿】（见 Step 2），使 ↺ 所在整行留在覆盖层之外、可点。展开时隐藏输入行，让磁带最大化。

- [ ] **Step 2: 替换 `toggleTapeExpand` 占位并新增展开/复位/懒加载**

把 Task 4 Step 4 加的占位 `function toggleTapeExpand() { renderTape(); scrollTapeToBottom(); }` 替换为：

```js
const calcEl = $('#calc');
const historyBtn = document.querySelector('.key[data-id="history"]');
let expanded = false;
function setExpanded(on) {
  expanded = on;
  calcEl.classList.toggle('tape-expanded', on);
  if (on) {
    // 覆盖层底沿 = ↺ 按钮那一行的【上沿】（rect 测量，不硬编码行高）。
    // 用 top 而非 bottom：让 ↺ 所在整行留在覆盖层之外、可见可点，"再点 ↺ 收起"才成立。
    const b = historyBtn.getBoundingClientRect().top;
    tapeScroll.style.bottom = (window.innerHeight - b) + 'px';
    renderTape(); scrollTapeToBottom();
  } else {
    tapeScroll.style.bottom = '';
  }
}
function toggleTapeExpand() { setExpanded(!expanded); }

// 接入旧历史（顶端懒加载），保持滚动位置不跳
function loadOlder() {
  if (showOlder) return false;
  const older = store.history.filter((h) => h.ts <= baselineTs);
  if (!older.length) return false;
  const oldH = tapeScroll.scrollHeight;
  showOlder = true; renderTape();
  tapeScroll.scrollTop += tapeScroll.scrollHeight - oldH;  // 锚定
  return true;
}

// 复位到干净态：隐藏旧历史 + 收起展开 + 露输入行
function resetTapeClean() {
  showOlder = false;
  if (expanded) setExpanded(false);
  renderTape(); scrollTapeToBottom();
}
```

- [ ] **Step 3: overscroll 触摸/滚轮监听**

在 endDrag 相关监听区（约第 381 行之后、`badgeEl.addEventListener` 之前）新增。overscroll 判定：到端点后朝越界方向累计位移超阈值触发，一次手势只触发一次。

```js
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
```

> 方向语义：磁带里"看更早历史"= 内容向下移 = 手指下拉（`dy>0`）/ 滚轮上滚（`deltaY<0`）。顶端两级：先 `loadOlder()`（接旧历史）；旧历史已全部接入后再次顶端 overscroll 才 `setExpanded(true)`。底端 overscroll（手指上拉 `dy<0` / 滚轮下滚 `deltaY>0`）→ `resetTapeClean()`。

- [ ] **Step 4: 人工验证（触屏 + 桌面滚轮均可）**

`http://localhost:8000/dev.html`，先制造历史：算若干条（或用有旧历史的 localStorage），刷新使部分成为"旧历史"（`ts<=baseline`）。
Expected:
- 磁带内正常滚动看会话条目。
- 滚到顶再下拉/上滚 → 旧历史接到上方，视图不跳（锚定）。
- 旧历史已全接入后，顶端再 overscroll → 磁带展开盖住键盘，停在 ↺ 行（功能行 1、2 仍可见可点），输入行隐藏。
- 点 ↺ → 展开/收起切换。
- 展开态下滚到底再上拉，或收起后底端 overscroll → 复位：旧历史隐藏、展开收起、露出底部输入行。
- 常规滚动（未到端点）不误触；一次拉只触发一次。
- headless：`node --check --input-type=module < js/app.js` 不报错。

- [ ] **Step 5: 提交**

```bash
git add js/app.js styles.css
git commit -m "feat: tape overscroll gestures + toggle expand over keypad"
```

---

## Task 6: 条目 Action 行 — Insert / Copy / Retry（含 i18n）

点磁带某条 → 该条下方滑出一行 Action（Insert 插算式 / Copy 复制结果 / Retry 直接重算）。同一时刻只展开一条。

**Files:**
- Modify: `js/i18n.js`（新增 `copied` / `pasteFail` 两条，6 语言）
- Modify: `js/app.js`（`#tape-list` 点击委托：展开/收起 Action 行 + 三按钮行为）
- Modify: `styles.css`（`.tape-action` 行样式）
- Test: `tests/test.html`（i18n 新键断言）

**Interfaces:**
- Consumes: `t('copied')` / `t('pasteFail')`（本 Task 新增）；`editor.insertAtoms`（Task 2）；`buildTape` 条目的 `atoms`/`display`/`ts`；Task 4 的 `renderTape`/`scrollTapeToBottom`；`store.addHistory`；`evaluate`（engine）；`li.dataset.ts`（Task 4 已写入）。
- Produces: `#tape-list` 的点击交互；被点 `<li>` 下方插入一个 `.tape-action` 行（三个 `<button>`）。Retry 复用 `doEquals` 的入库+滚底逻辑（此处直接对选定 atoms 求值）。

- [ ] **Step 1: i18n 新增两条并加测试**

在 `js/i18n.js` 的 `STRINGS` 里（`storedIn` 之后、`// MATH panel...` 之前）新增：

```js
  copied: {
    en: 'Copied', zh: '已复制', fr: 'Copié', es: 'Copiado',
    ru: 'Скопировано', ar: 'تم النسخ',
  },
  pasteFail: {
    en: 'Paste failed', zh: '粘贴失败', fr: 'Échec du collage', es: 'Error al pegar',
    ru: 'Не удалось вставить', ar: 'فشل اللصق',
  },
```

在 `tests/test.html` 的 i18n 用例区（`i18n t() 未知 key...` 之后）加：

```js
  test('i18n copied / pasteFail 六语言齐全', () => {
    for (const key of ['copied', 'pasteFail']) {
      for (const code of ['en','zh','fr','es','ru','ar']) {
        setLocale(code);
        const s = t(key);
        if (!s || s === key) throw new Error('missing ' + key + ' for ' + code);
      }
    }
    setLocale('en');
  });
```

- [ ] **Step 2: 运行确认（先红后绿）**

刷新 `tests/test.html`：先确认新用例存在。若先加了测试后加字典会 FAIL；两步都完成后应 PASS。
Expected: 全绿。

- [ ] **Step 3: CSS Action 行**

在 `styles.css` 磁带样式区新增：

```css
/* 条目操作行：点某条历史后在其下方展开 */
.tape-action { display: flex; gap: 8px; justify-content: flex-end;
  padding: 6px 16px 10px; }
.tape-action button { background: var(--key); color: var(--text); border: none;
  border-radius: 6px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
.tape-action button:active { background: #333; }
.tape-action .label { color: var(--muted); margin-right: auto; align-self: center;
  font-size: 13px; letter-spacing: 1px; }
```

- [ ] **Step 4: app.js 点击委托 + 三按钮**

在 `js/app.js` 里，`renderTape` 之后新增交互（并在文件末尾或事件绑定区绑定一次监听）。先加一个辅助与点击处理：

```js
// 点条目 → 在其下展开 Action 行（Insert/Copy/Retry）；再点该条或点别处收起。
let openActionTs = null;
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
    renderTape(); scrollTapeToBottom();
  } else { showToast(r.error); }         // Retry 出错：轻提示，不动输入行
}

tapeList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li || li.classList.contains('tape-action')) return;
  const item = entryByTs(li.dataset.ts);
  if (!item) return;
  if (openActionTs === String(item.ts)) { closeAction(); }
  else { openAction(li, item); }
});
```

> `renderTape()` 会重建列表；为简单起见，`renderTape` 内在重建后重置 `openActionTs=null`（下一步补一行）。Insert 用 `insertAtoms`（Task 2）插算式，符合 spec §7；Copy 写结果值；Retry 直接对 atoms 求值入库、不动输入行。

- [ ] **Step 5: renderTape 重建时清 Action 状态**

在 `renderTape()` 函数体开头 `tapeList.innerHTML = '';` 之后加一行，避免重渲染后残留悬空引用：

```js
  openActionTs = null;
```

> 注意变量声明顺序：`openActionTs` 用 `let` 声明需在 `renderTape` 之前（提升到 Task 4 加状态那段附近，与 `showOlder` 并列声明 `let openActionTs = null;`）。若实现者把交互代码放在 `renderTape` 之后，请把 `let openActionTs = null;` 上移到磁带状态声明区，仅保留此处赋值。

- [ ] **Step 6: 人工验证**

`http://localhost:8000/dev.html`：算几条历史。
Expected:
- 点某条 → 其下方出现 Action 行（含 Insert / Copy / Retry + 左侧 "Action" 标签）。
- 再点该条 → Action 行收起；点另一条 → 只在新条下展开（旧的收起）。
- Insert：先在输入行放 `3×`（`3` 后按 `×`），点某条 `12+8=20` 的 Insert → 输入行变 `3×12+8`，光标在末尾。
- Copy：点某条 Copy → toast「已复制」（中文态）；在别处 Ctrl/Cmd+V 得到该结果值。
- Retry：点某条 Retry → 磁带底部冒出同算式的新结果条，输入行不变，滚到底。
- headless：`node --check --input-type=module < js/i18n.js && node --check --input-type=module < js/app.js`。

- [ ] **Step 7: 提交**

```bash
git add js/i18n.js js/app.js styles.css tests/test.html
git commit -m "feat: per-entry Action row (Insert/Copy/Retry) with i18n"
```

---

## Task 7: 光标处 double-touch 粘贴

在 `#expr` 双触 → 读系统剪贴板，把数字串插到光标处。与既有"按住拖动移光标 + 放大镜"共存（在 `pointerup` 侧用时间窗判定双触，不影响拖动）。

**Files:**
- Modify: `js/app.js`（在既有 `endDrag`/`pointerup` 逻辑基础上加双触检测 + `pasteAtCursor`）

**Interfaces:**
- Consumes: 既有 `exprEl`、`editor.setCursor`（拖动已定位光标）、`editor.insertDigit`/`insertAtom`、`render`、`t('pasteFail')`（Task 6 已加）、`nearestBoundary`（既有）。
- Produces: `#expr` 上的双触 → `pasteAtCursor()`；仅解析**普通十进制数字串**（可含前导 `-`），逐字符插入。

- [ ] **Step 1: 新增 `pasteAtCursor` 与双触检测**

在 `js/app.js` 的 `endDrag` 定义（约第 374–380 行）之后、`exprEl.addEventListener('pointerup', endDrag);` 之前，新增：

```js
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
```

- [ ] **Step 2: 在 pointerup 接入双触检测**

把既有 `exprEl.addEventListener('pointerup', endDrag);`（第 381 行）替换为：

```js
exprEl.addEventListener('pointerup', (e) => { endDrag(e); maybeDoubleTap(e); });
```

（`pointercancel` 仍只调 `endDrag`，不变。）

> 共存说明：单次按住拖动 = 一次 pointerdown→move→up，`maybeDoubleTap` 只记一次 tap 不触发粘贴；快速两次轻点（几乎无 move）落在时间窗+邻近 → 触发粘贴。放大镜只在 `magOn`（拖动中）显示，轻点不驻留放大镜。

- [ ] **Step 3: 人工验证（需真机或支持 clipboard 的浏览器）**

`http://localhost:8000/dev.html`（HTTP localhost 下 `navigator.clipboard` 可用；首次读可能弹权限）。
先复制一个数字（如在地址栏或用 Task 6 的 Copy 复制 `20`）。
Expected:
- 在 `#expr` 光标目标位置双触/双击 → 数字 `20` 插到该处，与相邻数字按既有规则合并。
- 剪贴板为空/非数字 → toast「粘贴失败」，不崩。
- 单次按住拖动仍能移动光标、显示放大镜，不误触发粘贴。
- headless：`node --check --input-type=module < js/app.js`。

- [ ] **Step 4: 提交**

```bash
git add js/app.js
git commit -m "feat: double-touch paste number at cursor on #expr"
```

---

## Task 8: 发布 v7（版本闸 + 快照）

trunk 全部验证通过后，走 CLAUDE.md 的版本闸流程：bump SW 缓存、建 `v7/` 冻结快照、翻根 `index.html`。**仅在 Task 1–7 全部完成、`tests/test.html` 全绿、`dev.html` 人工清单通过后执行。**

**Files:**
- Modify: `sw.js`（`CACHE` + `ASSETS`）
- Create: `v7/`（快照目录）
- Modify: `index.html`（根 gate 全部 v6→v7）

**Interfaces:**
- Consumes: trunk 全套（`js/*.js` 含 `tape.js`、`styles.css`、`manifest.webmanifest`、`sw.js`）；`v6/index.html`（作为 `v7/index.html` 种子）；`v6/icons/`（拷入 v7）。
- Produces: 可回滚的 `v7/` 快照；根路径重定向到 `v7/`。

- [ ] **Step 1: bump `sw.js`**

在 `js/sw.js`（trunk 根的 `sw.js`）：
1. 第 1 行 `const CACHE = "calc-v6x";` 改为 `const CACHE = "calc-v7";`
2. 在 `ASSETS` 的 `'./js/...'` 列表里加入 `'./js/tape.js'`（放在 `'./js/i18n.js',` 之后一行）：

```js
  './js/i18n.js', './js/tape.js',
```

- [ ] **Step 2: 建 `v7/` 快照（trunk 为源，字节拷贝）**

```bash
mkdir -p v7/js
cp styles.css manifest.webmanifest sw.js v7/
cp js/*.js v7/js/
cp -R v6/icons v7/icons
cp v6/index.html v7/index.html
```

- [ ] **Step 3: 更新 `v7/index.html` 版本标签**

`v7/index.html` 由 `v6/index.html` 拷来，只需把可见版本号从 v6 改 v7。把第 29 行 `<div id="version">v6</div>` 改为 `<div id="version">v7</div>`。（该快照 `index.html` 已注册 SW、引用相对 `js/`，无其它需改。）

> 说明：v7 快照的 DOM 需与 trunk `dev.html` 的新结构一致（`#tape-scroll`/`#inputbar`、无 `#history-panel`）。由于 `v6/index.html` 仍是旧结构，**必须**把 `v7/index.html` 的 `#calc` 内部结构同步为 trunk 版。做法：用 `dev.html` 的 `<div id="calc">…</div>` 整段替换 `v7/index.html` 的对应整段（第 25–110 行区间），仅保留 v7 的 `<head>`（含 SW 注册脚本）与 `<div id="version">v7</div>` 文案。校验：`v7/index.html` 不含 `history-panel`、含 `tape-scroll`。

- [ ] **Step 4: 翻根 `index.html` 到 v7**

在根 `index.html` 把所有 v6 标记改 v7（共 6 处）：
1. 第 28 行注释 `====== Current version: v6 ======` → `v7`
2. 第 30 行 `<meta http-equiv="refresh" content="0; url=v6/">` → `url=v7/`
3. 第 31 行注释 `====== Current version: v6 ======` → `v7`
4. 第 47 行 `version <b>v6</b>` → `<b>v7</b>`
5. 第 48 行 `<a href="v6/">Enter here</a>` → `href="v7/"`
6. 第 51 行 `location.replace('v6/');` → `location.replace('v7/');`

- [ ] **Step 5: 校验快照与 trunk 一致**

```bash
for f in js/*.js styles.css manifest.webmanifest sw.js; do
  diff -q "$f" "v7/$f" || echo "MISMATCH $f"
done
echo "--- sanity ---"
grep -c "calc-v7" v7/sw.js sw.js
grep -c "tape-scroll" v7/index.html dev.html
grep -L "history-panel" v7/index.html   # 期望：文件名被列出(=不含该串) 或无输出
```
Expected: 无 `MISMATCH`；`calc-v7` 两处各 ≥1；`tape-scroll` 两处各 ≥1。

- [ ] **Step 6: 全量 headless 语法检查 + 测试页**

```bash
for f in js/*.js; do node --check --input-type=module < "$f" || echo "FAIL $f"; done
```
Expected: 无 `FAIL`。再开 `http://localhost:8000/tests/test.html` 确认全绿；开 `http://localhost:8000/`（应重定向到 `v7/`）确认生产快照可用。

- [ ] **Step 7: 提交并推送（触发 Pages 部署）**

```bash
git add sw.js index.html v7/
git commit -m "release: v7 — live history tape layout"
git push origin master
```

> 推送到 `master` 触发 `.github/workflows/static.yml` 自动部署。部署后线上 `/` 应重定向到 `/v7/`。

---

## Self-Review

**1. Spec coverage（逐条对照 spec 章节）：**
- §1.1 实时磁带（滚动、输入行钉底）→ Task 3（骨架）+ Task 4（渲染）✅
- §1.2 用一条冒一条（首屏空、按=累积）→ Task 4（`doEquals` 入库+`buildTape` session）✅
- §1.3 滚动看历史 + 滚到顶懒加载 → Task 5（`loadOlder` + 锚定）✅
- §1.4 ↺ 展开/收起盖键盘 → Task 5（`setExpanded` + rect 测量）✅
- §1.5 条目 Action 行（Insert/Copy/Retry）→ Task 6 ✅
- §1.6 光标 double-touch 粘贴 → Task 7 ✅
- §2 决策表全部：#1–3 布局/会话/懒加载→T3–5；#4 =提交清空→T4；#5 ↺+删遮罩→T4/T5；#6/#6b overscroll 两端→T5；#7 Action 行→T6；#8 Insert 插算式→T6（`insertAtoms`）；#9 Copy 结果值→T6；#10 Retry 直接重算不动输入→T6；#11 双触粘贴→T7；#12 不做实时预览→Non-Goal，无 Task ✅
- §4 `js/tape.js` DOM-free → Task 1 ✅
- §4 `baselineTs = store.history[0]?.ts ?? 0` → Task 4 Step 2 ✅
- §6.5 overscroll 阈值/去抖 → Task 5 Step 3（`OVER`/`fired`）✅
- §9.1 文件改动清单：`tape.js`(T1)、`app.js`(T4-7)、`i18n.js`(T6)、`dev.html`(T3)、`styles.css`(T3/5/6)、`sw.js`(T8)、根`index.html`(T8)、`v7/`(T8) ✅
- §9.2 发布流程 6 步 → Task 8 ✅

**2. Placeholder scan：** 无 TBD/TODO；每个代码步给出完整代码块；测试步给出完整用例。✅

**3. Type consistency：**
- `buildTape(history, baselineTs, showOlder)` 签名在 T1 定义、T4/T5 消费，一致 ✅
- `insertAtoms(atoms)` T2 定义、T6 消费 ✅
- `renderTape` / `scrollTapeToBottom` / `tapeScroll` / `showOlder` / `baselineTs` T4 定义，T5/T6 消费 ✅
- `openActionTs` 在 T6 使用，Step 5 明确其 `let` 声明须上移到磁带状态区（避免 TDZ）✅
- `toggleTapeExpand` T4 占位 → T5 真实实现（同名替换）✅
- `t('copied')`/`t('pasteFail')` T6 定义、T6/T7 消费 ✅
- SW `CACHE` 字符串 `"calc-v7"`、`ASSETS` 加 `./js/tape.js`，与 v7 快照 diff 校验一致 ✅

发现并已在计划内处理的点：Task 3 Step 6 与 Task 4 Step 1 存在临时耦合（移除 `#history-panel` 引用），已在 Task 3 注明"由同一实现者连续完成"。
