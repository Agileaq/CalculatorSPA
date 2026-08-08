# Shift 层 + MATH 面板 + 键盘间距 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有科学计算器 PWA 上增量实现 Shift 层黄色功能（真实科学函数子集）、MATH 分类面板、以及键盘底部间距。

**Architecture:** 沿用现有 `lex→parse→eval→format` 分层，无重构。引擎层（lexer/parser/evaluator）新增函数原子与 `nCr/nPr` 运算符；新增数据模块 `js/mathmenu.js` 提供 MATH 面板内容；`app.js` 抽出共享 `execAction(action)` 插入路径，供按键与 MATH 面板复用。

**Tech Stack:** HTML + CSS + 原生 JavaScript (ES modules)。测试沿用 `tests/test.html` + `tests/assert.js`（浏览器内运行；引擎模块无 DOM 依赖，也可 node v25 headless 运行）。零依赖、零构建。

设计来源：[docs/superpowers/specs/2026-08-08-shift-math-functions-design.md](../specs/2026-08-08-shift-math-functions-design.md)

## Global Constraints

- 零依赖、零构建：不得引入 npm 包、打包器、框架。仅 HTML/CSS/原生 ES modules。
- 所有资源路径用**相对路径**（适配 GitHub Pages 子路径部署）。
- 只实现能落到引擎、数学上有明确意义的功能；App 专有 / PRO 功能保留「该功能暂未开放」toast 占位。
- 新增定义域 / 取值违规统一抛 `CalcError('Math Error')`，由现有 `engine.js` 包装层显示，**不新增任何错误 UI**。
- 乘除显示为 `×` `÷`，内部求值用 `*` `/`；新增显示映射见 Task 9。
- 黄标文案的唯一数据源是 `SHIFT_ACTIONS[id].label`，由 app.js 注入，**不在 index.html 硬编码**。
- 角度模式默认 DEG，反三角函数结果受 DEG/RAD 影响（DEG 返回角度）。
- 提交频繁，每个 Task 末尾 commit。测试运行方式：浏览器打开 `tests/test.html` 看 PASS/FAIL 汇总。

---

## File Structure

```
CalculatorSPA/
├── index.html            # 修改：新增 MATH 面板容器；移除硬编码的两个 .second
├── styles.css            # 修改：#keypad padding-bottom；.shift-active 高亮；MATH 面板样式
├── js/
│   ├── lexer.js          # 修改：注册新 FUNC 原子 + nCr/nPr OP 记号
│   ├── parser.js         # 修改：新增 parseCombi 优先级层
│   ├── evaluator.js      # 修改：新增 log/asin/acos/atan/cbrt/abs + fromRad + nCr/nPr + factorial
│   ├── keymap.js         # 修改：SHIFT_ACTIONS 全表（含 label）+ ACTIONS.math 改为 {kind:'math'}
│   ├── mathmenu.js       # 新建：导出 MATH_CATALOG（分类 → 条目）
│   └── app.js            # 修改：execAction 共享路径 + 展开表 + DISPLAY + 注入黄标 + shift-active + openMath
├── sw.js                 # 修改：CACHE 版本 v4→v5；ASSETS 加入 mathmenu.js
└── tests/test.html       # 修改：新增引擎/接线单测用例
```

构建顺序：引擎（lexer→parser→evaluator，纯函数可独立测试）→ 数据（keymap、mathmenu）→ UI（index.html、styles.css、app.js）→ PWA（sw.js）。

---

### Task 1: lexer.js — 注册新函数原子与 nCr/nPr 运算符

**Files:**
- Modify: `js/lexer.js:7`（`FUNCS` 映射）、`js/lexer.js:9-20`（`classify`）
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: 无新增依赖
- Produces: `lex(atoms)` 新识别原子：`log(` `asin(` `acos(` `atan(` `cbrt(` `abs(` → `{FUNC, name}` + `LPAREN`；`nCr` `nPr` → `{OP, value:'nCr'|'nPr'}`。`nCr/nPr` 为 OP 类型，不参与隐式乘法（不在 LEFT/RIGHT 集合）。

- [ ] **Step 1: 写失败测试**（加入 `tests/test.html` 的 module script，紧接现有 lex 用例之后）

