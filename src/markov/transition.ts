/**
 * transition.ts — 전이행렬 생성기. (계획서 §3.3 · Phase 4)
 *
 * 한 행은 다음 순서로 전개한다.
 *
 * 1. **턴 유형 판정** — 우주여행 칸이면 정책에 따라 이동, 무인도 대기 상태면 더블
 *    판정, 그 외에는 정상 굴림.
 * 2. **주사위 굴림 및 더블 재귀** — 더블이면 착지 처리 후 같은 절차를 반복.
 * 3. **착지 칸 효과 적용** — 황금열쇠, 우주여행 정지, 무인도 강제 이동.
 * 4. **다음 턴 시작 상태 확정.**
 *
 * 한 턴을 전개하면서 **전이확률 · 착지 횟수 · 출발선 통과 횟수 · 굴림 횟수**를 한꺼번에
 * 모은다. 규칙이 복잡한 만큼 전개 코드를 두 벌 두면 반드시 어긋나므로, 착지 벡터 $v$
 * (Phase 6)도 같은 함수에서 얻는다. $\pi$ 와 $v$ 를 분리해야 하는 이유는 §3.8 참조.
 */

import { BOARD_SIZE, ISLAND_CELL, SPACE_TRAVEL_CELL, wrap } from './board';
import type { ModelConfig } from './config';
import {
  cellOfPosition,
  passesStart,
  resolveLanding,
  teleportTargets,
  type InflowSource,
  type LandingOutcome,
  type Position,
} from './rules';
import { buildStateSpace, type JailRemaining, type StateSpace } from './states';

/** 주사위 두 개를 던진 결과를 합과 더블 여부로 묶은 것. */
export interface DiceOutcome {
  readonly sum: number;
  readonly prob: number;
  readonly isDouble: boolean;
}

/**
 * 주사위 두 개의 결과 분포.
 *
 * 눈 목록을 바꾸면 그대로 따라간다. 짝수 눈만 남기면 이동 거리의 gcd 가 2가 되어
 * 주기 2가 생기고 멱승법이 진동한다. (§10 실험 12 — 구현은 배열 교체 한 줄)
 */
export function diceOutcomes(faces: readonly number[], count: 1 | 2 = 2): DiceOutcome[] {
  const n = faces.length;
  // 주사위가 하나면 더블이라는 개념 자체가 없다.
  if (count === 1) return faces.map((sum) => ({ sum, prob: 1 / n, isDouble: false }));

  const each = 1 / (n * n);
  const grouped = new Map<string, { sum: number; prob: number; isDouble: boolean }>();
  for (const a of faces) {
    for (const b of faces) {
      const sum = a + b;
      const isDouble = a === b;
      const key = `${sum}:${isDouble}`;
      const found = grouped.get(key);
      if (found === undefined) grouped.set(key, { sum, prob: each, isDouble });
      else found.prob += each;
    }
  }
  return [...grouped.values()].sort((x, y) => x.sum - y.sum || Number(x.isDouble) - Number(y.isDouble));
}

/** 더블이 나올 확률. 주사위 두 개이고 눈이 n 가지면 1/n 이다. */
export function doubleProbability(faces: readonly number[], count: 1 | 2 = 2): number {
  return count === 1 ? 0 : 1 / faces.length;
}

/** 한 턴을 전개한 결과. */
export interface TurnExpansion {
  /** 다음 턴 시작 상태의 확률분포. 전이행렬의 한 행이 된다. */
  readonly next: number[];
  /** 이 턴에 각 칸(0..39)에 착지하는 기대 횟수. */
  readonly landings: number[];
  /** 이 턴에 출발선을 지나는 기대 횟수. */
  readonly salaryPasses: number;
  /** 이 턴의 기대 굴림 횟수. */
  readonly rolls: number;
  /** 칸별 유입 경로 분해. `inflow[source][cell]` (§10 실험 8) */
  readonly inflow: Record<InflowSource, number[]>;
}

/** 더블 재귀를 끊는 확률 하한. (1/6)^k 로 줄어들므로 실질적인 절단 오차는 없다. */
const PROB_EPSILON = 1e-15;
const MAX_ROLLS = 64;

/** 상태공간을 설정에 맞춰 만든다. 무인도 규칙을 끄면 분할할 것이 없다. */
export function stateSpaceFor(config: ModelConfig): StateSpace {
  return buildStateSpace(config.enableJail ? config.jailModel : 'merged');
}

