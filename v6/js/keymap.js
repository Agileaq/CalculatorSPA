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
  eex: { kind: 'func', payload: 'eex' }, // EE: expanded by app into ×10^
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
  math: { kind: 'math' },
  // Keys flanking MATH: history recall (∧ older, ∨ newer)
  mathUp: { kind: 'historyUp' }, mathDown: { kind: 'historyDown' },
  fxs: { kind: 'placeholder' },
  grp: { kind: 'placeholder' }, comma: { kind: 'placeholder' },
  eng: { kind: 'placeholder' },
};

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

export const KEYBOARD = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': 'dot',
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow',
  '(': 'lparen', ')': 'rparen', '%': 'percent',
  'Enter': 'equals', '=': 'equals', 'Backspace': 'back',
  'ArrowLeft': 'left', 'ArrowRight': 'right', 'Escape': 'ac',
  'ArrowUp': 'mathUp', 'ArrowDown': 'mathDown',
};
