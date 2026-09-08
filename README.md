# MarkovBoard

부루마불의 규칙을 유한 마르코프 연쇄로 형식화하고, 전이행렬 $P$ 의 정상상태 분포
$\pi$ 를 계산해 각 칸의 장기 방문 확률 · 기대수익 · 첫 도달 확률을 분석하는 웹 프로젝트.

```
게임 규칙 → 상태공간 → 전이행렬 P → π, v → 수렴 분석 → 시뮬레이션 검증 → 시각화
```

## 원칙

- **선형대수와 확률 계산은 전부 직접 구현한다.** 라이브러리는 렌더링(React)과
  차트(Recharts)에만 쓴다.
- 계산 코드(`src/markov/`)는 화면에 의존하지 않는 순수 함수로 유지한다.
- 규칙 해석은 데이터가 아니라 설정(`config.ts`)으로 전환한다 — 설정 하나가 실험 하나.

## 명령

```bash
npm install
npm run dev        # 개발 서버
npm test           # 단위 테스트
npm run typecheck  # 타입 검사
npm run build      # 프로덕션 빌드
```

## 구조

```
src/markov/     화면에 의존하지 않는 순수 계산
src/components/ 시각화 컴포넌트
docs/           가정 · 데이터 대조 기록 · 실험 결과 · 개발 일지
notebooks/      NumPy 교차 검증
```

## 문서

- [`docs/assumptions.md`](docs/assumptions.md) — 규칙 해석 결정표 (A1–A10)
- [`docs/board-table.md`](docs/board-table.md) — 보드 40칸 데이터 대조 기록
- [`docs/card-table.md`](docs/card-table.md) — 황금열쇠 30장 대조 기록
- [`docs/state-design.md`](docs/state-design.md) — 상태공간 설계와 버린 안
- [`docs/experiments.md`](docs/experiments.md) — 실험 12건 결과표
- [`docs/journal.md`](docs/journal.md) — 개발 일지
