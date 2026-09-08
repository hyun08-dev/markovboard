/**
 * landing.ts — 착지 벡터 v 와 월급 통과율. (계획서 §3.8 · §3.10 · Phase 6)
 *
 * $\pi$ 는 **턴을 시작하는** 위치의 분포이고, $v$ 는 **한 턴당 각 칸에 착지하는
 * 기대 횟수**다. 둘은 다르다. 더블 재굴림 때문에 한 턴에 여러 칸에 착지할 수 있고,
 * 통행료는 착지할 때마다 발생하기 때문이다.
 *
 * 계획 초안의 $E[R]=\sum_i \pi_i r_i$ 는 이 구분이 없어 잘못된 값을 낸다.
 * 통행료에는 반드시 $v$ 를 쓴다.
 */

import { BOARD_SIZE } from './board';
import type { InflowSource } from './rules';
import type { TransitionModel } from './transition';

const INFLOW_SOURCES: readonly InflowSource[] = ['dice', 'card', 'backstep', 'teleport', 'stay'];

export interface LandingProfile {
  /** v_i — 한 턴당 칸 i 에 착지하는 기대 횟수. 길이 40. */
  readonly v: number[];
  /** Σv — 한 턴의 기대 착지 횟수. 특수 칸을 끄면 E[K] = 1.2 와 같다. */
  readonly totalLandings: number;
  /** 한 턴의 기대 굴림 횟수. */
  readonly expectedRolls: number;
  /** 턴당 출발선 통과 기대 횟수. 월급 수령 빈도다. */
  readonly salaryRate: number;
  /** π 를 칸 단위로 합친 것. 무인도 4상태는 10번으로 모은다. */
  readonly piByCell: number[];
  /**
   * 칸별 유입 경로 분해. 각 칸에서 다섯 경로를 합하면 그 칸의 π 가 된다. (§10 실험 8)
   *
   * `stay` 는 무인도에 계속 갇혀 있는 몫이다. 새로 들어온 것이 아니므로 나머지
   * 네 경로와 성격이 다르지만, 무인도 확률이 왜 높은지를 설명하려면 함께 봐야 한다.
   */
  readonly inflow: Record<InflowSource, number[]>;
}

/**
 * 정상분포에서 한 턴을 전개해 착지 벡터를 얻는다.
 *
 * $$v_j = \sum_i \pi_i \cdot (\text{상태 } i \text{ 에서 한 턴에 칸 } j \text{ 에 착지하는 기대 횟수})$$
 *
 * 턴 전개는 이미 `transition.ts` 가 전이확률과 **같은 계산에서** 모아 두었다.
 * 규칙 전개 코드를 두 벌 두면 반드시 어긋나기 때문이다.
 */
export function landingProfile(model: TransitionModel, pi: readonly number[]): LandingProfile {
  const v = new Array<number>(BOARD_SIZE).fill(0);
  const piByCell = new Array<number>(BOARD_SIZE).fill(0);
  const inflow = Object.fromEntries(
    INFLOW_SOURCES.map((source) => [source, new Array<number>(BOARD_SIZE).fill(0)]),
  ) as Record<InflowSource, number[]>;
  let expectedRolls = 0;
  let salaryRate = 0;

  for (let i = 0; i < model.space.size; i += 1) {
    const weight = pi[i] ?? 0;
    if (weight === 0) continue;

    piByCell[model.space.cellOf(i)] = (piByCell[model.space.cellOf(i)] ?? 0) + weight;
    expectedRolls += weight * (model.rolls[i] ?? 0);
    salaryRate += weight * (model.salaryPasses[i] ?? 0);

    const row = model.landings[i];
    if (row === undefined) continue;
    for (let cell = 0; cell < BOARD_SIZE; cell += 1) v[cell] = (v[cell] ?? 0) + weight * (row[cell] ?? 0);

    const sources = model.inflow[i];
    if (sources === undefined) continue;
    for (const source of INFLOW_SOURCES) {
      const from = sources[source];
      const into = inflow[source];
      for (let cell = 0; cell < BOARD_SIZE; cell += 1) into[cell] = (into[cell] ?? 0) + weight * (from[cell] ?? 0);
    }
  }

  return {
    v,
    totalLandings: v.reduce((a, b) => a + b, 0),
    expectedRolls,
    salaryRate,
    piByCell,
    inflow,
  };
}

/**
 * 한 바퀴(40칸)를 도는 데 걸리는 기대 턴 수.
 *
 * 월급 통과율의 역수다. 단순 근사는 $8.4/40 = 21\%$ 이므로 약 4.76턴이지만,
 * 무인도 정체와 우주여행 점프 때문에 실제 값은 이와 다르다. (§10 실험 7)
 */
export function turnsPerLap(salaryRate: number): number {
  return 1 / salaryRate;
}
