# 科学计算器 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个离线可运行、可安装为手机 PWA、部署于 GitHub Pages 的科学计算器单页应用，外观按截图 1:1 还原。

**Architecture:** 纯静态、零构建的 ES modules 应用。编辑层（token 列表 + 光标）与求值层（lexer → parser → evaluator → formatter）解耦；求值层为纯函数，可独立测试。历史与 STO 变量经 localStorage 持久化。service worker 做 cache-first 离线缓存。

**Tech Stack:** HTML + CSS + 原生 JavaScript (ES modules)。测试用浏览器内运行的轻量断言（`tests/test.html` + `tests/assert.js`），零依赖、零构建。

## Global Constraints

- 零依赖、零构建：不得引入 npm 包、打包器、框架。仅 HTML/CSS/原生 ES modules。
- 所有资源路径用**相对路径**（适配 GitHub Pages 子路径部署）。
- 角度模式默认 **DEG**，可切换 RAD。
- 数值显示：约 **12 位有效数字**四舍五入 + 浮点毛刺清理；超范围切科学计数法。
- 错误处理方案 A：`Syntax Error` / `Math Error`，**保留输入算式**，不锁定。
- 乘除显示为 `×` `÷`，内部求值用 `*` `/`。
- 占位（⛔）按钮点击弹「该功能暂未开放」toast，非阻塞、约 1–1.5s 自动消失、不动光标。
- 持久化用 localStorage，key 前缀 `calc.`。
- 提交频繁，每个 Task 末尾 commit。

---

## File Structure

```
CalculatorSPA/
├── index.html            # DOM 骨架 + module 引入 + SW 注册
├── styles.css            # 全部样式
├── js/
│   ├── formatter.js      # 纯函数：数值 → 显示字符串
│   ├── lexer.js          # 纯函数：token 数组 → 记号流（补隐式乘法）
│   ├── parser.js         # 纯函数：记号流 → AST
│   ├── evaluator.js      # 纯函数：AST + ctx → number（抛 CalcError）
│   ├── tokens.js         # 编辑模型：token 列表 + 光标 + undo/redo
│   ├── state.js          # 全局状态：角度模式、Shift、Ans、变量表
│   ├── history.js        # 历史 + STO 变量 + localStorage
│   ├── engine.js         # 组合 lexer→parser→evaluator，导出 evaluate()
│   ├── keymap.js         # 按钮 id / 物理键 → 编辑动作 映射表
│   └── app.js            # 入口：渲染、事件绑定、toast、协调各模块
├── tests/
│   ├── assert.js         # 轻量断言 + 测试运行器
│   └── test.html         # 在浏览器打开即跑全部单测
├── manifest.webmanifest
├── sw.js
├── icons/                # icon-192.png, icon-512.png（占位生成）
└── README.md
```

构建顺序：先纯函数引擎（可独立测试）→ 编辑模型 → 状态/持久化 → UI 组合 → PWA/部署。

---

### Task 1: 测试运行器 (assert.js + test.html)

**Files:**
- Create: `tests/assert.js`
- Create: `tests/test.html`

**Interfaces:**
- Produces:
  - `test(name, fn)` — 注册一个测试用例
  - `assertEqual(actual, expected, msg?)` — 严格相等断言（`Object.is`，可辨 NaN/-0）
  - `assertClose(actual, expected, eps=1e-9, msg?)` — 浮点近似断言
  - `assertThrows(fn, expectedMessage?, msg?)` — 断言抛异常，可校验 `err.message`
  - `runAll()` — 运行所有已注册用例，把结果写入 `document.body`（每条通过绿色/失败红色）并 `console.log` 汇总
- 各 `*.test.js` 以 `<script type="module">` 引入并调用上述断言；`test.html` 末尾调用 `runAll()`。

- [ ] **Step 1: 写 assert.js**

```javascript
const cases = [];
export function test(name, fn) { cases.push({ name, fn }); }

export function assertEqual(actual, expected, msg = '') {
  if (!Object.is(actual, expected)) {
    throw new Error(`${msg} expected ${String(expected)} but got ${String(actual)}`);
  }
}

export function assertClose(actual, expected, eps = 1e-9, msg = '') {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > eps) {
    throw new Error(`${msg} expected ~${expected} but got ${String(actual)}`);
  }
}

export function assertThrows(fn, expectedMessage, msg = '') {
  let threw = false;
  try { fn(); } catch (e) {
    threw = true;
    if (expectedMessage && e.message !== expectedMessage) {
      throw new Error(`${msg} expected throw "${expectedMessage}" but got "${e.message}"`);
    }
  }
  if (!threw) throw new Error(`${msg} expected function to throw`);
}

export function runAll() {
  let pass = 0, fail = 0;
  const out = document.createElement('pre');
  for (const c of cases) {
    try { c.fn(); pass++; out.innerHTML += `<span style="color:#3c3">PASS</span> ${c.name}\n`; }
    catch (e) { fail++; out.innerHTML += `<span style="color:#f55">FAIL</span> ${c.name}: ${e.message}\n`; }
  }
  out.innerHTML += `\n${pass} passed, ${fail} failed`;
  document.body.appendChild(out);
  console.log(`${pass} passed, ${fail} failed`);
}
```

- [ ] **Step 2: 写 test.html（先只引入自身，占位）**

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Calculator Tests</title></head>
<body>
<script type="module">
  // 后续 Task 会在此逐个 import '../js/*.test.js'（若拆分）或直接内联用例。
  // 本计划将各引擎单测直接写入本文件的 module script 中。
  import { runAll } from './assert.js';
  runAll();
</script>
</body></html>
```

- [ ] **Step 3: 在浏览器打开 tests/test.html 验证**

Run: 用浏览器打开 `tests/test.html`（或 `python3 -m http.server` 后访问）
Expected: 页面显示 `0 passed, 0 failed`，无报错。

- [ ] **Step 4: Commit**

```bash
git add tests/assert.js tests/test.html
git commit -m "test: add zero-dependency browser test runner"
```

---

### Task 2: formatter.js（数值格式化）

**Files:**
- Create: `js/formatter.js`
- Test: 用例写入 `tests/test.html` 的 module script

**Interfaces:**
- Produces:
  - `formatNumber(n)` — `number → string`。规则：非有限数抛不适用（调用方保证传有限数）；四舍五入到 12 位有效数字；清除浮点毛刺；`|n|>=1e15` 或 `0<|n|<1e-9` 用科学计数法（形如 `1.23e15`），否则常规十进制并去除多余末尾零；`-0` 显示为 `0`。

- [ ] **Step 1: 写失败测试**（加入 test.html 的 module script，import 见下）

```javascript
import { test, assertEqual } from './assert.js';
import { formatNumber } from '../js/formatter.js';

test('formatNumber 清理浮点毛刺', () => assertEqual(formatNumber(0.1 + 0.2), '0.3'));
test('formatNumber 整数', () => assertEqual(formatNumber(1024), '1024'));
test('formatNumber 去末尾零', () => assertEqual(formatNumber(1.5000000000), '1.5'));
test('formatNumber -0 归零', () => assertEqual(formatNumber(-0), '0'));
test('formatNumber 大数科学计数', () => assertEqual(formatNumber(1e15), '1e+15'));
test('formatNumber 小数科学计数', () => assertEqual(formatNumber(0.0000000001), '1e-10'));
test('formatNumber 12位有效数字', () => assertEqual(formatNumber(1/3), '0.333333333333'));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`formatNumber` 未定义 / 模块加载报错）

- [ ] **Step 3: 写最小实现**