/** 한 턴을 전개해 전이확률·착지·월급·굴림 수를 한꺼번에 모은다. */
export function expandTurn(space: StateSpace, config: ModelConfig, fromIndex: number): TurnExpansion {
  const dice = diceOutcomes(config.diceFaces, config.diceCount);
  // 착지 결과는 칸마다 한 번만 계산해 두고 재사용한다.
  const landingTable = Array.from({ length: BOARD_SIZE }, (_, cell) => resolveLanding(cell, config));
  const next = new Array<number>(space.size).fill(0);
  const landings = new Array<number>(BOARD_SIZE).fill(0);
  const inflow: Record<InflowSource, number[]> = {
    dice: new Array<number>(BOARD_SIZE).fill(0),
    card: new Array<number>(BOARD_SIZE).fill(0),
    backstep: new Array<number>(BOARD_SIZE).fill(0),
    teleport: new Array<number>(BOARD_SIZE).fill(0),
    stay: new Array<number>(BOARD_SIZE).fill(0),
  };
  let salaryPasses = 0;
  let rolls = 0;

  const add = (target: number[], index: number, amount: number): void => {
    target[index] = (target[index] ?? 0) + amount;
  };

  /** 무인도 대기 상태의 인덱스. 뭉갠 모델에서는 10번 칸 하나뿐이다. */
  const jailIndex = (remaining: JailRemaining): number =>
    config.enableJail && config.jailModel === 'split'
      ? space.indexOf({ kind: 'jail', remaining })
      : space.indexOfCell(10);

  const settle = (position: Position, prob: number, source: InflowSource = 'dice'): void => {
    add(inflow[source], cellOfPosition(position), prob);
    if (position.kind === 'jail') add(next, jailIndex(3), prob);
    // 갇히지 않고 무인도 칸에 서 있는 상태는 '대기 종료'와 같다.
    else if (position.kind === 'islandFree') add(next, jailIndex(0), prob);
    else add(next, space.indexOfCell(position.cell), prob);
  };

  /**
   * 굴림을 **레벨 단위로 집계하며** 전개한다.
   *
   * 더블 재굴림 트리를 그대로 펼치면 분기가 (주사위 결과 × 카드 30장)^깊이 로
   * 폭발한다. 대신 "지금 굴리고 있는 확률질량"을 칸별로 모아 한 레벨씩 밀어내면
   * 깊이당 비용이 40 × 21 × 30 으로 일정해진다. 결과는 완전히 같다.
   */
  const rollFrom = (startCell: number): void => {
    let active = new Array<number>(BOARD_SIZE).fill(0);
    active[startCell] = 1;

    for (let depth = 0; depth < MAX_ROLLS; depth += 1) {
      const carried = new Array<number>(BOARD_SIZE).fill(0);
      let remaining = 0;

      for (let cell = 0; cell < BOARD_SIZE; cell += 1) {
        const mass = active[cell] ?? 0;
        if (mass < PROB_EPSILON) continue;

        for (const { sum, prob: diceProb, isDouble } of dice) {
          const p = mass * diceProb;
          rolls += p;
          const landing = wrap(cell + sum);
          salaryPasses += p * passesStart(cell, landing);

          for (const outcome of landingTable[landing] as LandingOutcome[]) {
            const q = p * outcome.prob;
            for (const visited of outcome.landings) add(landings, visited, q);
            salaryPasses += q * outcome.salaryPasses;

            if (outcome.endsTurn || !isDouble) {
              settle(outcome.position, q, outcome.source);
            } else {
              add(carried, cellOfPosition(outcome.position), q);
              remaining += q;
            }
          }
        }
      }

      if (remaining < PROB_EPSILON) return;
      active = carried;
    }

    // 절단된 잔량은 현재 위치에서 턴이 끝난 것으로 처리한다. 행 정규화가 마무리한다.
    active.forEach((mass, cell) => {
      if (mass > 0) settle({ kind: 'cell', cell }, mass);
    });
  };

  const state = space.states[fromIndex];
  if (state === undefined) throw new RangeError(`상태 인덱스가 범위를 벗어났습니다: ${fromIndex}`);

  // (1) 우주여행 — 지난 턴에 30번에 멈췄으므로 이번 턴은 목적지로 이동하는 데 쓴다.
  //     주사위를 굴리지 않으므로 이 턴의 굴림 수는 0이다.
  if (state.kind === 'cell' && state.cell === SPACE_TRAVEL_CELL && config.enableSpaceTravel) {
    for (const [target, targetProb] of teleportTargets(config.teleportPolicy)) {
      salaryPasses += targetProb * passesStart(SPACE_TRAVEL_CELL, target);
      for (const outcome of landingTable[target] as LandingOutcome[]) {
        const q = targetProb * outcome.prob;
        for (const visited of outcome.landings) add(landings, visited, q);
        salaryPasses += q * outcome.salaryPasses;
        // 우주여행으로 도착한 칸은 그 자체가 유입 경로다. 카드가 다시 옮겼다면 카드 몫이다.
        settle(outcome.position, q, outcome.source === 'dice' ? 'teleport' : outcome.source);
      }
    }
    return { next, landings, salaryPasses, rolls, inflow };
  }

  // (2) 무인도 대기 — 자기 차례마다 한 번 굴려 더블이면 탈출한다. 실패하면 카운터가 준다.
  //     탈출 시에는 나온 눈의 합만큼 이동하고 턴을 끝낸다. (가정 A3)
  const waiting =
    (state.kind === 'jail' && state.remaining > 0) ||
    (state.kind === 'cell' && state.cell === 10 && config.enableJail && config.jailModel === 'merged');

  if (waiting) {
    rolls = 1;
    for (const { sum, prob: diceProb, isDouble } of dice) {
      if (!isDouble) {
        // 뭉갠 모델은 대기 턴 수 상한이 없어 제자리에 머문다. 이것이 근사의 정체다.
        const remaining = state.kind === 'jail' ? ((state.remaining - 1) as JailRemaining) : 0;
        add(next, state.kind === 'jail' ? jailIndex(remaining) : space.indexOfCell(10), diceProb);
        // 새로 들어온 것이 아니라 계속 갇혀 있는 몫이다. 유입과 구분해 센다.
        add(inflow.stay, ISLAND_CELL, diceProb);
        continue;
      }
      const landing = wrap(10 + sum);
      salaryPasses += diceProb * passesStart(10, landing);
      for (const outcome of landingTable[landing] as LandingOutcome[]) {
        const q = diceProb * outcome.prob;
        for (const visited of outcome.landings) add(landings, visited, q);
        salaryPasses += q * outcome.salaryPasses;
        // 우주여행으로 도착한 칸은 그 자체가 유입 경로다. 카드가 다시 옮겼다면 카드 몫이다.
        settle(outcome.position, q, outcome.source === 'dice' ? 'teleport' : outcome.source);
      }
    }
    return { next, landings, salaryPasses, rolls, inflow };
  }

  // (3) 그 밖에는 정상 굴림. J₀ 는 무인도 칸에서 자유롭게 이동하는 상태다.
  rollFrom(state.kind === 'cell' ? state.cell : 10);
  return { next, landings, salaryPasses, rolls, inflow };
}

