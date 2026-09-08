import { describe, it, expect } from 'vitest';
import { buildStateSpace, reachableFrom, pruneUnreachable, isIrreducible } from '../states';
import { ISLAND_CELL } from '../board';
import { buildToyMatrix } from '../toy';

describe('상태공간 생성', () => {
  const space = buildStateSpace('split');

  it('43개 상태가 생성된다 — 39칸 + 무인도 4단계', () => {
    expect(space.size).toBe(43);
  });

  it('무인도를 뭉갠 모델은 40개다', () => {
    expect(buildStateSpace('merged').size).toBe(40);
  });

  it('각 상태의 의미를 한 줄로 설명할 수 있다', () => {
    // 칸 번호 순서를 유지하고 10번 자리에 J₃ · J₂ · J₁ · J₀ 를 끼워 넣는다.
    expect(space.states.slice(9, 15).map((_, i) => space.label(9 + i))).toEqual(['c9', 'J3', 'J2', 'J1', 'J0', 'c11']);
  });

  it('10번 칸에서 시작하면 J₃ 를 가리킨다', () => {
    expect(space.label(space.indexOfCell(ISLAND_CELL))).toBe('J3');
  });

  it('무인도 4상태는 모두 보드 칸 10번에 대응한다', () => {
    for (const label of ['J3', 'J2', 'J1', 'J0']) {
      const i = space.states.findIndex((_, k) => space.label(k) === label);
      expect(space.cellOf(i)).toBe(ISLAND_CELL);
    }
  });

  it('칸 번호와 상태 인덱스가 서로 되돌아간다', () => {
    for (const cell of [0, 5, 9, 11, 30, 39]) {
      expect(space.cellOf(space.indexOfCell(cell))).toBe(cell);
    }
  });

  it('없는 상태를 물으면 던진다', () => {
    expect(() => space.indexOf({ kind: 'cell', cell: ISLAND_CELL })).toThrow();
    expect(() => space.label(43)).toThrow();
  });
});

describe('BFS 도달성 검사', () => {
  it('4상태 축소 모델에서 3번 칸이 도달 불가능으로 걸러진다', () => {
    const toy = buildToyMatrix();
    expect([...reachableFrom(toy, 0)].sort()).toEqual([0, 1, 2]);

    const pruned = pruneUnreachable(toy, 0);
    expect(pruned.kept).toEqual([0, 1, 2]);
    expect(pruned.removed).toEqual([3]);
    expect(pruned.matrix).toHaveLength(3);
  });

  it('가지치기 후에도 각 행의 합이 1이다', () => {
    // 3번으로 가는 확률이 없었으므로 잘라내도 확률이 새지 않는다.
    for (const row of pruneUnreachable(buildToyMatrix(), 0).matrix) {
      expect(Math.abs(row.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-12);
    }
  });

  it('가지치기 후 4상태 모델이 기약이다', () => {
    expect(isIrreducible(pruneUnreachable(buildToyMatrix(), 0).matrix)).toBe(true);
    // 가지치기 전에는 3번으로 되돌아갈 수 없어 기약이 아니다.
    expect(isIrreducible(buildToyMatrix())).toBe(false);
  });

  it('두 덩어리로 끊긴 체인은 기약이 아니다', () => {
    const disconnected = [
      [0.5, 0.5, 0, 0],
      [0.5, 0.5, 0, 0],
      [0, 0, 0.5, 0.5],
      [0, 0, 0.5, 0.5],
    ];
    expect(isIrreducible(disconnected)).toBe(false);
  });
});
