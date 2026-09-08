/**
 * cards.ts — 황금열쇠 덱 30장 정의. (계획서 §5)
 *
 * **대형(패밀리)판 기준**이다. 자료(나무위키 「부루마불/주요 카드」)에 따르면
 * 우주여행 초대권은 퀸 엘리자베스 호가 있는 버전에서 1장, 없는 버전에서 2장이며
 * 없는 버전에는 유람선 여행이 아예 없다. 계획서 §5.2는 우주여행 2장과 유람선
 * 1장을 함께 실어 두 버전을 섞었으므로, 대형판 기준으로 우주여행을 1장으로 바로잡았다.
 * 그 결과 이동 12 + 수입 7 + 지출 6 + 기타 5 = 30 으로 계획서 §5.1 분류표의
 * 합계 불일치도 함께 해소된다. (docs/card-table.md)
 *
 * 체인에 영향을 주는 것은 **위치를 바꾸는 11장**뿐이다. 나머지 카드는 수입·지출·
 * 기타 효과만 가지므로 위치 과정에서는 '제자리'로 처리한다. (계획서 §2.1)
 *
 * 가정 A5 — 매 뽑기마다 셔플하는 **복원 추출**로 근사한다. 실제 덱은 비복원이며,
 * 그 차이는 시뮬레이터에서 비복원으로도 돌려 측정한다. (§11.4)
 */

import { COLUMBIA_CELL, CONCORDE_CELL, QUEEN_ELIZABETH_CELL } from './board';

/** 카드 분류. 위치 과정에 영향을 주는 것은 'move' 중 11장뿐이다. */
export type CardCategory = 'move' | 'income' | 'expense' | 'misc';

/**
 * 월급 처리 규칙. (계획서 §3.10 — 이동 카드의 월급 예외)
 *
 * 자료: "출발지에 도착하거나 지나치면 월급을 받지만 **무인도로 가는 황금열쇠의
 * 경우만 예외적으로** 출발지를 지나쳐도 월급을 받지 못한다." 특정 장소 이동 카드는
 * "해당 장소에 도착할 때까지 계속 앞으로 가는 개념"이므로 통과 판정을 그대로 쓴다.
 * '이사'(뒤로 2·3칸)는 뒤로 가는 이동이라 출발선을 앞으로 지나지 않는다.
 */
export type SalaryRule = 'passing' | 'none';

export type CardEffect =
  /** 위치를 바꾸지 않는다. 비이동 18장과 '세계일주 초대권'이 여기 속한다. */
  | { readonly kind: 'stay' }
  /** 지정한 칸으로 이동한다. via 가 있으면 그 칸을 경유하므로 출발선을 두 번 지날 수 있다. */
  | { readonly kind: 'moveTo'; readonly target: number; readonly salary: SalaryRule; readonly via?: number }
  /** 현재 칸에서 상대적으로 이동한다 ('이사' — 뒤로 2칸 / 뒤로 3칸). */
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
  /** 우주여행 초대권은 30번에 도착해도 컬럼비아호 이용료 20만 원이 면제된다. */
  readonly spaceFeeExempt?: boolean;
  /** 20번 수령처의 적립금을 받는 카드인지. (사회복지기금 배당 · 세계일주 초대권) */
  readonly collectsWelfare?: boolean;
  /** 세계일주 초대권은 제자리이지만 월급을 받는다. */
  readonly grantsSalaryInPlace?: boolean;
  readonly note?: string;
}

/**
 * 이동 카드 12장. 이 중 '세계일주 초대권'만 제자리이므로 **위치를 바꾸는 카드는 11장**이다.
 */
