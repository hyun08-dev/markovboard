/**
 * model.ts — 설정 하나로 모든 계산 결과를 한 번에 만드는 진입점.
 *
 * 화면은 계산 결과를 이해하기 위한 수단이므로, 컴포넌트가 계산 순서를 알 필요가
 * 없도록 여기서 한 번에 묶는다. (계획서 §2.4)
 */

import {
  buildTransitionModel,
  isIrreducible,
  deflatedLambda2,
  landingProfile,
  logRegressionLambda2,
  payoffTable,
  powerIteration,
  expectedTollPerTurn,
  salaryPerTurn,
  turnsPerLap,
  verifyKac,
  welfareEstimate,
  type CellPayoff,
  type LandingProfile,
  type ModelConfig,
  type PowerIterationResult,
  type TransitionModel,
} from './markov';

export interface ComputedModel {
  readonly config: ModelConfig;
  readonly transition: TransitionModel;
  readonly power: PowerIterationResult;
  readonly profile: LandingProfile;
  readonly payoffs: readonly CellPayoff[];
  readonly lambda2: {
    readonly deflation: number;
    readonly deflationConverged: boolean;
    readonly oscillating: boolean;
    readonly logRegression: number;
    readonly r2: number;
    readonly constant: number;
  };
  /**
   * 이 설정에서 Perron–Frobenius 조건이 성립하는지.
   *
   * 실험 12의 데모 설정(짝수 눈 · 주사위 1개+홀수 눈)은 **일부러** 조건을 깨뜨린다.
   * 그때 정상분포는 유일하지 않고 Kac 보조정리도 성립하지 않으므로, 계산을 실패로
   * 두지 않고 **무엇이 깨졌는지 화면에 알린다.**
   */
  readonly diagnostics: {
    readonly irreducible: boolean;
    readonly converged: boolean;
    readonly kacAvailable: boolean;
    /** 사람이 읽는 경고. 조건이 모두 성립하면 빈 배열이다. */
    readonly warnings: readonly string[];
  };
  readonly summary: {
    readonly states: number;
    readonly iterations: number;
    readonly residual: number;
    readonly totalLandings: number;
    readonly expectedRolls: number;
    readonly salaryRate: number;
    readonly turnsPerLap: number;
    readonly salaryPerTurn: number;
    readonly expectedToll: number;
    readonly welfarePayout: number;
    readonly maxKacError: number;
  };
}

export function computeModel(config: ModelConfig): ComputedModel {
  const transition = buildTransitionModel(config);
  const power = powerIteration(transition.matrix);
  const profile = landingProfile(transition, power.pi);
  const deflation = deflatedLambda2(transition.matrix, power.pi, { maxIterations: 1500 });
  const regression = logRegressionLambda2(power.steps);

  const irreducible = isIrreducible(transition.matrix);
  // 기약이 아니면 (I − Q_A) 가 특이행렬이라 첫 도달 시간 선형계를 풀 수 없다.
  // 계산을 포기하는 대신 "이 설정에서는 성립하지 않는다"를 값으로 돌려준다.
  // 수렴하지 않은 π 는 정상분포가 아니므로 Kac 관계를 물어볼 대상이 아니다.
  let maxKacError = Number.NaN;
  let kacAvailable = false;
  if (irreducible && power.converged) {
    try {
      maxKacError = verifyKac(transition.matrix, power.pi).reduce((max, check) => Math.max(max, check.relativeError), 0);
      kacAvailable = true;
    } catch {
      kacAvailable = false;
    }
  }

  const warnings: string[] = [];
  if (!irreducible) {
    warnings.push(
      '체인이 기약이 아니다. 서로 오갈 수 없는 상태 덩어리로 쪼개져 있어 정상분포가 유일하지 않고, 초기 분포에 따라 다른 곳으로 수렴한다.',
    );
  }
  if (!power.converged) {
    warnings.push(
      '멱승법이 수렴하지 않았다. 비주기성 조건이 깨져 분포가 두 집합 사이를 진동하는 경우다 (주기 2).',
    );
  }
  if (warnings.length > 0) {
    warnings.push(
      'π 가 정상분포가 아니므로 여기서 파생되는 값(착지 벡터 v · 월급 통과율 · 기대 통행료 · Kac 관계)도 뜻이 없다. 이 화면에서는 수렴 곡선만 보면 된다.',
    );
  }

  return {
    config,
    transition,
    power,
    profile,
    payoffs: payoffTable(config.buildLevel, profile),
    lambda2: {
      deflation: deflation.magnitude,
      deflationConverged: deflation.converged,
      oscillating: deflation.oscillating,
      logRegression: regression.magnitude,
      r2: regression.r2,
      constant: regression.constant,
    },
    summary: {
      states: transition.space.size,
      iterations: power.iterations,
      residual: power.residual,
      totalLandings: profile.totalLandings,
      expectedRolls: profile.expectedRolls,
      salaryRate: profile.salaryRate,
      turnsPerLap: turnsPerLap(profile.salaryRate),
      salaryPerTurn: salaryPerTurn(profile),
      expectedToll: expectedTollPerTurn(config.buildLevel, profile),
      welfarePayout: welfareEstimate(profile).expectedPayout,
      maxKacError,
    },
    diagnostics: { irreducible, converged: power.converged, kacAvailable, warnings },
  };
}
