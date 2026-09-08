import { describe, it, expect } from 'vitest';
import { powerIteration, deflatedLambda2, logRegressionLambda2, multiply, l1, normalize } from '../power';
import { buildTransitionModel } from '../transition';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG, withConfig } from '../config';
import { buildToyReachable, TOY_EXACT_PI, TOY_EXACT_LAMBDA2 } from '../toy';
import { isIrreducible } from '../states';

describe('벡터·행렬 기본 연산', () => {
  it('πP 를 올바르게 곱한다', () => {
    expect(multiply([0.5, 0.5], [[0, 1], [1, 0]])).toEqual([0.5, 0.5]);
    expect(multiply([1, 0], [[0.2, 0.8], [0.5, 0.5]])).toEqual([0.2, 0.8]);
  });

  it('ℓ¹ 거리와 정규화', () => {
    expect(l1([1, 0], [0, 1])).toBe(2);
    expect(normalize([1, 3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe('4상태 축소 모델 — 손계산 · NumPy · TypeScript 대조 (§11.3)', () => {
  const { matrix } = buildToyReachable();
  const result = powerIteration(matrix);

  it('TypeScript 멱승법이 손계산 π = (1/6, 1/2, 1/3) 과 일치한다', () => {
    expect(result.converged).toBe(true);
    result.pi.forEach((value, i) => expect(value).toBeCloseTo(TOY_EXACT_PI[i] as number, 12));
  });

  it('잔차 ‖πP − π‖₁ 이 충분히 작다', () => {
    expect(result.residual).toBeLessThan(1e-12);
  });

  it('디플레이션 이론값이 손계산 |λ₂| = 1/2 와 일치한다', () => {
    const { magnitude, converged, oscillating } = deflatedLambda2(matrix, result.pi);
    expect(converged).toBe(true);
    // λ₂ = −1/2 는 실수이므로 스텝별 성장률이 진동하지 않는다.
    expect(oscillating).toBe(false);
    expect(magnitude).toBeCloseTo(TOY_EXACT_LAMBDA2, 8);
  });

  it('로그 회귀 실측값도 |λ₂| = 1/2 를 낸다', () => {
    const { magnitude, r2 } = logRegressionLambda2(result.steps);
    expect(magnitude).toBeCloseTo(TOY_EXACT_LAMBDA2, 4);
    // 오차가 정확히 등비수열이므로 직선에 완벽히 얹힌다.
    expect(r2).toBeGreaterThan(0.999999);
  });

  it('초기 분포를 바꿔도 같은 π 로 수렴한다', () => {
    for (const initial of ['start', 'uniform', [0.1, 0.2, 0.7]] as const) {
      const other = powerIteration(matrix, { initial: initial as never });
      other.pi.forEach((value, i) => expect(value).toBeCloseTo(TOY_EXACT_PI[i] as number, 12));
    }
  });
});

describe('해석적 정답 — 순수 순환 보드에서 정확히 1/40 (§11.2)', () => {
  const model = buildTransitionModel(PLAIN_CYCLIC_CONFIG);
  const result = powerIteration(model.matrix);

  it('모든 칸의 정상확률이 1/40 이다', () => {
    for (const value of result.pi) expect(value).toBeCloseTo(1 / 40, 12);
  });

  it('합이 1이고 모두 0 이상이다', () => {
    expect(result.pi.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    for (const value of result.pi) expect(value).toBeGreaterThanOrEqual(0);
  });
});

describe('전체 43상태 모델', () => {
  const model = buildTransitionModel(DEFAULT_CONFIG);
  const result = powerIteration(model.matrix);

  it('수렴하고 잔차가 충분히 작다', () => {
    expect(result.converged).toBe(true);
    expect(result.residual).toBeLessThan(1e-12);
  });

  it('π 가 확률벡터다', () => {
    expect(result.pi.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    for (const value of result.pi) expect(value).toBeGreaterThan(0);
  });

  it('기약·비주기 조건이 만족되어 초기 분포와 무관하게 같은 곳으로 간다', () => {
    const fromUniform = powerIteration(model.matrix, { initial: 'uniform' });
    expect(l1(result.pi, fromUniform.pi)).toBeLessThan(1e-11);
  });

  it('|λ₂| 의 이론값과 실측값이 오차 범위 내에서 일치한다', () => {
    const theory = deflatedLambda2(model.matrix, result.pi);
    const measured = logRegressionLambda2(result.steps);
    expect(theory.magnitude).toBeGreaterThan(0);
    expect(theory.magnitude).toBeLessThan(1);
    expect(measured.r2).toBeGreaterThan(0.99);
    expect(Math.abs(theory.magnitude - measured.magnitude)).toBeLessThan(0.01);
  });

  it('λ₂ 가 복소수임이 디플레이션의 진동으로 드러난다 (계획서 §15)', () => {
    // 스텝별 성장률이 |λ₂| 를 중심으로 오르내린다. 켤레쌍이 회전하기 때문이다.
    const theory = deflatedLambda2(model.matrix, result.pi);
    expect(theory.oscillating).toBe(true);
    expect(Math.abs(theory.lastRatio - theory.magnitude)).toBeGreaterThan(1e-3);
    // 순간 성장률은 끝내 한 값으로 수렴하지 않는다 — 계획서가 예상한 그대로다.
    expect(theory.converged).toBe(false);
    // 그런데도 성장률의 기하평균은 쓸 만한 |λ₂| 를 준다.
    expect(theory.magnitude).toBeCloseTo(logRegressionLambda2(result.steps).magnitude, 2);
  });

  it('스텝 변화와 실제 오차는 서로 다른 값이다 (§3.6 주의)', () => {
    const step = result.steps[5];
    expect(step).toBeDefined();
    expect((step as { stepChange: number }).stepChange).not.toBe((step as { error: number }).error);
  });
});

describe('Perron–Frobenius 조건 데모 (§10 실험 12)', () => {
  it('짝수 눈만 쓰면 기약성이 깨진다 — 주기성이 아니다', () => {
    // 이동 거리가 모두 짝수이므로 짝수 칸에서 홀수 칸으로 갈 수 없다.
    // 체인이 두 개의 닫힌 집합으로 쪼개져 정상분포가 유일하지 않다.
    const evenOnly = withConfig({
      diceFaces: [2, 4, 6],
      enableGoldenKey: false,
      enableSpaceTravel: false,
      enableJail: false,
    });
    const model = buildTransitionModel(evenOnly);
    expect(isIrreducible(model.matrix)).toBe(false);

    // 초기 분포에 따라 서로 다른 곳으로 수렴한다 — 유일성이 깨진 증거.
    const fromEven = powerIteration(model.matrix, { initial: 'start', startIndex: 0 });
    const fromOdd = powerIteration(model.matrix, { initial: 'start', startIndex: 1 });
    expect(l1(fromEven.pi, fromOdd.pi)).toBeGreaterThan(1.9);
    expect(fromEven.pi.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12);
    expect(fromOdd.pi.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12);
  });

  it('주사위 하나 + 홀수 눈이면 주기 2가 생겨 멱승법이 진동한다', () => {
    // 홀수를 짝수 번 더해야만 40의 배수가 되므로 모든 주기가 짝수다.
    const oddSingle = withConfig({
      diceFaces: [1, 3, 5],
      diceCount: 1,
      enableGoldenKey: false,
      enableSpaceTravel: false,
      enableJail: false,
    });
    const model = buildTransitionModel(oddSingle);

    // 기약이다 — 모든 칸에 갈 수 있다. 그런데도 수렴하지 않는다.
    expect(isIrreducible(model.matrix)).toBe(true);
    const result = powerIteration(model.matrix, { maxIterations: 300 });
    expect(result.converged).toBe(false);

    // steps[i] 는 k = i + 1 이다. 0번 칸(짝수)에서 출발했으므로 홀수 스텝 뒤에는
    // 홀수 칸에만, 짝수 스텝 뒤에는 짝수 칸에만 확률이 놓인다.
    const afterOddStep = result.steps[198]?.distribution as readonly number[]; // k = 199
    const afterEvenStep = result.steps[199]?.distribution as readonly number[]; // k = 200
    expect(afterOddStep.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
    expect(afterEvenStep.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);

    // 두 스텝을 묶으면(P²) 각 절반 안에서는 정상적으로 수렴해 간다.
    // 한 스텝 거리는 두 절반을 오가느라 2에 가깝지만, 두 스텝 거리는 훨씬 작다.
    const oneStep = l1(afterOddStep, afterEvenStep);
    const twoStep = l1(afterEvenStep, result.steps[201]?.distribution as readonly number[]);
    expect(oneStep).toBeGreaterThan(1.9);
    expect(twoStep).toBeLessThan(oneStep / 100);
  });
});
