/**
 * report.ts — 실험 결과를 콘솔 표로 뽑는다. docs/experiments.md 를 채우는 데 쓴다.
 *
 *   npm run report
 */

import { DEFAULT_CONFIG, PLAIN_CYCLIC_CONFIG } from '../src/markov/config';
import { buildTransitionModel } from '../src/markov/transition';
import { logRegressionLambda2, powerIteration } from '../src/markov/power';
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

// ─────────────────────────────────────────────────────────────────────────────
// 몬테카를로 검증 (Phase 7)
// ─────────────────────────────────────────────────────────────────────────────

import { chainConfidence, simulate } from '../src/markov/simulate';

console.log('\n=== 실험 11 — 몬테카를로 수렴률 O(N^{-1/2}) ===');
const points: Array<{ n: number; error: number }> = [];
for (const chains of [4, 8, 16, 32, 64, 128, 256, 512]) {
  const run = simulate(DEFAULT_CONFIG, { chains, turnsPerChain: 1200, burnIn: 200, seed: 1234 });
  const error = run.piByCell.reduce((sum, p, i) => sum + Math.abs(p - (profile.piByCell[i] ?? 0)), 0);
  points.push({ n: chains * 1000, error });
  console.log(`체인 ${String(chains).padStart(3)}  N=${String(chains * 1000).padStart(6)}  ||π̂ − π||₁ = ${error.toFixed(6)}`);
}
const meanX = points.reduce((s, p) => s + Math.log(p.n), 0) / points.length;
const meanY = points.reduce((s, p) => s + Math.log(p.error), 0) / points.length;
const slope =
  points.reduce((s, p) => s + (Math.log(p.n) - meanX) * (Math.log(p.error) - meanY), 0) /
  points.reduce((s, p) => s + (Math.log(p.n) - meanX) ** 2, 0);
console.log(`로그–로그 기울기 = ${slope.toFixed(4)}   (이론값 −0.5)`);

console.log('\n=== 실험 6 (분포) — 사회복지기금 적립액 ===');
const mc = simulate(DEFAULT_CONFIG, { chains: 400, turnsPerChain: 2000, burnIn: 200, seed: 20260908 });
const buckets = new Map<number, number>();
for (const payout of mc.welfarePayouts) buckets.set(payout, (buckets.get(payout) ?? 0) + 1);
const total = mc.welfarePayouts.length;
const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
let cumulative = 0;
for (const [amount, count] of sorted.slice(0, 7)) {
  cumulative += count / total;
  console.log(`${String(amount).padStart(4)}만: ${((count / total) * 100).toFixed(2)}%  (누적 ${(cumulative * 100).toFixed(2)}%)`);
}
console.log(`평균 수령액 = ${(mc.welfarePayouts.reduce((a, b) => a + b, 0) / total).toFixed(3)}만  (해석해 ${welfare.expectedPayout.toFixed(3)}만)`);
const over45 = mc.welfarePayouts.filter((x) => x >= 45).length / total;
console.log(`45만 이상 받을 확률 = ${(over45 * 100).toFixed(2)}%`);

console.log('\n=== 몬테카를로 vs 해석해 (95% 신뢰구간) ===');
let covered = 0;
for (let cell = 0; cell < 40; cell += 1) {
  const ci = chainConfidence(mc.perChain, cell);
  const truth = profile.piByCell[cell] ?? 0;
  if (truth >= ci.low && truth <= ci.high) covered += 1;
}
console.log(`40칸 중 ${covered}칸이 95% 구간 안에 들어옴`);
console.log(`||π̂ − π||₁ = ${mc.piByCell.reduce((s, p, i) => s + Math.abs(p - (profile.piByCell[i] ?? 0)), 0).toFixed(6)}`);
console.log(`월급 통과율: 시뮬 ${pct(mc.salaryRate)} vs 해석해 ${pct(profile.salaryRate)}`);
console.log(`Kac 무인도: 시뮬 ${(mc.returnTimes[10] ?? 0).toFixed(3)} vs 1/π = ${(1 / (profile.piByCell[10] ?? 1)).toFixed(3)}`);

// ─────────────────────────────────────────────────────────────────────────────
// 실험 3 · 4 · 8 · 9
// ─────────────────────────────────────────────────────────────────────────────

import { withConfig, type TeleportPolicy } from '../src/markov/config';
import { diceOutcomes } from '../src/markov/transition';

console.log('\n=== 실험 3 — 우주여행 정책 비교 ===');
const policies: TeleportPolicy[] = ['uniform', 'seoul', 'newyork', 'jail'];
const label: Record<TeleportPolicy, string> = { uniform: '균등', seoul: '서울 우선', newyork: '뉴욕 우선', jail: '무인도 도피' };
console.log('정책        π(서울)   v(서울)   π(무인도)  턴당 통행료(호텔)  월급통과율  |λ₂|');
for (const policy of policies) {
  const cfg = withConfig({ teleportPolicy: policy });
  const m = buildTransitionModel(cfg);
  const r = powerIteration(m.matrix);
  const prof = landingProfile(m, r.pi);
  console.log(
    `${label[policy].padEnd(10)} ${pct(prof.piByCell[39] ?? 0).padStart(8)} ${(prof.v[39] ?? 0).toFixed(5)}  ${pct(prof.piByCell[10] ?? 0).padStart(8)}  ${expectedTollPerTurn('hotel', prof).toFixed(3).padStart(10)}만  ${pct(prof.salaryRate).padStart(9)}  ${logRegressionLambda2(r.steps).magnitude.toFixed(5)}`,
  );
}

console.log('\n=== 실험 4 — 첫 도달 확률 표 재계산 ===');

