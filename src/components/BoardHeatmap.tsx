import { useState } from 'react';
import { BOARD, BOARD_SIZE, cellAt, type BuildLevel } from '../markov';
import type { ComputedModel } from '../model';
import { Tooltip, type TooltipState } from './Tooltip';

/**
 * BoardHeatmap — 실제 40칸 배치를 SVG 로 그리고 칸별 π 를 명암으로 표시한다.
 *
 * 칸 배치가 불규칙해 차트 라이브러리보다 직접 그리는 편이 빠르다. (계획서 §7)
 * 색은 **순차 램프(파랑 한 색, 밝음 → 어두움)** 다. 크기를 나타내는 값에는
 * 무지개색을 쓰지 않는다.
 */

/** 칸 번호 → 11×11 격자 좌표. 0번이 오른쪽 아래 모서리다. */
function gridPosition(index: number): { col: number; row: number } {
  if (index <= 10) return { col: 10 - index, row: 10 };
  if (index <= 20) return { col: 0, row: 20 - index };
  if (index <= 30) return { col: index - 20, row: 0 };
  return { col: 10, row: index - 30 };
}

const RAMP = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600', '--seq-700'];

/** 값을 순차 램프의 한 단계로 옮긴다. 0 은 가장 밝은 단계다. */
function rampStep(value: number, max: number): string {
  if (max <= 0) return `var(${RAMP[0]})`;
  const t = Math.min(1, Math.max(0, value / max));
  // 상위 값이 뭉치지 않도록 제곱근으로 펴 준다.
  const index = Math.min(RAMP.length - 1, Math.round(Math.sqrt(t) * (RAMP.length - 1)));
  return `var(${RAMP[index]})`;
}

export type HeatMetric = 'pi' | 'v' | 'returnPerTurn';

const METRIC_LABEL: Record<HeatMetric, string> = {
  pi: 'π — 턴 시작 확률',
  v: 'v — 턴당 착지 기대 횟수',
  returnPerTurn: '턴당 회수율',
};

