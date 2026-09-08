import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BOARD, chainConfidence, simulate, type SimulationResult } from '../markov';
import type { ComputedModel } from '../model';
import { Stat } from './BoardHeatmap';

/**
 * ComparisonChart — 해석해와 몬테카를로 경험 분포를 같은 축에 겹친다. (계획서 §6.3)
 *
 * 신뢰구간은 **체인 간 분산**으로 만든다. 한 체인 안의 연속 표본은 상관되어 있어
 * √(π(1−π)/N) 로 계산하면 구간을 과소평가한다. (§11.4)
 */
export function ComparisonChart({ model }: { model: ComputedModel }) {
  const [chains, setChains] = useState(200);
  const [turns, setTurns] = useState(1500);
  const [burnIn, setBurnIn] = useState(200);
  const [seed, setSeed] = useState(20260908);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const run = (): void => {
    setRunning(true);
    // 브라우저가 버튼 상태를 그릴 틈을 준 뒤 계산한다.
    window.setTimeout(() => {
      setResult(simulate(model.config, { chains, turnsPerChain: turns, burnIn, seed }));
      setRunning(false);
    }, 16);
  };

  const data =
    result === null
      ? []
      : BOARD.map((cell) => {
          const ci = chainConfidence(result.perChain, cell.index);
          return {
            cell: cell.index,
            name: cell.name,
            theory: (model.profile.piByCell[cell.index] ?? 0) * 100,
            empirical: ci.mean * 100,
            half: ci.halfWidth * 100,
            covered: (model.profile.piByCell[cell.index] ?? 0) >= ci.low && (model.profile.piByCell[cell.index] ?? 0) <= ci.high,
          };
        });

  const covered = data.filter((d) => d.covered).length;
  const l1 = result === null ? 0 : result.piByCell.reduce((sum, p, i) => sum + Math.abs(p - (model.profile.piByCell[i] ?? 0)), 0);

  return (
    <div className="card">
      <h2>이론값 – 시뮬레이션 비교</h2>
      <p className="note">
        규칙 정의는 공유하되 <b>계산 경로는 완전히 분리</b>했다. 전이행렬은 확률을 모으고 시뮬레이터는 주사위를 굴린다.
        두 결과가 맞으면 서로를 검증한다.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', margin: '12px 0' }}>
        <label className="field" style={{ margin: 0, width: 110 }}>
          <span>체인 수</span>
          <input type="number" min={4} max={2000} value={chains} onChange={(e) => setChains(Number(e.target.value))} />
        </label>
        <label className="field" style={{ margin: 0, width: 120 }}>
          <span>체인당 턴</span>
          <input type="number" min={200} max={20000} value={turns} onChange={(e) => setTurns(Number(e.target.value))} />
        </label>
        <label className="field" style={{ margin: 0, width: 110 }}>
          <span>burn-in</span>
          <input type="number" min={0} max={5000} value={burnIn} onChange={(e) => setBurnIn(Number(e.target.value))} />
        </label>
        <label className="field" style={{ margin: 0, width: 130 }}>
          <span>난수 씨앗</span>
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
        <button className="action" data-variant="primary" onClick={run} disabled={running}>
          {running ? '계산 중…' : '시뮬레이션 실행'}
        </button>
        {result !== null && (
          <button className="action" onClick={() => setShowTable((value) => !value)}>
            {showTable ? '그래프 보기' : '표로 보기'}
          </button>
        )}
      </div>

      {result === null ? (
        <p className="tip">씨앗을 고정했으므로 같은 설정이면 같은 결과가 나온다 — 보고서의 수치를 재현할 수 있다.</p>
      ) : (
        <>
          <dl className="stats" style={{ marginBottom: 14 }}>
            <Stat label="‖π̂ − π‖₁" value={l1.toFixed(6)} note={`유효 ${result.effectiveTurns.toLocaleString()}턴`} />
            <Stat label="95% 구간이 해석해를 덮은 칸" value={`${covered} / 40`} note="95% 구간의 기대값은 38" />
            <Stat label="월급 통과율" value={`${(result.salaryRate * 100).toFixed(3)}%`} note={`해석해 ${(model.profile.salaryRate * 100).toFixed(3)}%`} />
            <Stat
              label="Kac — 무인도 재귀시간"
              value={(result.returnTimes[10] ?? 0).toFixed(3)}
              note={`1/π = ${(1 / (model.profile.piByCell[10] ?? 1)).toFixed(3)}`}
            />
          </dl>

          <div className="legend">
            <span>
              <i className="swatch" style={{ background: 'var(--series-1)' }} /> 몬테카를로 경험 분포 (95% 구간)
            </span>
            <span>
              <i className="swatch" style={{ background: 'var(--series-2)' }} /> 해석해 π
            </span>
          </div>

          {showTable ? (
            <div className="scroll-x" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>칸</th>
                    <th>해석해 π</th>
                    <th>시뮬 π̂</th>
                    <th>95% 구간</th>
                    <th>포함</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.cell}>
                      <td>
                        {row.cell}번 {row.name}
                      </td>
                      <td>{row.theory.toFixed(3)}%</td>
                      <td>{row.empirical.toFixed(3)}%</td>
                      <td>
                        {(row.empirical - row.half).toFixed(3)} – {(row.empirical + row.half).toFixed(3)}%
                      </td>
                      <td style={{ color: row.covered ? 'var(--good)' : 'var(--critical)' }}>{row.covered ? '예' : '아니오'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ height: 340 }}>
              <ResponsiveContainer>
                <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="cell" stroke="var(--axis)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={1} label={{ value: '칸 번호', position: 'insideBottom', offset: -14, fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis stroke="var(--axis)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={52} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, key: string) => [`${value.toFixed(3)}%`, key === 'empirical' ? '시뮬레이션' : '해석해']}
                    labelFormatter={(cell: number) => `${cell}번 ${BOARD[cell]?.name ?? ''}`}
                  />
                  <Bar dataKey="empirical" name="시뮬레이션" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={14}>
                    <ErrorBar dataKey="half" width={4} strokeWidth={1.5} stroke="var(--text-secondary)" direction="y" />
                  </Bar>
                  <Line type="monotone" dataKey="theory" name="해석해" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <h3 style={{ marginTop: 16 }}>사회복지기금 적립액 분포 (실험 6)</h3>
          <WelfareTable payouts={result.welfarePayouts} expected={model.summary.welfarePayout} />
        </>
      )}
    </div>
  );
}

function WelfareTable({ payouts, expected }: { payouts: readonly number[]; expected: number }) {
  if (payouts.length === 0) return null;
  const buckets = new Map<number, number>();
  for (const payout of payouts) buckets.set(payout, (buckets.get(payout) ?? 0) + 1);
  const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(0, 7);
  const mean = payouts.reduce((a, b) => a + b, 0) / payouts.length;
  const over45 = payouts.filter((x) => x >= 45).length / payouts.length;
  let cumulative = 0;

  return (
    <>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>수령액</th>
              {rows.map(([amount]) => (
                <th key={amount}>{amount}만</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>확률</td>
              {rows.map(([amount, count]) => (
                <td key={amount}>{((count / payouts.length) * 100).toFixed(2)}%</td>
              ))}
            </tr>
            <tr>
              <td>누적</td>
              {rows.map(([amount, count]) => {
                cumulative += count / payouts.length;
                return <td key={amount}>{(cumulative * 100).toFixed(2)}%</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="tip">
        평균 {mean.toFixed(3)}만 (갱신보상 근사 {expected.toFixed(3)}만) · 45만 이상 받을 확률 {(over45 * 100).toFixed(2)}%
      </p>
    </>
  );
}
