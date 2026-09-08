/**
 * toy.ts — 4상태 축소 모델. (계획서 Phase 2 · §11.3)
 *
 * 실제 43상태 모델로 가기 전에 **손으로 풀 수 있는 크기**의 보드를 하나 만들어
 * 손계산 · NumPy · TypeScript 세 경로가 같은 답을 내는지 확인한다. 세 결과가
 * 일치해야 실제 모델로 진행한다.
 *
 * 이 장난감 보드는 실제 모델의 두 가지 성질을 일부러 담고 있다.
 *
 * 1. **강제 이동 칸** — 3번에 착지하면 즉시 1번으로 끌려간다. 부루마불의
 *    '무인도로 가시오'와 12번 황금열쇠 '뒤로 2칸'에 대응한다.
 * 2. **도달 불가능 상태** — 그 결과 3번에서 턴을 시작하는 일이 없어진다.
 *    BFS 도달성 검사(§3.2)가 무엇을 걸러내는지 보여주는 최소 예제다.
 *
 * 손계산 결과는 docs/state-design.md 에 유도 과정과 함께 적었다.
 */

/** 장난감 보드의 칸 수. */
export const TOY_SIZE = 4;

/** 주사위 한 개, 눈은 1과 2뿐이며 각각 1/2. 더블 규칙은 없다. */
export const TOY_DICE: readonly number[] = [1, 2];

/** 3번 칸에 착지하면 1번으로 끌려간다. */
export const TOY_FORCED_MOVE: Readonly<Record<number, number>> = { 3: 1 };

/** 착지 칸에 강제 이동 효과를 적용한 뒤의 최종 칸. */
function resolve(landing: number): number {
  return TOY_FORCED_MOVE[landing] ?? landing;
}

/**
 * 4×4 전이행렬을 만든다. 도달 불가능 상태를 아직 제거하지 않은 원본이다.
 *
 *      0    1    2    3
 * 0 [  0   1/2  1/2   0  ]
 * 1 [  0   1/2  1/2   0  ]
 * 2 [ 1/2  1/2   0    0  ]
 * 3 [ 1/2  1/2   0    0  ]
 *
 * 3번 열이 전부 0이므로 3번은 어디에서도 도달할 수 없다.
 */
export function buildToyMatrix(): number[][] {
  const p = 1 / TOY_DICE.length;
  return Array.from({ length: TOY_SIZE }, (_, from) => {
    const row = new Array<number>(TOY_SIZE).fill(0);
    for (const face of TOY_DICE) {
      const to = resolve((from + face) % TOY_SIZE);
      row[to] = (row[to] ?? 0) + p;
    }
    return row;
  });
}

/** 도달 가능한 상태만 남긴 3×3 전이행렬과 상태 목록. */
export function buildToyReachable(): { states: number[]; matrix: number[][] } {
  const full = buildToyMatrix();
  const states = [0, 1, 2];
  const matrix = states.map((i) => states.map((j) => full[i]?.[j] ?? 0));
  return { states, matrix };
}

/**
 * 손으로 푼 정확한 정상분포. πP = π 와 Σπ = 1 을 연립해 얻는다.
 *
 *   π₀ = 1/6,  π₁ = 1/2,  π₂ = 1/3
 */
export const TOY_EXACT_PI: readonly number[] = [1 / 6, 1 / 2, 1 / 3];

/**
 * 손으로 푼 정확한 고유값. 특성다항식이 −λ(λ − 1)(λ + 1/2) 로 인수분해된다.
 * 따라서 |λ₂| = 1/2 이고 오차가 매 스텝 정확히 절반으로 줄어야 한다.
 */
export const TOY_EXACT_EIGENVALUES: readonly number[] = [1, -1 / 2, 0];
export const TOY_EXACT_LAMBDA2 = 1 / 2;

/** Kac 보조정리로 얻는 정확한 재귀시간 m_ii = 1/π_i. */
export const TOY_EXACT_RETURN_TIMES: readonly number[] = [6, 2, 3];
