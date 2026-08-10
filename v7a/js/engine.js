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
    const isMathError =
      (e instanceof CalcError && e.message === 'Math Error') ||
      e.message === 'Math Error';
    return { ok: false, error: isMathError ? 'Math Error' : 'Syntax Error' };
  }
}
