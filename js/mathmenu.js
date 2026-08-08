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
