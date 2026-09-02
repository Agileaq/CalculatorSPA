// js/tokens.js
const isNumAtom = (s) => /^\d*\.?\d*$/.test(s) && s !== '';
// toggleSign 分支1 的操作数判定：数字、变量(A-Z)、常量(pi/e)、Ans。
const OPERAND_CONST = new Set(['pi', 'e', 'Ans']);
const isOperandAtom = (s) => isNumAtom(s) || OPERAND_CONST.has(s) || /^[A-Z]$/.test(s);

// Cursor model: (cursor, offset).
//  cursor = atom index ∈ [0, atoms.length]; insert point sits before atoms[cursor].
//  offset = char offset within atoms[cursor] when it's a number; 0 when between atoms.
// Canonical form: (k,0) = boundary between atom k-1 and k; (k,o) with 0<o<len and
//  isNumAtom(atoms[k]) = interior of number atom k; (len,0) = end of expression.
//  Right edge of atom k canonicalizes to (k+1,0) — offset is never a full atom's length,
//  and a 1-char number atom has no interior (crossed in one move step).
export class Editor {
  constructor() { this._atoms = []; this._cursor = 0; this._offset = 0; this._undo = []; this._redo = []; }
  get atoms() { return this._atoms.slice(); }
  get cursor() { return this._cursor; }
  get offset() { return this._offset; }

  _snapshot() {
    this._undo.push({ atoms: this._atoms.slice(), cursor: this._cursor, offset: this._offset });
    this._redo = [];
  }

  insertAtom(atom) {
    if (this._offset > 0) {                                // split a number at the cursor
      this._snapshot();
      const a = this._atoms[this._cursor];
      const left = a.slice(0, this._offset);
      const right = a.slice(this._offset);                 // non-empty: offset < len
      this._atoms.splice(this._cursor, 1, left, atom, right);
      this._cursor += 2;                                    // between atom and right
      this._offset = 0;
      return;
    }
    this._snapshot();
    this._atoms.splice(this._cursor, 0, atom);
    this._cursor++;
    // offset stays 0
  }

  // 批量插入：把一串原子按顺序插到当前光标处（复用 insertAtom 的数字分裂/合并逻辑）。
  insertAtoms(atoms) { for (const a of atoms) this.insertAtom(a); }

  insertDigit(ch) {
    const a = this._atoms[this._cursor];
    if (this._offset > 0) {                                // inside a number
      if (ch === '.' && a.includes('.')) return;           // refuse duplicate dot (no snapshot)
      this._snapshot();
      this._atoms[this._cursor] = a.slice(0, this._offset) + ch + a.slice(this._offset);
      this._offset++;
      return;
    }
    // offset === 0: existing logic unchanged
    const left = this._atoms[this._cursor - 1];
    const right = this._atoms[this._cursor];
    this._snapshot();
    if (this._cursor > 0 && left !== undefined && isNumAtom(left) &&
        !(ch === '.' && left.includes('.'))) {
      this._atoms[this._cursor - 1] = left + ch;
    } else if (right !== undefined && isNumAtom(right) &&
               !(ch === '.' && right.includes('.'))) {
      this._atoms[this._cursor] = ch + right; // prepend and merge into right number; cursor stays
    } else {
      this._atoms.splice(this._cursor, 0, ch);
      this._cursor++;
    }
    // offset stays 0
  }

  backspace() {
    if (this._offset > 0) {
      this._snapshot();
      const a = this._atoms[this._cursor];
      const na = a.slice(0, this._offset - 1) + a.slice(this._offset);
      if (na === '') { this._atoms.splice(this._cursor, 1); this._cursor--; this._offset = 0; }
      else { this._atoms[this._cursor] = na; this._offset--; }
      return;
    }
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
    // offset stays 0
  }

  moveLeft() {
    if (this._offset > 0) { this._offset--; return; }
    if (this._cursor === 0) return;
    this._cursor--;
    const a = this._atoms[this._cursor];
    this._offset = isNumAtom(a) ? a.length - 1 : 0;
  }
  moveRight() {
    const a = this._atoms[this._cursor];
    if (a !== undefined && isNumAtom(a) && this._offset < a.length - 1) { this._offset++; return; }
    if (this._cursor < this._atoms.length) { this._cursor++; this._offset = 0; }
  }
  // Absolute cursor move (touch-to-position). No snapshot, like moveLeft/moveRight.
  // setCursor(i) ⟹ setCursor(i, 0) — backward compatible with atom-boundary callers.
  setCursor(i, o = 0) {
    i = Math.max(0, Math.min(this._atoms.length, i));
    if (i === this._atoms.length) { this._cursor = i; this._offset = 0; return; }
    const a = this._atoms[i];
    if (!isNumAtom(a)) { this._cursor = i; this._offset = 0; return; }
    o = Math.max(0, Math.min(a.length, o));
    if (o === a.length) { this._cursor = i + 1; this._offset = 0; } // right edge → (i+1, 0)
    else { this._cursor = i; this._offset = o; }
  }

  clear() { this._snapshot(); this._atoms = []; this._cursor = 0; this._offset = 0; }

  setAtoms(arr) { this._snapshot(); this._atoms = arr.slice(); this._cursor = this._atoms.length; this._offset = 0; }

