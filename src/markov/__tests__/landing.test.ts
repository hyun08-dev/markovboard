import { describe, it, expect } from 'vitest';
import { buildTransitionModel } from '../transition';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG, withConfig } from '../config';
import { simulate } from '../simulate';
import { powerIteration } from '../power';
import { landingProfile, turnsPerLap } from '../landing';
import { expectedTollPerTurn, payoffTable, salaryPerTurn, welfareEstimate, yieldOf, cellPayoff } from '../payoff';
import { BOARD, cellAt, SALARY, WELFARE_CONTRIBUTION } from '../board';

const profileFor = (config: typeof DEFAULT_CONFIG) => {
  const model = buildTransitionModel(config);
  const pi = powerIteration(model.matrix).pi;
  return { model, pi, profile: landingProfile(model, pi) };
};

describe('착지 벡터 v (§3.8)', () => {
  it('순수 순환 보드에서 Σv = E[K] = 1.2 다 (§11.2 보조 불변량)', () => {
    const { profile } = profileFor(PLAIN_CYCLIC_CONFIG);
    expect(profile.totalLandings).toBeCloseTo(1.2, 10);
    expect(profile.expectedRolls).toBeCloseTo(1.2, 10);
  });

  it('순수 순환 보드에서 v 가 모든 칸에 고르게 퍼진다', () => {
    const { profile } = profileFor(PLAIN_CYCLIC_CONFIG);
    for (const value of profile.v) expect(value).toBeCloseTo(1.2 / 40, 10);
  });

  it('순수 순환 보드의 월급 통과율이 정확히 8.4/40 이다', () => {
    const { profile } = profileFor(PLAIN_CYCLIC_CONFIG);
    expect(profile.salaryRate).toBeCloseTo(8.4 / 40, 10);
    expect(turnsPerLap(profile.salaryRate)).toBeCloseTo(40 / 8.4, 8);
    expect(salaryPerTurn(profile)).toBeCloseTo((8.4 / 40) * SALARY, 8);
  });

  it('전체 모델에서 v 와 π 는 다른 벡터다', () => {
    const { profile } = profileFor(DEFAULT_CONFIG);
    expect(profile.piByCell.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    // v 는 확률이 아니라 기대 횟수라 합이 1이 아니다.
    expect(profile.totalLandings).toBeGreaterThan(1);
    // 황금열쇠 칸은 착지는 많이 해도 그 자리에서 턴을 시작하는 일은 드물다.
    const gk = 17;
    expect(profile.v[gk] as number).toBeGreaterThan(profile.piByCell[gk] as number);
  });

  it('무인도는 반대로 π 가 v 보다 훨씬 크다 — 갇혀서 턴을 시작하기 때문', () => {
    const { profile } = profileFor(DEFAULT_CONFIG);
    expect(profile.piByCell[10] as number).toBeGreaterThan((profile.v[10] as number) * 2);
  });
});

describe('보상 계산 (§3.8)', () => {
  const { profile } = profileFor(DEFAULT_CONFIG);

  it('기대 지출은 π 가 아니라 v 로 계산한다', () => {
    const withV = expectedTollPerTurn('hotel', profile);
    const withPi = BOARD.reduce((sum, cell) => sum + (profile.piByCell[cell.index] ?? 0) * (cell.tolls?.hotel ?? cell.tolls?.none ?? 0), 0);
    expect(withV).toBeGreaterThan(0);
    // 두 값은 다르다. 계획 초안의 Σπ·r 은 잘못된 값을 낸다.
    expect(Math.abs(withV - withPi)).toBeGreaterThan(1);
  });

  it('회수 지표가 정의대로 계산된다', () => {
    const taipei = cellPayoff(cellAt(1), 'hotel', profile);
    expect(taipei.toll).toBe(25);
    expect(taipei.investment).toBe(30); // 매입가 5 + 호텔 25
    expect(taipei.paybackLandings).toBeCloseTo(30 / 25, 12);
    expect(taipei.returnPerTurn).toBeCloseTo((taipei.landingRate * 25) / 30, 12);
    expect(taipei.paybackTurns).toBeCloseTo(1 / taipei.returnPerTurn, 8);
  });

  it('소유 가능한 29칸 전부에 지표가 나온다', () => {
    const table = payoffTable('hotel', profile);
    expect(table).toHaveLength(29); // 도시 23 + 한국 3 + 탈것 3
    for (const row of table) {
      expect(row.toll).toBeGreaterThan(0);
      expect(row.investment).toBeGreaterThan(0);
      expect(Number.isFinite(row.returnPerTurn)).toBe(true);
    }
  });

  it('수익률 정의 세 가지가 서로 다른 순위를 만든다 (§10 실험 5)', () => {
    const owned = BOARD.filter((c) => c.price !== undefined);
    const rank = (definition: 'perBuildCost' | 'perInvestment' | 'visitWeighted') =>
      [...owned].sort((a, b) => yieldOf(b, 'hotel', profile, definition) - yieldOf(a, 'hotel', profile, definition)).map((c) => c.index);
    expect(rank('perInvestment')).not.toEqual(rank('visitWeighted'));
  });

  it('자료의 이스탄불 수익률 세 수치가 모두 재현된다 — 정의 차이였다 (§4.3)', () => {
    const istanbul = cellAt(9);
    const t = istanbul.tolls as { none: number; villa1: number; villa2: number; building: number; hotel: number };
    const b = istanbul.buildCost as { villa: number; building: number; hotel: number };
    const allBuildingTolls = t.villa1 + t.villa2 + t.building + t.hotel; // 104
    const allBuildCosts = b.villa * 2 + b.building + b.hotel; // 50
    const price = istanbul.price as number; // 12

    // "호텔 가격 대비 240%" — 호텔료 ÷ 호텔 건축비
    expect(yieldOf(istanbul, 'hotel', profile, 'perBuildCost')).toBeCloseTo(2.4, 10);
    // "건물 가격 대비 208%" — 건물 통행료 합 ÷ 건축비 합
    expect(allBuildingTolls / allBuildCosts).toBeCloseTo(2.08, 10);
    // "가격 대비 167.74%" — 건물 통행료 합 ÷ (매입가 + 건축비 합)
    expect(allBuildingTolls / (price + allBuildCosts)).toBeCloseTo(1.6774, 4);
  });

  it('사회복지기금 기대 수령액이 15만 × v₃₈/v₂₀ 이다 (§3.9)', () => {
    const welfare = welfareEstimate(profile);
    expect(welfare.expectedPayout).toBeCloseTo(
      (WELFARE_CONTRIBUTION * welfare.contributionRate) / welfare.collectionRate,
      12,
    );
    expect(welfare.expectedPayout).toBeGreaterThan(0);
  });
});

describe('월급 예외 처리 (§3.10)', () => {
  const { profile } = profileFor(DEFAULT_CONFIG);

  it('세계일주 초대권은 제자리인데도 월급을 준다', () => {
    // 카드를 끄면 이 몫이 사라지므로 통과율이 눈에 띄게 줄어든다.
    const withoutCards = profileFor(withConfig({ enableGoldenKey: false })).profile;
    expect(profile.salaryRate).toBeGreaterThan(withoutCards.salaryRate);
  });

  it('해석해의 월급 통과율이 시뮬레이션과 맞는다', () => {
    const mc = simulate(DEFAULT_CONFIG, { chains: 200, turnsPerChain: 1200, burnIn: 200, seed: 4242 });
    // 세계일주 초대권 몫(약 0.56%p)을 빠뜨리면 이 테스트가 깨진다.
    expect(mc.salaryRate).toBeCloseTo(profile.salaryRate, 3);
  });
});

describe('유입 경로 분해 (§10 실험 8)', () => {
  const { profile } = profileFor(DEFAULT_CONFIG);

  it('다섯 경로의 합이 그 칸의 π 와 같다', () => {
    for (let cell = 0; cell < 40; cell += 1) {
      const total = (['dice', 'card', 'backstep', 'teleport', 'stay'] as const).reduce(
        (sum, source) => sum + (profile.inflow[source][cell] ?? 0),
        0,
      );
      expect(total).toBeCloseTo(profile.piByCell[cell] ?? 0, 12);
    }
  });

  it("'대기 체류'는 무인도에만 있다 — 새로 들어온 것이 아니기 때문", () => {
    expect(profile.inflow.stay[10] as number).toBeGreaterThan(0);
    for (let cell = 0; cell < 40; cell += 1) {
      if (cell !== 10) expect(profile.inflow.stay[cell] ?? 0).toBe(0);
    }
  });

  it('무인도에는 네 경로가 모두 있다', () => {
    for (const source of ['dice', 'card', 'backstep', 'teleport'] as const) {
      expect(profile.inflow[source][10] as number).toBeGreaterThan(0);
    }
  });

  it("서울에는 '뒤로 가기' 유입이 있다 — 2번 황금열쇠에서 뒤로 3칸", () => {
    expect(profile.inflow.backstep[39] as number).toBeGreaterThan(0);
    // 이동 카드 목적지가 아닌 뉴욕에는 뒤로 가기 유입이 없다.
    expect(profile.inflow.backstep[37] as number).toBeCloseTo(0, 12);
  });
});
