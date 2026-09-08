import { useState } from 'react';
import type { ComputedModel } from '../model';
import { Tooltip, type TooltipState } from './Tooltip';

/**
 * MatrixHeatmap — 전이행렬 P 자체를 그대로 그린다. (계획서 §8)
 *
 * 43×43 이라 한 화면에 들어간다. 어떤 규칙이 어떤 구조를 만드는지가 눈에 보인다 —
 * 주사위 이동이 만드는 대각 띠, 무인도의 세로줄, 우주여행 칸의 가로 띠.
 * 값이 크기이므로 **순차 램프(파랑 한 색)** 를 쓴다.
 */
const RAMP = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600', '--seq-700'];

export function MatrixHeatmap({ model }: { model: ComputedModel }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const n = model.transition.space.size;
  const cell = 15;
  const pad = 46;
  const size = n * cell;
  const max = Math.max(...model.transition.matrix.flat());

  return (
    <div className="card">
      <h2>전이행렬 P</h2>
      <p className="note">
        {n}×{n} 행렬을 그대로 그렸다. 대각선 옆의 띠는 주사위 이동, 세로줄은 무인도로 끌려가는 경로,
        가로 띠는 우주여행 칸에서 온 보드에 확률이 퍼지는 모습이다.
      </p>
      <div className="ramp" aria-hidden="true">
        0 <i /> {max.toFixed(3)}
      </div>

      <div className="scroll-x">
        <svg viewBox={`0 0 ${size + pad} ${size + pad}`} width="100%" style={{ maxWidth: size + pad, marginTop: 10 }} role="img" aria-label="전이행렬 히트맵">
          {model.transition.matrix.map((row, i) =>
            row.map((value, j) => {
              if (value <= 0) return null;
              const t = Math.min(1, Math.sqrt(value / max));
              const step = RAMP[Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)))];
              return (
                <rect
                  key={`${i}-${j}`}
                  x={pad + j * cell}
                  y={i * cell}
                  width={cell - 1}
                  height={cell - 1}
                  fill={`var(${step})`}
                  onMouseMove={(event) =>
                    setTooltip({
                      x: event.clientX,
                      y: event.clientY,
                      content: (
                        <>
                          <strong>
                            {model.transition.space.label(i)} → {model.transition.space.label(j)}
                          </strong>
                          확률 {value.toFixed(6)}
                        </>
                      ),
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            }),
          )}
          {model.transition.matrix.map((_, i) =>
            i % 5 === 0 ? (
              <text key={i} x={pad - 5} y={i * cell + 11} fontSize={9} textAnchor="end" fill="var(--text-muted)">
                {model.transition.space.label(i)}
              </text>
            ) : null,
          )}
          <text x={pad} y={size + 22} fontSize={11} fill="var(--text-muted)">
            열 = 다음 턴 시작 상태 · 행 = 현재 상태
          </text>
        </svg>
      </div>
      <Tooltip state={tooltip} />
    </div>
  );
}
