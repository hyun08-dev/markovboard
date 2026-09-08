/**
 * cards.ts — 황금열쇠 덱 30장 정의. (계획서 §5)
 *
 * 체인에 영향을 주는 것은 **위치를 바꾸는 12장**뿐이다. 나머지 카드는 수입·지출·
 * 기타 효과만 가지므로 위치 과정에서는 '제자리'로 처리한다. (계획서 §2.1)
 *
 * 가정 A5 — 매 뽑기마다 셔플하는 **복원 추출**로 근사한다. 실제 덱은 비복원이며,
 * 그 차이는 시뮬레이터에서 비복원으로도 돌려 측정한다. (§11.4)
 */

import { CONCORDE_CELL, QUEEN_ELIZABETH_CELL } from './board';

/** 카드 분류. 위치 과정에 영향을 주는 것은 'move' 중 12장뿐이다. */
export type CardCategory = 'move' | 'income' | 'expense' | 'misc';

/**
 * 월급 처리 규칙. (계획서 §3.10 — 이동 카드의 월급 예외 3종)
 * - 'passing'  0번 출발 칸을 지나치거나 도착하면 월급을 받는다 (일반 규칙).
 * - 'none'     지나쳐도 월급을 받지 않는다 ('뒤로 X칸', '무인도로 가시오').
 */
export type SalaryRule = 'passing' | 'none';

export type CardEffect =
  /** 위치를 바꾸지 않는다. 수입·지출·기타 18장과 '세계일주'가 여기 속한다. */
  | { readonly kind: 'stay' }
  /** 지정한 칸으로 이동한다. via 가 있으면 그 칸을 경유하므로 출발선을 두 번 지날 수 있다. */
  | { readonly kind: 'moveTo'; readonly target: number; readonly salary: SalaryRule; readonly via?: number }
  /** 현재 칸에서 상대적으로 이동한다 ('뒤로 2칸', '뒤로 3칸'). */
  | { readonly kind: 'moveBy'; readonly delta: number; readonly salary: SalaryRule }
  /** 무인도로 직행해 갇힌다. 월급 없음. */
  | { readonly kind: 'toIsland' };

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly category: CardCategory;
  /** 덱에 들어 있는 장수. */
  readonly count: number;
  readonly effect: CardEffect;
  /** 우주여행 카드는 30번에 도착해도 이용료 20만 원이 면제된다. */
  readonly spaceFeeExempt?: boolean;
  /** 20번 수령처의 적립금을 받는 카드인지. (사회복지기금 배당 · 세계일주) */
  readonly collectsWelfare?: boolean;
  /** 세계일주는 제자리이지만 월급을 받는다. */
  readonly grantsSalaryInPlace?: boolean;
  readonly note?: string;
}

/**
 * 이동 카드 13장. (계획서 §5.2)
 * 이 중 '세계일주'만 제자리이므로 **위치를 바꾸는 카드는 12장**이다.
 */
