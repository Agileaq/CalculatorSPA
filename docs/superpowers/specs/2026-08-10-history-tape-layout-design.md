# 实时历史磁带 + 空间利用 — 设计文档

- 日期：2026-08-10
- 状态：已通过设计评审，待用户审阅 spec
- 前序：在 [2026-08-07 科学计算器 PWA](./2026-08-07-scientific-calculator-pwa-design.md)、[2026-08-08 Shift/MATH](./2026-08-08-shift-math-functions-design.md) 已上线基础上增量开发
- 范围级别：**布局与交互重构**（无引擎改动）—— 把算式区从「顶部大数字 + 底部大片黑」改为商业 App 式「实时历史磁带 + 底部输入行」，并新增条目操作行与光标处粘贴

## 1. 目标

用户诉求：`998866+2` 这类短算式下，屏幕下半部一大片黑色浪费空间。参照商业 App，把该空间变成一条**实时历史磁带**：

1. **实时磁带**：按钮区上方是一个可上下滚动的历史列表；当前输入行钉在底部（紧贴键盘）。
2. **用一条冒一条**：首次进入磁带为空（首屏干净，不预先堆历史）；每按一次 `=`，算式+结果作为新条目冒到输入行上方，向上堆积。
3. **滚动看历史**：下滑露出更早历史（滚到顶懒加载启动前保存的旧历史）；上滑回到底部干净态。
4. **↺ 展开/收起**：点 ↺ 把磁带向下展开盖住键盘（停在 ↺ 所在行，保证还能再点），一屏看更多；再点 ↺ 还原键盘。
5. **条目操作**：点磁带里某条历史 → 该条下方滑出一行 `Action`，含 `Insert` / `Copy` / `Retry` 三个按钮。
6. **光标处粘贴**：在输入行光标处 double-touch 可粘贴系统剪贴板内容（与 Copy 配套）。

## 2. 需求决策汇总（已与用户确认）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 空间默认形态 | **实时历史磁带**（商业做法）；输入行由顶部移到底部 |
| 2 | 首屏历史 | **不预先堆**；磁带初始只含本次会话新算的，用一条冒一条 |
| 3 | 旧历史接入 | **滚到顶懒加载**：启动前保存的旧历史，下滑到顶时才接到上方 |
| 4 | 按 `=` 行为 | **提交并清空**：算式+结果落到磁带底部，输入行清空，结果存入 `Ans` |
| 5 | ↺ 按钮 | **展开/收起磁带**（盖住键盘，停在 ↺ 行）；删除原全屏历史遮罩层 |
| 6 | 展开触发 | **overscroll 手势 + ↺ 按钮**：顶端到顶后继续拉（overscroll）→ 展开盖键盘；↺ 随时切换展开 |
| 6b | 复位手势 | **底端到底后继续拉（overscroll）→ 复位到「无历史干净态」**（收起展开 + 隐藏旧历史）。与 §6 顶端展开构成对称的两端 overscroll |
| 7 | 点条目 | 该条下方展开 `Action` 行（Insert / Copy / Retry） |
| 8 | Insert 语义 | 把该条**算式原子**插入到当前输入行光标处（保留正在输入的内容） |
| 9 | Copy 语义 | 把该条**结果值**复制到系统剪贴板 |
| 10 | Retry 语义 | 用该条历史**直接重算一次**，结果作为新条目落到磁带底部（不改动当前输入行） |
| 11 | double-touch | 光标处双触 → 读剪贴板并插入到光标处 |
| 12 | 实时预览 | **不做**（保持按 `=` 才求值），留待日后 |

## 3. 布局改造

现状：`#display` 为 `flex:1` 大盒，`#expr`（算式）钉顶部、`#result` 在其下，底部留白。

改为：`#display` 内分两块（上滚动、下固定）：

```
┌─────────────────────┐
│ DEG  EN  v7          │  #statusbar（不变）
├─────────────────────┤
│                      │ ┐
│  (空白, 往上冒)       │ │ #tape-scroll —— flex:1, overflow-y:auto
│  3×3         = 9     │ │  内容靠底对齐(justify-content:flex-end)
│  998866+2  = 998868  │ ┘  少量条目贴着输入行、向上堆
│ ───────────────────  │
│  25555+1▏            │ ┐ #inputbar —— 钉在底部, 紧贴键盘
│              = 25556 │ ┘  含 #expr(可编辑) + #result
├─────────────────────┤
│  Shift  ↷  ∧  ↶  ⌫   │  #keypad（不变）
│  ...                 │
└─────────────────────┘
```

