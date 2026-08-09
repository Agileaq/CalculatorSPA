// js/formatter.js
export function formatNumber(n) {
  if (n === 0) return '0';              // 同时处理 -0
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) {
    // 科学计数：12 位有效数字，去尾零
    let s = n.toExponential(11);
    s = s.replace(/\.?0+e/, 'e');       // 去尾零
    return s;
  }
  // 常规：先按 12 位有效数字定形，再解析回数字去毛刺与末尾零
  const rounded = Number(n.toPrecision(12));
  let s = String(rounded);
  if (s.includes('e')) {                // String() 对 |n|<1e-6 会用指数，需展开为普通小数
    const k = Math.floor(Math.log10(Math.abs(rounded)));
    const digits = Math.min(100, 11 - k); // 保留到第 12 位有效数字
    s = rounded.toFixed(digits).replace(/\.?0+$/, '');
  }
  return s;
}
