// js/formatter.js
export function formatNumber(n) {
  if (n === 0) return '0';              // also handles -0
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) {
    // scientific: 12 significant digits, strip trailing zeros
    let s = n.toExponential(11);
    s = s.replace(/\.?0+e/, 'e');       // strip trailing zeros
    return s;
  }
  // normal: first shape to 12 significant digits, then parse back to clean float glitches and trailing zeros
  const rounded = Number(n.toPrecision(12));
  let s = String(rounded);
  if (s.includes('e')) {                // String() uses exponent for |n|<1e-6; expand to plain decimal
    const k = Math.floor(Math.log10(Math.abs(rounded)));
    const digits = Math.min(100, 11 - k); // keep to the 12th significant digit
    s = rounded.toFixed(digits).replace(/\.?0+$/, '');
  }
  return s;
}
