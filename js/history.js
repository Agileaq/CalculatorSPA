// js/history.js
const K_HIST = 'calc.history', K_VARS = 'calc.vars', K_SEQ = 'calc.seq';
const MAX = 100;

export class Store {
  constructor(storage = localStorage) {
    this._s = storage;
    this._history = this._load(K_HIST, []);
    this._vars = this._load(K_VARS, {});
    this._seq = Number(this._s.getItem(K_SEQ) || 0);
  }
  _load(key, fallback) {
    try { const raw = this._s.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  _save(key, val) { this._s.setItem(key, JSON.stringify(val)); }

  get history() { return this._history.slice(); }
  addHistory(atoms, display) {
    this._seq++; this._s.setItem(K_SEQ, this._seq);
    this._history.unshift({ atoms: atoms.slice(), display, ts: this._seq });
    if (this._history.length > MAX) this._history.length = MAX;
    this._save(K_HIST, this._history);
  }

  get vars() { return { ...this._vars }; }
  getVar(name) { return this._vars[name] ?? 0; }
  setVar(name, value) { this._vars[name] = value; this._save(K_VARS, this._vars); }
}
