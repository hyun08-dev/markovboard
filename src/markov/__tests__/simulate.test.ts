import { describe, it, expect } from 'vitest';
import { simulate, chainConfidence, createRandom } from '../simulate';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG, withConfig } from '../config';
import { buildTransitionModel } from '../transition';
import { powerIteration } from '../power';
import { landingProfile } from '../landing';

const analytic = (config: typeof DEFAULT_CONFIG) => {
  const model = buildTransitionModel(config);
  const pi = powerIteration(model.matrix).pi;
  return landingProfile(model, pi);
};

describe('난수 발생기', () => {
  it('씨앗이 같으면 같은 수열이 나온다 — 실험을 재현할 수 있다', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b());
  });

  it('씨앗이 다르면 수열도 다르다', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it('[0, 1) 안에 머물고 평균이 0.5 근처다', () => {
    const random = createRandom(7);
    let sum = 0;
    for (let i = 0; i < 20000; i += 1) {
      const x = random();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 2);
  });
});

describe('몬테카를로 — 해석해와의 대조 (§11.4)', () => {
  const profile = analytic(DEFAULT_CONFIG);
  const result = simulate(DEFAULT_CONFIG, { chains: 120, turnsPerChain: 1200, burnIn: 200, seed: 20260908 });

  it('경험 확률의 합이 1이다', () => {
    expect(result.piByCell.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('경험 분포가 해석해와 가깝다', () => {
    const distance = result.piByCell.reduce((sum, p, i) => sum + Math.abs(p - (profile.piByCell[i] ?? 0)), 0);
    expect(distance).toBeLessThan(0.02);
  });

  it('체인 간 분산으로 만든 95% 신뢰구간이 해석해를 포함한다', () => {
    let covered = 0;
    for (let cell = 0; cell < 40; cell += 1) {
      const ci = chainConfidence(result.perChain, cell);
      if ((profile.piByCell[cell] ?? 0) >= ci.low && (profile.piByCell[cell] ?? 0) <= ci.high) covered += 1;
    }
    // 95% 구간이므로 40칸 중 대부분이 덮여야 한다.
    expect(covered).toBeGreaterThanOrEqual(35);
  });

  it('착지 벡터 v 도 해석해와 맞는다', () => {
    const distance = result.v.reduce((sum, value, i) => sum + Math.abs(value - (profile.v[i] ?? 0)), 0);
    expect(distance).toBeLessThan(0.02);
  });

  it('월급 통과율이 해석해와 맞는다', () => {
    expect(result.salaryRate).toBeCloseTo(profile.salaryRate, 2);
  });

  it('Kac — 시뮬레이션 실측 재귀시간이 1/π 와 맞는다 (§11.4 세 번째 축)', () => {
    // 무인도는 π 가 가장 커서 재귀시간이 짧고 표본이 많다.
    const island = result.returnTimes[10] as number;
    expect(island).toBeCloseTo(1 / (profile.piByCell[10] ?? 1), 0);
  });
});

describe('순수 순환 보드', () => {
  it('경험 분포가 1/40 근처로 모인다', () => {
    const result = simulate(PLAIN_CYCLIC_CONFIG, { chains: 100, turnsPerChain: 1200, burnIn: 200, seed: 5 });
    for (const p of result.piByCell) expect(p).toBeCloseTo(1 / 40, 2);
  });
});

describe('덱 추출 방식 (가정 A5)', () => {
  it('복원과 비복원의 차이가 작다 — 근사가 정당함을 보인다', () => {
    const options = { chains: 100, turnsPerChain: 1200, burnIn: 200, seed: 99 } as const;
    const withReplacement = simulate(DEFAULT_CONFIG, options);
    const withoutReplacement = simulate(withConfig({ cardDeck: 'no-replace' }), options);
    const distance = withReplacement.piByCell.reduce(
      (sum, p, i) => sum + Math.abs(p - (withoutReplacement.piByCell[i] ?? 0)),
      0,
    );
    expect(distance).toBeLessThan(0.03);
  });
});

describe('사회복지기금 적립액 분포 (§10 실험 6)', () => {
  it('적립액이 15만 원의 배수로만 나온다', () => {
    const result = simulate(DEFAULT_CONFIG, { chains: 40, turnsPerChain: 1200, burnIn: 200, seed: 3 });
    expect(result.welfarePayouts.length).toBeGreaterThan(500);
    for (const payout of result.welfarePayouts) expect(payout % 15).toBeCloseTo(0, 10);
  });
});
