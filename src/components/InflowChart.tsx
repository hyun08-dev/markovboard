import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { BOARD } from '../markov';
import type { ComputedModel } from '../model';

/**
 * InflowChart — 칸별 유입 경로를 누적 막대로 나눈다. (계획서 §10 실험 8)
 *
 * "높다"에서 "왜 높은지"로 넘어가는 화면이다. 다섯 경로의 합이 그 칸의 π 와 같다.
 * 누적 막대이므로 인접 색만 구분되면 되고, 조각 사이에 2px 틈을 둔다.
 */
const SOURCES = [
  { key: 'dice', label: '주사위 착지', color: 'var(--series-1)' },
  { key: 'card', label: '이동 카드', color: 'var(--series-2)' },
  { key: 'backstep', label: "'이사' 뒤로", color: 'var(--series-3)' },
  { key: 'teleport', label: '우주여행', color: 'var(--series-4)' },
  { key: 'stay', label: '무인도 대기 체류', color: 'var(--series-5)' },
] as const;

export function InflowChart({ model }: { model: ComputedModel }) {
  const data = BOARD.map((cell) => ({
    cell: cell.index,
    name: cell.name,
    dice: (model.profile.inflow.dice[cell.index] ?? 0) * 100,
    card: (model.profile.inflow.card[cell.index] ?? 0) * 100,
    backstep: (model.profile.inflow.backstep[cell.index] ?? 0) * 100,
    teleport: (model.profile.inflow.teleport[cell.index] ?? 0) * 100,
    stay: (model.profile.inflow.stay[cell.index] ?? 0) * 100,
  }));

  return (
    <div className="card">
      <h2>유입 경로 분해</h2>
      <p className="note">
        각 칸에 <b>어떤 경로로</b> 들어왔는지를 나눈다. 무인도가 높은 이유는 잘 들어가서가 아니라
        <b> 못 나와서</b>다 — 대기 체류가 그 칸 확률의 3분의 2를 넘는다.
      </p>
      <div className="legend">
        {SOURCES.map((source) => (
          <span key={source.key}>
            <i className="swatch" style={{ background: source.color }} /> {source.label}
          </span>
        ))}
      </div>
      <div style={{ height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="cell" stroke="var(--axis)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={1} label={{ value: '칸 번호', position: 'insideBottom', offset: -14, fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis stroke="var(--axis)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={52} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <RechartsTooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, key: string) => [`${value.toFixed(3)}%`, SOURCES.find((s) => s.key === key)?.label ?? key]}
              labelFormatter={(cell: number) => `${cell}번 ${BOARD[cell]?.name ?? ''}`}
            />
            {SOURCES.map((source, i) => (
              <Bar
                key={source.key}
                dataKey={source.key}
                stackId="inflow"
                fill={source.color}
                // 조각 사이 2px 틈. 맨 위 조각만 모서리를 둥글린다.
                stroke="var(--surface-1)"
                strokeWidth={1}
                radius={i === SOURCES.length - 1 ? [3, 3, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="tip">다섯 경로의 합은 그 칸의 π 와 정확히 같다. 대기 체류는 무인도에만 있다.</p>
    </div>
  );
}
