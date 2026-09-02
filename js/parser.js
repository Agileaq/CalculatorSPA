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
    let node = parseCombi();
    while (peek() && peek().type === T.OP && (peek().value === '*' || peek().value === '/' || peek().value === 'Mod')) {
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
  function parseUnary() {
    if (peek() && peek().type === T.OP && peek().value === '-') {
      next(); return { kind: 'unary', op: '-', operand: parseUnary() };
    }
    return parsePow();
  }
  function parsePow() {
    const base = parsePostfix();
    if (peek() && peek().type === T.OP && peek().value === '^') {
      next(); return { kind: 'binary', op: '^', left: base, right: parseUnary() }; // right-associative
    }
    return base;
  }
  function parsePostfix() {
    let node = parsePrimary();
    while (peek() && (peek().type === T.PERCENT || peek().type === T.FACT)) {
      if (peek().type === T.PERCENT) { next(); node = { kind: 'percent', operand: node }; }
      else { next(); node = { kind: 'fact', operand: node }; }
    }
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
  if (pos !== tokens.length) err(); // leftover tokens = syntax error
  return result;
}
