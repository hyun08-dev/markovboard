import { DEFAULT_CONFIG, type BuildLevel, type CardDeckModel, type JailModel, type ModelConfig, type TeleportPolicy } from '../markov';

/**
 * ConfigPanel — 모델 설정 패널. (계획서 §6.4)
 *
 * **설정 하나를 바꾸면 실험 하나가 실행된다.** 실험할 때마다 코드를 고쳐야 하면
 * §10 실험 목록이 실제로 굴러가지 않는다.
 */
export function ConfigPanel({
  config,
  onChange,
  onReset,
  shareUrl,
}: {
  config: ModelConfig;
  onChange: (patch: Partial<ModelConfig>) => void;
  onReset: () => void;
  shareUrl: string;
}) {
  const changed = (Object.keys(DEFAULT_CONFIG) as (keyof ModelConfig)[]).filter(
    (key) => JSON.stringify(config[key]) !== JSON.stringify(DEFAULT_CONFIG[key]),
  );

  return (
    <aside className="card" style={{ position: 'sticky', top: 16 }}>
      <h2>모델 설정</h2>
      <p className="tip" style={{ marginBottom: 14 }}>
        설정 하나가 실험 하나다. 바꾼 값은 주소창에 인코딩되므로 링크로 그대로 재현된다.
      </p>

      <label className="field">
        <span>무인도 모델링 (실험 9)</span>
        <select value={config.jailModel} onChange={(e) => onChange({ jailModel: e.target.value as JailModel })}>
          <option value="split">4단계 분리 — J₃·J₂·J₁·J₀ (43상태)</option>
          <option value="merged">한 상태로 뭉갬 (40상태 · 근사)</option>
        </select>
      </label>

      <label className="field">
        <span>우주여행 정책 (실험 3 · 가정 A7)</span>
        <select value={config.teleportPolicy} onChange={(e) => onChange({ teleportPolicy: e.target.value as TeleportPolicy })}>
          <option value="uniform">균등 — 39칸 (중립 기준선)</option>
          <option value="seoul">서울 우선 (39번)</option>
          <option value="newyork">뉴욕 우선 (37번)</option>
          <option value="jail">무인도 도피 (10번)</option>
        </select>
      </label>

      <label className="field">
        <span>건물 개발 단계 (실험 5 · 가정 A8)</span>
        <select value={config.buildLevel} onChange={(e) => onChange({ buildLevel: e.target.value as BuildLevel })}>
          <option value="none">빈 땅 — 대지료</option>
          <option value="villa1">별장 1채</option>
          <option value="villa2">별장 2채</option>
          <option value="building">빌딩</option>
          <option value="hotel">호텔 1채 (기본)</option>
          <option value="full">풀하우스 — 별장2+빌딩+호텔 (확장 해석)</option>
        </select>
      </label>

      <label className="field">
        <span>주사위 (실험 12 — Perron–Frobenius 조건)</span>
        <select
          value={`${config.diceCount}:${config.diceFaces.join('')}`}
          onChange={(e) => {
            const [count, faces] = e.target.value.split(':');
            onChange({ diceCount: Number(count) as 1 | 2, diceFaces: [...(faces ?? '')].map(Number) });
          }}
        >
          <option value="2:123456">2개 · 1–6 (기본)</option>
          <option value="2:246">2개 · 짝수만 → 기약성 파괴</option>
          <option value="1:135">1개 · 홀수만 → 주기 2</option>
          <option value="1:123456">1개 · 1–6</option>
        </select>
      </label>

      <label className="field">
        <span>황금열쇠 덱 (가정 A5)</span>
        <select value={config.cardDeck} onChange={(e) => onChange({ cardDeck: e.target.value as CardDeckModel })}>
          <option value="shuffle">복원 추출 — 매번 셔플 (해석해 가능)</option>
          <option value="no-replace">비복원 추출 (시뮬레이터 전용)</option>
        </select>
      </label>

      <h3 style={{ marginTop: 18 }}>규칙 토글</h3>
      <Toggle label="황금열쇠 효과" checked={config.enableGoldenKey} onChange={(v) => onChange({ enableGoldenKey: v })} />
      <Toggle label="우주여행" checked={config.enableSpaceTravel} onChange={(v) => onChange({ enableSpaceTravel: v })} />
      <Toggle label="무인도 고립" checked={config.enableJail} onChange={(v) => onChange({ enableJail: v })} />
      <Toggle
        label="우주여행 칸에서 턴 종료 (B4)"
        checked={config.spaceEndsTurn}
        onChange={(v) => onChange({ spaceEndsTurn: v })}
      />
      <Toggle
        label="12번 '뒤로 2칸'으로 갇힘 (A4)"
        checked={config.jailOnBackstep}
        onChange={(v) => onChange({ jailOnBackstep: v })}
      />
      <Toggle
        label="카드 이동 후 황금열쇠 재추첨 (A6)"
        checked={config.chainCardMoves}
        onChange={(v) => onChange({ chainCardMoves: v })}
      />
      <Toggle
        label="카드로 이동하면 턴 종료 (A11)"
        checked={config.cardMoveEndsTurn}
        onChange={(v) => onChange({ cardMoveEndsTurn: v })}
      />

      <p className="tip" style={{ marginTop: 14 }}>
        {changed.length === 0 ? '기본 설정 그대로입니다.' : `기본값과 다른 항목 ${changed.length}개: ${changed.join(', ')}`}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="action" onClick={onReset} disabled={changed.length === 0}>
          기본값으로
        </button>
        <button className="action" onClick={() => void navigator.clipboard?.writeText(shareUrl)}>
          링크 복사
        </button>
      </div>
    </aside>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
