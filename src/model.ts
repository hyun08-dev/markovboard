/**
 * model.ts — 설정 하나로 모든 계산 결과를 한 번에 만드는 진입점.
 *
 * 화면은 계산 결과를 이해하기 위한 수단이므로, 컴포넌트가 계산 순서를 알 필요가
 * 없도록 여기서 한 번에 묶는다. (계획서 §2.4)
 */

import {
  buildTransitionModel,
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
  const kac = verifyKac(transition.matrix, power.pi);

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
      maxKacError: kac.reduce((max, check) => Math.max(max, check.relativeError), 0),
    },
  };
}
