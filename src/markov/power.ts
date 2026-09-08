/**
 * power.ts — 멱승법, 수렴 기록, 디플레이션 λ₂. (계획서 §3.4–§3.7 · Phase 5)
 *
 * 선형대수는 전부 직접 구현한다. 라이브러리는 렌더링과 차트에만 쓴다. (§7)
 */

/** 확률벡터와 행렬의 곱 πP. 벡터를 왼쪽에서 곱한다. */
export function multiply(vector: readonly number[], matrix: readonly (readonly number[])[]): number[] {
  const n = matrix.length;
  const result = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const weight = vector[i] ?? 0;
    if (weight === 0) continue;
    const row = matrix[i];
    if (row === undefined) continue;
    for (let j = 0; j < n; j += 1) result[j] = (result[j] ?? 0) + weight * (row[j] ?? 0);
  }
  return result;
}

/** ℓ¹ 노름. 확률벡터의 거리 지표로 쓴다. (§3.6) */
export function l1(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return sum;
}

/** 합이 1이 되도록 다시 맞춘다. 매 스텝 정규화해 합의 드리프트를 막는다. */
export function normalize(vector: readonly number[]): number[] {
  const total = vector.reduce((a, b) => a + b, 0);
  if (total === 0) throw new Error('영벡터는 정규화할 수 없습니다.');
  return vector.map((x) => x / total);
}

/** 초기 분포의 종류. (§6.2 — 수렴 시각화에서 고르게 한다) */
export type InitialDistribution = 'start' | 'uniform' | number[];

export function initialVector(size: number, kind: InitialDistribution, startIndex = 0): number[] {
  if (Array.isArray(kind)) return normalize(kind);
  if (kind === 'uniform') return new Array<number>(size).fill(1 / size);
  const vector = new Array<number>(size).fill(0);
  vector[startIndex] = 1;
  return vector;
}

export interface PowerIterationStep {
  readonly k: number;
  /** 스텝 사이의 변화 ‖π⁽ᵏ⁺¹⁾ − π⁽ᵏ⁾‖₁. */
  readonly stepChange: number;
  /** 최종 π 에서 잰 실제 오차 ‖π⁽ᵏ⁾ − π‖₁. 수렴 후에 되돌아가 채운다. */
  readonly error: number;
  readonly distribution: readonly number[];
}

export interface PowerIterationResult {
  readonly pi: number[];
  readonly steps: readonly PowerIterationStep[];
  readonly iterations: number;
  readonly converged: boolean;
  /** 잔차 ‖πP − π‖₁. */
  readonly residual: number;
}

export interface PowerIterationOptions {
  readonly tolerance?: number;
  readonly maxIterations?: number;
  readonly initial?: InitialDistribution;
  readonly startIndex?: number;
  /** 각 반복의 분포를 보관할지. 수렴 시각화에 쓴다. 기본값 true. */
  readonly keepHistory?: boolean;
}

/**
 * 멱승법으로 정상분포를 구한다.
 *
 * $$\pi^{(k+1)} = \pi^{(k)}P$$
 *
 * **주의** — $\|\pi^{(k+1)}-\pi^{(k)}\|_1$ 이 작은 것과 $\|\pi^{(k)}-\pi\|_1$ 이 작은
 * 것은 다르다. $|\lambda_2|$ 가 1에 가까우면 스텝 변화는 작아도 실제 오차는 클 수 있다.
 * 그래서 두 값을 **모두** 기록한다. (§3.6)
 */
export function powerIteration(
  matrix: readonly (readonly number[])[],
  options: PowerIterationOptions = {},
): PowerIterationResult {
  const { tolerance = 1e-14, maxIterations = 5000, initial = 'start', startIndex = 0, keepHistory = true } = options;

  let current = initialVector(matrix.length, initial, startIndex);
  const history: number[][] = [current];
  const changes: number[] = [];
  let converged = false;
  let iterations = 0;

  for (let k = 0; k < maxIterations; k += 1) {
    const nextRaw = multiply(current, matrix);
    const next = normalize(nextRaw);
    const change = l1(next, current);
    changes.push(change);
    if (keepHistory) history.push(next);
    current = next;
    iterations = k + 1;
    if (change < tolerance) {
      converged = true;
      break;
    }
  }

  const pi = current;
  // 실제 오차는 최종 π 를 알고 나서야 잴 수 있으므로 되돌아가 채운다.
  const steps: PowerIterationStep[] = changes.map((stepChange, index) => {
    const distribution = history[index + 1] ?? pi;
    return { k: index + 1, stepChange, error: l1(distribution, pi), distribution };
  });

  return { pi, steps, iterations, converged, residual: l1(multiply(pi, matrix), pi) };
}

/**
 * 디플레이션으로 두 번째 고유값의 크기를 구한다. — **이론값** (§3.7 (a))
 *
 * $$Q = P - \mathbf{1}\pi$$
 *
 * 로 고유값 1을 제거한 뒤 $Q$ 에 멱승법을 적용하면 $|\lambda_2|$ 가 남는다.
 * $\mathbf 1$ 은 성분이 모두 1인 열벡터이므로 $\mathbf 1\pi$ 는 모든 행이 $\pi$ 인 행렬이다.
 *
 * **순간 성장률이 아니라 성장률의 기하평균을 본다.** $\lambda_2$ 가 복소 켤레쌍이면
 * 한 스텝의 성장률이 $|\lambda_2|$ 를 중심으로 진동해 그대로는 수렴하지 않는다.
 * 반면 $\|Q^k v\|^{1/k} \to |\lambda_2|$ 는 복소수에서도 성립한다.
 * 진동 여부는 `oscillating` 으로 따로 보고한다.
 */
