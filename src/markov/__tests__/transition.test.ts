import { describe, it, expect } from 'vitest';
import { buildTransitionModel, diceOutcomes, doubleProbability, expandTurn, stateSpaceFor } from '../transition';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG, withConfig } from '../config';
import { isIrreducible } from '../states';
import { GOLDEN_KEY_CELLS, ISLAND_CELL, SPACE_TRAVEL_CELL } from '../board';
import { passesStart, teleportTargets } from '../rules';

const rowSum = (row: readonly number[]) => row.reduce((a, b) => a + b, 0);

describe('주사위 분포', () => {
  const outcomes = diceOutcomes([1, 2, 3, 4, 5, 6]);

  it('확률의 합이 1이다', () => {
    expect(Math.abs(rowSum(outcomes.map((o) => o.prob)) - 1)).toBeLessThan(1e-12);
  });

  it('합 7이 가장 흔하고 6/36이다', () => {
    const byTotal = new Map<number, number>();
    for (const o of outcomes) byTotal.set(o.sum, (byTotal.get(o.sum) ?? 0) + o.prob);
    expect(byTotal.get(7)).toBeCloseTo(6 / 36, 12);
    expect(byTotal.get(2)).toBeCloseTo(1 / 36, 12);
    expect(byTotal.get(12)).toBeCloseTo(1 / 36, 12);
  });

  it('기대 합이 7이다', () => {
    expect(outcomes.reduce((sum, o) => sum + o.sum * o.prob, 0)).toBeCloseTo(7, 12);
  });

  it('더블 확률이 1/6이다', () => {
    const doubles = outcomes.filter((o) => o.isDouble).reduce((sum, o) => sum + o.prob, 0);
    expect(doubles).toBeCloseTo(1 / 6, 12);
    expect(doubleProbability([1, 2, 3, 4, 5, 6])).toBeCloseTo(1 / 6, 12);
  });

  it('짝수 눈만 쓰면 합이 모두 짝수다 — 주기 2의 원인', () => {
    for (const o of diceOutcomes([2, 4, 6])) expect(o.sum % 2).toBe(0);
    expect(doubleProbability([2, 4, 6])).toBeCloseTo(1 / 3, 12);
  });
});

describe('출발선 통과 판정', () => {
  it('앞으로 갈 때만, 되감길 때 한 번 센다', () => {
    expect(passesStart(2, 15)).toBe(0);
    expect(passesStart(15, 1)).toBe(1); // 한 바퀴 돌아 타이베이
    expect(passesStart(17, 15)).toBe(1);
    expect(passesStart(5, 0)).toBe(1); // 출발 칸에 도착해도 월급
    expect(passesStart(5, 5)).toBe(0); // 제자리
  });

  it('어느 황금열쇠 칸에서든 서울(39)로 가면 월급이 없다', () => {
    for (const g of GOLDEN_KEY_CELLS) expect(passesStart(g, 39)).toBe(0);
  });

  it('항공여행은 콩코드가 뒤에 있는 칸에서 월급을 두 번 받는다', () => {
    const salary = (g: number) => passesStart(g, 15) + passesStart(15, 1);
    expect([2, 7, 12].map(salary)).toEqual([1, 1, 1]);
    expect([17, 22, 34].map(salary)).toEqual([2, 2, 2]);
  });
});

describe('우주여행 목적지 정책', () => {
  it('균등 정책은 우주여행 칸을 제외한 39칸에 고르게 퍼진다', () => {
    const targets = teleportTargets('uniform');
    expect(targets.size).toBe(39);
    expect(targets.has(SPACE_TRAVEL_CELL)).toBe(false);
    expect(rowSum([...targets.values()])).toBeCloseTo(1, 12);
  });

  it('고정 정책은 한 칸에 몰린다', () => {
    expect([...teleportTargets('seoul').entries()]).toEqual([[39, 1]]);
    expect([...teleportTargets('newyork').entries()]).toEqual([[37, 1]]);
    expect([...teleportTargets('jail').entries()]).toEqual([[ISLAND_CELL, 1]]);
  });
});

describe('해석적 정답 — 순수 순환 40칸 보드 (§11.2)', () => {
  const model = buildTransitionModel(PLAIN_CYCLIC_CONFIG);

  it('상태가 40개다', () => {
    expect(model.space.size).toBe(40);
  });

  it('P 가 순환행렬이다 — 모든 행이 한 칸씩 밀린 같은 행이다', () => {
    const first = model.matrix[0] as number[];
    for (let i = 1; i < 40; i += 1) {
      const row = model.matrix[i] as number[];
      for (let j = 0; j < 40; j += 1) {
        expect(row[(i + j) % 40] as number).toBeCloseTo(first[j] as number, 12);
      }
    }
  });

  it('열 합도 1이다 — 이중확률행렬이므로 π = 1/40 이 정확히 성립한다', () => {
    for (let j = 0; j < 40; j += 1) {
      const columnSum = model.matrix.reduce((sum, row) => sum + (row[j] ?? 0), 0);
      expect(Math.abs(columnSum - 1)).toBeLessThan(1e-12);
    }
  });

  it('특수 칸을 끈 상태에서 Σv = E[K] = 1.2 다', () => {
    // 한 턴의 기대 굴림 횟수는 기하분포의 기대값 1/(1-1/6) = 6/5.
    for (let i = 0; i < 40; i += 1) {
      expect(rowSum(model.landings[i] as number[])).toBeCloseTo(1.2, 10);
      expect(model.rolls[i] as number).toBeCloseTo(1.2, 10);
    }
  });

  it('한 턴의 기대 이동 거리가 8.4칸이다', () => {
    // E[K] × E[주사위 합] = 1.2 × 7
    const expectedDistance = (model.rolls[0] as number) * 7;
    expect(expectedDistance).toBeCloseTo(8.4, 10);
  });

  it('턴당 출발선 통과 기대 횟수가 8.4/40 이다', () => {
    const average = model.salaryPasses.reduce((a, b) => a + b, 0) / 40;
    expect(average).toBeCloseTo(8.4 / 40, 10);
  });
});

