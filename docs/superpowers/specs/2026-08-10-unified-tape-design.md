# Unified Tape Design — 输入融入磁带

- Date: 2026-08-10
- Status: Approved (brainstorm → 待实现)
- Supersedes (extends): `2026-08-10-history-tape-layout-design.md`

## 1. 目标

把输入框从独立容器变成磁带的"最新一条未完成条目"。程序上只控制一个上下拉的磁带面板,输入与历史用同一条分隔符区分,视觉与逻辑统一。

## 2. 已确认的决策(brainstorm 锁定)

| # | 决策 | 备注 |
|---|------|------|
| ① | **AC 两段式**(输入是否为空为唯一判据):非空→清空输入;已空→统一回正常态(收叠磁带/关展开/显输入行/复位历史) | 与展开态无关;展开态下输入本就为空,AC 直接触发回正常态 |
| ② | **输入同化为磁带条目**:字号 18/22px、同样式;仅带闪烁光标、无 `= 结果`(未完成条目) | 不保持大字 |
| ③ | **Insert 插入到当前光标处**(代码现状) | 不改 |
| ④ | **Model A**:输入是磁带末项,随磁带滚动;上滑浏览旧历史时输入滚出视野;按键插入/点输入行→自动 snap 回底 | 单一滚动容器 |

## 3. 第 4 节关键澄清(实时预览的事实校正)

现状 `#result` 这条结果线**只**承载两件事,不存在实时预览:
- **回放值**:按 ∧/∨ 时显示 `= <历史值>`(`recallUp`/`recallDown`)
- **错误**:按 `=` 失败时显示 `Syntax/Math Error`(`doEquals`)

`render()` 从不碰 `#result`;插入按键从不调用 `evaluate()`。故"删 `#result` 后回放值与错误去哪"才是真问题。

**锁定决策 A(忠实现状):**
- `.h-current` 增一条可选 `.h-res` 结果线,只用于回放 `= <值>` 和错误(红)
- 正常打字时无结果线(与现在完全一致)
- **不引入实时预览**——不每次按键 evaluate
- 按 `=` 成功后,结果作为新历史条目落到 `.h-current` 正上方,该新条目显示 `= 值`,天然可见;`.h-current` 清成空条目。无需独立结果线承载刚算出的值。

## 4. 架构:单一滚动容器

### 4.1 HTML 结构变化

现状:
```html
<section id="display">
  <div id="tape-scroll"><ul id="tape-list"></ul></div>
  <div id="inputbar">
    <div id="expr"></div>
    <div id="result"></div>
  </div>
</section>
```

改后:
```html
<section id="display">
  <div id="tape-scroll"><ul id="tape-list"></ul></div>
</section>
<!-- #inputbar 删除 -->
```

`#tape-list` 最后一项永远是当前输入 `<li class="h-current">`。`#tape-scroll` 是唯一滚动容器,沿用现 `margin-top:auto` + `min-height:0` + flex column 的靠底对齐方案。

### 4.2 渲染分工

- `renderTape()` —— 只渲染历史条目 `<li>`(算式 `.h-expr` + 结果 `.h-res`),不碰输入。重建时在末尾留出 `.h-current` 的占位。
- `renderCurrentInput()` —— 渲染/更新末尾 `<li class="h-current">`,内含:
  - `.h-expr`:搬现 `render()` 的光标/`.tok`/`.ch` spans/`isNumDisplay` 逻辑,目标 = `.h-current .h-expr`
  - 可选 `.h-res`:回放 `= <值>` 或错误(红);正常打字时缺省
- `render()` —— 保留作薄壳 `function render(){ renderCurrentInput(); }`,避免改 40+ 处调用点,行为等价。

### 4.3 光标 DOM 命中与放大镜(选择器迁移)

现状 `nearestBoundary` 与 `showMagnifier` 以独立 `#expr` 为基准。改后:
- `exprEl` 指向 `#tape-list .h-current`(而非 `#expr`)
- `nearestBoundary` 查 `.h-current .tok`(限定在当前输入条目内)
- `showMagnifier` 的 `rect` 基准改 `.h-current` 的 `.h-expr`
- `displayString()` 逻辑不变(读 `editor.atoms`)

