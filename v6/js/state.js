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

  // 历史回溯光标：null 表示未在回溯中，否则指向 store.history 的索引
  // 进入回溯（按 ∧）时置为 0（最新条目）；按 ∨ 越过最新则置为 null
  get recall() { return this._recall; }
  set recall(v) { this._recall = v; }
  resetRecall() { this._recall = null; }
}
