/**
 * hitting.ts — 첫 도달 확률·시간, Kac 검증. (계획서 §3.11 · Phase 6)
 *
 * 정상분포와 **완전히 독립적인 계산 경로**를 하나 더 만드는 것이 목적이다.
 * Kac 보조정리 $m_{ii} = 1/\pi_i$ 가 성립하는지 확인하면 π 계산이 옳다는 증거가
 * 하나 더 쌓인다. (§11.4 — 세 번째 검증 축)
 */

/**
 * 선형계 $Ax = b$ 를 부분 피벗 가우스 소거로 푼다.
 *
 * 43×43 규모라 직접 구현으로 충분하다. 라이브러리는 렌더링과 차트에만 쓴다. (§7)
 */
export function solveLinearSystem(a: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = a.length;
  const m: number[][] = a.map((row, i) => [...row, b[i] ?? 0]);

  for (let col = 0; col < n; col += 1) {
    // 부분 피벗 — 절댓값이 가장 큰 행을 위로 올려 수치 안정성을 지킨다.
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = row;
    }
    if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-14) throw new Error(`특이행렬입니다 (${col}열).`);
    [m[col], m[pivot]] = [m[pivot] as number[], m[col] as number[]];

    const pivotRow = m[col] as number[];
    const pivotValue = pivotRow[col] as number;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const target = m[row] as number[];
      const factor = (target[col] as number) / pivotValue;
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) target[k] = (target[k] as number) - factor * (pivotRow[k] as number);
    }
  }

  return m.map((row, i) => (row[n] as number) / (row[i] as number));
}

/**
 * 목표 집합 A 까지의 기대 도달 시간 h.
 *
 * A 를 흡수 상태로 만들고 나머지 부분행렬을 $Q_A$ 라 하면
 *
 * $$(I-Q_A)\,h = \mathbf{1}$$
 *
 * A 에 속한 상태는 0을 돌려준다.
 */
export function expectedHittingTimes(matrix: readonly (readonly number[])[], targets: Iterable<number>): number[] {
  const n = matrix.length;
  const target = new Set(targets);
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => !target.has(i));

  const system = rest.map((i) =>
    rest.map((j) => (i === j ? 1 : 0) - (matrix[i]?.[j] ?? 0)),
  );
  const solution = solveLinearSystem(system, new Array<number>(rest.length).fill(1));

  const times = new Array<number>(n).fill(0);
  rest.forEach((state, k) => {
    times[state] = solution[k] ?? Number.NaN;
  });
  return times;
}

/**
 * 목표 집합 A 중 **어느 상태에 먼저 닿는지**의 확률.
 *
 * 각 목표 상태 t 에 대해 흡수 확률 $u^{(t)}$ 는
 *
 * $$u^{(t)}_i = \sum_j P_{ij}\,u^{(t)}_j \quad (i \notin A),\qquad u^{(t)}_t = 1,\ u^{(t)}_s = 0\ (s \in A, s \ne t)$$
 *
 * 를 만족한다. 반환값은 `[출발 상태][목표 순서]` 이다.
 */
export function absorptionProbabilities(
  matrix: readonly (readonly number[])[],
  targets: readonly number[],
): number[][] {
  const n = matrix.length;
  const target = new Set(targets);
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => !target.has(i));
  const system = rest.map((i) => rest.map((j) => (i === j ? 1 : 0) - (matrix[i]?.[j] ?? 0)));

  const result = Array.from({ length: n }, () => new Array<number>(targets.length).fill(0));
  targets.forEach((t, column) => {
    const rhs = rest.map((i) => matrix[i]?.[t] ?? 0);
    const solution = solveLinearSystem(system, rhs);
    rest.forEach((state, k) => {
      (result[state] as number[])[column] = solution[k] ?? Number.NaN;
    });
    (result[t] as number[])[column] = 1;
  });
  return result;
}

/**
 * 평균 재귀시간 $m_{ii}$ — 상태 i 를 떠나 처음 되돌아올 때까지의 기대 턴 수.
 *
 * $$m_{ii} = 1 + \sum_{j \ne i} P_{ij}\, h_j$$
 *
 * 여기서 $h_j$ 는 i 까지의 기대 도달 시간이다. **π 를 전혀 쓰지 않는다.**
 */
export function meanReturnTime(matrix: readonly (readonly number[])[], state: number): number {
  const h = expectedHittingTimes(matrix, [state]);
  const row = matrix[state] ?? [];
  let sum = 1;
  for (let j = 0; j < matrix.length; j += 1) {
    if (j === state) continue;
    sum += (row[j] ?? 0) * (h[j] ?? 0);
  }
  return sum;
}

export interface KacCheck {
  readonly state: number;
  /** 선형계로 구한 평균 재귀시간. */
  readonly returnTime: number;
  /** Kac 보조정리가 예측하는 값 1/π_i. */
  readonly predicted: number;
  readonly relativeError: number;
}

/**
 * Kac 보조정리 검증. (§3.11)
 *
 * $$m_{ii} = \frac{1}{\pi_i}$$
 *
 * 좌변은 선형계로, 우변은 멱승법으로 구한다. **계산 경로가 완전히 다르므로**
 * 두 값이 맞으면 서로를 검증한다.
 */
export function verifyKac(matrix: readonly (readonly number[])[], pi: readonly number[]): KacCheck[] {
  return pi.map((probability, state) => {
    const returnTime = meanReturnTime(matrix, state);
    const predicted = 1 / probability;
    return {
      state,
      returnTime,
      predicted,
      relativeError: Math.abs(returnTime - predicted) / predicted,
    };
  });
}