### 4.4 滚动 snap(Model A 关键)

- 任意按键插入 / 点输入行 → `scrollTapeToBottom()` 把末项滚回视野
- 浏览旧历史(上滑)时输入滚出视野是预期行为
- 见 §7 的 ∨ 键 snap 回底

## 5. 输入条目的统一渲染

### 5.1 `.h-current` 结构对比

| | 历史条目 `<li>` | 当前输入 `<li class="h-current">` |
|---|---|---|
| 算式 `.h-expr` | `item.atoms.map(showAtom).join('')` | 现 `render()` 逻辑(含 `.tok`/`.ch`/`.cursor`) |
| 结果 `.h-res` | `= item.display` | 仅回放 `= <值>` 或错误(红);正常缺省 |
| 光标 | 无 | 闪烁 `.cursor` |
| 字号 | 18/22px | 18/22px(同化) |
| 点击行为 | 展开 Action 行 | `pointerdown` 光标拖拽 |

### 5.2 视觉细节

- `.h-current .h-expr` 复用 `#tape-list .h-expr`:`text-align:left`、`word-break:break-all`、`color:var(--muted)`
- 光标拖拽、放大镜、双触粘贴逻辑不变,选择器从 `#expr` 改 `.h-current`
- 空输入时 `.h-current` 仍渲染空 `.h-expr` + 闪烁光标,`min-height:44px` 占位(防磁带塌缩、滚动跳变)

### 5.3 分隔符统一

每个 `<li>`(含 `.h-current`)`border-top:1px solid #1a1a1a`。`#tape-list` 不再整体带顶边。历史条目之间、历史与输入之间,分隔符完全一致。

## 6. AC 两段式与状态机

### 6.1 AC 行为

```js
case 'clear':
  if (editor.atoms.length > 0) {        // 输入非空 → 清空输入
    editor.clear(); state.resetRecall();
    render();
  } else {                               // 输入已空 → 统一回正常态
    resetToNormal();
  }
  break;
```

### 6.2 `resetToNormal()` —— 唯一复位出口

```js
function resetToNormal() {
  showOlder = false;
  if (expanded) setExpanded(false);
  closeAction();
  state.resetRecall();
  renderTape(); renderCurrentInput(); scrollTapeToBottom();
}
```

### 6.3 状态变量(已有)

| 变量 | 正常态 | 展开态 | AC 已空触发 |
|---|---|---|---|
| `expanded` | false | true | →false |
| `showOlder` | false(会话)/ true(展开时) | true | →false |
| `openActionTs` | — | — | →null |

### 6.4 边界

- AC 在展开态(输入空)→ `else` → `resetToNormal()` → `setExpanded(false)` + `showOlder=false`。展开态 AC = 全复位。
- AC 在正常态、输入已空 → `resetToNormal()` 中 `if(expanded)` 不触发、`showOlder` 本就 false,等效只 `closeAction`+`scrollTapeToBottom`,干净态保持。
- 滚动到底再下拉:原 `resetTapeClean()` 改为复用 `resetToNormal()`(语义一致),删 `resetTapeClean`。

### 6.5 `doEquals` 提交后

- 现状 `editor.clear()` + `renderTape()` + `scrollTapeToBottom()`。
- 改后等价,`render()`→`renderCurrentInput()`;提交后 `showOlder` 不变(提交不接入旧历史)。
- `#result` 已删,故 `resultEl.textContent=''` 等句删除;回放值/错误的去向见 §4.2 + §5.1(并入 `.h-current .h-res`)。新结果作为历史条目落到 `.h-current` 正上方,天然显示 `= 值`。

## 7. 展开态 / overscroll / Action 行 / ∨ 键

### 7.1 展开态覆盖层

删 `#inputbar` 后,`#calc.tape-expanded #inputbar { display:none }` 改为隐藏磁带末项:
```css
#calc.tape-expanded #tape-scroll { position: absolute; left:0; right:0; top:0; z-index:12; background:rgba(0,0,0,.96); }
#calc.tape-expanded #tape-list .h-current { display: none; }
```
展开态下输入本就为空,隐藏 `.h-current` 等价现状隐藏 `#inputbar`。`setExpanded(true)` 仍 `showOlder=true` + `bottom = historyBtn.getBoundingClientRect().top`(露 ↺ 行)。