const MOVE_CARDS: readonly Card[] = [
  {
    id: 'air-travel',
    name: '항공여행',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 1, salary: 'passing', via: CONCORDE_CELL },
    note: '콩코드 여객기를 타고 타이베이로 간다. 콩코드가 뒤에 있으면 출발선을 두 번 지난다.',
  },
  {
    id: 'cruise-travel',
    name: '유람선 여행',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 3, salary: 'passing', via: QUEEN_ELIZABETH_CELL },
    note: '퀸 엘리자베스 호를 타고 베이징으로 간다. 대형판에만 있는 카드다.',
  },
  {
    id: 'highway',
    name: '고속도로',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 0, salary: 'passing' },
    note: '출발지로 간다. 월급 20만 원을 받는다.',
  },
  {
    id: 'tour-seoul',
    name: '관광여행 · 서울',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 39, salary: 'passing' },
    note: '39번은 출발 직전 칸이라 어느 칸에서 가도 출발선을 지나지 않는다. 통행료 200만.',
  },
  {
    id: 'tour-busan',
    name: '관광여행 · 부산',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 25, salary: 'passing' },
    note: '통행료 60만.',
  },
  {
    id: 'tour-jeju',
    name: '관광여행 · 제주도',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 5, salary: 'passing' },
    note: '통행료 30만.',
  },
  {
    id: 'move-back-2',
    name: '이사 · 뒤로 2칸',
    category: 'move',
    count: 1,
    effect: { kind: 'moveBy', delta: -2, salary: 'none' },
    note: '12번에서 뽑으면 10번 무인도에 갇힌다 (가정 A4).',
  },
  {
    id: 'move-back-3',
    name: '이사 · 뒤로 3칸',
    category: 'move',
    count: 1,
    effect: { kind: 'moveBy', delta: -3, salary: 'none' },
    note: "2번에서 뽑으면 39번 서울로 직행한다. 자료가 '가장 강력한 크리티컬 히트'로 꼽는 경로.",
  },
  {
    id: 'go-island',
    name: '무인도',
    category: 'move',
    count: 1,
    effect: { kind: 'toIsland' },
    note: '폭풍우를 만나 무인도로 간다. 출발지를 지나도 월급을 받지 못하는 유일한 예외.',
  },
  {
    id: 'welfare-dividend',
    name: '사회복지기금 배당',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 20, salary: 'passing' },
    collectsWelfare: true,
    note: '사회복지기금 수령처로 가서 적립금을 가져간다.',
  },
  {
    id: 'world-tour',
    name: '세계일주 초대권',
    category: 'move',
    count: 1,
    effect: { kind: 'stay' },
    collectsWelfare: true,
    grantsSalaryInPlace: true,
    note: '현재 위치에서 한 바퀴 돈다. 월급과 적립금을 받지만 위치는 그대로다.',
  },
  {
    id: 'space-travel',
    name: '우주여행 초대권',
    category: 'move',
    count: 1,
    effect: { kind: 'moveTo', target: 30, salary: 'passing', via: COLUMBIA_CELL },
    spaceFeeExempt: true,
    note: '컬럼비아호로 이동해 우주여행 칸으로 간다. 이용료 20만 원이 면제된다. 대형판은 1장.',
  },
];

/**
 * 위치를 바꾸지 않는 18장. (계획서 §5.1 분류표)
 *
 * 수입 7 — 노벨평화상 30만 · 복권 당첨 20만 · 자동차 경주 우승 10만 · 장학금 10만 ·
 *          연금 5만 등.
 * 지출 6 — 해외유학 10만 · 병원비 5만 · 과속운전 벌금 5만 · 건물 유지비 3종
 *          (정기종합소득세 · 건물수리비 · 방범비) 등.
 * 기타 5 — 반액대매출 · 무인도 탈출권(무전기) · 우대권 2장 · 생일축하 등.
 *
 * 개별 금액은 위치 과정에 영향을 주지 않으므로 분류별 장수만 모델에 넣는다.
 * 각 분류의 정확한 구성은 docs/card-table.md 에 기록한다.
 */
const NON_MOVE_CARDS: readonly Card[] = [
  { id: 'income', name: '수입 카드', category: 'income', count: 7, effect: { kind: 'stay' } },
  { id: 'expense', name: '지출 카드', category: 'expense', count: 6, effect: { kind: 'stay' } },
  { id: 'misc', name: '기타 카드', category: 'misc', count: 5, effect: { kind: 'stay' } },
];

export const DECK: readonly Card[] = [...MOVE_CARDS, ...NON_MOVE_CARDS];

/** 덱 총 장수. 대형 제품 기준 30장이다. (계획서 §2.2) */
export const DECK_SIZE = DECK.reduce((sum, card) => sum + card.count, 0);

/** 위치를 바꾸는 카드의 총 장수. 대형판에서 11장. */
export const POSITION_CHANGING_COUNT = DECK.filter((c) => c.effect.kind !== 'stay').reduce((sum, c) => sum + c.count, 0);

/** 황금열쇠 칸에서 위치가 바뀔 확률. 11/30 ≈ 36.7% */
export const POSITION_CHANGE_PROBABILITY = POSITION_CHANGING_COUNT / DECK_SIZE;

/** 복원 추출(가정 A5) 하에서 각 카드를 뽑을 확률. */
export function drawProbability(card: Card): number {
  return card.count / DECK_SIZE;
}
