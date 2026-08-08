# Shift 层 + MATH 面板 + 键盘间距 — 设计文档

- 日期：2026-08-08
- 状态：已通过设计评审，待用户审阅 spec
- 前序：本设计在 [2026-08-07 科学计算器 PWA](./2026-08-07-scientific-calculator-pwa-design.md) 已上线基础上增量开发
- 范围级别：**务实功能子集** —— 只实现能落到现有 `lex→parse→eval→format` 引擎、数学上有明确意义的功能；那款商业 App 专有 / PRO 的标签继续保留「暂未开放」提示

## 1. 目标

按用户的三条诉求，在现有计算器上增量实现：

1. **Shift 层黄色功能**：把 Shift 键按出来后各键左上角的黄色第二功能，落地为真实可用的科学函数（功能子集，见 §3）。
2. **键盘底部间距**：`#keypad` 增加 `padding-bottom: 6px`，底排按钮与屏幕边缘之间留出呼吸位。
3. **MATH 面板**：点 MATH 弹出一个**分类列表面板**，只列出引擎真正支持、能算出结果的函数；点条目即插入到当前算式并关闭面板。

## 2. 需求决策汇总（已与用户确认）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 总体范围 | 务实功能子集；App 专有 / PRO 功能保留「暂未开放」占位 |
| 2 | MATH 交互形态 | **分类列表面板**（复用现有历史面板样式），点条目插入并关闭 |
| 3 | Shift 显示方式 | **常驻小黄标 + 按下时高亮**：每个有第二功能的键左上角常显小黄标；按 Shift 后键盘进入高亮态，点键即执行黄色功能 |
| 4 | 数字区 App 专有黄标 | 仅额外实现 **Cⁿᵣ / Pⁿᵣ**（组合数/排列数）；Y·Z·M、F1–F3、iGRP、iFX、分式、°'"、#↔□ 等继续保留「暂未开放」占位 |

## 3. Shift 层功能映射

实现状态：✅ 落地为真实功能（常驻小黄标）/ ⛔ 保留占位（无黄标，Shift 态点击弹「该功能暂未开放」toast）。

| 主键 | Shift 第二功能 | 插入内容 | 引擎处理 | 状态 |
|------|----------------|----------|----------|------|
| `π` | `e` | 常量 `e` | 已支持 | ✅ |
| `Ln` | `log`（以 10 为底） | `log(` | evaluator 新增 `log` | ✅ |
| `Sin` | `sin⁻¹` | `asin(` | evaluator 新增 `asin`（角度感知） | ✅ |
| `Cos` | `cos⁻¹` | `acos(` | evaluator 新增 `acos`（角度感知） | ✅ |
| `Tan` | `tan⁻¹` | `atan(` | evaluator 新增 `atan`（角度感知） | ✅ |
| `X²` | `X³` | `^3` 展开 | app 新增 `cube` 展开 | ✅ |
| `√` | `³√` | `cbrt(` | evaluator 新增 `cbrt`（支持负数） | ✅ |
| `X` | `X⁻¹` | `^(-1)` 展开 | app 新增 `recip` 展开 | ✅ |
| `+` | `nCr` | 运算符 `nCr` | evaluator 新增组合数 | ✅ |
| `−` | `nPr` | 运算符 `nPr` | evaluator 新增排列数 | ✅ |
| `0` | `%` | `%` | 已支持 | ✅ |
| `EE` | `eˣ` | `e^` 展开 | 已支持（`epow`） | ✅ |

**保留占位（无黄标）**：`Y·Z·M`、`F1·F2·F3`、`iGRP`、`iFX`、`′`、`▸M`、`°'"`、`{`、`}`、分式、`#↔□`、`#→▢`、`▢←#` 等——均为该 App 专有能力（内存组、自定义函数槽、度分秒、进制转换、二维结构编辑），与本引擎无关，Shift 态点击维持现有「该功能暂未开放」提示。

## 4. MATH 面板内容

面板按分类列出，每类内为可点条目；点击插入对应内容到光标处并关闭面板。仅收录引擎可求值项：

