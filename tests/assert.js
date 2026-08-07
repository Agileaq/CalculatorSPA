const cases = [];
export function test(name, fn) { cases.push({ name, fn }); }

export function assertEqual(actual, expected, msg = '') {
  if (!Object.is(actual, expected)) {
    throw new Error(`${msg} expected ${String(expected)} but got ${String(actual)}`);
  }
}

export function assertClose(actual, expected, eps = 1e-9, msg = '') {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > eps) {
    throw new Error(`${msg} expected ~${expected} but got ${String(actual)}`);
  }
}

export function assertThrows(fn, expectedMessage, msg = '') {
  let threw = false;
  try { fn(); } catch (e) {
    threw = true;
    if (expectedMessage && e.message !== expectedMessage) {
      throw new Error(`${msg} expected throw "${expectedMessage}" but got "${e.message}"`);
    }
  }
  if (!threw) throw new Error(`${msg} expected function to throw`);
}

export function runAll() {
  let pass = 0, fail = 0;
  const out = document.createElement('pre');
  for (const c of cases) {
    try { c.fn(); pass++; out.innerHTML += `<span style="color:#3c3">PASS</span> ${c.name}\n`; }
    catch (e) { fail++; out.innerHTML += `<span style="color:#f55">FAIL</span> ${c.name}: ${e.message}\n`; }
  }
  out.innerHTML += `\n${pass} passed, ${fail} failed`;
  document.body.appendChild(out);
  console.log(`${pass} passed, ${fail} failed`);
}
