# Character-level cursor inside number atoms (drag/tap lands mid-number)

## Context

The drag-to-move-cursor feature (just shipped) only snaps to **atom boundaries**. Since adjacent digit chars merge into one atom, the expression `1234` is a single atom — so tapping between 2 and 3 jumps the cursor to before-1 or after-4, never between 2 and 3. The user wants the cursor to land exactly where they touch, including **inside** a multi-char number.

Splitting the atom is rejected: `["12","34"]` is lexer-evaluated as `12×34 = 408` (implicit multiply), so a pure cursor gesture would silently change the answer. **Approach: add a character offset to the cursor model so it can sit inside a number atom without splitting it.** The atom array is unchanged; only the cursor's "where within the current atom" is added. `setCursor` accepts an atom index + char offset; `app.js` hit-tests per character.

This design was validated against all 9 existing Editor tests by a Plan agent — they all still pass (they use offset 0, i.e. atom boundaries), conditional on the fixes below.

## Canonical form (invariant maintained by every mutator)

State: `_atoms[]`, `_cursor` (atom index ∈ `[0,len]`), `_offset` (char offset within `_atoms[_cursor]`).

- `(k, 0)` — boundary between atom k-1 and atom k (start when k=0, end when k=len).
- `(k, o)` with `0 < o < len(atoms[k])` AND `isNumAtom(atoms[k])` — interior of number atom k.
- `(len, 0)` — end of expression.
- **Forbidden:** `_offset > 0` when `atoms[_cursor]` is not a number; `_offset === len(atoms[_cursor])` (right edge canonicalizes to `(k+1, 0)`); `_offset < 0`.
- A 1-char number atom has no interior positions (cursor crosses it in one move step) — the price of not splitting, same as today.

Right edge → `(k+1, 0)` (never `(k, len)`): guarantees a unique representation per position, keeps all existing offset-0 tests passing, and makes moveLeft/moveRight symmetric across atoms.

## `js/tokens.js` — per-method (validated spec)

- `constructor`: add `this._offset = 0`.
- `get offset() { return this._offset; }` (new). `get cursor()` unchanged (still returns atom index).
- `_snapshot()`: push `{ atoms, cursor, offset }`; clear redo. (must include offset — otherwise undo restores a stale offset.)
- `insertDigit(ch)`:
  - `_offset > 0` (inside a number): if `ch==='.' && atom.includes('.')` → return (no snapshot, refuse dup dot); else `_snapshot()`, `atoms[cursor] = atom.slice(0,offset)+ch+atom.slice(offset)`, `offset++`.
  - `_offset === 0`: existing logic unchanged (merge into left tail / merge into right head / splice new; offset stays 0).
- `insertAtom(atom)`:
  - `_offset > 0`: `_snapshot()`, split into `left=atom.slice(0,offset)`, `right=atom.slice(offset)` (non-empty since offset<len), `splice(cursor,1,left,atom,right)`, `_cursor+=2`, `_offset=0`.
  - `_offset === 0`: existing logic (splice, cursor++). **Gate the split strictly on `_offset>0`, NOT on "atom is a number"** — else test `["2","+","3"]` breaks.
- `backspace()`:
  - `_offset > 0`: `_snapshot()`, `na = atom.slice(0,offset-1)+atom.slice(offset)`; if `na===""` → `splice(cursor,1)`, `_cursor--`, `_offset=0`; else `atoms[cursor]=na`, `offset--`.
  - `_offset === 0`: existing logic unchanged.
- `moveLeft()`: `if (offset>0) { offset--; return; } if (cursor>0) { cursor--; const a=atoms[cursor]; offset = isNumAtom(a) ? a.length-1 : 0; }`
- `moveRight()`: `const a=atoms[cursor]; if (a!==undefined && isNumAtom(a) && offset < a.length-1) { offset++; return; } if (cursor<atoms.length) { cursor++; offset=0; }`
- `setCursor(i, o=0)`: clamp `i` to `[0,len]`; if `i===len` → `(i,0)`; if `atoms[i]` is not a number → `(i,0)`; else clamp `o` to `[0,len]`; if `o===len` → `(i+1,0)` else `(i,o)`. **1-arg `setCursor(i)` stays `setCursor(i,0)` — backward compatible with existing app.js callers.**
- `clear()`: `_snapshot(); _atoms=[]; _cursor=0; _offset=0;`
- `setAtoms(arr)`: `_snapshot(); _atoms=arr.slice(); _cursor=arr.length; _offset=0;`
- `undo()`/`redo()`: push current `{atoms,cursor,offset}`, pop saved triple, restore all three.

## `js/app.js` — render + hit test

**`render()`** — wrap each **character** of a number atom in its own `.ch` span (carrying `data-c` = char index 0..len-1) inside a `.tok` span (carrying `data-i` = atom index); non-number atoms stay a single `.tok` (no `.ch` children). Cursor span placement:
- if `offset === 0`: before the `.tok` for `atoms[cursor]` (or at end if `cursor === len`), as today.
- if `offset > 0`: inside that number atom's `.tok`, between the `data-c = offset-1` and `data-c = offset` `.ch` spans.

**`nearestBoundary(x, y)`** — return `{i, o}` instead of a single atom index:
- before atom i (left edge of its first char / whole span for non-number): `{i, o: 0}`.
- between char c-1 and c of number atom i: `{i, o: c}` (c ∈ 1..len-1).
- after atom i (right edge): `{i: i+1, o: 0}` (canonical next).

**pointer handlers** — pass both: `editor.setCursor(pos.i, pos.o)` on down and move.

## `tests/test.html` — new DOM-free cases

- `setCursor` with offset: inside `1234` set offset 2, clamp offset to `[0,len)`, offset→0 at `i===len`, non-number atom forces offset 0.
- `insertDigit` mid-number inserts at char cursor: `1234` @ offset 2, type `5` → `12534`, offset 3.
- `backspace` mid-number deletes char before offset: `1234` @ offset 2 → `124`, offset 1; backspace offset 0 of a 1-char atom empties it.
- `moveLeft`/`moveRight` traverse char-by-char across a multi-char number and cross atom boundaries at edges; 1-char number crosses in one step.
- `undo`/`redo` restore offset (type mid-number, undo → cursor+offset back where they were).
- Existing 9 Editor cases still pass unchanged (they're all offset 0).

## Sync & release
- `js/tokens.js` → `v6/js/tokens.js`, `js/app.js` → `v6/js/app.js` (byte-identical).
- SW cache `calc-v6n → calc-v6o` (trunk + v6). `tests/test.html` trunk-only.
- No root-gate / dev.html / manifest changes (no version bump).

## Verification
1. `node --check --input-type=module < js/*.js` — all parse.
2. Headless: import `tests/assert.js` + `js/tokens.js`; run the new offset cases AND the existing 9 Editor cases — all green.
3. `diff -q` trunk↔v6 on tokens.js, app.js, styles.css, sw.js → IDENTICAL.
4. Browser at `http://localhost:8000/dev.html`: type `1234`, drag between 2 and 3 → cursor lands there; type `5` → `12534`; backspace → `124`; `‹`/`›` keys traverse char-by-char; press `=` → evaluates as the literal (NOT 12×34). Open `tests/test.html` for the full suite.
5. Commit + push `master` (Pages auto-deploys).