// (a) 순수 주사위 계산 — 잔여 d칸에 정확히 착지할 확률 (특수 칸 무시).
//     hit[d] = Σ_s P(합=s) · hit[d−s],  hit[0] = 1
const dice = diceOutcomes([1, 2, 3, 4, 5, 6]);
const hit: number[] = [1];
for (let d = 1; d <= 24; d += 1) {
  let p = 0;
  for (const { sum, prob } of dice) if (sum <= d) p += prob * (hit[d - sum] ?? 0);
  hit[d] = p;
}
const knownTable: Record<number, number> = { 2: 2.8, 3: 5.6, 4: 8.4, 5: 11.4, 6: 14.7, 7: 18.2, 8: 16.6, 9: 15.6, 10: 14.8, 11: 14.1, 12: 13.4, 13: 12.5, 14: 13.9, 15: 14.6, 16: 14.8, 17: 14.7, 18: 14.6 };
console.log('(a) 순수 주사위 표 — 자료값 재현 확인');
console.log('  d :  ' + Array.from({ length: 17 }, (_, i) => String(i + 2).padStart(6)).join(''));
console.log('계산:  ' + Array.from({ length: 17 }, (_, i) => ((hit[i + 2] ?? 0) * 100).toFixed(1).padStart(6)).join(''));
console.log('자료:  ' + Array.from({ length: 17 }, (_, i) => String(knownTable[i + 2] ?? '-').padStart(6)).join(''));
console.log(`  d=24 → ${((hit[24] ?? 0) * 100).toFixed(3)}%,  극한 1/E[합] = ${(100 / 7).toFixed(3)}%`);

// (b) 실제 체인 — 한 바퀴당 칸별 착지 기대 횟수 = v_j / (턴당 출발선 통과 횟수).
//     순수 순환 보드에서는 이 값이 정확히 1/7 이 되어 (a) 의 극한과 맞물린다.
const plainModel = buildTransitionModel(PLAIN_CYCLIC_CONFIG);
const plainProfile = landingProfile(plainModel, powerIteration(plainModel.matrix).pi);
console.log('\n(b) 한 바퀴당 착지 기대 횟수  v_j / (월급 통과율)');
console.log(`  순수 순환 보드: ${((plainProfile.v[0] ?? 0) / plainProfile.salaryRate).toFixed(6)}   (이론 1/7 = ${(1 / 7).toFixed(6)})`);
const perLap = profile.v.map((value) => value / profile.salaryRate);
const lapMean = perLap.reduce((a, b) => a + b, 0) / 40;
console.log(`  실제 체인 평균 : ${lapMean.toFixed(6)}`);
const ranked4 = perLap.map((value, cell) => ({ cell, value })).sort((a, b) => b.value - a.value);
console.log('  상위 5: ' + ranked4.slice(0, 5).map((r) => `${r.cell}번 ${cellAt(r.cell).name} ${(r.value * 100).toFixed(2)}%`).join(' | '));
console.log('  하위 5: ' + ranked4.slice(-5).map((r) => `${r.cell}번 ${cellAt(r.cell).name} ${(r.value * 100).toFixed(2)}%`).join(' | '));
const gaps = perLap.map((value, cell) => ({ cell, gap: value - 1 / 7 })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
console.log('  1/7 과 가장 많이 벌어진 칸:');
for (const g of gaps.slice(0, 5)) {
  console.log(`    ${String(g.cell).padStart(2)}번 ${cellAt(g.cell).name.padEnd(12)} ${((1 / 7 + g.gap) * 100).toFixed(2)}%  (${g.gap > 0 ? '+' : ''}${(g.gap * 100).toFixed(2)}%p)`);
}

// (c) 세 값이 맞물리는지 확인.
console.log('\n(c) 세 값의 맞물림 (순수 순환 보드)');
console.log(`  잔여 d→∞ 착지 확률 = 1/E[합] = ${(1 / 7).toFixed(6)}`);
console.log(`  한 바퀴 굴림 수    = 40/7   = ${(40 / 7).toFixed(6)}   실제 = ${(plainProfile.expectedRolls / plainProfile.salaryRate).toFixed(6)}`);
console.log(`  Kac  m_ii = 1/π_i  = 40      실제 = ${(1 / (plainProfile.piByCell[0] ?? 1)).toFixed(6)}`);

console.log('\n=== 실험 9 — 무인도 모델링 민감도 ===');
const split = (() => { const m = buildTransitionModel(DEFAULT_CONFIG); return landingProfile(m, powerIteration(m.matrix).pi); })();
const merged = (() => { const c = withConfig({ jailModel: 'merged' }); const m = buildTransitionModel(c); return landingProfile(m, powerIteration(m.matrix).pi); })();
let maxDiff = 0;
let maxCell = 0;
for (let cell = 0; cell < 40; cell += 1) {
  const diff = Math.abs((split.piByCell[cell] ?? 0) - (merged.piByCell[cell] ?? 0));
  if (diff > maxDiff) { maxDiff = diff; maxCell = cell; }
}
console.log(`무인도 π: 4단계 ${pct(split.piByCell[10] ?? 0)}  vs  뭉갠 모델 ${pct(merged.piByCell[10] ?? 0)}`);
console.log(`최대 확률 차이 = ${(maxDiff * 100).toFixed(3)}%p (${maxCell}번 ${cellAt(maxCell).name})`);
console.log(`ℓ¹ 거리 = ${split.piByCell.reduce((s, p, i) => s + Math.abs(p - (merged.piByCell[i] ?? 0)), 0).toFixed(5)}`);
console.log(`무인도를 뺀 나머지 39칸의 최대 차이 = ${(Math.max(...split.piByCell.map((p, i) => (i === 10 ? 0 : Math.abs(p - (merged.piByCell[i] ?? 0))))) * 100).toFixed(3)}%p`);