- `#expr` / `#result` **保持原 id 与所有既有能力**（光标、按住拖动移光标、放大镜 loupe），仅从顶部容器移入 `#inputbar`，钉在磁带下方。这样触摸/放大镜/拖拽代码零改动。
- `#tape-scroll` 为 `flex:1` 可滚动区；内容用 `justify-content:flex-end`（或列表 `margin-top:auto`）实现「少量条目贴底、向上生长」的磁带观感。
- 磁带条目复用现 `openHistory()` 里 `.h-expr` / `.h-res` 的渲染（算式经 `showAtom` 映射 + `= display`），保证与原历史面板视觉一致。

## 4. 数据模型：`js/tape.js`（DOM-free，可 headless 测试）

新增一个纯函数模块，把「哪些历史该显示、按什么顺序」从 `app.js` 里剥离，便于像引擎模块一样跑 node 测试。

- **会话基线**：`app.js` 启动时捕获 `baselineTs = store.history[0]?.ts ?? 0`（`history` 为 newest-first，`history[0]` 即启动时最大 `ts`，见 `history.js` 每条自带单调递增 `ts`）。用 `ts` 而非长度切分，不受 100 上限淘汰影响。
- **导出** `buildTape(history, baselineTs, showOlder) -> Entry[]`（返回**从上到下**的显示顺序，即 oldest-first）：
  - `session = history.filter(h => h.ts > baselineTs)`（本次会话新算的）
  - `older = history.filter(h => h.ts <= baselineTs)`（启动前保存的）
  - `toDisplay = arr => arr.slice().reverse()`（newest-first → oldest-first）
  - `return showOlder ? [...toDisplay(older), ...toDisplay(session)] : toDisplay(session)`
- 语义：`showOlder=false`（默认/首屏）只显示会话新增，实现「用一条冒一条」；滚到顶置 `showOlder=true` 接入旧历史。

## 5. 按 `=` 的行为（`doEquals` 改动）

现状：按 `=` 求值后算式**留在**编辑区。改为**提交并清空**：

1. 求值（引擎链不变）。
2. **成功**：`state.ans = value`；`store.addHistory(atoms, display)`（新条目 `ts > baseline` → 归入 session → 出现在磁带底部）；`editor.clear()` 清空输入行；`#result` 清空；重渲染磁带并滚到底（`tapeScroll.scrollTop = scrollHeight`）。
3. **失败**：`#result` 显示 `Syntax/Math Error` 并置红，**保留算式、不提交、不清空**（沿用现有「温柔错误」模型）。

`∧`/`∨` REPLAY 键保持不变（仍从 `store.history` 载回输入行）；清空后按 `∧` 从最新条目开始，与现逻辑一致。

## 6. 磁带交互

术语：磁带是原生可滚动区，`scrollTop=0` 为顶端（最早），`scrollTop=max` 为底端（输入行）。**overscroll = 已到某端点后仍继续朝该端点方向拉**。用 overscroll（而非"上滑/下滑"）描述以消除方向歧义。

### 6.1 常规滚动看历史
- 在未到端点时，原生滚动照常浏览磁带内已有条目，不触发任何手势动作。

### 6.2 顶端：懒加载旧历史 → 再 overscroll 展开
两级手势，都在顶端触发，按顺序递进：
1. **懒加载**：`scrollTop <= 0` 且 `showOlder===false` 且存在 older 条目 → 置 `showOlder=true`、重渲染。
   - **滚动锚定**：重渲染前记 `oldHeight = scrollHeight`，渲染后 `scrollTop += (scrollHeight - oldHeight)`，避免接入旧历史时视图跳动。
2. **overscroll 展开**：已在顶端（`scrollTop <= 0`，且无更多 older 可加载 / 已 `showOlder=true`）时，继续朝顶端方向拉（touch 下 `deltaY` 使内容进一步下移，或 `wheel` 负向）→ 触发展开（等价点 ↺，见 §6.4）。用"已在顶部时的继续上拉"判定，避免与常规滚动打架。

### 6.3 底端：overscroll 复位到干净态
- **干净态定义**：`showOlder=false`（隐藏旧历史，磁带只剩本次会话条目）+ 收起展开（去掉 `.tape-expanded`）+ 滚到底露出输入行。等同首屏「用一条冒一条」的初始观感（会话已算的仍在，旧历史收回）。
- **触发**：已在底端（`scrollTop >= max`）时，继续朝底端方向拉（overscroll）→ 复位到干净态。
- 与顶端展开对称：顶端 overscroll 展开看更多，底端 overscroll 收回归位。