```javascript
// js/formatter.js
export function formatNumber(n) {
  if (n === 0) return '0';              // 同时处理 -0
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) {
    // 科学计数：12 位有效数字，去尾零
    let s = n.toExponential(11);
    s = s.replace(/\.?0+e/, 'e');       // 去尾零
    return s;
  }
  // 常规：先按 12 位有效数字定形，再解析回数字去毛刺与末尾零
  const rounded = Number(n.toPrecision(12));
  let s = String(rounded);
  if (s.includes('e')) {                // toPrecision 边界可能仍产生指数
    s = rounded.toExponential(11).replace(/\.?0+e/, 'e');
  }
  return s;
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 上述 7 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/formatter.js tests/test.html
git commit -m "feat: add number formatter with float-noise cleanup"
```

---

### Task 3: lexer.js（token 数组 → 记号流 + 隐式乘法）

**Files:**
- Create: `js/lexer.js`
- Test: 用例加入 `tests/test.html`

**说明：** 编辑模型（Task 7）产出的 token 对象形如 `{type, value}`。lexer 消费一个 **token 值字符串数组**（如 `['2','×','sin(','30',')']` 中每个原子），归一化为记号流并插入隐式乘法记号。为解耦，本 Task 定义 lexer 直接接收「原子字符串数组」，其中每个原子是下列之一：数字串、`+ - * / ^ ( )`、函数名带括号 `sin( cos( tan( ln( sqrt(`、常量 `pi e`、变量单字母 `A..Z`、`Ans`、`%`。

**Interfaces:**
- Consumes: `formatNumber` 无关。输入 `atoms: string[]`。
- Produces:
  - `TOKEN_TYPES` 常量对象：`{ NUM, OP, LPAREN, RPAREN, FUNC, CONST, VAR, ANS, PERCENT }`
  - `lex(atoms)` → `Array<{type, value}>`。数字原子 → `{NUM, Number}`；`+-*/^` → `{OP, char}`；`(` → LPAREN；`)` → RPAREN；`sin(` 等 → 产出 `{FUNC, 'sin'}` **和** 一个 LPAREN；`pi`→`{CONST,'pi'}`，`e`→`{CONST,'e'}`；`A..Z`→`{VAR, name}`；`Ans`→`{ANS}`；`%`→`{PERCENT}`。
  - **隐式乘法**：在相邻的 [NUM/RPAREN/CONST/VAR/ANS/PERCENT] 与 [NUM/CONST/VAR/ANS/FUNC/LPAREN] 之间插入 `{OP,'*'}`。抛 `CalcError('Syntax Error')`（从 evaluator.js 导入的错误类，见 Task 5）用于无法识别的原子——但为避免循环依赖，lexer 定义自己的 `throw new Error('Syntax Error')`，engine 统一包装。

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual, assertThrows } from './assert.js';
import { lex, TOKEN_TYPES as T } from '../js/lexer.js';

const types = (atoms) => lex(atoms).map(t => t.type);

