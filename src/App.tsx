import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG, type ModelConfig } from './markov';
import { computeModel } from './model';
import { BoardHeatmap, Stat, type HeatMetric } from './components/BoardHeatmap';
import { ConvergencePlot } from './components/ConvergencePlot';
import { ComparisonChart } from './components/ComparisonChart';
import { MatrixHeatmap } from './components/MatrixHeatmap';
import { InflowChart } from './components/InflowChart';
import { ConfigPanel } from './components/ConfigPanel';
import { decodeConfig, encodeConfig } from './urlState';

type Tab = 'board' | 'convergence' | 'comparison' | 'inflow' | 'matrix';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'board', label: '보드 히트맵' },
  { id: 'convergence', label: '정상상태 수렴' },
  { id: 'comparison', label: '이론값 – 시뮬레이션' },
  { id: 'inflow', label: '유입 경로' },
  { id: 'matrix', label: '전이행렬 P' },
];

export function App() {
  const [config, setConfig] = useState<ModelConfig>(() => decodeConfig(window.location.search));
  const [tab, setTab] = useState<Tab>('board');
  const [metric, setMetric] = useState<HeatMetric>('pi');
  const [selected, setSelected] = useState<number | null>(null);

  const query = encodeConfig(config);
  useEffect(() => {
    // 임베드된 iframe 등 히스토리 조작이 막힌 환경에서도 앱이 죽지 않게 감싼다.
    try {
      const next = `${window.location.pathname}${query === '' ? '' : `?${query}`}`;
      window.history.replaceState(null, '', next);
    } catch {
      /* 주소를 못 바꿔도 계산과 화면에는 지장이 없다. */
    }
  }, [query]);

  const model = useMemo(() => computeModel(config), [config]);
  const shareUrl = `${window.location.origin}${window.location.pathname}${query === '' ? '' : `?${query}`}`;

  return (
    <main className="app">
      <div className="masthead">
        <h1>MarkovBoard</h1>
        <p>부루마불 위치 과정의 정상상태 분석 · 대형(패밀리)판 · 기본 룰</p>
      </div>

      <div className="card">
        <dl className="stats">
          <Stat
            label="상태 수"
            value={`${model.summary.states}개`}
            note={!config.enableJail ? '무인도 규칙 끔' : config.jailModel === 'split' ? '무인도 4단계 분리' : '무인도 뭉갬'}
          />
          <Stat label="잔차 ‖πP−π‖₁" value={model.summary.residual.toExponential(1)} note={`${model.summary.iterations}회 반복`} />
          <Stat label="|λ₂|" value={model.lambda2.logRegression.toFixed(5)} note={model.lambda2.oscillating ? '복소 켤레쌍 — 디플레이션 진동' : '실수'} />
          <Stat label="Σv (턴당 착지)" value={model.summary.totalLandings.toFixed(4)} note={`기대 굴림 ${model.summary.expectedRolls.toFixed(4)}`} />
          <Stat label="월급 통과율" value={`${(model.summary.salaryRate * 100).toFixed(3)}%`} note={`한 바퀴 ${model.summary.turnsPerLap.toFixed(2)}턴`} />
          <Stat label="턴당 기대 통행료" value={`${model.summary.expectedToll.toFixed(2)}만`} note={`개발 단계: ${config.buildLevel}`} />
          <Stat label="사회복지기금 기대 수령" value={`${model.summary.welfarePayout.toFixed(2)}만`} note="갱신보상 근사" />
          <Stat
            label="Kac 최대 상대오차"
            value={model.diagnostics.kacAvailable ? model.summary.maxKacError.toExponential(1) : '—'}
            note={model.diagnostics.kacAvailable ? 'm_ii = 1/π_i' : '정상분포가 아니라 계산 불가'}
          />
        </dl>
      </div>

      {model.diagnostics.warnings.length > 0 && (
        <div className="card" role="status" style={{ borderColor: 'var(--critical)' }}>
          <h2 style={{ color: 'var(--critical)' }}>⚠ Perron–Frobenius 조건이 깨졌습니다</h2>
          <p className="note" style={{ marginTop: 0 }}>
            이 설정은 <b>일부러</b> 조건을 깨뜨린 실험 12의 데모다. 아래 결과는 "유일한 정상분포"가 아니다.
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--text-secondary)' }}>
            {model.diagnostics.warnings.map((warning) => (
              <li key={warning} style={{ marginBottom: 4 }}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="layout">
        <div>
          <div className="tabs" role="tablist">
            {TABS.map((entry) => (
              <button key={entry.id} role="tab" aria-selected={tab === entry.id} onClick={() => setTab(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>

          {tab === 'board' && (
            <BoardHeatmap model={model} metric={metric} onMetricChange={setMetric} selected={selected} onSelect={setSelected} />
          )}
          {tab === 'convergence' && <ConvergencePlot model={model} />}
          {tab === 'comparison' && <ComparisonChart model={model} />}
          {tab === 'inflow' && <InflowChart model={model} />}
          {tab === 'matrix' && <MatrixHeatmap model={model} />}
        </div>

        <ConfigPanel
          config={config}
          onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
          onApply={setConfig}
          onReset={() => setConfig(DEFAULT_CONFIG)}
          shareUrl={shareUrl}
        />
      </div>
    </main>
  );
}
