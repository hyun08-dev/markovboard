/**
 * payoff.ts — 기대수익, 투자 회수 지표, 갱신보상. (계획서 §3.8 · §3.9 · Phase 6)
 *
 * 기대수익은 "만약 해당 칸이 상대 소유이고 지정한 개발 단계라면, 한 턴당 기대
 * 지출액"이라는 **조건부 기대값**이다 (가정 A9). 절대적인 손익이 아니라 칸 간
 * 비교 지표다.
 */

import {
  BOARD,
  BOARD_SIZE,
  SALARY,
  WELFARE_CONTRIBUTION,
  WELFARE_PAY_CELL,
  WELFARE_RECEIVE_CELL,
  investmentOf,
  tollOf,
  type BuildLevel,
  type Cell,
} from './board';
import type { LandingProfile } from './landing';

export interface CellPayoff {
  readonly index: number;
  readonly name: string;
  /** π_i — 턴 시작 확률. 무인도는 4상태를 합친 값이다. */
  readonly stationaryProb: number;
  /** v_i — 턴당 착지 기대 횟수. */
  readonly landingRate: number;
  /** 개발 단계 d 에서의 통행료 r_i. 소유할 수 없는 칸은 0. */
  readonly toll: number;
  /** v_i · r_i — 턴당 기대 지출액. */
  readonly expectedPayoff: number;
  /** 매입가 + 건축비. */
  readonly investment: number;
  /** (매입가 + 건축비) / r_i — 본전을 뽑는 데 필요한 착지 횟수. */
  readonly paybackLandings: number;
  /** v_i · r_i / (매입가 + 건축비) — 턴당 회수율. **방문 확률을 곱한 지표다.** */
  readonly returnPerTurn: number;
  /** 본전을 뽑는 데 걸리는 기대 턴 수 = 1 / returnPerTurn. */
  readonly paybackTurns: number;
}

const finiteOrInfinity = (numerator: number, denominator: number): number =>
  denominator === 0 ? Number.POSITIVE_INFINITY : numerator / denominator;

/** 칸 하나의 수익 지표를 계산한다. */
export function cellPayoff(cell: Cell, level: BuildLevel, profile: LandingProfile): CellPayoff {
  const toll = tollOf(cell, level);
  const investment = investmentOf(cell, level);
  const landingRate = profile.v[cell.index] ?? 0;
  const expectedPayoff = landingRate * toll;

  return {
    index: cell.index,
    name: cell.name,
    stationaryProb: profile.piByCell[cell.index] ?? 0,
    landingRate,
    toll,
    expectedPayoff,
    investment,
    paybackLandings: finiteOrInfinity(investment, toll),
    returnPerTurn: finiteOrInfinity(expectedPayoff, investment),
    paybackTurns: finiteOrInfinity(investment, expectedPayoff),
  };
}

/** 소유할 수 있는 모든 칸의 수익 지표. */
export function payoffTable(level: BuildLevel, profile: LandingProfile): CellPayoff[] {
  return BOARD.filter((cell) => cell.price !== undefined).map((cell) => cellPayoff(cell, level, profile));
}

/**
 * 한 턴당 기대 지출 총액. (계획서 §3.8)
 *
 * $$E[R^{(d)}] = \sum_i v_i\, r_i^{(d)}$$
 *
 * **$\pi$ 가 아니라 $v$ 를 쓴다.** 통행료는 턴을 시작하는 위치가 아니라 착지할
 * 때마다 발생하기 때문이다.
 */
export function expectedTollPerTurn(level: BuildLevel, profile: LandingProfile): number {
  let total = 0;
  for (let cell = 0; cell < BOARD_SIZE; cell += 1) {
    const data = BOARD[cell];
    if (data === undefined) continue;
    total += (profile.v[cell] ?? 0) * tollOf(data, level);
  }
  return total;
}

/** 수익률의 세 가지 정의. (§10 실험 5 — 정의에 따라 순위가 달라진다) */
export type YieldDefinition =
  /** 통행료 ÷ 건축비 */
  | 'perBuildCost'
  /** 통행료 ÷ (매입가 + 건축비) */
  | 'perInvestment'
  /** v_i × 통행료 ÷ (매입가 + 건축비) — **방문 확률 가중** */
  | 'visitWeighted';

export function yieldOf(cell: Cell, level: BuildLevel, profile: LandingProfile, definition: YieldDefinition): number {
  const toll = tollOf(cell, level);
  const investment = investmentOf(cell, level);
  const price = cell.price ?? 0;

  switch (definition) {
    case 'perBuildCost': {
      // 건물을 지을 수 없는 칸은 건축비가 0이라 이 정의 자체가 성립하지 않는다.
      const buildCost = investment - price;
      return buildCost === 0 ? Number.NaN : toll / buildCost;
    }
    case 'perInvestment':
      return finiteOrInfinity(toll, investment);
    case 'visitWeighted':
      return finiteOrInfinity((profile.v[cell.index] ?? 0) * toll, investment);
  }
}

export interface WelfareEstimate {
  /** v₃₈ — 접수처 착지 빈도. */
  readonly contributionRate: number;
  /** v₂₀ — 수령처 착지 빈도. */
  readonly collectionRate: number;
  /** 한 번 수령할 때의 기대 적립액. */
  readonly expectedPayout: number;
}

/**
 * 사회복지기금의 기대 수령액 — 갱신보상 근사. (계획서 §3.9 · 가정 A10)
 *
 * 20번에서 받는 금액은 과거 이력에 의존하므로 위치만으로는 결정되지 않는다.
 * 잔액을 상태에 넣으면 상태공간이 폭발하므로 기대값만 계산한다.
 *
 * $$E[\text{수령액}] \approx 15\text{만} \times \frac{v_{38}}{v_{20}}$$
 *
 * **근사다.** 분포가 아니라 기대값만 다루며, 잔액이 0일 때 아무 일도 일어나지
 * 않는다는 점도 반영하지 못한다. 한계로 기록한다.
 */
export function welfareEstimate(profile: LandingProfile): WelfareEstimate {
  const contributionRate = profile.v[WELFARE_PAY_CELL] ?? 0;
  const collectionRate = profile.v[WELFARE_RECEIVE_CELL] ?? 0;
  return {
    contributionRate,
    collectionRate,
    expectedPayout: finiteOrInfinity(WELFARE_CONTRIBUTION * contributionRate, collectionRate),
  };
}

/** 턴당 기대 월급 수입. 월급은 착지가 아니라 **통과** 이벤트다. (§3.10) */
export function salaryPerTurn(profile: LandingProfile): number {
  return profile.salaryRate * SALARY;
}
