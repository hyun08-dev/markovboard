/**
 * states.ts — 상태공간 생성과 BFS 도달성 검사. (계획서 §3.2)
 *
 * 체인의 한 스텝은 **한 플레이어의 완전한 턴**이다. 굴림 단위가 아니라 턴 단위를
 * 택한 이유는 무인도 대기가 턴 단위로 규정되어 있기 때문이다. 굴림 단위로 정의하면
 * 더블 재굴림 때문에 '3턴 대기'를 셀 수 없다. (§3.1)
 *
 * **더블 카운터는 상태에 넣지 않는다.** 부루마불 기본 룰에는 3연속 더블 페널티가
 * 없으므로(A1) 더블은 "그 턴 안에서 한 번 더 굴린다"는 의미만 가지며 다음 턴의
 * 분포에 영향을 주지 않는다. 즉 더블은 턴 내부 전개에서 처리되고 상태에는 나타나지
 * 않는다. 이 하나의 판단이 상태 수를 43개로 묶어 준다.
 */

import { BOARD_SIZE, ISLAND_CELL } from './board';
import type { JailModel } from './config';

/** 남은 무인도 대기 턴 수. J0 은 대기가 끝나 자유롭게 이동할 수 있는 상태다. */
export type JailRemaining = 0 | 1 | 2 | 3;

export type State =
  /** 해당 번호 칸에서 턴을 시작한다. */
  | { readonly kind: 'cell'; readonly cell: number }
  /** 무인도에 갇힌 채 턴을 시작한다. */
  | { readonly kind: 'jail'; readonly remaining: JailRemaining };

export interface StateSpace {
  readonly states: readonly State[];
  readonly size: number;
  /** 상태 → 인덱스. */
  indexOf(state: State): number;
  /** 칸 번호로 시작 상태의 인덱스를 얻는다. 10번은 J₃ 를 가리킨다. */
  indexOfCell(cell: number): number;
  /** 인덱스 → 사람이 읽는 이름. ('c17', 'J2' 형태) */
  label(index: number): string;
  /** 인덱스 → 보드 칸 번호. 무인도 상태는 모두 10을 돌려준다. */
  cellOf(index: number): number;
}

function keyOf(state: State): string {
  return state.kind === 'cell' ? `c${state.cell}` : `J${state.remaining}`;
}

/**
 * 상태공간을 만든다.
 *
 * - `'split'` — 무인도만 대기 카운터로 4분할. |S| = 39 + 4 = 43
 * - `'merged'` — 무인도를 한 상태로 뭉갠 근사. |S| = 40 (§10 실험 9)
 *
 * 칸 번호 순서를 유지하되 10번 자리에 J₃ · J₂ · J₁ · J₀ 를 끼워 넣는다.
 * 히트맵이 인덱스를 칸 번호로 되돌리기 쉬워진다.
 */
export function buildStateSpace(jailModel: JailModel): StateSpace {
  const states: State[] = [];
  for (let cell = 0; cell < BOARD_SIZE; cell += 1) {
    if (cell === ISLAND_CELL && jailModel === 'split') {
      states.push({ kind: 'jail', remaining: 3 }, { kind: 'jail', remaining: 2 }, { kind: 'jail', remaining: 1 }, { kind: 'jail', remaining: 0 });
    } else {
      states.push({ kind: 'cell', cell });
    }
  }

  const index = new Map<string, number>();
  states.forEach((state, i) => index.set(keyOf(state), i));

  const lookup = (state: State): number => {
    const i = index.get(keyOf(state));
    if (i === undefined) throw new RangeError(`상태공간에 없는 상태입니다: ${keyOf(state)}`);
    return i;
  };

  return {
    states,
    size: states.length,
    indexOf: lookup,
    indexOfCell(cell) {
      if (cell === ISLAND_CELL && jailModel === 'split') return lookup({ kind: 'jail', remaining: 3 });
      return lookup({ kind: 'cell', cell });
    },
    label(i) {
      const state = states[i];
      if (state === undefined) throw new RangeError(`상태 인덱스가 범위를 벗어났습니다: ${i}`);
      return keyOf(state);
    },
    cellOf(i) {
      const state = states[i];
      if (state === undefined) throw new RangeError(`상태 인덱스가 범위를 벗어났습니다: ${i}`);
      return state.kind === 'cell' ? state.cell : ISLAND_CELL;
    },
  };
}

/**
 * 출발 상태에서 BFS로 도달 가능한 상태를 찾는다.
 *
 * 이 전처리를 생략하면 기약성이 깨져 멱승법이 수렴하지 않거나 π 에 의미 없는 0이
 * 섞인다. 4상태 축소 모델에서 3번 칸이 걸러지는 것과 같은 상황이다. (§3.2)
 */
export function reachableFrom(matrix: readonly (readonly number[])[], start: number): Set<number> {
  const seen = new Set<number>([start]);
  const queue: number[] = [start];
  while (queue.length > 0) {
    const from = queue.shift() as number;
    const row = matrix[from];
    if (row === undefined) continue;
    row.forEach((p, to) => {
      if (p > 0 && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    });
  }
  return seen;
}

/**
 * 모든 상태가 서로 도달 가능한지(강연결) 검사한다. 기약성 조건이다. (§3.5)
 *
 * 전이의 방향을 뒤집은 그래프에서도 전부 도달 가능하면, 출발 상태를 거쳐 어떤
 * 상태에서 어떤 상태로도 갈 수 있다.
 */
export function isIrreducible(matrix: readonly (readonly number[])[], start = 0): boolean {
  const n = matrix.length;
  const forward = reachableFrom(matrix, start);
  if (forward.size !== n) return false;

  const reversed: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  matrix.forEach((row, from) => {
    row.forEach((p, to) => {
      if (p > 0) {
        const target = reversed[to];
        if (target !== undefined) target[from] = 1;
      }
    });
  });
  return reachableFrom(reversed, start).size === n;
}

export interface PrunedSpace {
  /** 남은 상태의 원래 인덱스 목록. */
  readonly kept: readonly number[];
  /** 제거된 상태의 원래 인덱스 목록. */
  readonly removed: readonly number[];
  /** 남은 상태만으로 다시 만든 정사각 행렬. */
  readonly matrix: number[][];
}

/** 도달 불가능한 상태를 제거하고 부분행렬을 돌려준다. */
export function pruneUnreachable(matrix: readonly (readonly number[])[], start: number): PrunedSpace {
  const reachable = reachableFrom(matrix, start);
  const kept: number[] = [];
  const removed: number[] = [];
  for (let i = 0; i < matrix.length; i += 1) (reachable.has(i) ? kept : removed).push(i);

  const pruned = kept.map((i) => kept.map((j) => matrix[i]?.[j] ?? 0));
  return { kept, removed, matrix: pruned };
}
