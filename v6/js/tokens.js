// js/tokens.js
const isNumAtom = (s) => /^\d*\.?\d*$/.test(s) && s !== '';

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
}