| 分类 | 条目 |
|------|------|
| 三角函数 | `sin` `cos` `tan` `sin⁻¹` `cos⁻¹` `tan⁻¹` |
| 对数指数 | `ln` `log` `eˣ` `10ˣ` |
| 幂与根 | `x²` `x³` `√` `³√` `x⁻¹` `xⁿ` |
| 组合数 | `nCr` `nPr` |
| 常数 / 其他 | `π` `e` `abs` `Ans` `%` |

MATH 面板专属新增（不在按键上，仅面板可点）：`abs(`（绝对值）、`10ˣ`（`10^` 展开）。其余条目复用已有或 §3 已引入的动作。

## 5. 架构与改动

沿用现有分层，无需重构。新增一个数据模块 `js/mathmenu.js`；其余为在既有文件内扩展。

### 5.1 文件改动清单

| 文件 | 改动 |
|------|------|
| `js/evaluator.js` | 新增函数 `log/asin/acos/atan/cbrt/abs`；新增 `fromRad` 反向角度换算；新增阶乘与 `nCr`/`nPr`（二元运算） |
| `js/lexer.js` | `FUNCS` 注册新函数原子；`nCr`/`nPr` 作为 `OP` 记号分类 |
| `js/parser.js` | 新增一级优先级 `parseCombi`（介于 `× ÷` 与一元之间，左结合）处理 `nCr`/`nPr` |
| `js/keymap.js` | `SHIFT_ACTIONS` 扩充为 §3 全表，并为每项加 `label` 字段（黄标文案）；新增所需 `ACTIONS` 条目 |
| `js/mathmenu.js` | **新建**：导出 `MATH_CATALOG`（分类 → 条目，每条目自带 `{label, action}`） |
| `js/app.js` | 抽出共享 `execAction(action)` 插入路径；新增 `cube/recip/tenpow` 展开；扩展 `DISPLAY` 映射；构建并绑定 MATH 面板；初始化时按 `SHIFT_ACTIONS.label` 注入 `.second` 小黄标；`updateShift()` 切换 `#keypad.shift-active` |
| `index.html` | 新增 MATH 面板容器；移除硬编码的两个 `.second`（改为注入）；引入无须改动（`app.js` 已是模块入口） |
| `styles.css` | `#keypad` 加 `padding-bottom: 6px`；新增 `.shift-active` 高亮样式；MATH 面板复用历史面板样式 + 分类标题样式 |
| `sw.js` | `CACHE` 版本 `calc-v4 → calc-v5`；`ASSETS` 加入 `./js/mathmenu.js` |

### 5.2 求值引擎细节

- **反三角角度感知**：新增 `fromRad(x, mode) = mode==='DEG' ? x*180/π : x`。`asin/acos/atan` 求出弧度后经 `fromRad` 换算，使 DEG 模式下 `sin⁻¹(0.5)=30`、RAD 模式下 `=π/6`。
- **定义域错误**：`log(x≤0)`、`asin/acos(|x|>1)` → 抛 `CalcError('Math Error')`；`cbrt` 与 `abs` 全定义域；`atan` 全定义域。
- **组合数/排列数**：`nCr`/`nPr` 作二元中缀运算，左右操作数须为**非负整数**且 `n ≥ r`，否则 `Math Error`。`nPr(n,r)=n!/(n−r)!`，`nCr(n,r)=n!/(r!(n−r)!)`。阶乘对超大 n 溢出为 `Infinity`，由现有「结果非有限即 Math Error」的检查兜底。
- **优先级**：`nCr`/`nPr` 绑定紧于 `× ÷`、松于一元负号（`parseCombi` 位于 `parseMulDiv` 与 `parseUnary` 之间，左结合），故 `5 nCr 2 × 3 = 30`。

### 5.3 共享插入路径（app.js 重构）

现状：`dispatch(id)` 内联处理所有 `kind`。改动：把「编辑区插入类」动作（`digit/atom/func/ans`）抽成 `execAction(action)`，供两处复用：

1. 按键 / 物理键盘：`dispatch(id)` 解析 id → action → `execAction`（控制类动作 `history/sto/shift/equals/clear/nav/undo/redo/placeholder` 仍在 dispatch 内处理）。
2. MATH 面板点条目：直接 `execAction(item.action)` → 关闭面板 → `render()`。

