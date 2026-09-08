/**
 * report.ts — 실험 결과를 콘솔 표로 뽑는다. docs/experiments.md 를 채우는 데 쓴다.
 *
 *   npm run report
 */

import { DEFAULT_CONFIG } from '../src/markov/config';
import { buildTransitionModel } from '../src/markov/transition';
import { powerIteration } from '../src/markov/power';
import { landingProfile, turnsPerLap } from '../src/markov/landing';
import { expectedTollPerTurn, payoffTable, salaryPerTurn, welfareEstimate, yieldOf } from '../src/markov/payoff';
import { BOARD, cellAt } from '../src/markov/board';
import { verifyKac } from '../src/markov/hitting';

const model = buildTransitionModel(DEFAULT_CONFIG);
const { pi } = powerIteration(model.matrix);
const profile = landingProfile(model, pi);
const pct = (x: number) => `${(x * 100).toFixed(3)}%`;

console.log('\n=== 실험 1 — π 와 v 의 순위 차이 ===');
const cells = BOARD.map((c) => ({ i: c.index, name: c.name, pi: profile.piByCell[c.index] ?? 0, v: profile.v[c.index] ?? 0 }));
const byPi = [...cells].sort((a, b) => b.pi - a.pi);
const byV = [...cells].sort((a, b) => b.v - a.v);
console.log('π 상위 5 :', byPi.slice(0, 5).map((c) => `${c.i} ${c.name} ${pct(c.pi)}`).join(' | '));
console.log('v 상위 5 :', byV.slice(0, 5).map((c) => `${c.i} ${c.name} ${c.v.toFixed(5)}`).join(' | '));
console.log('π 하위 5 :', byPi.slice(-5).map((c) => `${c.i} ${c.name} ${pct(c.pi)}`).join(' | '));
console.log('v 하위 5 :', byV.slice(-5).map((c) => `${c.i} ${c.name} ${c.v.toFixed(5)}`).join(' | '));
console.log('Σv =', profile.totalLandings.toFixed(6), ' 기대 굴림 =', profile.expectedRolls.toFixed(6));

console.log('\n=== 실험 2 — "출발지 기준 7의 배수" 통설 ===');
const transient = powerIteration(model.matrix, { initial: 'start', startIndex: model.space.indexOfCell(0), maxIterations: 40, keepHistory: true });
const atStep = (k: number, cell: number) => ((transient.steps[k - 1]?.distribution[model.space.indexOfCell(cell)] ?? 0) * 100);
console.log('7의 배수 칸이 각 스텝에서 이웃보다 튀는가 (%, 괄호는 그 스텝의 최대 칸)');
for (const k of [1, 2, 3, 4, 6, 10, 20]) {
  const step = transient.steps[k - 1];
  if (step === undefined) continue;
  let best = 0;
  let bestCell = 0;
  BOARD.forEach((c) => {
    const p = step.distribution[model.space.indexOfCell(c.index)] ?? 0;
    if (p > best) { best = p; bestCell = c.index; }
  });
  console.log(
    `k=${String(k).padStart(2)}: 7번 ${atStep(k, 7).toFixed(3)}  14번 ${atStep(k, 14).toFixed(3)}  21번 ${atStep(k, 21).toFixed(3)}  28번 ${atStep(k, 28).toFixed(3)}   최대=${bestCell}번 ${(best * 100).toFixed(3)}`,
  );
}
const neighbours = [19, 20, 22, 23];
console.log(`정상: 21번 ${pct(profile.piByCell[21] ?? 0)}  이웃 19/20/22/23 = ${neighbours.map((c) => pct(profile.piByCell[c] ?? 0)).join(' / ')}`);
console.log(`      v₂₁ = ${(profile.v[21] ?? 0).toFixed(5)}  이웃 v = ${neighbours.map((c) => (profile.v[c] ?? 0).toFixed(5)).join(' / ')}`);

console.log('\n=== 실험 5 — 수익률 세 정의의 상위 5 ===');
for (const def of ['perBuildCost', 'perInvestment', 'visitWeighted'] as const) {
  const ranked = BOARD.filter((c) => c.price !== undefined)
    .map((c) => ({ c, y: yieldOf(c, 'hotel', profile, def) }))
    .filter((r) => Number.isFinite(r.y))
    .sort((a, b) => b.y - a.y)
    .slice(0, 5);
  console.log(def.padEnd(14), ranked.map((r) => `${r.c.name} ${(r.y * 100).toFixed(1)}%`).join(' | '));
}

console.log('\n=== 실험 5 — 턴당 회수율 상위/하위 5 ===');
const table = payoffTable('hotel', profile).sort((a, b) => b.returnPerTurn - a.returnPerTurn);
for (const row of [...table.slice(0, 5), ...table.slice(-5)]) {
  console.log(
    `${String(row.index).padStart(2)} ${row.name.padEnd(10)} v=${row.landingRate.toFixed(5)} r=${String(row.toll).padStart(4)} 투자=${String(row.investment).padStart(4)} 회수율=${(row.returnPerTurn * 100).toFixed(3)}%/턴 회수턴=${row.paybackTurns.toFixed(1)}`,
  );
}

console.log('\n=== 실험 6 — 사회복지기금 ===');
const welfare = welfareEstimate(profile);
console.log(`v₃₈ = ${welfare.contributionRate.toFixed(6)}  v₂₀ = ${welfare.collectionRate.toFixed(6)}  기대 수령액 = ${welfare.expectedPayout.toFixed(3)}만`);

console.log('\n=== 실험 7 — 월급 통과율 ===');
console.log(`실제 = ${pct(profile.salaryRate)}  근사(8.4/40) = ${pct(8.4 / 40)}  한 바퀴 = ${turnsPerLap(profile.salaryRate).toFixed(3)}턴`);
console.log(`턴당 기대 월급 = ${salaryPerTurn(profile).toFixed(4)}만  턴당 기대 통행료(호텔) = ${expectedTollPerTurn('hotel', profile).toFixed(3)}만`);

console.log('\n=== Kac 검증 (§11.4) ===');
const kac = verifyKac(model.matrix, pi);
const worst = kac.reduce((a, b) => (a.relativeError > b.relativeError ? a : b));
console.log(`최대 상대오차 = ${worst.relativeError.toExponential(2)} (상태 ${model.space.label(worst.state)})`);
console.log(`예: 무인도 J₃ m=${(kac[model.space.indexOfCell(10)] as { returnTime: number }).returnTime.toFixed(3)}  서울 m=${(kac[model.space.indexOfCell(39)] as { returnTime: number }).returnTime.toFixed(3)} (1/π=${(1 / (pi[model.space.indexOfCell(39)] ?? 1)).toFixed(3)})`);
console.log(`참고: 순수 순환 보드라면 모든 m_ii = 40, 서울 ${cellAt(39).name} 실제 = ${(kac[model.space.indexOfCell(39)] as { returnTime: number }).returnTime.toFixed(2)}`);