export interface TransitionModel {
  readonly space: StateSpace;
  readonly config: ModelConfig;
  /** 43×43 전이행렬. 각 행의 합은 1이다. */
  readonly matrix: number[][];
  /** 상태 i 에서 턴을 시작할 때 각 칸에 착지하는 기대 횟수. */
  readonly landings: number[][];
  /** 상태 i 에서 턴을 시작할 때 출발선을 지나는 기대 횟수. */
  readonly salaryPasses: number[];
  /** 상태 i 에서 턴을 시작할 때의 기대 굴림 횟수. */
  readonly rolls: number[];
  /** 상태 i 에서 다음 턴 시작 칸으로 들어가는 경로별 확률. */
  readonly inflow: Record<InflowSource, number[]>[];
}

/**
 * 전이행렬을 만든다.
 *
 * 부동소수점 때문에 행 합이 정확히 1이 되지 않으므로 **마지막에 행 정규화를 한 번**
 * 수행한다. (§11.1)
 */
export function buildTransitionModel(config: ModelConfig): TransitionModel {
  const space = stateSpaceFor(config);
  const matrix: number[][] = [];
  const landings: number[][] = [];
  const salaryPasses: number[] = [];
  const rolls: number[] = [];
  const inflow: Record<InflowSource, number[]>[] = [];

  for (let i = 0; i < space.size; i += 1) {
    const turn = expandTurn(space, config, i);
    const total = turn.next.reduce((a, b) => a + b, 0);
    matrix.push(total > 0 ? turn.next.map((p) => p / total) : turn.next);
    landings.push(turn.landings);
    salaryPasses.push(turn.salaryPasses);
    rolls.push(turn.rolls);
    inflow.push(turn.inflow);
  }

  return { space, config, matrix, landings, salaryPasses, rolls, inflow };
}