`func` 展开集中在 `execAction`：`square→^2`、`cube→^3`、`recip→^(-1)`、`tenpow→10^`、`epow→e^`、`eex→×10^`。这是本设计唯一的结构性改进，直接服务于「按键与 MATH 面板共用一条插入逻辑」，避免两份重复。

### 5.4 显示映射（DISPLAY）

内部原子 → 显示文本新增：`asin(→sin⁻¹(`、`acos(→cos⁻¹(`、`atan(→tan⁻¹(`、`cbrt(→³√(`、`nCr→C`、`nPr→P`（同物理 Casio 的 `5C2`/`5P2` 记法）。`log(`、`abs(`、`e`、`10^` 原样显示。

### 5.5 Shift 显示与高亮

- **单一数据源**：黄标文案存于 `SHIFT_ACTIONS[id].label`；`app.js` 初始化时遍历，为对应 `data-id` 的键注入 `<span class="second">label</span>` 并加 `has-shift` 类。移除 index.html 里原先硬编码的 `%` / `eˣ` 两个 `.second`，避免 keymap 与 UI 漂移。
- **高亮态**：`updateShift()` 在 `#keypad` 上切换 `shift-active` 类。CSS 中 `.shift-active .key.has-shift` 给出可感知的高亮（黄标增亮 / 键面微黄），Shift 键自身沿用现有 `.active` 黄框。
- **不切换主标签**：主键文案始终不变（按决策 3），仅黄标常显 + 按下高亮，实现最简且与现有风格一致。

## 6. 数据流

按键 / 物理键盘 / MATH 面板点条目 → 解析为 `action {kind, payload}` → `execAction` 修改 `Editor` → `render()` 重绘（MATH 额外关闭面板）。求值链 `=`：`lexer → parser → evaluator → formatter` **完全不变**，仅新增可识别的原子与节点运算。

## 7. 错误处理

所有新增定义域 / 取值违规（`log`/`asin`/`acos` 出域、`nCr`/`nPr` 非非负整数或 `n<r`）统一抛 `CalcError('Math Error')`，由现有 `engine.js` 包装层显示在结果位、保留算式。**不新增任何错误 UI**。

## 8. 测试策略

沿用现有 `tests/test.html` + `tests/assert.js` 浏览器测试页；引擎模块无 DOM 依赖，同样可在 node v25 下 headless 运行，供子代理验证。

**引擎单测（纯函数，新增用例）：**
- `log(1000)=3`；`log(0)`、`log(-1)` → 抛 `Math Error`
- `asin(0.5)=30`（DEG）、`asin(0.5)≈π/6`（RAD）；`acos(1)=0`；`atan(1)=45`（DEG）
- `asin(2)`、`acos(-2)` → 抛 `Math Error`
- `cbrt(-8)=-2`、`cbrt(27)=3`；`abs(-5)=5`
- `nCr(5,2)=10`、`nPr(5,2)=20`；`5 nCr 2 × 3 = 30`（优先级）
- `nCr(2,5)`（n<r）、`nCr(5,-1)`、`nCr(5.5,2)`（非整数） → 抛 `Math Error`

**接线单测：**
- `SHIFT_ACTIONS` 新条目的 `kind`/`payload`/`label` 断言
- `MATH_CATALOG` 完整性：每条目的 `action` 通过 `Editor` 插入后原子符合预期，且引擎能识别（无未知原子）

**DOM / CSS（人工浏览器清单）：**
- Shift 态高亮切换、黄标注入正确
- MATH 面板打开 / 点条目插入 / 关闭
- `#keypad` 底部 6px 间距

## 9. 明确不在本次范围（Non-Goals）

- 数字区 App 专有黄标（Y·Z·M、F1–F3、iGRP、iFX、分式、°'"、进制转换等）的真实功能
- MATH 面板的 A…Z 字母目录观感与右侧字母索引条（改用分类列表）
- MATH 目录中所有 PRO+ 条目（ANOVA、BinomCDF、矩阵、复数、Augment 等）
- 二维结构化编辑（自然分数 / 根号内嵌排版）