const MOVE_CARDS: readonly Card[] = [
  {
    id: 'air-travel',
    name: '항공여행',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 1, salary: 'passing', via: CONCORDE_CELL },
    note: '15번 콩코드를 경유한다. 콩코드가 뒤에 있으면 출발선을 두 번 지나 월급을 두 번 받는다.',
  },
  {
    id: 'cruise-travel',
    name: '관광여행 (유람선)',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 3, salary: 'passing', via: QUEEN_ELIZABETH_CELL },
    note: '28번 퀸 엘리자베스 호를 경유한다.',
  },
  {
    id: 'highway',
    name: '고속도로',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 0, salary: 'passing' },
    note: '출발 칸에 도착하므로 월급을 받는다.',
  },
  {
    id: 'tour-seoul',
    name: '관광여행 · 서울',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 39, salary: 'passing' },
    note: '39번은 출발 직전 칸이라 어느 칸에서 가도 출발선을 지나지 않는다.',
  },
  { id: 'tour-busan', name: '관광여행 · 부산', category: 'move', count: 1, effect: { kind: 'moveTo', target: 25, salary: 'passing' } },
  { id: 'tour-jeju', name: '관광여행 · 제주도', category: 'move', count: 1, effect: { kind: 'moveTo', target: 5, salary: 'passing' } },
  {
    id: 'back-2',
    name: '뒤로 2칸',
    category: 'move',
    count: 1,
    effect: { kind: 'moveBy', delta: -2, salary: 'none' },
    note: '12번에서 뽑으면 10번 무인도에 갇힌다 (가정 A4).',
  },
  {
    id: 'back-3',
    name: '뒤로 3칸',
    category: 'move',
    count: 1,
    effect: { kind: 'moveBy', delta: -3, salary: 'none' },
    note: '2번에서 뽑으면 39번 서울로 직행한다.',
  },
  { id: 'go-island', name: '무인도로 가시오', category: 'move', count: 1, effect: { kind: 'toIsland' }, note: '월급을 받지 않는다.' },
  {
    id: 'welfare-dividend',
    name: '사회복지기금 배당',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 20, salary: 'passing' },
    collectsWelfare: true,
  },
  {
    id: 'world-tour',
    name: '세계일주',
    category: 'move',
    count: 1,
    effect: { kind: 'stay' },
    collectsWelfare: true,
    grantsSalaryInPlace: true,
    note: '제자리이지만 월급과 적립금을 받는다. 위치 과정에는 영향이 없다.',
  },
  {
    id: 'space-travel',
    name: '우주여행',
    category: 'move',
    count: 2,
    effect: { kind: 'moveTo', target: 30, salary: 'passing' },
    spaceFeeExempt: true,
    note: '30번에 도착하되 이용료 20만 원이 면제된다. 목적지는 우주여행 정책을 따른다.',
  },
];

/**
 * 위치를 바꾸지 않는 17장.
 *
 * 계획서 §5.1 표는 수입 7 · 지출 6 · 기타 5 = 18장으로 적었으나, 이동 13장을 더하면
 * 31장이 되어 덱 총 장수 30장과 어긋난다. 이동 카드 13장은 §5.2에 개별 열거되어
 * 검증되므로, 여기서는 비이동 카드를 **17장**으로 맞춘다. 분류별 내역은 실물 카드
 * 대조 후 확정하며, 대조 전까지는 위치 과정에 영향이 없다는 점만 이용한다.
 * (docs/card-table.md 의 미확정 항목 참조)
 */
const NON_MOVE_CARDS: readonly Card[] = [
  { id: 'income', name: '수입 카드', category: 'income', count: 7, effect: { kind: 'stay' } },
  { id: 'expense', name: '지출 카드', category: 'expense', count: 6, effect: { kind: 'stay' } },
  { id: 'misc', name: '기타 카드', category: 'misc', count: 4, effect: { kind: 'stay' } },
];

export const DECK: readonly Card[] = [...MOVE_CARDS, ...NON_MOVE_CARDS];

/** 덱 총 장수. 대형 제품 기준 30장이다. (계획서 §2.2) */
export const DECK_SIZE = DECK.reduce((sum, card) => sum + card.count, 0);

/** 위치를 바꾸는 카드의 총 장수. 12장 → 40%. */
export const POSITION_CHANGING_COUNT = DECK.filter((c) => c.effect.kind !== 'stay').reduce((sum, c) => sum + c.count, 0);

/** 황금열쇠 칸에서 위치가 바뀔 확률. 12/30 = 0.4 */
export const POSITION_CHANGE_PROBABILITY = POSITION_CHANGING_COUNT / DECK_SIZE;

/** 복원 추출(가정 A5) 하에서 각 카드를 뽑을 확률. */
export function drawProbability(card: Card): number {
  return card.count / DECK_SIZE;
}