test('lex 基本数字与运算', () => {
  const t = lex(['2', '+', '3']);
  assertEqual(t.length, 3);
  assertEqual(t[0].type, T.NUM); assertEqual(t[0].value, 2);
  assertEqual(t[1].type, T.OP);  assertEqual(t[1].value, '+');
});
test('lex 函数展开为 FUNC+LPAREN', () => {
  const t = lex(['sin(', '30', ')']);
  assertEqual(t[0].type, T.FUNC); assertEqual(t[0].value, 'sin');
  assertEqual(t[1].type, T.LPAREN);
  assertEqual(t[2].type, T.NUM);
  assertEqual(t[3].type, T.RPAREN);
});
test('lex 隐式乘法 数字接常量', () => {
  assertEqual(types(['2', 'pi']).join(','), [T.NUM, T.OP, T.CONST].join(','));
});
test('lex 隐式乘法 括号接括号', () => {
  assertEqual(types([')', '(']).join(','), [T.RPAREN, T.OP, T.LPAREN].join(','));
});
test('lex 隐式乘法 数字接函数', () => {
  assertEqual(types(['2', 'sin(']).join(','), [T.NUM, T.OP, T.FUNC, T.LPAREN].join(','));
});
test('lex 未知原子报错', () => assertThrows(() => lex(['@']), 'Syntax Error'));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`lex` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/lexer.js
export const TOKEN_TYPES = {
  NUM: 'NUM', OP: 'OP', LPAREN: 'LPAREN', RPAREN: 'RPAREN',
  FUNC: 'FUNC', CONST: 'CONST', VAR: 'VAR', ANS: 'ANS', PERCENT: 'PERCENT',
};
const T = TOKEN_TYPES;
const FUNCS = { 'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'ln(': 'ln', 'sqrt(': 'sqrt' };

function classify(atom) {
  if (/^\d*\.?\d+$/.test(atom) || /^\d+\.$/.test(atom)) return [{ type: T.NUM, value: Number(atom) }];
  if ('+-*/^'.includes(atom) && atom.length === 1) return [{ type: T.OP, value: atom }];
  if (atom === '(') return [{ type: T.LPAREN }];
  if (atom === ')') return [{ type: T.RPAREN }];
  if (FUNCS[atom]) return [{ type: T.FUNC, value: FUNCS[atom] }, { type: T.LPAREN }];
  if (atom === 'pi' || atom === 'e') return [{ type: T.CONST, value: atom }];
  if (atom === 'Ans') return [{ type: T.ANS }];
  if (atom === '%') return [{ type: T.PERCENT }];
  if (/^[A-Z]$/.test(atom)) return [{ type: T.VAR, value: atom }];
  throw new Error('Syntax Error');
}

const LEFT = new Set([T.NUM, T.RPAREN, T.CONST, T.VAR, T.ANS, T.PERCENT]);
const RIGHT = new Set([T.NUM, T.CONST, T.VAR, T.ANS, T.FUNC, T.LPAREN]);

export function lex(atoms) {
  const flat = [];
  for (const a of atoms) for (const tok of classify(a)) flat.push(tok);
  const out = [];
  for (let i = 0; i < flat.length; i++) {
    if (i > 0 && LEFT.has(flat[i - 1].type) && RIGHT.has(flat[i].type)) {
      out.push({ type: T.OP, value: '*' });
    }
    out.push(flat[i]);
  }
  return out;
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 6 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/lexer.js tests/test.html
git commit -m "feat: add lexer with implicit multiplication"
```

---

### Task 4: parser.js（记号流 → AST）

**Files:**
- Create: `js/parser.js`
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: `lex`, `TOKEN_TYPES` from lexer.js
- Produces:
  - `parse(tokens)` → AST 节点。节点形状：
    - `{ kind: 'num', value }`
    - `{ kind: 'const', name }`（'pi'|'e'）
    - `{ kind: 'var', name }`
    - `{ kind: 'ans' }`
    - `{ kind: 'binary', op, left, right }`（op ∈ `+ - * / ^`）
    - `{ kind: 'unary', op: '-', operand }`
    - `{ kind: 'percent', operand }`
    - `{ kind: 'call', name, arg }`
  - 优先级（低→高）：`+ -` → `* /` → 一元 `-` → `^`(右结合) → 后缀 `%` → primary（数字/常量/变量/Ans/函数调用/括号）。
  - 语法错误抛 `new Error('Syntax Error')`。

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual, assertThrows } from './assert.js';
import { lex } from '../js/lexer.js';
import { parse } from '../js/parser.js';

const ast = (atoms) => parse(lex(atoms));

test('parse 加法节点', () => {
  const a = ast(['2', '+', '3']);
  assertEqual(a.kind, 'binary'); assertEqual(a.op, '+');
  assertEqual(a.left.value, 2); assertEqual(a.right.value, 3);
});
test('parse 优先级 乘先于加', () => {
  const a = ast(['2', '+', '3', '*', '4']);
  assertEqual(a.op, '+'); assertEqual(a.right.op, '*');
});
test('parse ^ 右结合', () => {
  const a = ast(['2', '^', '3', '^', '2']); // 2^(3^2)
  assertEqual(a.op, '^'); assertEqual(a.right.op, '^');
});
test('parse 一元负号', () => {
  const a = ast(['-', '5']);
  assertEqual(a.kind, 'unary'); assertEqual(a.operand.value, 5);
});
test('parse 函数调用', () => {
  const a = ast(['sin(', '30', ')']);
  assertEqual(a.kind, 'call'); assertEqual(a.name, 'sin'); assertEqual(a.arg.value, 30);
});
test('parse 括号不匹配报错', () => assertThrows(() => ast(['(', '2']), 'Syntax Error'));
test('parse 空输入报错', () => assertThrows(() => parse([]), 'Syntax Error'));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`parse` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/parser.js
import { TOKEN_TYPES as T } from './lexer.js';

export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const err = () => { throw new Error('Syntax Error'); };

  function parseExpr() { return parseAddSub(); }

  function parseAddSub() {
    let node = parseMulDiv();
    while (peek() && peek().type === T.OP && (peek().value === '+' || peek().value === '-')) {
      const op = next().value;
      node = { kind: 'binary', op, left: node, right: parseMulDiv() };
    }
    return node;
  }
  function parseMulDiv() {
    let node = parseUnary();
    while (peek() && peek().type === T.OP && (peek().value === '*' || peek().value === '/')) {
      const op = next().value;
      node = { kind: 'binary', op, left: node, right: parseUnary() };
    }
    return node;
  }
  function parseUnary() {
    if (peek() && peek().type === T.OP && peek().value === '-') {
      next(); return { kind: 'unary', op: '-', operand: parseUnary() };
    }
    return parsePow();
  }
  function parsePow() {
    const base = parsePostfix();
    if (peek() && peek().type === T.OP && peek().value === '^') {
      next(); return { kind: 'binary', op: '^', left: base, right: parseUnary() }; // 右结合
    }
    return base;
  }
  function parsePostfix() {
    let node = parsePrimary();
    while (peek() && peek().type === T.PERCENT) { next(); node = { kind: 'percent', operand: node }; }
    return node;
  }
  function parsePrimary() {
    const t = peek();
    if (!t) err();
    if (t.type === T.NUM) { next(); return { kind: 'num', value: t.value }; }
    if (t.type === T.CONST) { next(); return { kind: 'const', name: t.value }; }
    if (t.type === T.VAR) { next(); return { kind: 'var', name: t.value }; }
    if (t.type === T.ANS) { next(); return { kind: 'ans' }; }
    if (t.type === T.FUNC) {
      const name = next().value;
      if (!peek() || peek().type !== T.LPAREN) err();
      next(); // (
      const arg = parseExpr();
      if (!peek() || peek().type !== T.RPAREN) err();
      next(); // )
      return { kind: 'call', name, arg };
    }
    if (t.type === T.LPAREN) {
      next(); const node = parseExpr();
      if (!peek() || peek().type !== T.RPAREN) err();
      next(); return node;
    }
    err();
  }

  if (tokens.length === 0) err();
  const result = parseExpr();
  if (pos !== tokens.length) err(); // 有剩余记号 = 语法错误
  return result;
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 7 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/parser.js tests/test.html
git commit -m "feat: add recursive-descent parser"
```

---

### Task 5: evaluator.js（AST 求值 + DEG/RAD + 错误）

**Files:**
- Create: `js/evaluator.js`
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Produces:
  - `class CalcError extends Error`（message 为 `'Math Error'` 或 `'Syntax Error'`）
  - `evaluate(ast, ctx)` → `number`。`ctx = { angleMode: 'DEG'|'RAD', ans: number, vars: {[A-Z]: number} }`。
  - 语义：`const pi`→Math.PI，`e`→Math.E；`var` 未定义时取 0；`ans`→ctx.ans；`sin/cos/tan` 按 angleMode 换算（DEG 时角度转弧度）；`ln`→自然对数，`sqrt`→平方根；`^`→Math.pow；`percent`→ operand/100。
  - 非有限结果（Infinity/NaN）→ 抛 `CalcError('Math Error')`；除以 0、`ln(x<=0)`、`sqrt(x<0)`、`tan` 的奇点同样 `Math Error`。

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual, assertClose, assertThrows } from './assert.js';
import { lex } from '../js/lexer.js';
import { parse } from '../js/parser.js';
import { evaluate, CalcError } from '../js/evaluator.js';

const ev = (atoms, ctx = {}) =>
  evaluate(parse(lex(atoms)), { angleMode: 'DEG', ans: 0, vars: {}, ...ctx });

test('eval 加乘优先级', () => assertEqual(ev(['2', '+', '3', '*', '4']), 14));
test('eval 幂右结合', () => assertEqual(ev(['2', '^', '3', '^', '2']), 512));
test('eval sin(30) DEG', () => assertClose(ev(['sin(', '30', ')']), 0.5));
test('eval sin(pi/6) RAD', () => assertClose(ev(['sin(', 'pi', '/', '6', ')'], { angleMode: 'RAD' }), 0.5));
test('eval sqrt', () => assertEqual(ev(['sqrt(', '9', ')']), 3));
test('eval 百分比', () => assertEqual(ev(['50', '%']), 0.5));
test('eval Ans', () => assertEqual(ev(['Ans', '+', '1'], { ans: 41 }), 42));
test('eval 变量', () => assertEqual(ev(['A', '*', '2'], { vars: { A: 21 } }), 42));
test('eval 除零 Math Error', () => assertThrows(() => ev(['1', '/', '0']), 'Math Error'));
test('eval ln(0) Math Error', () => assertThrows(() => ev(['ln(', '0', ')']), 'Math Error'));
test('eval sqrt(-1) Math Error', () => assertThrows(() => ev(['sqrt(', '-', '1', ')']), 'Math Error'));
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`evaluate` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/evaluator.js
export class CalcError extends Error {}

const toRad = (x, mode) => (mode === 'DEG' ? (x * Math.PI) / 180 : x);

export function evaluate(node, ctx) {
  const n = evalNode(node, ctx);
  if (!Number.isFinite(n)) throw new CalcError('Math Error');
  return n === 0 ? 0 : n; // 归一化 -0
}

function evalNode(node, ctx) {
  switch (node.kind) {
    case 'num': return node.value;
    case 'const': return node.name === 'pi' ? Math.PI : Math.E;
    case 'var': return ctx.vars[node.name] ?? 0;
    case 'ans': return ctx.ans;
    case 'percent': return evalNode(node.operand, ctx) / 100;
    case 'unary': return -evalNode(node.operand, ctx);
    case 'binary': {
      const a = evalNode(node.left, ctx), b = evalNode(node.right, ctx);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) throw new CalcError('Math Error'); return a / b;
        case '^': return Math.pow(a, b);
      }
      break;
    }
    case 'call': {
      const x = evalNode(node.arg, ctx);
      switch (node.name) {
        case 'sin': return Math.sin(toRad(x, ctx.angleMode));
        case 'cos': return Math.cos(toRad(x, ctx.angleMode));
        case 'tan': {
          const r = Math.tan(toRad(x, ctx.angleMode));
          if (!Number.isFinite(r) || Math.abs(r) > 1e15) throw new CalcError('Math Error');
          return r;
        }
        case 'ln': if (x <= 0) throw new CalcError('Math Error'); return Math.log(x);
        case 'sqrt': if (x < 0) throw new CalcError('Math Error'); return Math.sqrt(x);
      }
    }
  }
  throw new CalcError('Syntax Error');
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 11 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/evaluator.js tests/test.html
git commit -m "feat: add evaluator with DEG/RAD and math errors"
```

---

### Task 6: engine.js（组合 + 统一错误包装）

**Files:**
- Create: `js/engine.js`
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Consumes: `lex`, `parse`, `evaluate`, `CalcError`, `formatNumber`
- Produces:
  - `evaluate(atoms, ctx)` → `{ ok: true, value: number, display: string }` 或 `{ ok: false, error: 'Syntax Error'|'Math Error' }`。**不抛异常**——把 lexer/parser 的 `Error('Syntax Error')` 与 evaluator 的 `CalcError` 统一捕获归类；其它未知异常归为 `'Syntax Error'`。`display` 由 `formatNumber(value)` 得到。

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual } from './assert.js';
import { evaluate as engineEval } from '../js/engine.js';

const ctx = { angleMode: 'DEG', ans: 0, vars: {} };
test('engine 成功返回 display', () => {
  const r = engineEval(['0.1', '+', '0.2'], ctx);
  assertEqual(r.ok, true); assertEqual(r.display, '0.3');
});
test('engine 语法错误', () => {
  const r = engineEval(['(', '2'], ctx);
  assertEqual(r.ok, false); assertEqual(r.error, 'Syntax Error');
});
test('engine 数学错误', () => {
  const r = engineEval(['1', '/', '0'], ctx);
  assertEqual(r.ok, false); assertEqual(r.error, 'Math Error');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`engine.js` 不存在）

- [ ] **Step 3: 写实现**

```javascript
// js/engine.js
import { lex } from './lexer.js';
import { parse } from './parser.js';
import { evaluate as evalAst, CalcError } from './evaluator.js';
import { formatNumber } from './formatter.js';

export function evaluate(atoms, ctx) {
  try {
    const value = evalAst(parse(lex(atoms)), ctx);
    return { ok: true, value, display: formatNumber(value) };
  } catch (e) {
    const msg = e instanceof CalcError ? e.message
      : e.message === 'Math Error' ? 'Math Error' : 'Syntax Error';
    return { ok: false, error: msg === 'Math Error' ? 'Math Error' : 'Syntax Error' };
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 3 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/engine.js tests/test.html
git commit -m "feat: add engine facade combining lex/parse/eval/format"
```

---

### Task 7: tokens.js（编辑模型：token 列表 + 光标 + undo/redo）

**Files:**
- Create: `js/tokens.js`
- Test: 用例加入 `tests/test.html`

**说明：** 编辑模型维护「原子字符串数组 + 光标索引」。光标索引 ∈ `[0, atoms.length]`，表示插入位置在第 index 个原子之前。数字连续输入合并进同一原子（例如先插 `'3'` 再插 `'1'`，若光标紧邻数字原子则合并为 `'31'`）——为简化，本模型将**每个原子视为独立单位**，数字合并逻辑放在 `insertDigit`。

**Interfaces:**
- Produces `class Editor`:
  - `atoms` (getter) → `string[]` 当前原子数组副本
  - `cursor` (getter) → number
  - `insertAtom(atom)` — 在光标处插入一个原子（函数/运算符/常量/括号等），光标后移
  - `insertDigit(ch)` — 插入数字字符或小数点；若光标左邻原子是纯数字串则并入该原子，否则新建原子
  - `backspace()` — 删除光标左邻原子（数字原子则删其最后一个字符，删空则移除）
  - `moveLeft()` / `moveRight()` — 光标移动（边界处不动）
  - `clear()` — 清空
  - `setAtoms(arr)` — 用于历史回填：替换整个数组，光标置末尾
  - `undo()` / `redo()` — 结构快照栈
  - 每次改动（insert/backspace/clear/setAtoms）前自动压入 undo 快照；`moveLeft/Right` 不入栈

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual } from './assert.js';
import { Editor } from '../js/tokens.js';

test('insertDigit 合并数字', () => {
  const e = new Editor();
  e.insertDigit('3'); e.insertDigit('1');
  assertEqual(e.atoms.join(','), '31');
});
test('insertAtom 与运算符分隔', () => {
  const e = new Editor();
  e.insertDigit('2'); e.insertAtom('+'); e.insertDigit('3');
  assertEqual(e.atoms.join(','), '2,+,3');
});
test('backspace 删数字字符', () => {
  const e = new Editor();
  e.insertDigit('3'); e.insertDigit('1'); e.backspace();
  assertEqual(e.atoms.join(','), '3');
});
test('backspace 删整个原子', () => {
  const e = new Editor();
  e.insertDigit('2'); e.insertAtom('+'); e.backspace();
  assertEqual(e.atoms.join(','), '2');
});
test('光标中间插入', () => {
  const e = new Editor();
  e.insertDigit('2'); e.insertAtom('+'); e.insertDigit('3');
  e.moveLeft(); e.moveLeft(); // 光标在 + 之前
  e.insertDigit('9');
  assertEqual(e.atoms.join(','), '2,9,+,3');
});
test('undo/redo', () => {
  const e = new Editor();
  e.insertDigit('2'); e.insertAtom('+');
  e.undo();
  assertEqual(e.atoms.join(','), '2');
  e.redo();
  assertEqual(e.atoms.join(','), '2,+');
});
test('clear 后可 undo', () => {
  const e = new Editor();
  e.insertDigit('5'); e.clear();
  assertEqual(e.atoms.length, 0);
  e.undo();
  assertEqual(e.atoms.join(','), '5');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`Editor` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/tokens.js
const isNumAtom = (s) => /^\d*\.?\d*$/.test(s) && s !== '';

export class Editor {
  constructor() { this._atoms = []; this._cursor = 0; this._undo = []; this._redo = []; }
  get atoms() { return this._atoms.slice(); }
  get cursor() { return this._cursor; }

  _snapshot() {
    this._undo.push({ atoms: this._atoms.slice(), cursor: this._cursor });
    this._redo = [];
  }

  insertAtom(atom) {
    this._snapshot();
    this._atoms.splice(this._cursor, 0, atom);
    this._cursor++;
  }

  insertDigit(ch) {
    this._snapshot();
    const left = this._atoms[this._cursor - 1];
    if (this._cursor > 0 && left !== undefined && isNumAtom(left) &&
        !(ch === '.' && left.includes('.'))) {
      this._atoms[this._cursor - 1] = left + ch;
    } else {
      this._atoms.splice(this._cursor, 0, ch);
      this._cursor++;
    }
  }

  backspace() {
    if (this._cursor === 0) return;
    this._snapshot();
    const idx = this._cursor - 1;
    const left = this._atoms[idx];
    if (isNumAtom(left) && left.length > 1) {
      this._atoms[idx] = left.slice(0, -1);
    } else {
      this._atoms.splice(idx, 1);
      this._cursor--;
    }
  }

  moveLeft() { if (this._cursor > 0) this._cursor--; }
  moveRight() { if (this._cursor < this._atoms.length) this._cursor++; }

  clear() { this._snapshot(); this._atoms = []; this._cursor = 0; }

  setAtoms(arr) { this._snapshot(); this._atoms = arr.slice(); this._cursor = this._atoms.length; }

  undo() {
    if (!this._undo.length) return;
    this._redo.push({ atoms: this._atoms.slice(), cursor: this._cursor });
    const s = this._undo.pop();
    this._atoms = s.atoms; this._cursor = s.cursor;
  }
  redo() {
    if (!this._redo.length) return;
    this._undo.push({ atoms: this._atoms.slice(), cursor: this._cursor });
    const s = this._redo.pop();
    this._atoms = s.atoms; this._cursor = s.cursor;
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 7 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/tokens.js tests/test.html
git commit -m "feat: add editor model with cursor and undo/redo"
```

---

### Task 8: history.js（历史 + STO 变量 + localStorage）

**Files:**
- Create: `js/history.js`
- Test: 用例加入 `tests/test.html`（用可注入的 storage 以免污染真实 localStorage）

**Interfaces:**
- Produces `class Store`:
  - `constructor(storage = localStorage)` — 依赖注入，测试传入内存实现
  - `addHistory(atoms, display)` — 追加一条 `{ atoms: string[], display: string, ts: number }`；`ts` 由调用方无法传时用递增计数（避免 Date 依赖测试不确定；实现用 `storage` 里的自增序号）
  - `history` (getter) → 数组（最新在前），最多保留 100 条
  - `getVar(name)` / `setVar(name, value)` — STO 变量读写
  - `vars` (getter) → `{[A-Z]: number}`
  - 所有写操作同步持久化到 storage，key：`calc.history`、`calc.vars`、`calc.seq`
  - `constructor` 从 storage 载入已有数据

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual } from './assert.js';
import { Store } from '../js/history.js';

function memStorage() {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
  };
}

test('addHistory 最新在前', () => {
  const s = new Store(memStorage());
  s.addHistory(['1', '+', '1'], '2');
  s.addHistory(['2', '*', '2'], '4');
  assertEqual(s.history[0].display, '4');
  assertEqual(s.history[1].display, '2');
});
test('变量读写', () => {
  const s = new Store(memStorage());
  s.setVar('A', 42);
  assertEqual(s.getVar('A'), 42);
  assertEqual(s.vars.A, 42);
});
test('持久化跨实例', () => {
  const mem = memStorage();
  const s1 = new Store(mem);
  s1.setVar('B', 7); s1.addHistory(['B'], '7');
  const s2 = new Store(mem);
  assertEqual(s2.getVar('B'), 7);
  assertEqual(s2.history[0].display, '7');
});
test('历史上限 100', () => {
  const s = new Store(memStorage());
  for (let i = 0; i < 105; i++) s.addHistory([String(i)], String(i));
  assertEqual(s.history.length, 100);
  assertEqual(s.history[0].display, '104');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`Store` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/history.js
const K_HIST = 'calc.history', K_VARS = 'calc.vars', K_SEQ = 'calc.seq';
const MAX = 100;

export class Store {
  constructor(storage = localStorage) {
    this._s = storage;
    this._history = this._load(K_HIST, []);
    this._vars = this._load(K_VARS, {});
    this._seq = Number(this._s.getItem(K_SEQ) || 0);
  }
  _load(key, fallback) {
    try { const raw = this._s.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  _save(key, val) { this._s.setItem(key, JSON.stringify(val)); }

  get history() { return this._history.slice(); }
  addHistory(atoms, display) {
    this._seq++; this._s.setItem(K_SEQ, this._seq);
    this._history.unshift({ atoms: atoms.slice(), display, ts: this._seq });
    if (this._history.length > MAX) this._history.length = MAX;
    this._save(K_HIST, this._history);
  }

  get vars() { return { ...this._vars }; }
  getVar(name) { return this._vars[name] ?? 0; }
  setVar(name, value) { this._vars[name] = value; this._save(K_VARS, this._vars); }
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 4 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/history.js tests/test.html
git commit -m "feat: add history and variable store with persistence"
```

---

### Task 9: state.js（全局状态）

**Files:**
- Create: `js/state.js`
- Test: 用例加入 `tests/test.html`

**Interfaces:**
- Produces `class AppState`:
  - `angleMode` (getter) → `'DEG'|'RAD'`（默认 `'DEG'`）
  - `toggleAngleMode()` — DEG↔RAD 切换
  - `shift` (getter) → boolean（默认 false）
  - `toggleShift()` / `clearShift()` — Shift 态切换/清除
  - `ans` (getter/setter) → number（默认 0）

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual } from './assert.js';
import { AppState } from '../js/state.js';

test('默认 DEG', () => assertEqual(new AppState().angleMode, 'DEG'));
test('切换角度模式', () => {
  const s = new AppState(); s.toggleAngleMode();
  assertEqual(s.angleMode, 'RAD');
});
test('shift 切换与清除', () => {
  const s = new AppState();
  s.toggleShift(); assertEqual(s.shift, true);
  s.clearShift(); assertEqual(s.shift, false);
});
test('ans 读写', () => {
  const s = new AppState(); s.ans = 42;
  assertEqual(s.ans, 42);
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`AppState` 未定义）

- [ ] **Step 3: 写实现**

```javascript
// js/state.js
export class AppState {
  constructor() { this._angle = 'DEG'; this._shift = false; this._ans = 0; }
  get angleMode() { return this._angle; }
  toggleAngleMode() { this._angle = this._angle === 'DEG' ? 'RAD' : 'DEG'; }
  get shift() { return this._shift; }
  toggleShift() { this._shift = !this._shift; }
  clearShift() { this._shift = false; }
  get ans() { return this._ans; }
  set ans(v) { this._ans = v; }
}
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 4 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/state.js tests/test.html
git commit -m "feat: add app state (angle mode, shift, ans)"
```

---

### Task 10: keymap.js（按钮/物理键 → 动作映射）

**Files:**
- Create: `js/keymap.js`
- Test: 用例加入 `tests/test.html`

**说明：** 集中定义「按钮语义 id → 对编辑器/状态执行什么」，让 app.js 只做分发。动作用一个描述对象表达，便于测试而不依赖 DOM。

**Interfaces:**
- Produces:
  - `ACTIONS` — `{ [buttonId]: { kind, payload? } }`。`kind ∈ 'digit'|'atom'|'func'|'backspace'|'clear'|'left'|'right'|'undo'|'redo'|'equals'|'toggleAngle'|'toggleShift'|'history'|'sto'|'ans'|'placeholder'}`。
    - 数字键 `0..9` → `{kind:'digit', payload:'0'..'9'}`；`.` → `{kind:'digit', payload:'.'}`
    - `add/sub/mul/div/pow` → `{kind:'atom', payload:'+'|'-'|'*'|'/'|'^'}`
    - `lparen/rparen` → `{kind:'atom', payload:'('|')'}`
    - `pi` → `{kind:'atom', payload:'pi'}`；`percent` → `{kind:'atom', payload:'%'}`
    - `sin/cos/tan/ln/sqrt` → `{kind:'atom', payload:'sin('...}`（作为原子插入，lexer 认得）
    - `square` → 特殊：插入 `^` 再插入 `2` → 用 `{kind:'func', payload:'square'}`（app 展开）
    - `ans` → `{kind:'ans'}`；`ac` → `{kind:'clear'}`；`back` → `{kind:'backspace'}`
    - `left/right/undo/redo/equals/deg/shift/history/sto` → 对应 kind
    - 占位键（`mathUp/mathDown/math/fxs/grp/comma/eex-secondary` 等）→ `{kind:'placeholder'}`
  - `KEYBOARD` — 物理键 `event.key` → buttonId 映射：`'0'..'9'`,`'.'`→数字；`'+'`,`'-'`,`'*'`,`'/'`,`'^'`→运算；`'('`,`')'`；`'Enter'`/`'='`→equals；`'Backspace'`→back；`'ArrowLeft'`→left；`'ArrowRight'`→right；`'Escape'`→ac。

- [ ] **Step 1: 写失败测试**

```javascript
import { test, assertEqual } from './assert.js';
import { ACTIONS, KEYBOARD } from '../js/keymap.js';

test('数字键动作', () => {
  assertEqual(ACTIONS['7'].kind, 'digit');
  assertEqual(ACTIONS['7'].payload, '7');
});
test('运算符动作', () => {
  assertEqual(ACTIONS.mul.kind, 'atom');
  assertEqual(ACTIONS.mul.payload, '*');
});
test('函数作为原子', () => {
  assertEqual(ACTIONS.sin.payload, 'sin(');
});
test('占位键', () => {
  assertEqual(ACTIONS.math.kind, 'placeholder');
});
test('物理键映射', () => {
  assertEqual(KEYBOARD['Enter'], 'equals');
  assertEqual(KEYBOARD['Backspace'], 'back');
  assertEqual(KEYBOARD['*'], 'mul');
});
```

- [ ] **Step 2: 运行验证失败**

Run: 浏览器打开 `tests/test.html`
Expected: FAIL（`keymap.js` 不存在）

- [ ] **Step 3: 写实现**

```javascript
// js/keymap.js
export const ACTIONS = {
  '0': { kind: 'digit', payload: '0' }, '1': { kind: 'digit', payload: '1' },
  '2': { kind: 'digit', payload: '2' }, '3': { kind: 'digit', payload: '3' },
  '4': { kind: 'digit', payload: '4' }, '5': { kind: 'digit', payload: '5' },
  '6': { kind: 'digit', payload: '6' }, '7': { kind: 'digit', payload: '7' },
  '8': { kind: 'digit', payload: '8' }, '9': { kind: 'digit', payload: '9' },
  dot: { kind: 'digit', payload: '.' },
  add: { kind: 'atom', payload: '+' }, sub: { kind: 'atom', payload: '-' },
  mul: { kind: 'atom', payload: '*' }, div: { kind: 'atom', payload: '/' },
  pow: { kind: 'atom', payload: '^' },
  lparen: { kind: 'atom', payload: '(' }, rparen: { kind: 'atom', payload: ')' },
  pi: { kind: 'atom', payload: 'pi' }, percent: { kind: 'atom', payload: '%' },
  eex: { kind: 'atom', payload: '*' }, // EE：作为 ×10^ 由 app 展开，见下
  sin: { kind: 'atom', payload: 'sin(' }, cos: { kind: 'atom', payload: 'cos(' },
  tan: { kind: 'atom', payload: 'tan(' }, ln: { kind: 'atom', payload: 'ln(' },
  sqrt: { kind: 'atom', payload: 'sqrt(' },
  square: { kind: 'func', payload: 'square' },
  ans: { kind: 'ans' }, ac: { kind: 'clear' }, back: { kind: 'backspace' },
  left: { kind: 'left' }, right: { kind: 'right' },
  undo: { kind: 'undo' }, redo: { kind: 'redo' }, equals: { kind: 'equals' },
  deg: { kind: 'toggleAngle' }, shift: { kind: 'toggleShift' },
  history: { kind: 'history' }, sto: { kind: 'sto' },
  varX: { kind: 'atom', payload: 'X' },
  // 占位
  mathUp: { kind: 'placeholder' }, mathDown: { kind: 'placeholder' },
  math: { kind: 'placeholder' }, fxs: { kind: 'placeholder' },
  grp: { kind: 'placeholder' }, comma: { kind: 'placeholder' },
  eng: { kind: 'placeholder' },
};

export const KEYBOARD = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': 'dot',
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow',
  '(': 'lparen', ')': 'rparen', '%': 'percent',
  'Enter': 'equals', '=': 'equals', 'Backspace': 'back',
  'ArrowLeft': 'left', 'ArrowRight': 'right', 'Escape': 'ac',
};
```

- [ ] **Step 4: 运行验证通过**

Run: 浏览器打开 `tests/test.html`
Expected: 5 条 PASS

- [ ] **Step 5: Commit**

```bash
git add js/keymap.js tests/test.html
git commit -m "feat: add keymap for buttons and physical keyboard"
```

---

### Task 11: index.html（DOM 骨架）

**Files:**
- Create: `index.html`

**说明：** 静态结构，按截图布局：顶部状态栏（DEG/RAD 徽标 + 时钟位省略）、显示区（算式行 + 结果行 + 光标）、历史面板（默认隐藏）、按钮网格。每个按钮带 `data-id`（对应 keymap 的 buttonId）。此 Task 只出结构，样式在 Task 12、行为在 Task 13。**无独立自动化测试**，验收=浏览器打开结构完整、无控制台报错。

**Interfaces:**
- Produces DOM 契约（app.js 依赖这些选择器）：
  - `#badge`（角度模式徽标，文本 DEG/RAD）
  - `#expr`（算式显示容器，app 渲染 atoms + 光标）
  - `#result`（结果/错误显示）
  - `#history-panel`（历史面板容器）、`#history-list`（列表）、`#history-close`
  - 所有按钮 `<button class="key" data-id="...">`；占位键额外加 `data-placeholder`（仅样式区分，可选）
  - `<script type="module" src="js/app.js">`；SW 注册脚本

- [ ] **Step 1: 写 index.html**

```html
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#000000">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <title>Calculator</title>
</head>
<body>
  <div id="calc">
    <header id="statusbar">
      <span id="badge" class="badge">DEG</span>
    </header>

    <section id="display">
      <div id="expr" aria-label="expression"></div>
      <div id="result"></div>
    </section>

    <div id="history-panel" hidden>
      <div class="history-head">
        <span>History</span>
        <button id="history-close" type="button">✕</button>
      </div>
      <ul id="history-list"></ul>
    </div>

    <div id="toast" class="toast" hidden></div>

    <section id="keypad">
      <!-- 功能行 1 -->
      <button class="key fn shift" data-id="shift" type="button">Shift</button>
      <button class="key fn" data-id="redo" type="button">↷</button>
      <button class="key fn" data-id="mathUp" data-placeholder type="button">∧</button>
      <button class="key fn" data-id="undo" type="button">↶</button>
      <button class="key fn danger" data-id="back" type="button">⌫</button>
      <!-- 功能行 2 -->
      <button class="key fn danger" data-id="ac" type="button">AC</button>
      <button class="key fn" data-id="left" type="button">‹</button>
      <button class="key fn" data-id="math" data-placeholder type="button">MATH</button>
      <button class="key fn" data-id="right" type="button">›</button>
      <button class="key fn" data-id="history" type="button">↺</button>
      <!-- 功能行 3 -->
      <button class="key fn" data-id="fxs" data-placeholder type="button">FXs</button>
      <button class="key fn" data-id="grp" data-placeholder type="button">GRP</button>
      <button class="key fn" data-id="mathDown" data-placeholder type="button">∨</button>
      <button class="key fn" data-id="comma" data-placeholder type="button">, ,</button>
      <button class="key fn" data-id="sto" type="button">STO</button>
      <!-- 科学函数行 1 -->
      <button class="key sci" data-id="pi" type="button">π</button>
      <button class="key sci" data-id="ln" type="button">Ln</button>
      <button class="key sci" data-id="sin" type="button">Sin</button>
      <button class="key sci" data-id="cos" type="button">Cos</button>
      <button class="key sci" data-id="tan" type="button">Tan</button>
      <!-- 科学函数行 2 -->
      <button class="key sci" data-id="varX" type="button">X</button>
      <button class="key sci" data-id="square" type="button">X²</button>
      <button class="key sci" data-id="sqrt" type="button">√</button>
      <button class="key sci" data-id="lparen" type="button">(</button>
      <button class="key sci" data-id="rparen" type="button">)</button>
      <!-- 数字区 -->
      <button class="key num" data-id="7" type="button">7</button>
      <button class="key num" data-id="8" type="button">8</button>
      <button class="key num" data-id="9" type="button">9</button>
      <button class="key op" data-id="mul" type="button">×</button>
      <button class="key op" data-id="div" type="button">÷</button>

      <button class="key num" data-id="4" type="button">4</button>
      <button class="key num" data-id="5" type="button">5</button>
      <button class="key num" data-id="6" type="button">6</button>
      <button class="key op" data-id="add" type="button">+</button>
      <button class="key op" data-id="sub" type="button">−</button>

      <button class="key num" data-id="1" type="button">1</button>
      <button class="key num" data-id="2" type="button">2</button>
      <button class="key num" data-id="3" type="button">3</button>
      <button class="key num" data-id="ans" type="button">Ans</button>
      <button class="key equals" data-id="equals" type="button" style="grid-row: span 2;">=</button>

      <button class="key num" data-id="0" type="button">0</button>
      <button class="key num" data-id="dot" type="button">.</button>
      <button class="key sci" data-id="eex" type="button">EE</button>
      <button class="key sci" data-id="pow" type="button">xⁿ</button>
    </section>
  </div>

  <script type="module" src="js/app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: 浏览器验证结构**

Run: `python3 -m http.server 8000` 后访问 `http://localhost:8000/`
Expected: 页面出现所有按钮，控制台仅可能报 `app.js`/`sw.js` 尚未创建的 404（下个 Task 补），无结构错误。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add calculator DOM structure"
```

---

### Task 12: styles.css（视觉还原）

**Files:**
- Create: `styles.css`

**说明：** 按截图 1:1 深色主题。5 列按钮网格；显示区占上方；数字键浅灰立体块；Shift 黄、AC/退格红、箭头蓝、`=` 高键跨 2 行。移动竖屏优先，桌面限制最大宽度居中。**无自动化测试**，验收=浏览器目视接近截图。

**Interfaces:** 消费 Task 11 的 class/id；提供 `.badge.rad`（RAD 态红色）、`.key.active`（Shift 激活提示）、`.toast.show` 等由 app.js 切换的类。

- [ ] **Step 1: 写 styles.css**

```css
:root {
  --bg: #000; --panel: #0a0a0a; --key: #1c1c1e; --key-num: #2a2a2c;
  --text: #fff; --muted: #8a8a8e; --yellow: #f5c518; --red: #ff453a;
  --blue: #0a84ff; --equals: #2a2a2c;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; background: var(--bg); color: var(--text);
  font-family: -apple-system, system-ui, sans-serif; overflow: hidden; }
#calc { display: flex; flex-direction: column; height: 100vh;
  max-width: 480px; margin: 0 auto; position: relative; }

#statusbar { padding: 10px 14px; }
.badge { background: var(--blue); color: #fff; font-size: 12px; font-weight: 700;
  padding: 2px 8px; border-radius: 6px; letter-spacing: 1px; }
.badge.rad { background: var(--red); }

#display { flex: 1; display: flex; flex-direction: column; justify-content: flex-start;
  align-items: flex-end; padding: 16px; overflow: hidden; }
#expr { font-size: 32px; line-height: 1.4; word-break: break-all; text-align: right;
  min-height: 44px; width: 100%; }
#expr .cursor { display: inline-block; width: 2px; height: 32px; background: var(--text);
  vertical-align: middle; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
#result { font-size: 24px; color: var(--muted); margin-top: 12px; }
#result.error { color: var(--red); }

#keypad { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
  background: #111; padding: 1px; }
.key { border: none; background: var(--key); color: var(--text); font-size: 22px;
  padding: 16px 0; cursor: pointer; user-select: none; transition: background .08s; }
.key:active { background: #333; }
.key.fn { font-size: 15px; color: var(--muted); background: var(--panel); }
.key.sci { font-size: 18px; background: #141416; }
.key.num { background: var(--key-num); font-size: 24px; }
.key.op { font-size: 24px; }
.key.equals { background: var(--equals); font-size: 26px; }
.key.shift { color: var(--yellow); font-weight: 700; }
.key.danger { color: var(--red); }
.key.active { outline: 2px solid var(--yellow); outline-offset: -2px; }
.key[data-id="left"], .key[data-id="right"], .key[data-id="redo"], .key[data-id="undo"] { color: var(--blue); }

#history-panel { position: absolute; inset: 0; background: rgba(0,0,0,.96); z-index: 10;
  display: flex; flex-direction: column; }
.history-head { display: flex; justify-content: space-between; align-items: center;
  padding: 14px; border-bottom: 1px solid #222; }
#history-close { background: none; border: none; color: var(--text); font-size: 20px; }
#history-list { list-style: none; overflow-y: auto; flex: 1; }
#history-list li { padding: 12px 14px; border-bottom: 1px solid #1a1a1a; cursor: pointer; }
#history-list li:active { background: #1a1a1a; }
#history-list .h-expr { font-size: 16px; }
#history-list .h-res { font-size: 14px; color: var(--muted); text-align: right; }

.toast { position: absolute; bottom: 40%; left: 50%; transform: translateX(-50%);
  background: rgba(60,60,60,.95); color: #fff; padding: 10px 18px; border-radius: 20px;
  font-size: 14px; z-index: 20; opacity: 0; transition: opacity .2s; pointer-events: none; }
.toast.show { opacity: 1; }
```

- [ ] **Step 2: 浏览器目视验证**

Run: `python3 -m http.server 8000` 访问首页
Expected: 布局、配色接近截图；Shift 黄、AC 红、`=` 跨两行。

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add dark calculator theme matching mockup"
```

---

### Task 13: app.js（渲染 + 事件 + 协调）

**Files:**
- Create: `js/app.js`
- Test: 手动交互验收（引擎/模型已被前面单测覆盖；此层为 DOM 粘合）

**Interfaces:**
- Consumes: `Editor`(tokens), `AppState`(state), `Store`(history), `evaluate`(engine), `ACTIONS`/`KEYBOARD`(keymap)
- 行为规格：
  - **渲染算式**：把 `editor.atoms` 映射为显示符号（`*`→`×`,`/`→`÷`,`sin(`→`sin(`,`pi`→`π`,`sqrt(`→`√(`,`^`→`^`,`%`→`%`），在 `editor.cursor` 位置插入 `<span class="cursor">`。
  - **dispatch(id)**：查 `ACTIONS[id]` 按 kind 执行：
    - `digit`→`editor.insertDigit`；`atom`→`editor.insertAtom`；`func:square`→`insertAtom('^'); insertAtom('2')`；
    - `ans`→`insertAtom('Ans')`；`backspace/clear/left/right/undo/redo`→ 对应 editor 方法；
    - `equals`→ 取 `editor.atoms` 调 `engine.evaluate(atoms, ctx)`，`ctx={angleMode, ans, vars}`。ok 则显示 `display`、`state.ans=value`、`store.addHistory`、结果行去 error 类；否则结果行显示 `error` 文案 + error 类，**保留算式**。
    - `toggleAngle`→ `state.toggleAngleMode()` 并更新 `#badge` 文本与 `.rad` 类；
    - `toggleShift`→ `state.toggleShift()`，切换 Shift 键 `.active`；
    - `history`→ 打开面板并渲染 `store.history`（每条点后 `editor.setAtoms(item.atoms)` 并关面板）；
    - `sto`→ 简化实现：`prompt` 选变量名（A–Z 单字母），把当前结果或当前表达式求值后 `store.setVar`；无有效值则 toast 提示；
    - `placeholder`→ `showToast('该功能暂未开放')`。
  - **每次 dispatch 后重渲染**，并（除 toggleShift 外）在数字/atom 输入后自动 `state.clearShift()`。
  - **物理键盘**：`keydown` 时用 `KEYBOARD[e.key]` 找 id，命中则 `preventDefault()` 并 `dispatch(id)`。
  - **toast(msg)**：设 `#toast` 文本、加 `.show`、`setTimeout` 1200ms 去掉（复用单一计时器，重入清旧计时器）。

- [ ] **Step 1: 写 app.js**

```javascript
// js/app.js
import { Editor } from './tokens.js';
import { AppState } from './state.js';
import { Store } from './history.js';
import { evaluate } from './engine.js';
import { ACTIONS, KEYBOARD } from './keymap.js';

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
  const action = ACTIONS[id];
  if (!action) return;
  switch (action.kind) {
    case 'digit': editor.insertDigit(action.payload); break;
    case 'atom': editor.insertAtom(action.payload); break;
    case 'func': if (action.payload === 'square') { editor.insertAtom('^'); editor.insertAtom('2'); } break;
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
```

- [ ] **Step 2: 手动交互验收清单**

Run: `python3 -m http.server 8000` 访问首页，依次验证：
Expected:
  - 输入 `2 + 3 × 4` 按 `=` → 结果 `14`
  - `sin( 3 0 )` 按 `=`（DEG）→ `0.5`；点徽标切 RAD，`sin( pi / 6 )` → `0.5`
  - `1 / 0 =` → 结果行红色 `Math Error`，算式保留
  - `( 2 =` → `Syntax Error`
  - 方向键/`‹``›` 移光标中间插入生效；`⌫` 删除；`↶`/`↷` 撤销重做
  - 点占位键（MATH/FXs/GRP 等）→ 弹「该功能暂未开放」toast
  - 算完点 `↺` 历史，点条目回填算式
  - 刷新页面后历史仍在（localStorage）
  - 物理键盘数字、`+-*/`、回车、退格、方向键均可用

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up UI, keyboard, history, and STO"
```

---

### Task 14: PWA 清单 + service worker + 图标

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`（生成占位图标）

**Interfaces:** manifest 相对路径；sw cache-first，版本常量 `CACHE = 'calc-v1'` 缓存全部静态资源。

- [ ] **Step 1: 写 manifest.webmanifest**

```json
{
  "name": "Scientific Calculator",
  "short_name": "Calc",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: 写 sw.js**

```javascript
const CACHE = 'calc-v1';
const ASSETS = [
  './', './index.html', './styles.css',
  './js/app.js', './js/tokens.js', './js/state.js', './js/history.js',
  './js/engine.js', './js/lexer.js', './js/parser.js', './js/evaluator.js',
  './js/formatter.js', './js/keymap.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

- [ ] **Step 3: 生成占位图标**

Run（无需 Python 库，用最小合法 PNG 或 ImageMagick；若无 ImageMagick 用下面的 Python）:
```bash
python3 - << 'PY'
import struct, zlib
def png(path, size, rgb=(10,132,255)):
    w=h=size
    raw=bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw += bytes(rgb)
    def chunk(t,d):
        c=struct.pack('>I',len(d))+t+d
        return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    sig=b'\x89PNG\r\n\x1a\n'
    ihdr=struct.pack('>IIBBBBB',w,h,8,2,0,0,0)
    idat=zlib.compress(bytes(raw),9)
    open(path,'wb').write(sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',idat)+chunk(b'IEND',b''))
import os; os.makedirs('icons',exist_ok=True)
png('icons/icon-192.png',192); png('icons/icon-512.png',512)
print('icons written')
PY
```
Expected: `icons/icon-192.png`、`icons/icon-512.png` 生成。（后续可替换为设计图标。）

- [ ] **Step 4: 验证 PWA 可安装 + 离线**

Run: `python3 -m http.server 8000` 访问首页；打开 DevTools → Application → Manifest 无错误、Service Worker 已激活；勾选 Offline 后刷新仍可用。
Expected: 离线可加载并计算。

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest sw.js icons/
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

### Task 15: README + 部署到 GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README.md**

````markdown
# Scientific Calculator PWA

离线可用的科学计算器单页应用。纯静态、零依赖、零构建。

## 本地运行
```bash
python3 -m http.server 8000
# 访问 http://localhost:8000/
```
（必须经 HTTP 服务，`file://` 下 ES modules 与 service worker 不生效。）

## 运行测试
浏览器打开 `tests/test.html`，查看 PASS/FAIL 汇总。

## 部署到 GitHub Pages
1. 推送到 GitHub 仓库。
2. Settings → Pages → Source 选目标分支、目录 `/ (root)`。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。

因所有路径为相对路径，子路径部署无需改配置。

## 安装为手机 PWA
用手机浏览器打开线上地址 → 菜单「添加到主屏幕」。

## 功能
四则运算、括号、π/e、Ln、Sin/Cos/Tan（DEG/RAD 可切换）、√、x²、xⁿ、EE、百分比、Ans、STO 变量、历史记录（持久化、可点击复用）、撤销/重做、行内光标编辑、物理键盘支持。
````

- [ ] **Step 2: 最终自检 + 提交**

Run: 浏览器打开 `tests/test.html` 确认全部 PASS；首页手动验收清单（Task 13 Step 2）全过。
Expected: 全绿。

```bash
git add README.md
git commit -m "docs: add README with deploy and usage instructions"
```

- [ ] **Step 3: Push 到远程**（用户已配置带 token 的 origin）

Run:
```bash
git push -u origin HEAD
```
Expected: 推送成功。（如需回显远程地址，token 部分打码为首尾各 1 位。）

---

## Self-Review

**Spec coverage：**
- 范围 B、DEG 默认可切换、localStorage 持久化、历史可点击复用、多文件无构建、行内编辑、物理键盘、错误方案 A、12 位有效数字+毛刺清理、占位 toast、乘除符号、PWA/离线/部署 —— 均有对应 Task（引擎 T2-6、编辑 T7、状态 T9、持久化 T8、UI/交互 T10-13、PWA T14、部署 T15）。✅
- `xⁿ`（pow）、`x²`（square 展开）、EE、%、Ans、STO 均在 keymap(T10)/app(T13) 覆盖。✅

**Placeholder scan：** 无 TBD/TODO；所有代码步骤含完整代码。✅

**Type consistency：**
- `evaluate` 命名：evaluator 导出 `evaluate(ast, ctx)`；engine 以 `evalAst` 别名导入，自身导出 `evaluate(atoms, ctx)`；app 从 engine 导入 `evaluate`。一致。✅
- ctx 形状 `{angleMode, ans, vars}` 在 evaluator/engine/app 一致。✅
- Editor 方法名（insertAtom/insertDigit/backspace/moveLeft/moveRight/clear/setAtoms/undo/redo、getter atoms/cursor）在 T7 定义、T13 调用一致。✅
- Store 方法（addHistory/getVar/setVar、getter history/vars）T8 定义、T13 调用一致。✅
- ACTIONS buttonId 与 index.html 的 data-id 对齐（含占位键）。✅

无遗留问题。