### 7.2 overscroll

```js
if (atTop && dy > OVER) { fired = true; if (!loadOlder()) setExpanded(true); }
else if (atBottom && dy < -OVER) { fired = true; resetToNormal(); }   // 原 resetTapeClean
```
`loadOlder` 滚动锚定(`scrollTop += scrollHeight - oldH`)保留。

### 7.3 ∨ 键 = snap 回底(新交互,无新按钮)

Model A 下浏览旧历史时输入滚出视野,"只想回到底看输入、不想插入"的快捷:
- 非 replay 时按 ∨ → 若磁带不在底 → `scrollTapeToBottom()`;已在底 → no-op
- replay 时 ∨ 仍走 `recallDown`

### 7.4 Action 行(Insert/Copy/Retry)

逻辑不变(`openAction`/`closeAction`/`copyText`/`retryEntry`)。Action 行插在 `.h-current` 之外的历史 `<li>` 后(历史条目独有,不附输入)。
- 点 `.h-current` 不触发 Action(走光标拖拽)
- `tapeList` 点击监听:点 `.h-current` 时 `entryByTs` 返回 undefined → 早返回,不弹 Action

## 8. 受影响清单(实现对照)

### js/app.js
- 删 `#inputbar`、`#expr`、`#result` 的独立元素引用;`exprEl` → 指向 `.h-current`
- `render()` → 薄壳调 `renderCurrentInput()`
- 新增 `renderCurrentInput()`:搬现 `render()` 光标/tok/ch 逻辑 + 可选 `.h-res`(回放/错误)
- `renderTape()` 末尾留 `.h-current` 占位;不再碰输入
- `recallUp`/`recallDown`:`resultEl.textContent` → 改写 `.h-current .h-res`
- `doEquals`:删 `resultEl` 句;`render()`→`renderCurrentInput()`
- `dispatch` `case 'clear'`:两段式(§6.1)
- `resetToNormal()` 新增;`resetTapeClean` 删除并替换调用点
- `recallDown`:非 replay 时 snap 回底(§7.3)
- `nearestBoundary`/`showMagnifier`:选择器从 `#expr` 改 `.h-current`
- overscroll `resetTapeClean()` → `resetToNormal()`
- `setExpanded`:JS 逻辑不变(仍 `showOlder=true` + `bottom = historyBtn.top`);隐藏输入的方式由 CSS 接管(§7.1 隐藏 `.h-current`,不再靠 `#inputbar` 隐藏)

### dev.html
- 删 `<div id="inputbar">` 包裹与 `#expr`/`#result`,保留 `<div id="tape-scroll"><ul id="tape-list"></ul></div>`
- (实现后照此更新 `vN/` 快照)

### styles.css
- 删 `#inputbar`、`#expr`、`#result` 规则
- 新增 `.h-current` 规则(同磁带条目样式 + 光标占位 + `min-height:44px`)
- `.h-current .h-expr`/`.h-res` 复用磁带条目样式(18/22px、左/右对齐)
- 每个 `<li>` `border-top:1px solid #1a1a1a`;`#tape-list` 去整体顶边
- `#calc.tape-expanded #tape-list .h-current { display:none }`(替代 `#inputbar` 隐藏)
- `.h-current .h-res.error { color: var(--red); }`(错误红)

### js/tape.js
- 不变(`buildTape` 仍只管历史条目,输入不入 history)

### js/history.js / js/state.js / js/i18n.js / js/keymap.js
- 不变

## 9. 测试

`tests/test.html` 需新增/调整:
- `buildTape` 用例不变(输入不入 history)
- 新增:`renderCurrentInput` 在 `.h-current` 内正确渲染光标/`.tok`/`.ch`(若可 DOM-free 测)
- 新增:AC 两段式——非空清空、已空回正常态(需 mock editor + state)
- 新增:∨ 键非 replay snap 回底(需 mock scroll)
- 现有 i18n `copied`/`pasteFail` 用例不变

## 10. 不在本次范围

- 实时预览(每次按键 evaluate)——明确不做(§3 决策 A)
- 历史条目样式改版——沿用现磁带样式
- MATH 面板、STO、回放语义——不变
