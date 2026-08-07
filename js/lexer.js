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
