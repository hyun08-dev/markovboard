import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BOARD, initialVector, powerIteration, type InitialDistribution } from '../markov';
import type { ComputedModel } from '../model';
import { Stat } from './BoardHeatmap';

/**
 * ConvergencePlot — 멱승법의 각 반복 단계를 재생한다. (계획서 §6.2)
 *
 * 오차 감쇠 곡선과 이론 예측 C|λ₂|^k 를 같은 축에 겹쳐 그린다.
 * **스텝 변화 ‖π⁽ᵏ⁺¹⁾−π⁽ᵏ⁾‖₁ 과 실제 오차 ‖π⁽ᵏ⁾−π‖₁ 을 나눠 그린다** —
 * |λ₂| 가 1에 가까우면 둘이 크게 다르기 때문이다. (§3.6)
 *
 * 이 화면이 §10 실험 2(과도상태 vs 정상상태)의 발표 도구를 겸한다.
 */
export function ConvergencePlot({ model }: { model: ComputedModel }) {
  const [initial, setInitial] = useState<InitialDistribution>('start');
  const [step, setStep] = useState(3);

  const run = useMemo(() => {
    const startIndex = model.transition.space.indexOfCell(0);
    return powerIteration(model.transition.matrix, { initial, startIndex, maxIterations: 120 });
  }, [model, initial]);

  const data = run.steps.slice(0, 60).map((s) => ({
    k: s.k,
    stepChange: s.stepChange,
    error: s.error,
    theory: model.lambda2.constant * model.lambda2.logRegression ** s.k,
  }));

  const maxStep = Math.max(1, run.steps.length);
  const current = run.steps[Math.min(step, maxStep) - 1];
  const distribution = current?.distribution ?? run.pi;

  const byCell = BOARD.map((cell) => {
    let total = 0;
    for (let i = 0; i < model.transition.space.size; i += 1) {
      if (model.transition.space.cellOf(i) === cell.index) total += distribution[i] ?? 0;
    }
    return { cell: cell.index, name: cell.name, value: total };
  });
  const top = [...byCell].sort((a, b) => b.value - a.value).slice(0, 6);
  const sevens = [7, 14, 21, 28].map((cell) => byCell[cell] as { name: string; value: number });

  return (
    <div className="card">
      <h2>정상상태 수렴</h2>
      <p className="note">
        오차가 <code>C·|λ₂|ᵏ</code> 로 줄어드는지 확인한다. <b>스텝 변화</b>와 <b>실제 오차</b>는 다른 값이다 —
        |λ₂| 가 1에 가까우면 스텝 변화가 작아도 실제 오차는 클 수 있다.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', margin: '12px 0' }}>
        <label className="field" style={{ margin: 0, minWidth: 200 }}>
          <span>초기 분포</span>
          <select value={initial as string} onChange={(event) => setInitial(event.target.value as InitialDistribution)}>
            <option value="start">출발 칸 집중</option>
            <option value="uniform">균등</option>
          </select>
        </label>
        <label className="field" style={{ margin: 0, flex: '1 1 260px' }}>
          <span>
            반복 단계 k = {step} / {maxStep}
          </span>
          <input
            type="range"
            min={1}
            max={maxStep}
            value={Math.min(step, maxStep)}
            onChange={(event) => setStep(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
      </div>

      <dl className="stats" style={{ marginBottom: 14 }}>
        <Stat label="|λ₂| 이론 (디플레이션)" value={model.lambda2.deflation.toFixed(6)} note={model.lambda2.oscillating ? '진동 — 복소 켤레쌍' : '수렴'} />
        <Stat label="|λ₂| 실측 (로그 회귀)" value={model.lambda2.logRegression.toFixed(6)} note={`R² ${model.lambda2.r2.toFixed(6)}`} />
        <Stat label="수렴까지" value={`${model.summary.iterations}회`} note={`잔차 ${model.summary.residual.toExponential(1)}`} />
      </dl>

      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--series-1)' }} /> 실제 오차 ‖π⁽ᵏ⁾−π‖₁
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--series-2)' }} /> 스텝 변화 ‖π⁽ᵏ⁺¹⁾−π⁽ᵏ⁾‖₁
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--series-3)' }} /> 이론 예측 C·|λ₂|ᵏ
        </span>
      </div>

      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="k" stroke="var(--axis)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: '반복 k', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis
              scale="log"
              domain={['auto', 'auto']}
              stroke="var(--axis)"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(value: number) => value.toExponential(0)}
              width={64}
            />
            <RechartsTooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              formatter={(value: number) => value.toExponential(3)}
            />
            <Legend verticalAlign="top" height={0} content={() => null} />
            <Line type="monotone" dataKey="error" name="실제 오차" stroke="var(--series-1)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="stepChange" name="스텝 변화" stroke="var(--series-2)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="theory" name="이론 C|λ₂|ᵏ" stroke="var(--series-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ marginTop: 18 }}>k = {step} 시점의 분포 — 실험 2 (7의 배수 통설)</h3>
      <p className="tip">
        출발 칸에 확률을 몰아 두고 재생하면 7·14·21·28번이 차례로 튀었다가 사라진다.
        <b> 과도상태 효과이지 정상상태 효과가 아니다.</b>
      </p>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>7의 배수 칸</th>
              {sevens.map((entry, i) => (
                <th key={entry.name}>{[7, 14, 21, 28][i]}번 {entry.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>k = {step} 확률</td>
              {sevens.map((entry) => (
                <td key={entry.name}>{(entry.value * 100).toFixed(3)}%</td>
              ))}
            </tr>
            <tr>
              <td>정상상태 π</td>
              {[7, 14, 21, 28].map((cell) => (
                <td key={cell}>{((model.profile.piByCell[cell] ?? 0) * 100).toFixed(3)}%</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 14 }}>k = {step} 상위 6칸</h3>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>칸</th>
              {top.map((entry) => (
                <th key={entry.cell}>
                  {entry.cell}번 {entry.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>확률</td>
              {top.map((entry) => (
                <td key={entry.cell}>{(entry.value * 100).toFixed(3)}%</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="tip">
        초기 분포 합 {initialVector(model.transition.space.size, initial).reduce((a, b) => a + b, 0).toFixed(0)} · 매 스텝 정규화로 합의 드리프트를 막는다.
      </p>
    </div>
  );
}