### 6.4 ↺ 展开/收起（盖住键盘）
- ↺ 按钮随时切换展开态（与顶端 overscroll 展开等价，互为入口）。
- 展开：给 `#calc` 加 `.tape-expanded`；`#tape-scroll` 变为绝对定位覆盖层，**顶到状态栏下、底到 ↺ 按钮那一行的下沿**。底沿由 JS 测量：`bottom = innerHeight - historyBtn.getBoundingClientRect().bottom`（与放大镜同样的 rect 测量手法，稳健、不硬编码行高）。功能行 1（Shift/↷/∧/↶/⌫）与功能行 2（AC/‹/MATH/›/↺）保持可见可点；磁带覆盖其下所有键行。
- 收起：再点 ↺，或底端 overscroll 复位（§6.3）去掉 `.tape-expanded`。

### 6.5 overscroll 判定实现
- 触摸：在 `#tape-scroll` 上跟踪 `touchstart` 的起点 Y 与 `touchmove` 的 `deltaY`；当当前已在顶端/底端且 `deltaY` 继续朝越界方向累计超过一个小阈值（如 40px）→ 触发对应手势，并对该手势做去抖（一次拉只触发一次）。
- 指针/滚轮（桌面 `dev.html` 调试用）：`wheel` 事件在到端点后按 `deltaY` 方向判定，同一阈值/去抖逻辑。
- 触发后重置累计，避免连触。

## 7. 条目 Action 行（Insert / Copy / Retry）

- 点磁带某条 → 该条**下方**滑出一行 `Action`（图标 + 文案，参照用户所给样式）。同一时刻只展开一条；再点该条或点别处收起。
- **Insert**（123↵）：把该条**算式原子序列**插入到当前输入行光标处，保留正在输入的内容。新增 `insertAtoms(atoms)`（对每个原子调 `editor.insertAtom`）。例：输入 `3×▏`，Insert `12+8=20` → `3×12+8▏`。
- **Copy**（双框）：`navigator.clipboard.writeText(entry.display)` → toast「已复制」。GitHub Pages 为 HTTPS，Clipboard API 可用。失败（无权限/不支持）→ toast 提示。
- **Retry**（圈箭头）：用该条 `atoms` **直接走引擎求值一次** → `state.ans = value` + `store.addHistory` → 作为新条目落到磁带底部并滚到底。**不改动当前输入行**（区别于 Insert），符合「直接进行一次计算」。

## 8. 光标处 double-touch 粘贴

- 在 `#expr` 上检测双触（两次 `pointerup` 间隔 ≤ ~300ms 且位置相近）。触发 → `navigator.clipboard.readText()` → 插入到光标处。
- 与现有「按住拖动移光标 + 放大镜」共存：单次按住拖动仍走原逻辑；双触在 `pointerup` 侧用时间窗判定，不影响拖动。
- **粘贴内容范围（务实）**：匹配 Copy 的产物 —— **普通十进制数字串**（可含前导负号）。逐字符经 `insertDigit`/`insertAtom` 插入以复用数字合并逻辑。非数字/科学计数法/整条表达式的粘贴为本次 Non-Goal（见 §13），无法识别时忽略非法字符或 toast 提示。

## 9. 架构与文件改动

沿用现有分层，无引擎改动。新增一个数据模块 `js/tape.js`，其余为既有文件内扩展。

### 9.1 文件改动清单

| 文件 | 改动 |
|------|------|
| `js/tape.js` | **新建**：导出纯函数 `buildTape(history, baselineTs, showOlder)`（§4） |
| `js/app.js` | 渲染磁带（`buildTape` + 条目 DOM）；启动捕获 `baselineTs`；`doEquals` 改为提交并清空（§5）；磁带滚动懒加载 + 锚定（§6.2）；↺ 改为 `toggleTapeExpand`（测量 ↺ rect 设覆盖层，§6.3）；条目点击展开 Action 行 + Insert/Copy/Retry（§7）；`#expr` 双触粘贴（§8）；新增 `insertAtoms`；移除 `openHistory` |
| `js/i18n.js` | 新增字符串：`copied`、`actionInsert`/`actionCopy`/`actionRetry`（若用文案）、`pasteFail`/`clipboardEmpty`（六语言） |
| `js/history.js` | 无需改动（`ts` 已具备；`baselineTs` 由 app 侧从 `history[0].ts` 捕获） |
| `dev.html` | 重构 `#display`：拆成 `#tape-scroll` + `#inputbar`（后者含现 `#expr`/`#result`）；**移除** `#history-panel` 及 `#history-close`；`#math-panel`/`#toast` 保留；版本标签 `v6 · dev → v7 · dev` |
| `styles.css` | `#display` 改为容纳滚动区 + 固定输入行；`#tape-scroll`（flex:1, overflow-y:auto, 靠底对齐）；`#inputbar` 固定底部；`.tape-expanded #tape-scroll` 覆盖层样式；Action 行样式；复用/清理 `#history-panel` 相关样式 |
| `sw.js` | `CACHE` 版本 `calc-v6 → calc-v7`；`ASSETS` 加入 `./js/tape.js` |
| 根 `index.html` | 版本闸更新（见 §9.2 发布流程）：两处 `当前版本：v7` 标记、`url=v7/`、版本徽章、`点此进入` href、`location.replace('v7/')` |
| `v7/`（新建目录） | 冻结快照：拷贝 trunk `styles.css`/`manifest.webmanifest`/`sw.js`/全部 `js/*.js`（含 `tape.js`）+ 上版 `icons/`；`v7/index.html` 由上版 `vN/index.html` 播种后更新版本标签 |