export function BoardHeatmap({
  model,
  metric,
  onMetricChange,
  selected,
  onSelect,
}: {
  model: ComputedModel;
  metric: HeatMetric;
  onMetricChange: (metric: HeatMetric) => void;
  selected: number | null;
  onSelect: (cell: number | null) => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const payoffByCell = new Map(model.payoffs.map((p) => [p.index, p]));

  const valueOf = (cell: number): number => {
    if (metric === 'pi') return model.profile.piByCell[cell] ?? 0;
    if (metric === 'v') return model.profile.v[cell] ?? 0;
    return payoffByCell.get(cell)?.returnPerTurn ?? 0;
  };

  const values = Array.from({ length: BOARD_SIZE }, (_, cell) => valueOf(cell));
  const max = Math.max(...values.filter(Number.isFinite));
  const format = (value: number) =>
    metric === 'v' ? value.toFixed(5) : `${(value * 100).toFixed(3)}%`;

  const size = 62;
  const board = size * 11;

  return (
    <div className="card">
      <div className="masthead" style={{ justifyContent: 'space-between' }}>
        <h2>보드 히트맵</h2>
        <label className="field" style={{ margin: 0, minWidth: 220 }}>
          <span>표시할 값</span>
          <select value={metric} onChange={(event) => onMetricChange(event.target.value as HeatMetric)}>
            {(Object.keys(METRIC_LABEL) as HeatMetric[]).map((key) => (
              <option key={key} value={key}>
                {METRIC_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ramp" aria-hidden="true">
        낮음 <i /> 높음 <span style={{ marginLeft: 8 }}>최대 {format(max)}</span>
      </div>

      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${board} ${board}`}
          width="100%"
          style={{ maxWidth: board, display: 'block', marginTop: 10 }}
          role="img"
          aria-label={`부루마불 40칸 보드. ${METRIC_LABEL[metric]} 를 명암으로 표시한다.`}
        >
          {BOARD.map((cell) => {
            const { col, row } = gridPosition(cell.index);
            const value = values[cell.index] ?? 0;
            const isSelected = selected === cell.index;
            // 램프 뒤쪽 단계 위에서는 흰 글씨가 읽힌다.
            const dark = max > 0 && Math.sqrt(value / max) > 0.62;
            return (
              <g
                key={cell.index}
                transform={`translate(${col * size} ${row * size})`}
                onMouseMove={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    content: (
                      <>
                        <strong>
                          {cell.index}번 {cell.name}
                        </strong>
                        π {((model.profile.piByCell[cell.index] ?? 0) * 100).toFixed(3)}%
                        <br />v {(model.profile.v[cell.index] ?? 0).toFixed(5)}
                        {payoffByCell.has(cell.index) && (
                          <>
                            <br />
                            턴당 회수율 {((payoffByCell.get(cell.index)?.returnPerTurn ?? 0) * 100).toFixed(3)}%
                          </>
                        )}
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onSelect(isSelected ? null : cell.index)}
                style={{ cursor: 'pointer' }}
              >
                {/* 칸 사이에 2px 틈을 둬 채움이 서로 붙지 않게 한다. */}
                <rect
                  x={1}
                  y={1}
                  width={size - 2}
                  height={size - 2}
                  rx={5}
                  fill={rampStep(value, max)}
                  stroke={isSelected ? 'var(--text-primary)' : 'var(--border)'}
                  strokeWidth={isSelected ? 2.5 : 1}
                />
                <text x={6} y={13} fontSize={9} fill={dark ? '#ffffff' : 'var(--text-muted)'}>
                  {cell.index}
                </text>
                <text
                  x={size / 2}
                  y={size / 2 + 1}
                  fontSize={cell.name.length > 6 ? 8 : 9.5}
                  textAnchor="middle"
                  fill={dark ? '#ffffff' : 'var(--text-primary)'}
                >
                  {cell.name.length > 7 ? `${cell.name.slice(0, 6)}…` : cell.name}
                </text>
                <text
                  x={size / 2}
                  y={size - 10}
                  fontSize={9}
                  textAnchor="middle"
                  fill={dark ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)'}
                  fontVariant="tabular-nums"
                >
                  {format(value)}
                </text>
              </g>
            );
          })}

          <text x={board / 2} y={board / 2 - 30} textAnchor="middle" fontSize={15} fill="var(--text-secondary)">
            {METRIC_LABEL[metric]}
          </text>
          <text x={board / 2} y={board / 2 + 2} textAnchor="middle" fontSize={26} fill="var(--text-primary)" fontWeight={600}>
            {model.summary.states}개 상태
          </text>
          <text x={board / 2} y={board / 2 + 28} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
            잔차 {model.summary.residual.toExponential(1)} · {model.summary.iterations}회 반복
          </text>
        </svg>
      </div>

      {selected !== null && <CellDetail model={model} cell={selected} />}
      <Tooltip state={tooltip} />
    </div>
  );
}

function CellDetail({ model, cell }: { model: ComputedModel; cell: number }) {
  const data = cellAt(cell);
  const payoff = model.payoffs.find((p) => p.index === cell);
  const inflow = (['dice', 'card', 'backstep', 'teleport', 'stay'] as const)
    .map((source) => ({ source, value: model.profile.inflow[source][cell] ?? 0 }))
    .filter((entry) => entry.value > 1e-12)
    .sort((a, b) => b.value - a.value);
  const label: Record<string, string> = {
    dice: '주사위 착지',
    card: '이동 카드',
    backstep: "'이사' 뒤로",
    teleport: '우주여행',
    stay: '무인도 대기 체류',
  };
  const total = model.profile.piByCell[cell] ?? 0;
  const buildLevel: BuildLevel = model.config.buildLevel;

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <h3>
        {cell}번 {data.name}
      </h3>
      <dl className="stats">
        <Stat label="π (턴 시작 확률)" value={`${(total * 100).toFixed(3)}%`} note={`균등 대비 ${(total * 40).toFixed(2)}배`} />
        <Stat label="v (턴당 착지)" value={(model.profile.v[cell] ?? 0).toFixed(5)} />
        {payoff !== undefined && (
          <>
            <Stat label={`통행료 (${buildLevel})`} value={`${payoff.toll}만`} />
            <Stat label="투자액" value={`${payoff.investment}만`} note="매입가 + 건축비" />
            <Stat label="턴당 기대수익" value={`${payoff.expectedPayoff.toFixed(3)}만`} note="v × 통행료" />
            <Stat label="턴당 회수율" value={`${(payoff.returnPerTurn * 100).toFixed(3)}%`} note={`회수 ${payoff.paybackTurns.toFixed(1)}턴`} />
            <Stat label="회수 필요 착지" value={`${payoff.paybackLandings.toFixed(2)}회`} />
          </>
        )}
      </dl>

      <h3 style={{ marginTop: 14 }}>유입 경로 분해</h3>
      <table>
        <thead>
          <tr>
            <th>경로</th>
            <th>확률</th>
            <th>비중</th>
          </tr>
        </thead>
        <tbody>
          {inflow.map((entry) => (
            <tr key={entry.source}>
              <td>{label[entry.source]}</td>
              <td>{(entry.value * 100).toFixed(3)}%</td>
              <td>{((entry.value / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  // 조건이 깨진 설정에서는 Infinity·NaN 이 나올 수 있다. 숫자인 척하지 않고 줄표로 둔다.
  const shown = /Infinity|NaN/.test(value) ? '—' : value;
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        {shown}
        {note !== undefined && <small>{note}</small>}
      </dd>
    </div>
  );
}