```javascript
test('lex 新函数 log 展开', () => {
  const t = lex(['log(', '100', ')']);
  assertEqual(t[0].type, T.FUNC); assertEqual(t[0].value, 'log');
  assertEqual(t[1].type, T.LPAREN);
});
test('lex 新函数 asin/cbrt/abs', () => {
  assertEqual(lex(['asin('])[0].value, 'asin');
  assertEqual(lex(['cbrt('])[0].value, 'cbrt');
  assertEqual(lex(['abs('])[0].value, 'abs');
});
test('lex nCr/nPr 为 OP', () => {
  const t = lex(['5', 'nCr', '2']);
  assertEqual(t[1].type, T.OP); assertEqual(t[1].value, 'nCr');
  assertEqual(t.length, 3); // 无隐式乘法插入
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: 上述 3 条 FAIL（`nCr` 等未知原子抛 Syntax Error / FUNC 名不匹配）

- [ ] **Step 3: 写实现**

在 `js/lexer.js` 第 7 行的 `FUNCS` 常量加入新条目：

```javascript
const FUNCS = {
  'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'ln(': 'ln', 'sqrt(': 'sqrt',
  'log(': 'log', 'asin(': 'asin', 'acos(': 'acos', 'atan(': 'atan',
  'cbrt(': 'cbrt', 'abs(': 'abs',
};
```

在 `classify(atom)` 里 `if (atom === '%')` 那行之后、`if (/^[A-Z]$/...` 之前，加入：

```javascript
  if (atom === 'nCr' || atom === 'nPr') return [{ type: T.OP, value: atom }];
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 上述 3 条 PASS，且现有 lexer 用例仍全绿。

- [ ] **Step 5: Commit**

```bash
git add js/lexer.js tests/test.html
git commit -m "feat: lex new function atoms and nCr/nPr operators"
```

---

### Task 2: parser.js — 新增 parseCombi 优先级层（nCr/nPr）

**Files:**
- Modify: `js/parser.js:20-27`（`parseMulDiv`）、新增 `parseCombi`
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: `lex`, `TOKEN_TYPES` from lexer.js（Task 1 已加 nCr/nPr）
- Produces: `parse` 支持 `nCr`/`nPr` 为二元 `{kind:'binary', op:'nCr'|'nPr', left, right}`。优先级：**紧于 `× ÷`、松于一元负号**（`parseCombi` 位于 `parseMulDiv` 与 `parseUnary` 之间，左结合）。故 `5 nCr 2 × 3` = `(5 nCr 2) × 3`。

- [ ] **Step 1: 写失败测试**（加入现有 parse 用例之后）

```javascript
test('parse nCr 二元节点', () => {
  const a = ast(['5', 'nCr', '2']);
  assertEqual(a.kind, 'binary'); assertEqual(a.op, 'nCr');
  assertEqual(a.left.value, 5); assertEqual(a.right.value, 2);
});
test('parse nCr 紧于乘法', () => {
  const a = ast(['5', 'nCr', '2', '*', '3']); // (5 nCr 2) * 3
  assertEqual(a.op, '*'); assertEqual(a.left.op, 'nCr');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: 2 条 FAIL（parser 遇到剩余 nCr 记号抛 Syntax Error）

- [ ] **Step 3: 写实现**

把 `parseMulDiv` 中两处 `parseUnary()` 调用改为 `parseCombi()`：

```javascript
  function parseMulDiv() {
    let node = parseCombi();
    while (peek() && peek().type === T.OP && (peek().value === '*' || peek().value === '/')) {
      const op = next().value;
      node = { kind: 'binary', op, left: node, right: parseCombi() };
    }
    return node;
  }
  function parseCombi() {
    let node = parseUnary();
    while (peek() && peek().type === T.OP && (peek().value === 'nCr' || peek().value === 'nPr')) {
      const op = next().value;
      node = { kind: 'binary', op, left: node, right: parseUnary() };
    }
    return node;
  }
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 2 条 PASS，现有 parser 用例仍全绿。

- [ ] **Step 5: Commit**

```bash
git add js/parser.js tests/test.html
git commit -m "feat: parse nCr/nPr with precedence between mul and unary"
```

---

### Task 3: evaluator.js — 新增一元函数（log/asin/acos/atan/cbrt/abs）

**Files:**
- Modify: `js/evaluator.js`（新增 `fromRad`；`call` 分支新增 case）
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: AST `call` 节点 name ∈ 新函数集
- Produces: 求值语义——
  - `log(x)`：x≤0 → `Math Error`，否则 `Math.log10(x)`
  - `asin(x)`/`acos(x)`：`|x|>1` → `Math Error`，否则求弧度后经 `fromRad` 换算（DEG 返回角度）
  - `atan(x)`：全定义域，`fromRad` 换算
  - `cbrt(x)`：`Math.cbrt(x)`（支持负数）
  - `abs(x)`：`Math.abs(x)`
  - `fromRad(x, mode) = mode==='DEG' ? x*180/π : x`

- [ ] **Step 1: 写失败测试**（加入现有 eval 用例之后）

```javascript
test('eval log(1000)=3', () => assertClose(ev(['log(', '1000', ')']), 3));
test('eval log(0) Math Error', () => assertThrows(() => ev(['log(', '0', ')']), 'Math Error'));
test('eval asin(0.5)=30 DEG', () => assertClose(ev(['asin(', '0.5', ')']), 30));
test('eval asin(0.5)=pi/6 RAD', () => assertClose(ev(['asin(', '0.5', ')'], { angleMode: 'RAD' }), Math.PI / 6));
test('eval acos(1)=0', () => assertClose(ev(['acos(', '1', ')']), 0));
test('eval atan(1)=45 DEG', () => assertClose(ev(['atan(', '1', ')']), 45));
test('eval asin(2) Math Error', () => assertThrows(() => ev(['asin(', '2', ')']), 'Math Error'));
test('eval cbrt(-8)=-2', () => assertClose(ev(['cbrt(', '-', '8', ')']), -2));
test('eval abs(-5)=5', () => assertEqual(ev(['abs(', '-', '5', ')']), 5));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: 9 条 FAIL（新函数走到 `throw new CalcError('Syntax Error')` 兜底）

- [ ] **Step 3: 写实现**

在 `js/evaluator.js` 顶部 `toRad` 定义之后加入反向换算：

```javascript
const fromRad = (x, mode) => (mode === 'DEG' ? (x * 180) / Math.PI : x);
```

在 `call` 分支的 `switch (node.name)` 内，`case 'sqrt':` 之后加入：

```javascript
        case 'log': if (x <= 0) throw new CalcError('Math Error'); return Math.log10(x);
        case 'asin': if (x < -1 || x > 1) throw new CalcError('Math Error'); return fromRad(Math.asin(x), ctx.angleMode);
        case 'acos': if (x < -1 || x > 1) throw new CalcError('Math Error'); return fromRad(Math.acos(x), ctx.angleMode);
        case 'atan': return fromRad(Math.atan(x), ctx.angleMode);
        case 'cbrt': return Math.cbrt(x);
        case 'abs': return Math.abs(x);
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 9 条 PASS，现有 eval 用例仍全绿。

- [ ] **Step 5: Commit**

```bash
git add js/evaluator.js tests/test.html
git commit -m "feat: evaluate log/asin/acos/atan/cbrt/abs with angle awareness"
```

---

### Task 4: evaluator.js — 组合数 nCr / 排列数 nPr

**Files:**
- Modify: `js/evaluator.js`（`binary` 分支新增 case；新增 `factorial`/`nCr`/`nPr`/`checkNK` 辅助）
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: AST `{kind:'binary', op:'nCr'|'nPr', left, right}`
- Produces: `nPr(n,r)=n!/(n−r)!`，`nCr(n,r)=n!/(r!(n−r)!)`。要求 n、r 为**非负整数**且 `n ≥ r`，否则 `Math Error`。超大 n 阶乘溢出为 `Infinity`，由 `evaluate()` 尾部「非有限即 Math Error」兜底。

- [ ] **Step 1: 写失败测试**（加入现有 eval 用例之后）

```javascript
test('eval nCr(5,2)=10', () => assertEqual(ev(['5', 'nCr', '2']), 10));
test('eval nPr(5,2)=20', () => assertEqual(ev(['5', 'nPr', '2']), 20));
test('eval nCr 优先级 5C2*3=30', () => assertEqual(ev(['5', 'nCr', '2', '*', '3']), 30));
test('eval nCr(2,5) Math Error', () => assertThrows(() => ev(['2', 'nCr', '5']), 'Math Error'));
test('eval nCr(5,-1) Math Error', () => assertThrows(() => ev(['5', 'nCr', '-', '1']), 'Math Error'));
test('eval nCr(5.5,2) Math Error', () => assertThrows(() => ev(['5.5', 'nCr', '2']), 'Math Error'));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: 6 条 FAIL（`binary` 分支无 nCr/nPr case，走 break 后到 Syntax Error 兜底）

- [ ] **Step 3: 写实现**

在 `js/evaluator.js` 的 `binary` 分支 `switch (node.op)` 内，`case '^':` 之后加入：

```javascript
        case 'nCr': return nCr(a, b);
        case 'nPr': return nPr(a, b);
```

在文件末尾（`evalNode` 函数之后）加入辅助函数：

```javascript
function checkNK(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n)
    throw new CalcError('Math Error');
}
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function nPr(n, k) { checkNK(n, k); return factorial(n) / factorial(n - k); }
function nCr(n, k) { checkNK(n, k); return factorial(n) / (factorial(k) * factorial(n - k)); }
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 6 条 PASS，现有 eval 用例仍全绿。

- [ ] **Step 5: Commit**

```bash
git add js/evaluator.js tests/test.html
git commit -m "feat: evaluate nCr/nPr with integer-domain validation"
```

---

### Task 5: keymap.js — 扩充 SHIFT_ACTIONS 全表（含 label）+ math 动作

**Files:**
- Modify: `js/keymap.js:26`（把 `math` 从 placeholder 改为 `{kind:'math'}`）、`js/keymap.js:32-35`（`SHIFT_ACTIONS`）
- Test: 用例加入 `tests/test.html`

**说明：** `SHIFT_ACTIONS` 从当前 2 条扩充为 spec §3 全表，每条新增 `label` 字段（黄标文案）。`label` 是 UI 注入黄标的唯一数据源。`nCr/nPr` 用 `kind:'atom'`（插入运算符原子）。app.js 的 `func` 展开新增 `cube/recip`（Task 7 处理）。

**Interfaces:**
- Consumes: 无新增依赖
- Produces:
  - `ACTIONS.math` 改为 `{ kind: 'math' }`（不再 placeholder）
  - `SHIFT_ACTIONS` 全表（键为 buttonId，值含 `kind`/`payload`/`label`）：

| buttonId | kind | payload | label |
|----------|------|---------|-------|
| `pi` | atom | `e` | `e` |
| `ln` | atom | `log(` | `log` |
| `sin` | atom | `asin(` | `sin⁻¹` |
| `cos` | atom | `acos(` | `cos⁻¹` |
| `tan` | atom | `atan(` | `tan⁻¹` |
| `square` | func | `cube` | `x³` |
| `sqrt` | atom | `cbrt(` | `³√` |
| `varX` | func | `recip` | `x⁻¹` |
| `add` | atom | `nCr` | `nCr` |
| `sub` | atom | `nPr` | `nPr` |
| `0` | atom | `%` | `%` |
| `eex` | func | `epow` | `eˣ` |

- [ ] **Step 1: 写失败测试**（加入现有 keymap 用例之后）

```javascript
test('SHIFT ln→log 带 label', () => {
  assertEqual(SHIFT_ACTIONS.ln.kind, 'atom');
  assertEqual(SHIFT_ACTIONS.ln.payload, 'log(');
  assertEqual(SHIFT_ACTIONS.ln.label, 'log');
});
test('SHIFT sin→asin 带 label', () => {
  assertEqual(SHIFT_ACTIONS.sin.payload, 'asin(');
  assertEqual(SHIFT_ACTIONS.sin.label, 'sin⁻¹');
});
test('SHIFT add→nCr', () => {
  assertEqual(SHIFT_ACTIONS.add.payload, 'nCr');
  assertEqual(SHIFT_ACTIONS.add.label, 'nCr');
});
test('SHIFT square→cube func', () => {
  assertEqual(SHIFT_ACTIONS.square.kind, 'func');
  assertEqual(SHIFT_ACTIONS.square.payload, 'cube');
});
test('math 动作非 placeholder', () => {
  assertEqual(ACTIONS.math.kind, 'math');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（新 SHIFT_ACTIONS 键未定义；`ACTIONS.math.kind` 仍是 `placeholder`）。同时现有测试 `test('占位键', () => assertEqual(ACTIONS.math.kind, 'placeholder'))` 会失败——**在本步一并把该现有用例改为断言 `'math'`**（见 Step 3 说明）。

- [ ] **Step 3: 写实现**

1）把 `js/keymap.js` 第 26 行 `math: { kind: 'placeholder' },` 从占位组移出，改为：

```javascript
  math: { kind: 'math' },
```

（保留 `mathUp/mathDown/fxs/grp/comma/eng` 仍为 placeholder。）

2）把 `SHIFT_ACTIONS` 整块替换为：

```javascript
export const SHIFT_ACTIONS = {
  pi:     { kind: 'atom', payload: 'e',     label: 'e' },
  ln:     { kind: 'atom', payload: 'log(',  label: 'log' },
  sin:    { kind: 'atom', payload: 'asin(', label: 'sin⁻¹' },
  cos:    { kind: 'atom', payload: 'acos(', label: 'cos⁻¹' },
  tan:    { kind: 'atom', payload: 'atan(', label: 'tan⁻¹' },
  square: { kind: 'func', payload: 'cube',  label: 'x³' },
  sqrt:   { kind: 'atom', payload: 'cbrt(', label: '³√' },
  varX:   { kind: 'func', payload: 'recip', label: 'x⁻¹' },
  add:    { kind: 'atom', payload: 'nCr',   label: 'nCr' },
  sub:    { kind: 'atom', payload: 'nPr',   label: 'nPr' },
  '0':    { kind: 'atom', payload: '%',     label: '%' },
  eex:    { kind: 'func', payload: 'epow',  label: 'eˣ' },
};
```

3）把 `tests/test.html` 中现有用例
`test('占位键', () => { assertEqual(ACTIONS.math.kind, 'placeholder'); });`
改为断言另一个仍为占位的键，避免与新行为冲突：

```javascript
test('占位键', () => { assertEqual(ACTIONS.fxs.kind, 'placeholder'); });
```

4）现有用例 `test('Shift 第二功能 0→%', ...)` 与 `test('Shift 第二功能 EE→e^x', ...)` 仍成立（payload 未变），保留不动。

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 5 条新用例 PASS；改写后的「占位键」用例 PASS；其余全绿。

- [ ] **Step 5: Commit**

```bash
git add js/keymap.js tests/test.html
git commit -m "feat: full shift action table with labels; math action"
```

---

### Task 6: mathmenu.js — MATH_CATALOG 数据模块

**Files:**
- Create: `js/mathmenu.js`
- Test: 用例加入 `tests/test.html`

**说明：** 纯数据 + 一个校验友好的结构。每个条目 `{ label, action }`，`action` 与 keymap 的动作对象同构（`{kind, payload?}`），供 app.js 的 `execAction` 直接消费。仅收录引擎可求值项（spec §4）。

**Interfaces:**
- Consumes: 无（纯数据；但 action 的 payload 必须是 lexer/execAction 认得的原子或展开名）
- Produces: `MATH_CATALOG` — `Array<{ title: string, items: Array<{label: string, action: {kind, payload?}}> }>`。分类与条目：
  - **三角函数**：sin→`sin(`, cos→`cos(`, tan→`tan(`, sin⁻¹→`asin(`, cos⁻¹→`acos(`, tan⁻¹→`atan(`（均 `kind:'atom'`）
  - **对数指数**：ln→`ln(`, log→`log(`（atom）；eˣ→`epow`, 10ˣ→`tenpow`（`kind:'func'`）
  - **幂与根**：x²→`square`, x³→`cube`, x⁻¹→`recip`（func）；√→`sqrt(`, ³√→`cbrt(`（atom）；xⁿ→`^`（atom）
  - **组合数**：nCr→`nCr`, nPr→`nPr`（atom）
  - **常数/其他**：π→`pi`, e→`e`, abs→`abs(`, Ans→`Ans`（atom）；%→`%`（atom）

- [ ] **Step 1: 写失败测试**（加入 `tests/test.html`，并在顶部 import 区加 `import { MATH_CATALOG } from '../js/mathmenu.js';`）

```javascript
test('MATH_CATALOG 分类齐全', () => {
  const titles = MATH_CATALOG.map(g => g.title);
  assertEqual(titles.join(','), '三角函数,对数指数,幂与根,组合数,常数/其他');
});
test('MATH_CATALOG 每条目有 label 与 action', () => {
  for (const g of MATH_CATALOG) for (const it of g.items) {
    if (!it.label || !it.action || !it.action.kind)
      throw new Error('bad item ' + JSON.stringify(it));
  }
});
test('MATH_CATALOG 原子能被 lexer 识别', () => {
  // 仅校验 kind:'atom' 且 payload 为完整原子（func 展开由 app 负责，跳过）
  for (const g of MATH_CATALOG) for (const it of g.items) {
    if (it.action.kind === 'atom') {
      lex([it.action.payload]); // 不抛异常即通过
    }
  }
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`mathmenu.js` 不存在，模块加载报错）

- [ ] **Step 3: 写实现**

```javascript
// js/mathmenu.js
export const MATH_CATALOG = [
  { title: '三角函数', items: [
    { label: 'sin',    action: { kind: 'atom', payload: 'sin(' } },
    { label: 'cos',    action: { kind: 'atom', payload: 'cos(' } },
    { label: 'tan',    action: { kind: 'atom', payload: 'tan(' } },
    { label: 'sin⁻¹',  action: { kind: 'atom', payload: 'asin(' } },
    { label: 'cos⁻¹',  action: { kind: 'atom', payload: 'acos(' } },
    { label: 'tan⁻¹',  action: { kind: 'atom', payload: 'atan(' } },
  ]},
  { title: '对数指数', items: [
    { label: 'ln',   action: { kind: 'atom', payload: 'ln(' } },
    { label: 'log',  action: { kind: 'atom', payload: 'log(' } },
    { label: 'eˣ',   action: { kind: 'func', payload: 'epow' } },
    { label: '10ˣ',  action: { kind: 'func', payload: 'tenpow' } },
  ]},
  { title: '幂与根', items: [
    { label: 'x²',  action: { kind: 'func', payload: 'square' } },
    { label: 'x³',  action: { kind: 'func', payload: 'cube' } },
    { label: '√',   action: { kind: 'atom', payload: 'sqrt(' } },
    { label: '³√',  action: { kind: 'atom', payload: 'cbrt(' } },
    { label: 'x⁻¹', action: { kind: 'func', payload: 'recip' } },
    { label: 'xⁿ',  action: { kind: 'atom', payload: '^' } },
  ]},
  { title: '组合数', items: [
    { label: 'nCr', action: { kind: 'atom', payload: 'nCr' } },
    { label: 'nPr', action: { kind: 'atom', payload: 'nPr' } },
  ]},
  { title: '常数/其他', items: [
    { label: 'π',   action: { kind: 'atom', payload: 'pi' } },
    { label: 'e',   action: { kind: 'atom', payload: 'e' } },
    { label: 'abs', action: { kind: 'atom', payload: 'abs(' } },
    { label: 'Ans', action: { kind: 'atom', payload: 'Ans' } },
    { label: '%',   action: { kind: 'atom', payload: '%' } },
  ]},
];
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 3 条 PASS。

- [ ] **Step 5: Commit**

```bash
git add js/mathmenu.js tests/test.html
git commit -m "feat: add MATH_CATALOG data module"
```

---

### Task 7: index.html — MATH 面板容器 + 移除硬编码黄标

**Files:**
- Modify: `index.html:94-96`（移除硬编码 `.second`）、`index.html:42`（在 toast 之后插入 MATH 面板）

**说明：** 结构改动，无自动化测试；验收=浏览器打开无控制台报错、结构存在。MATH 面板复用历史面板的结构语义（全屏覆盖 + 头部 + 可滚动内容区），内容由 app.js 从 `MATH_CATALOG` 动态生成。

**Interfaces:**
- Produces DOM 契约（app.js 依赖）：
  - `#math-panel`（容器，默认 `hidden`）、`#math-close`（关闭按钮）、`#math-body`（分类内容挂载点）
  - 移除 `data-id="0"` 按钮内的 `<span class="second">%</span>` 与 `data-id="eex"` 按钮内的 `<span class="second">eˣ</span>`（改由 app.js 注入）

- [ ] **Step 1: 移除两个硬编码 `.second`**

把 `index.html` 第 94 行：
```html
      <button class="key num" data-id="0" type="button"><span class="second">%</span>0</button>
```
改为：
```html
      <button class="key num" data-id="0" type="button">0</button>
```

把第 96 行：
```html
      <button class="key sci" data-id="eex" type="button"><span class="second">eˣ</span>EE</button>
```
改为：
```html
      <button class="key sci" data-id="eex" type="button">EE</button>
```

- [ ] **Step 2: 在 `#toast` 行之后插入 MATH 面板**

在 `<div id="toast" class="toast" hidden></div>`（第 42 行）之后、`<section id="keypad">` 之前插入：

```html
    <div id="math-panel" hidden>
      <div class="history-head">
        <span>MATH</span>
        <button id="math-close" type="button">✕</button>
      </div>
      <div id="math-body"></div>
    </div>
```

- [ ] **Step 3: 浏览器验证结构**

Run: `python3 -m http.server 8000` 访问 `http://localhost:8000/`
Expected: 页面正常；`0` 与 `EE` 键此刻**没有**黄标（下个 Task 由 app.js 注入）；控制台无结构报错。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add MATH panel container; remove hardcoded shift labels"
```

---

### Task 8: app.js — execAction 重构 + 展开表 + DISPLAY

**Files:**
- Modify: `js/app.js`（抽出 `execAction`；扩展 `DISPLAY`；`dispatch` 复用 `execAction`）
- Test: 手动交互验收（引擎已被单测覆盖；此层为 DOM 粘合）

**说明：** 这是唯一的结构性改进——把「编辑区插入类」动作抽成 `execAction(action)`，供按键与 MATH 面板复用。控制类动作（history/sto/shift/equals/clear/nav/undo/redo/placeholder/math）仍在 `dispatch` 内。展开表集中在 `execAction`。

**Interfaces:**
- Consumes: `SHIFT_ACTIONS`（Task 5 新增 label；本 Task 已 import）
- Produces:
  - `execAction(action)` — 处理 `digit/atom/func/ans`；`func` 展开：`square→^2`、`cube→^3`、`recip→^(-1)`、`tenpow→10^`、`epow→e^`、`eex→×10^`。返回 void，调用方负责 `render()`。
  - `DISPLAY` 新增：`asin(→sin⁻¹(`、`acos(→cos⁻¹(`、`atan(→tan⁻¹(`、`cbrt(→³√(`、`nCr→C`、`nPr→P`。

- [ ] **Step 1: 扩展 DISPLAY 映射**

把 `js/app.js` 第 16 行的 `DISPLAY` 常量替换为：

```javascript
const DISPLAY = {
  '*': '×', '/': '÷', 'pi': 'π', 'sqrt(': '√(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', 'cbrt(': '³√(',
  'nCr': 'C', 'nPr': 'P',
};
```

- [ ] **Step 2: 抽出 execAction，改造 dispatch**

把现有 `dispatch(id)` 函数（第 78-113 行）替换为下面两个函数。`execAction` 只管插入类；`dispatch` 解析 shift/base 后，插入类交给 `execAction`，控制类就地处理：

```javascript
// 只处理「插入到编辑区」的动作；调用方负责 render()
function execAction(action) {
  switch (action.kind) {
    case 'digit': editor.insertDigit(action.payload); break;
    case 'atom': editor.insertAtom(action.payload); break;
    case 'func':
      if (action.payload === 'square') { editor.insertAtom('^'); editor.insertAtom('2'); }
      else if (action.payload === 'cube') { editor.insertAtom('^'); editor.insertAtom('3'); }
      else if (action.payload === 'recip') { editor.insertAtom('^'); editor.insertAtom('('); editor.insertAtom('-'); editor.insertAtom('1'); editor.insertAtom(')'); }
      else if (action.payload === 'tenpow') { editor.insertDigit('1'); editor.insertDigit('0'); editor.insertAtom('^'); }
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
```

> 注意：`toggleAngle` 现在 `return`（不再 fall-through 到 `render`），因为角度切换不改变算式，且原逻辑用 `clearShift` 例外来避免——现在改为直接 return 更清晰。现有物理键盘 `deg` 无绑定，行为不变。

- [ ] **Step 3: 手动验收（本 Task 只验证按键仍工作 + shift 插入）**

Run: `python3 -m http.server 8000` 访问首页：
Expected:
  - 基本输入/求值仍正常（`2+3×4=14`）
  - 按 Shift 再按 `Ln` → 插入 `log(`（显示 `log(`）；按 Shift 再按 `Sin` → 显示 `sin⁻¹(`
  - 按 Shift 再按 `+` → 显示 `C`（nCr）；`5 C 2 =` → `10`
  - 按 Shift 再按 `√` → 显示 `³√(`；`³√( -8 ) =` → `-2`
  - MATH 键点击暂时无面板（openMath 下个 Task 实现）——**本步 openMath 尚未定义，会报错**，故本 Task 的 `case 'math': openMath()` 需要一个占位：在文件里临时加 `function openMath() { showToast('MATH 面板开发中'); }`，Task 9 再替换为真实现。

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "refactor: extract execAction shared insert path; expand shift funcs"
```

---

### Task 9: app.js — 注入黄标 + shift-active 高亮 + MATH 面板

**Files:**
- Modify: `js/app.js`（import 加 `SHIFT_ACTIONS`、`MATH_CATALOG`；新增 `injectShiftLabels`、真实 `openMath`；改造 `updateShift`；初始化调用）
- Test: 手动交互验收

**说明：** 本 Task 完成三件事：从 `SHIFT_ACTIONS.label` 注入常驻黄标；`updateShift` 切换 `#keypad.shift-active`；用 `MATH_CATALOG` 构建并绑定 MATH 面板（替换 Task 8 的临时 `openMath` 桩）。

**Interfaces:**
- Consumes: `SHIFT_ACTIONS`（含 label）、`MATH_CATALOG`、`execAction`（Task 8）、`showAtom`/`render`（现有）
- Produces:
  - `injectShiftLabels()` — 遍历 `SHIFT_ACTIONS`，为每个 `[data-id]` 键注入 `<span class="second">label</span>` 并加 `has-shift` 类
  - `openMath()` — 从 `MATH_CATALOG` 生成分类列表挂到 `#math-body`，点条目 `execAction(item.action)` → 关面板 → `render()`
  - `updateShift()` — 除切换 shift 键 `.active` 外，切换 `#keypad` 的 `shift-active` 类

- [ ] **Step 1: 更新 import 并新增常量引用**

把 `js/app.js` 第 6 行：
```javascript
import { ACTIONS, SHIFT_ACTIONS, KEYBOARD } from './keymap.js';
```
之后新增一行：
```javascript
import { MATH_CATALOG } from './mathmenu.js';
```
并在 `const toastEl = ...` 那行的选择器组里补上 MATH 面板引用（第 14 行附近）：
```javascript
const mathPanel = $('#math-panel'), mathBody = $('#math-body');
```

- [ ] **Step 2: 改造 updateShift**

把现有 `updateShift`（第 41-43 行）替换为：

```javascript
function updateShift() {
  document.querySelector('[data-id="shift"]').classList.toggle('active', state.shift);
  document.querySelector('#keypad').classList.toggle('shift-active', state.shift);
}
```

- [ ] **Step 3: 新增 injectShiftLabels 与真实 openMath**

在 `updateShift` 之后新增：

```javascript
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
```

- [ ] **Step 4: 删除 Task 8 的临时 openMath 桩，绑定关闭按钮，初始化注入**

1）删除 Task 8 Step 3 里加入的临时 `function openMath() { showToast('MATH 面板开发中'); }`（真实现已在 Step 3 定义）。

2）在「历史关闭」绑定行之后新增 MATH 关闭绑定：
```javascript
document.querySelector('#math-close').addEventListener('click', () => { mathPanel.hidden = true; });
```

3）把文件末尾初始化行改为：
```javascript
injectShiftLabels();
updateBadge(); updateShift(); render();
```

- [ ] **Step 5: 手动交互验收**

Run: `python3 -m http.server 8000` 访问首页：
Expected:
  - `Ln/Sin/Cos/Tan/π/√/X/X²/+/−/0/EE` 左上角有黄标（`log`/`sin⁻¹`/…/`nCr`/`nPr`/`%`/`eˣ`）
  - 按 Shift → 键盘进入高亮态（黄标增亮/键面微黄），带 `has-shift` 的键可辨
  - 点 MATH → 弹分类面板（三角/对数指数/幂与根/组合数/常数其他）；点 `log` → 插入 `log(` 并关面板；点 `10ˣ` → 插入 `10^`；点 `nCr` → 插入 `C`
  - 点 `✕` 关面板；App 专有键（Y·Z·M 等，即无 has-shift 的键）在 Shift 态点击仍弹「该功能暂未开放」

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat: inject shift labels, shift highlight, MATH panel"
```

---

### Task 10: styles.css — 键盘间距 + shift 高亮 + MATH 面板样式

**Files:**
- Modify: `styles.css:28-29`（`#keypad` padding）、新增 `.shift-active`/`.math-*` 规则
- Test: 浏览器目视验收

**说明：** 三处样式：(1) 键盘底部 6px 间距；(2) shift 态高亮；(3) MATH 面板复用历史面板覆盖层 + 分类样式。`.second` 黄标样式已存在（第 33 行），无需改。

- [ ] **Step 1: 键盘底部间距**

把 `styles.css` 第 28-29 行：
```css
#keypad { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
  background: #111; padding: 1px; }
```
改为：
```css
#keypad { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
  background: #111; padding: 1px 1px 6px; }
```

- [ ] **Step 2: 新增 shift 高亮 + MATH 面板样式**

在文件末尾追加：

```css
/* Shift 激活态：带第二功能的键高亮 */
#keypad.shift-active .key.has-shift { background: #2a2410; }
#keypad.shift-active .key.has-shift .second { color: #ffd633; font-weight: 700; }

/* MATH 面板（复用历史面板覆盖层视觉） */
#math-panel { position: absolute; inset: 0; background: rgba(0,0,0,.96); z-index: 10;
  display: flex; flex-direction: column; }
#math-body { overflow-y: auto; flex: 1; padding: 8px 0 16px; }
.math-group { padding: 10px 14px 6px; color: var(--muted); font-size: 13px;
  letter-spacing: 1px; }
.math-items { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
  background: #111; }
.math-item { border: none; background: var(--key); color: var(--text);
  font-size: 18px; padding: 16px 0; cursor: pointer; }
.math-item:active { background: #333; }
```

- [ ] **Step 3: 浏览器目视验证**

Run: `python3 -m http.server 8000` 访问首页：
Expected:
  - 底排按钮与屏幕底缘之间有 6px 黑色间距
  - 按 Shift → 带黄标的键背景转暗黄、黄标变亮
  - MATH 面板：分类标题灰色小字 + 3 列条目网格，滚动流畅

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "style: keypad bottom padding, shift highlight, MATH panel"
```

---

### Task 11: sw.js — 缓存版本与资源清单

**Files:**
- Modify: `sw.js:1`（`CACHE`）、`sw.js:2-16`（`ASSETS`）

**说明：** 新增了 `js/mathmenu.js`，且改了多个已缓存文件——必须 bump 版本让旧缓存失效，并把新模块加入预缓存列表。

- [ ] **Step 1: bump 版本 + 加入 mathmenu.js**

把 `sw.js` 第 1 行：
```javascript
const CACHE = 'calc-v4';
```
改为：
```javascript
const CACHE = 'calc-v5';
```

在 `ASSETS` 数组的 `'./js/formatter.js', './js/keymap.js',` 那行改为包含 mathmenu：
```javascript
  './js/formatter.js', './js/keymap.js', './js/mathmenu.js',
```

- [ ] **Step 2: 验证 SW 更新 + 离线**

Run: `python3 -m http.server 8000` 访问首页；DevTools → Application → Service Workers 看到 `calc-v5` 激活、旧缓存被清；勾 Offline 刷新，MATH 面板与 shift 功能仍可用。
Expected: 离线可用，新资源已缓存。

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "chore: bump SW cache to v5, precache mathmenu.js"
```

---

### Task 12: 全量回归 + 部署

**Files:** 无新增

- [ ] **Step 1: 全量单测**

Run: 浏览器打开 `tests/test.html`
Expected: 全部 PASS（含新增 lexer/parser/evaluator/keymap/mathmenu 用例与原有全部用例）。

- [ ] **Step 2: 手动验收清单**

Run: `python3 -m http.server 8000` 访问首页，逐项验证：
Expected:
  - 键盘底部 6px 间距存在
  - 黄标常驻正确；Shift 高亮生效
  - Shift 功能全通：`e`/`log`/`sin⁻¹`/`cos⁻¹`/`tan⁻¹`/`x³`/`³√`/`x⁻¹`/`nCr`/`nPr`/`%`/`eˣ`
    - 抽查：`log(1000)=3`；DEG 下 `asin(0.5)=30`；`5 nCr 2 = 10`；`5 nPr 2 = 20`；`cbrt(-8)=-2`；`x⁻¹`：`4` 后按 Shift+X → `4^(-1)=0.25`
  - MATH 面板：分类齐全，点条目插入并关闭；`10ˣ`/`abs` 可用（`abs(-5)=5`）
  - App 专有键 Shift 态仍弹「该功能暂未开放」
  - 现有功能无回归（历史、STO、undo/redo、物理键盘、DEG/RAD）

- [ ] **Step 3: Push 到远程**

Run:
```bash
git push origin HEAD
```
Expected: 推送成功。（如回显远程 URL，token 部分按全局规则打码为首尾各 1 位。）

---

## Self-Review

**Spec coverage（对照 spec §3/§4/§5）：**
- 键盘底部 6px 间距 → Task 10 Step 1 ✅
- Shift 层 12 项功能 → lexer(T1)/parser(T2)/evaluator(T3,T4) 引擎 + keymap(T5) 映射 + app(T8 展开, T9 注入黄标/高亮) ✅
- 常驻小黄标 + 按下高亮 → T9 injectShiftLabels + updateShift；T10 `.shift-active` 样式 ✅
- App 专有键保留占位 → dispatch 中「shift 开启且无 shifted」分支 toast（T8）✅
- MATH 分类面板 → mathmenu(T6) 数据 + index(T7) 容器 + app(T9) openMath + styles(T10) ✅
- Cⁿᵣ/Pⁿᵣ → lexer OP(T1) + parser parseCombi(T2) + evaluator(T4) + keymap add/sub(T5) ✅
- MATH 专属 abs/10ˣ → evaluator abs(T3) + mathmenu tenpow/abs(T6) + app tenpow 展开(T8) ✅
- SW 版本 bump + mathmenu 预缓存 → T11 ✅
- 错误统一 Math Error、不新增错误 UI → T3/T4 抛 CalcError，engine 现有包装 ✅

**Placeholder scan：** 无 TBD/TODO；所有代码步骤含完整代码。T8 引入的临时 `openMath` 桩在 T9 Step 4 明确删除，非遗留占位。✅

**Type consistency：**
- 动作对象 `{kind, payload?}` 形状：keymap `ACTIONS`/`SHIFT_ACTIONS`(T5)、mathmenu `item.action`(T6)、app `execAction`(T8) 三处同构。✅
- `execAction` 处理的 kind 集合 `{digit, atom, func, ans}` = `INSERT_KINDS`；func 展开名 `square/cube/recip/tenpow/epow/eex` 在 keymap/mathmenu 产出、app 消费一致。✅
- 新函数原子名 `log(/asin(/acos(/atan(/cbrt(/abs(` 在 lexer FUNCS(T1)、evaluator case(T3)、mathmenu payload(T6)、app DISPLAY(T8) 四处一致。✅
- `nCr/nPr` 作为 OP：lexer(T1) 产 `{OP,'nCr'}`、parser(T2) 消费 `peek().value==='nCr'`、evaluator(T4) `case 'nCr'`、keymap(T5)/mathmenu(T6) payload `'nCr'` 一致。✅
- DOM 契约：index(T7) 产 `#math-panel/#math-close/#math-body`，app(T9) 消费一致。✅

无遗留问题。


---
