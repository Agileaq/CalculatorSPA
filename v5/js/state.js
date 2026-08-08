// js/state.js
export class AppState {
  constructor() { this._angle = 'DEG'; this._shift = false; this._ans = 0; }
  get angleMode() { return this._angle; }
  toggleAngleMode() { this._angle = this._angle === 'DEG' ? 'RAD' : 'DEG'; }
  get shift() { return this._shift; }
  toggleShift() { this._shift = !this._shift; }
  clearShift() { this._shift = false; }
  get ans() { return this._ans; }
  set ans(v) { this._ans = v; }
}
