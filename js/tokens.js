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