export interface DeflationResult {
  /** |λ₂| 추정값. 성장률의 **기하평균**이라 복소 고유값에서도 수렴한다. */
  readonly magnitude: number;
  /**
   * 스텝별 성장률이 한 값으로 안정되었는가.
   *
   * λ₂ 가 실수일 때만 true 다. 복소 켤레쌍이면 성장률이 영원히 진동하므로
   * **수렴하지 않는 것이 정상**이다. 그때도 `magnitude` 는 기하평균이라 쓸 수 있다.
   */
  readonly converged: boolean;
  /**
   * 스텝별 성장률이 진동하는가.
   *
   * 확률행렬은 비대칭이라 λ₂ 가 복소수일 수 있다. 그러면 켤레쌍이 회전하면서
   * 한 스텝의 성장률이 |λ₂| 를 중심으로 주기적으로 오르내린다. **이 진동 자체가
   * λ₂ 가 복소수라는 증거**이므로 감추지 않고 보고한다. (계획서 §15)
   */
  readonly oscillating: boolean;
  /** 마지막 스텝의 순간 성장률. */
  readonly lastRatio: number;
  /** 최근 성장률의 최대−최소. 진동의 크기를 그대로 보여 준다. */
  readonly ratioSpread: number;
  readonly iterations: number;
}

export function deflatedLambda2(
  matrix: readonly (readonly number[])[],
  pi: readonly number[],
  options: { tolerance?: number; maxIterations?: number } = {},
): DeflationResult {
  const { tolerance = 1e-12, maxIterations = 5000 } = options;
  const q: number[][] = matrix.map((row) => row.map((value, j) => value - (pi[j] ?? 0)));

  // 임의의 시작 벡터. π 와 겹치지 않도록 부호를 섞어 둔다.
  let vector: number[] = q.map((_, i) => (i % 2 === 0 ? 1 : -1));
  const norm = (v: readonly number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  vector = vector.map((x) => x / norm(vector));

  let logSum = 0;
  let magnitude = 0;
  let previous = Number.NaN;
  let converged = false;
  let lastRatio = 0;
  let iterations = 0;
  /** 진동을 재려면 최근 성장률을 조금 들고 있어야 한다. */
  const window: number[] = [];
  const WINDOW = 50;

  for (let k = 1; k <= maxIterations; k += 1) {
    const next = multiply(vector, q);
    const ratio = norm(next);
    iterations = k;
    if (ratio === 0) {
      return { magnitude: 0, converged: true, oscillating: false, lastRatio: 0, ratioSpread: 0, iterations };
    }

    logSum += Math.log(ratio);
    magnitude = Math.exp(logSum / k);
    lastRatio = ratio;
    vector = next.map((x) => x / ratio);

    // 초기 과도구간은 진동 판정에서 제외한다.
    if (k > 20) {
      window.push(ratio);
      if (window.length > WINDOW) window.shift();
    }

    if (k > 20 && Math.abs(ratio - previous) < tolerance) {
      converged = true;
      break;
    }
    previous = ratio;
  }

  // 최근 성장률이 한 값으로 모이지 않고 폭을 가지면 λ₂ 가 복소 켤레쌍이라는 뜻이다.
  const ratioSpread = window.length === 0 ? 0 : Math.max(...window) - Math.min(...window);
  return {
    // 성장률이 한 값으로 안정되었다면 그 값이 곧 |λ₂| 다. 진동한다면 기하평균을 쓴다.
    magnitude: converged ? lastRatio : magnitude,
    converged,
    oscillating: ratioSpread > 1e-6 * magnitude,
    lastRatio,
    ratioSpread,
    iterations,
  };
}

export interface LogRegressionResult {
  /** 회귀로 얻은 |λ₂|. exp(기울기). */
  readonly magnitude: number;
  /** log‖π⁽ᵏ⁾ − π‖₁ ≈ log C + k·log|λ₂| 의 절편에서 얻은 C. */
  readonly constant: number;
  /** 결정계수. 1에 가까울수록 지수 감쇠 모형이 잘 맞는다. */
  readonly r2: number;
  readonly usedPoints: number;
}

/**
 * 로그 회귀로 두 번째 고유값의 크기를 구한다. — **실측값** (§3.7 (b))
 *
 * $$\log\|\pi^{(k)}-\pi\|_1 \approx \log C + k\log|\lambda_2|$$
 *
 * 오차가 부동소수점 바닥에 닿은 뒤의 점들은 잡음이라 버린다.
 * 이론값과 실측값을 나란히 놓는 것 자체가 "이론과 실험의 대조"다.
 */
export function logRegressionLambda2(
  steps: readonly PowerIterationStep[],
  options: { floor?: number; skip?: number } = {},
): LogRegressionResult {
  const { floor = 1e-13, skip = 2 } = options;
  const points = steps
    .slice(skip)
    .filter((s) => s.error > floor)
    .map((s) => ({ x: s.k, y: Math.log(s.error) }));

  if (points.length < 2) return { magnitude: NaN, constant: NaN, r2: NaN, usedPoints: points.length };

  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  const sxy = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const sxx = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  const ssTot = points.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((sum, p) => sum + (p.y - (intercept + slope * p.x)) ** 2, 0);

  return {
    magnitude: Math.exp(slope),
    constant: Math.exp(intercept),
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    usedPoints: n,
  };
}
