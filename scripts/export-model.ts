/**
 * export-model.ts — 계산 결과를 JSON 으로 내보낸다.
 *
 * `notebooks/cross_check.ipynb` 가 이 파일을 읽어 **파이썬으로 독립 구현한 모델**과
 * 대조한다. 두 구현이 규칙 해석을 공유하지 않으므로, 결과가 맞으면 전이행렬
 * 생성기가 규칙을 제대로 옮겼다는 강한 증거가 된다. (계획서 §11.4)
 *
 *   npm run export:model
 */

import { writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG } from '../src/markov/config';
import { buildTransitionModel } from '../src/markov/transition';
import { deflatedLambda2, logRegressionLambda2, powerIteration } from '../src/markov/power';

function dump(name: string, config: typeof DEFAULT_CONFIG): void {
  const model = buildTransitionModel(config);
  const result = powerIteration(model.matrix);
  const theory = deflatedLambda2(model.matrix, result.pi);
  const measured = logRegressionLambda2(result.steps);

  const payload = {
    config,
    labels: model.matrix.map((_, i) => model.space.label(i)),
    cells: model.matrix.map((_, i) => model.space.cellOf(i)),
    matrix: model.matrix,
    pi: result.pi,
    residual: result.residual,
    iterations: result.iterations,
    lambda2: {
      deflation: theory.magnitude,
      deflationConverged: theory.converged,
      deflationOscillating: theory.oscillating,
      logRegression: measured.magnitude,
      logRegressionR2: measured.r2,
    },
    landings: model.landings,
    salaryPasses: model.salaryPasses,
    rolls: model.rolls,
  };

  const path = `notebooks/data/${name}.json`;
  writeFileSync(path, JSON.stringify(payload));
  console.log(`${path}  |S| = ${model.space.size}  반복 ${result.iterations}회  잔차 ${result.residual.toExponential(2)}`);
}

dump('default', DEFAULT_CONFIG);
dump('plain-cyclic', PLAIN_CYCLIC_CONFIG);
