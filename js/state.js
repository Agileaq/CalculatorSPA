// js/state.js
export class AppState {
  constructor() { this._angle = 'DEG'; this._shift = false; this._ans = 0; this._recall = null; }
  get angleMode() { return this._angle; }
  toggleAngleMode() { this._angle = this._angle === 'DEG' ? 'RAD' : 'DEG'; }
  get shift() { return this._shift; }
  toggleShift() { this._shift = !this._shift; }
  clearShift() { this._shift = false; }
  get ans() { return this._ans; }
  set ans(v) { this._ans = v; }

  // History recall cursor: null = not replaying, otherwise an index into store.history.
  // Entering recall (pressing ∧) sets it to 0 (newest entry); pressing ∨ past newest sets it to null.
  get recall() { return this._recall; }
  set recall(v) { this._recall = v; }
  resetRecall() { this._recall = null; }
}
