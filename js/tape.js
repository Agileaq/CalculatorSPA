// js/tape.js
// 磁带显示模型（DOM-free 纯函数）。
// history 为 newest-first（见 history.js），每条含单调递增 ts。
// baselineTs = 启动时的最大 ts；ts>baseline 为本次会话新算，ts<=baseline 为旧历史。
// 返回从上到下（oldest-first）的显示顺序。
export function buildTape(history, baselineTs, showOlder) {
  const session = history.filter((h) => h.ts > baselineTs);
  const older = history.filter((h) => h.ts <= baselineTs);
  const oldestFirst = (arr) => arr.slice().reverse();
  return showOlder
    ? [...oldestFirst(older), ...oldestFirst(session)]
    : oldestFirst(session);
}