### 9.2 发布流程（沿用 CLAUDE.md 版本闸）
1. trunk 实现（`js/`、`styles.css`、`dev.html`），经 `dev.html` + `tests/test.html` 验证。
2. `sw.js` `CACHE` → `calc-v7`，`ASSETS` 加 `./js/tape.js`。
3. 建 `v7/` 快照（trunk 为准，字节级拷贝 JS）。
4. 翻根 `index.html` 版本闸全部标记到 v7。
5. `dev.html` 版本标签 → `v7 · dev`。
6. commit + push，Pages 自动部署；核对 `v7/` 内 JS 与 trunk 一致。

## 10. 数据流

- **输入**：按键/物理键盘/MATH → `execAction` → `Editor` → `render()`（输入行）。**不变**。
- **求值**：`=` → 引擎链 `lex→parse→eval→format` **不变** → 成功则提交入 `store` + 清空输入行 + 重渲染磁带。
- **磁带**：`store.history` + `baselineTs` + `showOlder` → `buildTape` → 条目 DOM。
- **条目操作**：Insert → `insertAtoms` → 输入行；Copy → clipboard；Retry → 引擎求值 → `store` → 磁带。

## 11. 错误处理

- 求值错误：沿用「温柔错误」—— 结果位显示 `Syntax/Math Error`、保留算式、不提交、不锁定。**不新增错误 UI**。
- Clipboard 读/写失败：toast 轻提示，不阻断。
- 磁带为空（首屏/无历史）：正常显示空滚动区，无报错。

## 12. 测试策略

沿用 `tests/test.html` + `tests/assert.js`；`tape.js` 纯函数可 headless。

**新增单测（纯函数）：**
- `buildTape`：仅会话（`showOlder=false`）时不含 older；`showOlder=true` 时 older 在前、session 在后，均 oldest-first；空 history → `[]`；全为 older（无 session）时 `showOlder=false` 返回 `[]`。
- `baselineTs` 切分：给定含混合 `ts` 的 history，session/older 划分正确。
- `insertAtoms`：`3×▏` 插 `['12','+','8']` → 原子为 `['3','×','12','+','8']`、光标在末尾。
- `doEquals` 提交并清空：成功后 `editor.atoms` 为空、`store.history[0]` 为该条、`ans` 更新；失败后算式保留、`store` 未增。

**DOM / UI（人工浏览器清单，`dev.html`）：**
- 首屏磁带为空、输入行在底；连按 `=` 逐条冒出并滚到底。
- 顶端：滚到顶懒加载旧历史（无跳动）；已在顶端再 overscroll → 展开盖键盘。
- 底端：已在底端 overscroll → 复位干净态（收起展开 + 隐藏旧历史 + 露输入行）。
- ↺ 展开盖键盘、停在 ↺ 行、可再点收起（与顶端 overscroll 展开互为入口）。
- overscroll 阈值/去抖：常规滚动不误触；一次拉只触发一次。
- 点条目出 Action 行；Insert 插算式到光标处；Copy 后可在别处粘贴；Retry 落新条目不动输入行。
- `#expr` 光标处 double-touch 粘贴数字；与按住拖动/放大镜不冲突。

## 13. 明确不在本次范围（Non-Goals）

- **实时结果预览**（边打边显 `= 结果`）——保持按 `=` 才求值。
- **粘贴整条表达式 / 科学计数法**——本次仅支持普通十进制数字串粘贴。
- 磁带条目的滑动删除、清空全部历史按钮、条目多选等管理操作。
- 引擎、`∧`/`∨` REPLAY、STO/MATH/i18n/角度等既有能力的行为改动（除 `=` 提交清空外均不动）。
- 磁带展开的动画细节打磨（先求功能正确，过渡动画可后续优化）。
```
