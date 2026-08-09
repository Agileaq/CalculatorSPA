// js/evaluator.js
export class CalcError extends Error {}

const toRad = (x, mode) => (mode === 'DEG' ? (x * Math.PI) / 180 : x);
const fromRad = (x, mode) => (mode === 'DEG' ? (x * 180) / Math.PI : x);

export function evaluate(node, ctx) {
  const n = evalNode(node, ctx);
  if (!Number.isFinite(n)) throw new CalcError('Math Error');
  return n === 0 ? 0 : n; // normalize -0
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
        case 'nCr': return nCr(a, b);
        case 'nPr': return nPr(a, b);
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
        case 'log': if (x <= 0) throw new CalcError('Math Error'); return Math.log10(x);
        case 'asin': if (x < -1 || x > 1) throw new CalcError('Math Error'); return fromRad(Math.asin(x), ctx.angleMode);
        case 'acos': if (x < -1 || x > 1) throw new CalcError('Math Error'); return fromRad(Math.acos(x), ctx.angleMode);
        case 'atan': return fromRad(Math.atan(x), ctx.angleMode);
        case 'cbrt': return Math.cbrt(x);
        case 'abs': return Math.abs(x);
      }
    }
  }
  throw new CalcError('Syntax Error');
}

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
