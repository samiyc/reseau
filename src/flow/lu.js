/**
 * A dense LU factorisation with partial pivoting, for the DC power flow's system (docs/modele.md § 2): a few dozen to a
 * hundred unknowns, factored once, solved for as many right-hand sides as needed (the PTDF solves one per bus).
 */

/** Below this, a pivot is taken for zero: the matrix is singular (a bus left without a reference). */
const TINY = 1e-12;

/**
 * @typedef {{ n: number, lu: Float64Array, pivots: Int32Array }} Factor
 */

function swapRows(/** @type {Float64Array} */ a, /** @type {number} */ n, /** @type {number} */ i, /** @type {number} */ j) {
  for (let c = 0; c < n; c += 1) {
    const t = a[i * n + c];
    a[i * n + c] = a[j * n + c];
    a[j * n + c] = t;
  }
}

function pivotRow(/** @type {Float64Array} */ a, /** @type {number} */ n, /** @type {number} */ k) {
  let best = k;
  for (let r = k + 1; r < n; r += 1) if (Math.abs(a[r * n + k]) > Math.abs(a[best * n + k])) best = r;
  if (Math.abs(a[best * n + k]) < TINY) throw new Error("matrice singulière");
  return best;
}

function eliminate(/** @type {Float64Array} */ a, /** @type {number} */ n, /** @type {number} */ k) {
  const pivot = a[k * n + k];
  for (let r = k + 1; r < n; r += 1) {
    const factor = (a[r * n + k] /= pivot);
    if (factor !== 0) for (let c = k + 1; c < n; c += 1) a[r * n + c] -= factor * a[k * n + c];
  }
}

/** Factors the n × n row-major matrix `a`, in place. Throws on a singular matrix. */
export function factor(/** @type {Float64Array} */ a, /** @type {number} */ n) {
  const pivots = new Int32Array(n);
  for (let k = 0; k < n; k += 1) {
    const p = pivotRow(a, n, k);
    pivots[k] = p;
    if (p !== k) swapRows(a, n, p, k);
    eliminate(a, n, k);
  }
  return { n, lu: a, pivots };
}

/** Solves A·x = b into `x` (which may be `b`), from A's factor. */
export function solveInto(/** @type {Factor} */ { n, lu, pivots }, /** @type {Float64Array} */ b, /** @type {Float64Array} */ x) {
  if (x !== b) x.set(b);
  for (let k = 0; k < n; k += 1) {
    const p = pivots[k];
    if (p !== k) [x[k], x[p]] = [x[p], x[k]];
  }
  for (let r = 1; r < n; r += 1) {
    let sum = x[r];
    for (let c = 0; c < r; c += 1) sum -= lu[r * n + c] * x[c];
    x[r] = sum;
  }
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = x[r];
    for (let c = r + 1; c < n; c += 1) sum -= lu[r * n + c] * x[c];
    x[r] = sum / lu[r * n + r];
  }
  return x;
}
