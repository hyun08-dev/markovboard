import { describe, it, expect } from 'vitest';
import { solveLinearSystem, expectedHittingTimes, absorptionProbabilities, meanReturnTime, verifyKac } from '../hitting';
import { buildToyReachable, TOY_EXACT_RETURN_TIMES, TOY_EXACT_PI } from '../toy';
import { buildTransitionModel } from '../transition';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG } from '../config';
import { powerIteration } from '../power';

describe('선형계 풀이', () => {
  it('작은 계를 정확히 푼다', () => {
    const x = solveLinearSystem([[2, 1], [1, 3]], [5, 10]);
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(3, 12);
  });

  it('피벗이 필요한 계도 푼다', () => {
    const x = solveLinearSystem([[0, 1], [1, 0]], [2, 3]);
    expect(x[0]).toBeCloseTo(3, 12);
    expect(x[1]).toBeCloseTo(2, 12);
  });

  it('특이행렬은 던진다', () => {
    expect(() => solveLinearSystem([[1, 1], [2, 2]], [1, 2])).toThrow();
  });
});

describe('Kac 보조정리 — 4상태 축소 모델', () => {
  const { matrix } = buildToyReachable();

  it('평균 재귀시간이 손계산 (6, 2, 3) 과 일치한다', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(meanReturnTime(matrix, i)).toBeCloseTo(TOY_EXACT_RETURN_TIMES[i] as number, 10);
    }
  });

  it('m_ii = 1/π_i 가 성립한다', () => {
    for (const check of verifyKac(matrix, powerIteration(matrix).pi)) {
      expect(check.relativeError).toBeLessThan(1e-10);
      expect(check.predicted).toBeCloseTo(1 / (TOY_EXACT_PI[check.state] as number), 8);
    }
  });
});

describe('Kac 보조정리 — 실제 모델 (§11.4 세 번째 검증 축)', () => {
  it('순수 순환 보드에서 모든 재귀시간이 정확히 40이다', () => {
    const model = buildTransitionModel(PLAIN_CYCLIC_CONFIG);
    for (let i = 0; i < 5; i += 1) expect(meanReturnTime(model.matrix, i)).toBeCloseTo(40, 8);
  });

  it('43상태 모델에서 선형계와 멱승법이 서로를 검증한다', () => {
    const model = buildTransitionModel(DEFAULT_CONFIG);
    const pi = powerIteration(model.matrix).pi;
    // 두 경로는 공유하는 계산이 전혀 없다 — 한쪽이 틀리면 어긋난다.
    for (const check of verifyKac(model.matrix, pi)) expect(check.relativeError).toBeLessThan(1e-9);
  });
});

describe('첫 도달 시간과 흡수 확률', () => {
  const model = buildTransitionModel(DEFAULT_CONFIG);

  it('목표 상태 자신의 도달 시간은 0이다', () => {
    const target = model.space.indexOfCell(39);
    expect(expectedHittingTimes(model.matrix, [target])[target]).toBe(0);
  });

  it('서울까지의 기대 도달 시간이 양수이고 유한하다', () => {
    const times = expectedHittingTimes(model.matrix, [model.space.indexOfCell(39)]);
    for (const t of times) {
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it('흡수 확률의 합이 1이다', () => {
    const targets = [model.space.indexOfCell(39), model.space.indexOfCell(37)];
    for (const row of absorptionProbabilities(model.matrix, targets)) {
      expect(Math.abs(row.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9);
    }
  });

  it('더 가까운 칸에 먼저 닿는다는 직관이 틀린다', () => {
    // 35번 로마에서 보면 37번 뉴욕은 2칸, 39번 서울은 4칸 앞이다.
    // 그런데도 서울에 먼저 닿을 확률이 더 높다.
    //
    // 주사위 두 개의 합이 2일 확률은 1/36 뿐이고 4일 확률은 3/36 이다.
    // '가까울수록 잘 걸린다'가 성립하지 않는 이유이며, 잔여 칸별 도착 확률이
    // 7칸에서 최대가 되는 것과 같은 현상이다. (§10 실험 4)
    const targets = [model.space.indexOfCell(39), model.space.indexOfCell(37)];
    const row = absorptionProbabilities(model.matrix, targets)[model.space.indexOfCell(35)] as number[];
    expect(row[0] as number).toBeGreaterThan(row[1] as number);
    expect(row[0] as number).toBeCloseTo(0.5957, 3);
  });
});
