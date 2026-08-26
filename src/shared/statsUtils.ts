/**
 * statsUtils - shared descriptive & inferential statistics helpers used across
 * Exhaustive Tables, Deep Analytics and the Insight Matrix so every numeric
 * and categorical attribute gets the full standard toolkit (not just
 * mean/median/stdev) with real significance testing, not eyeballed
 * thresholds. Pure JS, no dependency - all distributions computed from
 * first principles (regularized incomplete beta / gamma functions) so this
 * works offline in the browser bundle.
 */

// ── Core descriptive stats ─────────────────────────────────────────────────
export function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
/** Population variance (divisor N) - matches the platform's existing "StdDev" formula. */
export function variancePop(v: number[], m = mean(v)): number {
  return v.length ? v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length : 0;
}
/** Sample variance (divisor N-1) - the correct convention for inferential stats (SE, CI, t-tests). */
export function varianceSample(v: number[], m = mean(v)): number {
  return v.length > 1 ? v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1) : 0;
}
export function stdDevPop(v: number[], m = mean(v)): number { return Math.sqrt(variancePop(v, m)); }
export function stdDevSample(v: number[], m = mean(v)): number { return Math.sqrt(varianceSample(v, m)); }
export function stdError(v: number[]): number { return v.length ? stdDevSample(v) / Math.sqrt(v.length) : 0; }
export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
export function mode(v: number[]): number | null {
  if (!v.length) return 0;
  const m = new Map<number, number>();
  v.forEach(x => m.set(x, (m.get(x) ?? 0) + 1));
  let best: number | null = null, bestC = 0;
  m.forEach((c, x) => { if (c > bestC) { bestC = c; best = x; } });
  return bestC > 1 ? best : null; // no repeated value => no meaningful mode
}
/** Sample skewness (Fisher-Pearson, bias-corrected for n>2). */
export function skewness(v: number[], m = mean(v), sd = stdDevSample(v, m)): number {
  const n = v.length;
  if (n < 3 || sd === 0) return 0;
  const g1 = v.reduce((a, x) => a + Math.pow((x - m) / sd, 3), 0) / n;
  return Math.sqrt(n * (n - 1)) / (n - 2) * g1;
}
/** Sample excess kurtosis (0 = normal distribution). */
export function kurtosis(v: number[], m = mean(v), sd = stdDevSample(v, m)): number {
  const n = v.length;
  if (n < 4 || sd === 0) return 0;
  const g2 = v.reduce((a, x) => a + Math.pow((x - m) / sd, 4), 0) / n;
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 - 3 * (n - 1)) + 3 - 3; // excess
}
/** 95% confidence interval for the mean, using the normal (z=1.96) approximation. */
export function ci95(v: number[]): [number, number] {
  const m = mean(v), se = stdError(v);
  return [m - 1.96 * se, m + 1.96 * se];
}

// ── Special functions (Numerical-Recipes-style implementations) ───────────
function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
/** Regularized incomplete beta function I_x(a,b), used for t- and F-distribution p-values. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(x, a, b) / a : 1 - bt * betacf(1 - x, b, a) / b;
}
function gammaSeries(a: number, x: number): number {
  const ITMAX = 200, EPS = 3e-9;
  if (x <= 0) return 0;
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 1; n <= ITMAX; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}
function gammaCf(a: number, x: number): number {
  const ITMAX = 200, EPS = 3e-9, FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}
/** Regularized lower incomplete gamma P(a,x), used for chi-square p-values. */
export function lowerGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaCf(a, x);
}

// ── Inferential tests ───────────────────────────────────────────────────────
/** Two-tailed p-value for a t-statistic with `df` degrees of freedom. */
export function tTestP(t: number, df: number): number {
  if (df <= 0 || !isFinite(t)) return 1;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}
/** Upper-tail p-value for an F-statistic (ANOVA / regression). */
export function fTestP(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  return 1 - incompleteBeta((df1 * f) / (df1 * f + df2), df1 / 2, df2 / 2);
}
/** Upper-tail p-value for a chi-square statistic with `df` degrees of freedom. */
export function chiSquareP(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  return 1 - lowerGammaP(df / 2, chi2 / 2);
}
/** Significance stars matching conventional thresholds. */
export function sigStars(p: number): string { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : ''; }

export interface CorrResult { r: number; n: number; t: number; df: number; p: number; }
/** Pearson correlation + two-tailed significance test on the paired, non-null values of a and b. */
export function pearsonTest(a: number[], b: number[]): CorrResult {
  const n = Math.min(a.length, b.length);
  if (n < 3) return { r: 0, n, t: 0, df: 0, p: 1 };
  const ma = mean(a), mb = mean(b);
  let nu = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  const r = da && db ? nu / Math.sqrt(da * db) : 0;
  const df = n - 2;
  const t = Math.abs(r) < 1 ? r * Math.sqrt(df / (1 - r * r)) : (r > 0 ? Infinity : -Infinity);
  return { r, n, t, df, p: tTestP(t, df) };
}

export interface AnovaResult { f: number; df1: number; df2: number; p: number; etaSq: number; groups: number; n: number; }
/** One-way ANOVA: does the categorical grouping explain a significant share of variance in the numeric measure? */
export function oneWayAnova(groups: number[][]): AnovaResult {
  const nonEmpty = groups.filter(g => g.length > 0);
  const k = nonEmpty.length, n = nonEmpty.reduce((a, g) => a + g.length, 0);
  if (k < 2 || n <= k) return { f: 0, df1: Math.max(0, k - 1), df2: Math.max(0, n - k), p: 1, etaSq: 0, groups: k, n };
  const grand = mean(nonEmpty.flat());
  let ssBetween = 0, ssWithin = 0;
  nonEmpty.forEach(g => {
    const gm = mean(g);
    ssBetween += g.length * (gm - grand) ** 2;
    g.forEach(x => { ssWithin += (x - gm) ** 2; });
  });
  const df1 = k - 1, df2 = n - k;
  const msBetween = ssBetween / df1, msWithin = df2 > 0 ? ssWithin / df2 : 0;
  const f = msWithin > 0 ? msBetween / msWithin : 0;
  const ssTotal = ssBetween + ssWithin;
  return { f, df1, df2, p: fTestP(f, df1, df2), etaSq: ssTotal > 0 ? ssBetween / ssTotal : 0, groups: k, n };
}

export interface ChiSqResult { chi2: number; df: number; p: number; cramerV: number; n: number; }
/** Chi-square test of independence between two categorical columns from their contingency table. */
export function chiSquareTest(table: number[][]): ChiSqResult {
  const rows = table.length, cols = rows ? table[0].length : 0;
  const n = table.reduce((a, r) => a + r.reduce((s, v) => s + v, 0), 0);
  if (!rows || !cols || n === 0) return { chi2: 0, df: 0, p: 1, cramerV: 0, n };
  const rowTot = table.map(r => r.reduce((s, v) => s + v, 0));
  const colTot = Array.from({ length: cols }, (_, j) => table.reduce((s, r) => s + r[j], 0));
  let chi2 = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const exp = (rowTot[i] * colTot[j]) / n;
    if (exp > 0) chi2 += (table[i][j] - exp) ** 2 / exp;
  }
  const df = (rows - 1) * (cols - 1);
  const cramerV = n > 0 ? Math.sqrt(chi2 / (n * Math.min(rows - 1, cols - 1) || 1)) : 0;
  return { chi2, df, p: chiSquareP(chi2, df), cramerV, n };
}
