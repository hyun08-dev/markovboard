/**
 * config.ts — 모델 설정 상수 블록. (계획서 §6.4)
 *
 * **설정 하나를 바꾸면 실험 하나가 실행된다**는 것이 이 파일의 목적이다.
 * 실험할 때마다 계산 코드를 고쳐야 한다면 §10 실험 목록이 굴러가지 않는다.
 * 전이행렬 생성기와 시뮬레이터는 모두 이 설정을 인자로 받는다.
 */

import type { BuildLevel } from './board';

/** 무인도 모델링 방식. (§10 실험 9 — 민감도 비교) */
export type JailModel =
  | 'split' //  J3 · J2 · J1 · J0 네 상태로 분리 (기본, 43상태)
  | 'merged'; // 무인도를 한 상태로 뭉갠 근사 (40상태)

/** 우주여행 목적지 정책. (가정 A7 · §10 실험 3) */
export type TeleportPolicy =
  | 'uniform' //  우주여행 칸을 제외한 39칸에 균등 랜덤 (중립 기준선)
  | 'seoul' //    39번 서울로 직행
  | 'newyork' //  37번 뉴욕으로 직행
  | 'jail'; //    10번 무인도로 자진 도피

/** 황금열쇠 덱 추출 방식. (가정 A5) */
export type CardDeckModel =
  | 'shuffle' //     매 뽑기마다 셔플하는 복원 추출 (해석해가 가능한 근사)
  | 'no-replace'; // 비복원 추출 (시뮬레이터 전용 — 해석해에는 쓰지 않는다)

/** 건축비 누적 해석. docs/board-table.md 에서 실물 규칙과 대조해 확정한다. */
export type BuildCostMode = 'direct' | 'cumulative';

export interface ModelConfig {
  /** 판본 식별자. 결과 파일에 함께 기록해 재현성을 남긴다. */
  readonly edition: string;
  /** 체인 한 스텝의 단위. 무인도 대기가 턴 단위로 규정되므로 기본은 'turn'. (§3.1) */
  readonly stepUnit: 'turn' | 'roll';
  readonly jailModel: JailModel;
  /** A4 — 12번 황금열쇠 '뒤로 2칸'으로 10번에 들어가면 갇히는가. */
  readonly jailOnBackstep: boolean;
  readonly teleportPolicy: TeleportPolicy;
  readonly cardDeck: CardDeckModel;
  /** A6 — 카드로 이동한 칸이 황금열쇠일 때 다시 뽑는가. 기본은 뽑지 않는다(무한 루프 방지). */
  readonly chainCardMoves: boolean;
  /** A8 — 모든 개발 가능 대지의 개발 단계. */
  readonly buildLevel: BuildLevel;
  readonly buildCostMode: BuildCostMode;
  /** 주사위 한 개의 눈 목록. 짝수만 남기면 주기 2가 생긴다. (§10 실험 12) */
  readonly diceFaces: readonly number[];
  /** MVP 스위치 — 황금열쇠·우주여행 효과를 모두 끈 순수 순환 보드. (Phase 0 · §11.2) */
  readonly enableGoldenKey: boolean;
  readonly enableSpaceTravel: boolean;
  /** 무인도 규칙 자체를 끈다. 켜면 순수 순환 40칸 보드가 되어 π = 1/40 이 정확히 나온다. */
  readonly enableJail: boolean;
}

/** 기본 설정 — 계획서 §2.3 결정표(A1–A10)를 그대로 옮긴 값. */
export const DEFAULT_CONFIG: ModelConfig = {
  edition: 'family-2016',
  stepUnit: 'turn',
  jailModel: 'split',
  jailOnBackstep: true,
  teleportPolicy: 'uniform',
  cardDeck: 'shuffle',
  chainCardMoves: false,
  buildLevel: 'hotel',
  buildCostMode: 'direct',
  diceFaces: [1, 2, 3, 4, 5, 6],
  enableGoldenKey: true,
  enableSpaceTravel: true,
  enableJail: true,
};

/**
 * 순수 순환 보드 설정 — 특수 칸을 모두 끈 40칸 + 주사위 2개.
 *
 * 이 설정에서 P 는 순환행렬(circulant)이 되어 이중확률행렬이므로 π_i = 1/40 이
 * 정확히 성립한다. 전이행렬 생성기 버그의 대부분을 잡는 해석적 정답 테스트다. (§11.2)
 */
export const PLAIN_CYCLIC_CONFIG: ModelConfig = {
  ...DEFAULT_CONFIG,
  enableGoldenKey: false,
  enableSpaceTravel: false,
  enableJail: false,
};

export function withConfig(overrides: Partial<ModelConfig>): ModelConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
