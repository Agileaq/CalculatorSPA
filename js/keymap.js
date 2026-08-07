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
  eex: { kind: 'func', payload: 'eex' }, // EE：由 app 展开为 ×10^
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

export const SHIFT_ACTIONS = {
  '0': { kind: 'atom', payload: '%' },
  eex: { kind: 'func', payload: 'epow' },
};

export const KEYBOARD = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': 'dot',
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow',
  '(': 'lparen', ')': 'rparen', '%': 'percent',
  'Enter': 'equals', '=': 'equals', 'Backspace': 'back',
  'ArrowLeft': 'left', 'ArrowRight': 'right', 'Escape': 'ac',
};