  undo() {
    if (!this._undo.length) return;
    this._redo.push({ atoms: this._atoms.slice(), cursor: this._cursor, offset: this._offset });
    const s = this._undo.pop();
    this._atoms = s.atoms; this._cursor = s.cursor; this._offset = s.offset;
  }
  redo() {
    if (!this._redo.length) return;
    this._undo.push({ atoms: this._atoms.slice(), cursor: this._cursor, offset: this._offset });
    const s = this._redo.pop();
    this._atoms = s.atoms; this._cursor = s.cursor; this._offset = s.offset;
  }

  // 符号翻转 ( +/- 键 )。基于光标左侧上下文分三支，统一用 (-x) 包裹/剥离，永不裸拼接 -。
  //  1) 左侧是数字/变量/常量/Ans：包裹成 (-x)；若已是 (-x) 则剥离还原。
  //  2) 左侧是 )：括号匹配，包裹整个块为 (-(...))；若已是 (-(...)) 则剥离还原。
  //  3) 左侧是运算符或空(光标在最前)：插入 (-0)，光标落在 0 与 ) 之间（语法树时刻合法）。
  toggleSign() {
    // --- 分支2：光标紧邻 ) 之前（在某个 ) 后，且 ) 之前是合法表达式闭合）---
    // 先检测"已包裹"形态 (-(...)) 以便剥离；否则做包裹。
    if (this._offset === 0 && this._cursor > 0 && this._atoms[this._cursor - 1] === ')') {
      // 堆栈向左平衡，找到匹配的 ( 的索引 i
      let depth = 0, i = -1;
      for (let k = this._cursor - 1; k >= 0; k--) {
        const a = this._atoms[k];
        if (a === ')') depth++;
        else if (a === '(') { depth--; if (depth === 0) { i = k; break; } }
      }
      if (i >= 0) {
        // 检测已包裹 (-(...))：外层 ( 在 i，其紧后是 -（即 atoms[i+1]==='-'），内部块为 (...)。
        // 例：[2, *, (, -, (, 3, +, 5, ), )] 中匹配到外层 ( 在 i=2，atoms[3]==='-'。
        if (i + 1 < this._atoms.length && this._atoms[i + 1] === '-') {
          // 剥离外层 (,-,...,)：删 i 处的 ( 和 i+1 处的 -，再删末尾 )（在 _cursor-1，删两个后→_cursor-3）
          this._snapshot();
          this._atoms.splice(i, 2);                       // 删外层 ( 和 -
          this._atoms.splice(this._cursor - 3, 1);        // 删外层 )
          this._cursor -= 3;
          return;
        }
        // 包裹为 (-(...))：在 i 处插入 (,-；在 _cursor(原 ) 后) 追加 )
        this._snapshot();
        this._atoms.splice(i, 0, '(', '-');
        this._atoms.splice(this._cursor + 2, 0, ')');   // +2 因前面插了两个
        this._cursor += 3;
        return;
      }
      // i<0 括号不平衡（由 autoCloseParens/引擎兜底）：退化到分支3
    }

    // --- 分支1：光标紧邻数字/变量/常量/Ans 之前 ---
    // 目标原子：光标在数字内(offset>0)→当前数字；否则 _cursor-1。
    let targetIdx = -1;
    if (this._offset > 0) {
      targetIdx = this._cursor;            // 光标在数字内部，目标即此数字
    } else if (this._cursor > 0) {
      const left = this._atoms[this._cursor - 1];
      if (isOperandAtom(left)) targetIdx = this._cursor - 1;
    }
    if (targetIdx >= 0) {
      const t = this._atoms[targetIdx];
      // 检测已包裹 (-t)：前两原子为 (,- 且后续对应 ) 紧跟
      if (targetIdx >= 2 && this._atoms[targetIdx - 1] === '-' && this._atoms[targetIdx - 2] === '('
          && this._atoms[targetIdx + 1] === ')') {
        // 剥离 (,-,t,) → t。需保留 targetIdx 的值，删 (-1,-2) 与 (+1)
        this._snapshot();
        const val = t;
        this._atoms.splice(targetIdx - 2, 3, val);     // 用 t 替换 (,-,t 三元
        this._atoms.splice(targetIdx - 1, 1);            // 删随后的 )
        this._cursor = targetIdx - 1; this._offset = 0;
        return;
      }
      // 包裹 t → (,-,t,)。在 targetIdx 插 (,-，在 targetIdx+1 追加 )
      this._snapshot();
      this._atoms.splice(targetIdx, 0, '(', '-');
      this._atoms.splice(targetIdx + 3, 0, ')');        // +2 因前面插了两个，再 +1 指向原 t 之后
      // 光标落在 t 与 ) 之间
      this._cursor = targetIdx + 3; this._offset = 0;
      return;
    }

    // --- 分支3：左侧是运算符或空 → 插入 (-0)，光标在 0 与 ) 之间 ---
    this._snapshot();
    this._atoms.splice(this._cursor, 0, '(', '-', '0', ')');
    this._cursor += 3;        // 在 0 之后、) 之前
    this._offset = 0;
  }
}

// 纯函数：补齐 atoms 中缺失的右括号（用于 = 提交前的容错）。只补 )，不插值。
export function autoCloseParens(atoms) {
  let depth = 0;
  for (const a of atoms) {
    if (a === '(') depth++;
    else if (a === ')') depth = Math.max(0, depth - 1);
  }
  if (depth <= 0) return atoms.slice();
  return [...atoms, ...Array(depth).fill(')')];
}