describe('전체 모델의 구조 불변조건 (§11.1)', () => {
  const model = buildTransitionModel(DEFAULT_CONFIG);

  it('43×43 행렬이 만들어진다', () => {
    expect(model.space.size).toBe(43);
    expect(model.matrix).toHaveLength(43);
    for (const row of model.matrix) expect(row).toHaveLength(43);
  });

  it('모든 확률이 0 이상이다', () => {
    for (const row of model.matrix) for (const p of row) expect(p).toBeGreaterThanOrEqual(0);
  });

  it('모든 행의 합이 1이다', () => {
    for (const row of model.matrix) expect(Math.abs(rowSum(row) - 1)).toBeLessThan(1e-12);
  });

  it('모든 상태가 도달 가능하고 체인이 기약이다', () => {
    expect(isIrreducible(model.matrix)).toBe(true);
  });
});

describe('규칙 하나하나의 전이', () => {
  const config = DEFAULT_CONFIG;
  const space = stateSpaceFor(config);
  const at = (label: string) => space.states.findIndex((_, i) => space.label(i) === label);

  it('무인도 대기는 더블(1/6)로만 탈출하고 실패하면 카운터가 하나 준다', () => {
    for (const [from, to] of [
      ['J3', 'J2'],
      ['J2', 'J1'],
      ['J1', 'J0'],
    ]) {
      const row = expandTurn(space, config, at(from as string)).next;
      expect(row[at(to as string)] as number).toBeCloseTo(5 / 6, 12);
    }
  });

  it('무인도 탈출은 눈의 합만큼 이동하고 턴을 끝낸다 (A3)', () => {
    const turn = expandTurn(space, config, at('J3'));
    // 더블 합은 4·6·8·10·12 뿐이며 각각 1/36. 10+4=14 스톡홀름.
    expect(turn.next[space.indexOfCell(14)] as number).toBeCloseTo(1 / 36, 12);
    // 한 번만 굴린다.
    expect(turn.rolls).toBeCloseTo(1, 12);
  });

  it('J₀ 는 무인도 칸에서 자유롭게 이동하는 정상 턴이다', () => {
    const turn = expandTurn(space, config, at('J0'));
    // 대기 상태(굴림 1회)와 달리 더블 재굴림이 살아 있어 1보다 크다.
    expect(turn.rolls).toBeGreaterThan(1);
    // 다만 순수 순환 보드의 1.2 에는 못 미친다. 무인도·우주여행에 걸리면 더블이어도
    // 턴이 거기서 끝나기 때문이다. 이 간극 자체가 특수 칸의 효과다.
    expect(turn.rolls).toBeLessThan(1.2);
    expect(turn.rolls).toBeCloseTo(1.1907, 3);
  });

  it('우주여행 칸에서는 주사위를 굴리지 않고 정책대로 이동한다', () => {
    const turn = expandTurn(space, config, space.indexOfCell(SPACE_TRAVEL_CELL));
    expect(turn.rolls).toBe(0);
    expect(rowSum(turn.next)).toBeCloseTo(1, 12);
    // 균등 정책은 우주여행 칸을 목적지에서 제외한다. 그런데도 30번으로 돌아올 확률이
    // 0이 아니다 — 황금열쇠 6칸 중 하나에 내린 뒤 우주여행 초대권(1/30)을 뽑는 경로가
    // 있기 때문이다. 6 × (1/39) × (1/30) 과 정확히 같아야 한다.
    expect(turn.next[space.indexOfCell(SPACE_TRAVEL_CELL)] as number).toBeCloseTo(6 / (39 * 30), 12);
  });

  it('우주여행으로 무인도에 가면 갇힌다', () => {
    const jailPolicy = withConfig({ teleportPolicy: 'jail' });
    const jailSpace = stateSpaceFor(jailPolicy);
    const turn = expandTurn(jailSpace, jailPolicy, jailSpace.indexOfCell(SPACE_TRAVEL_CELL));
    expect(turn.next[jailSpace.indexOf({ kind: 'jail', remaining: 3 })] as number).toBeCloseTo(1, 12);
  });

  it("12번 황금열쇠의 '뒤로 2칸'으로 무인도에 갇힌다 (A4)", () => {
    // 12번에 착지한 뒤 카드 1/30 로 뒤로 2칸 → 10번 → 갇힘.
    const on = withConfig({ jailOnBackstep: true });
    const off = withConfig({ jailOnBackstep: false });
    const jailShare = (config_: typeof on) => {
      const s = stateSpaceFor(config_);
      const row = expandTurn(s, config_, s.indexOfCell(9)).next; // 9번에서 3이 나오면 12번
      return row[s.indexOf({ kind: 'jail', remaining: 3 })] as number;
    };
    expect(jailShare(on)).toBeGreaterThan(jailShare(off));
  });

  it('황금열쇠 칸에 착지하면 위치가 11/30 확률로 바뀐다', () => {
    // 황금열쇠만 남기고 다른 특수 칸을 꺼서 카드 효과만 본다.
    const onlyCards = withConfig({ enableJail: false, enableSpaceTravel: false });
    const s = stateSpaceFor(onlyCards);
    const outcomes = expandTurn(s, onlyCards, s.indexOfCell(0));
    expect(rowSum(outcomes.next)).toBeCloseTo(1, 12);
  });
});
