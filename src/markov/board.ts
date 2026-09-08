/**
 * board.ts — 부루마불 신나는 세계여행(2016년 이후판 · 대형/패밀리) 40칸 순수 데이터.
 *
 * 이 파일은 **데이터만** 담는다. 칸 효과(황금열쇠 추첨, 무인도 강제 이동 등)의
 * 동작은 rules.ts / transition.ts 가 담당한다. 규칙을 데이터에 하드코딩하면
 * 모델 변형 실험마다 코드를 고쳐야 하기 때문이다. (계획서 §8)
 *
 * 금액 단위는 모두 **만 원**이다. 대지료는 만 원 미만이라 소수로 적는다.
 * (예: 25 = 25만 원, 0.2 = 2천 원)
 *
 * 출처 대조: 나무위키 「부루마불/주요 카드」 증서 목록 (2026-08-14 판).
 * 대조 결과와 계획서 §4.2·§4.3과의 차이는 docs/board-table.md 에 기록했다.
 */

/** 칸의 종류. */
export type CellKind =
  | 'start' //            0번 출발 — 통과 시 월급
  | 'city' //             건물을 지을 수 있는 도시
  | 'korea' //            한국 3칸 — 건물 불가, 고정 통행료
  | 'vehicle' //          탈것 3칸 — 건물 불가, 고정 통행료
  | 'goldenKey' //        황금열쇠 6칸
  | 'island' //           10번 무인도
  | 'space' //            30번 우주여행
  | 'welfareReceive' //   20번 사회복지기금 수령처
  | 'welfarePay'; //      38번 사회복지기금 접수처

/** 도시 구역. 건축비가 구역별로 동일하다. */
export type Zone = 'red' | 'yellow' | 'green' | 'blue';

/**
 * 개발 단계.
 *
 * 증서에는 대지료 · 별장 1채 · 별장 2채 · 빌딩 · 호텔의 다섯 가지 통행료가 적혀 있다.
 * 부루마불은 모노폴리와 달리 **건물을 단계적으로 업그레이드하지 않고 종류를 골라
 * 짓는다.** 따라서 호텔만 짓는 것이 가능하며, 그때의 투자액은 매입가 + 호텔 건축비다.
 *
 * 'full'(풀하우스)은 별장 2채 + 빌딩 + 호텔을 모두 지은 상태로, 통행료는 세 값의
 * 합이다. 여러 채 건설과 통행료 합산은 기본 규칙서에 명시되지 않은 확장 해석이므로
 * 실험 전용으로 둔다. (docs/assumptions.md B1)
 */
export type BuildLevel = 'none' | 'villa1' | 'villa2' | 'building' | 'hotel' | 'full';

/** 구조물별 건축비. 별장은 1채당 비용이다. */
export interface BuildCost {
  readonly villa: number;
  readonly building: number;
  readonly hotel: number;
}

/** 증서에 적힌 통행료. 건물을 지을 수 없는 칸은 none 하나만 채운다. */
export interface TollTable {
  /** 대지료 — 건물이 없을 때. */
  readonly none: number;
  readonly villa1?: number;
  readonly villa2?: number;
  readonly building?: number;
  readonly hotel?: number;
}

export interface Cell {
  /** 0..39 */
  readonly index: number;
  readonly name: string;
  readonly kind: CellKind;
  /** 도시 칸만 가진다. */
  readonly zone?: Zone;
  /** 매입가. 소유 가능한 칸만 가진다. */
  readonly price?: number;
  /** 도시 칸만 가진다. */
  readonly buildCost?: BuildCost;
  readonly tolls?: TollTable;
}

/** 구역별 건축비. 부에노스아이레스만 빌딩비가 예외라 개별 지정한다. */
const BUILD_COST: Record<Zone, BuildCost> = {
  red: { villa: 5, building: 15, hotel: 25 },
  yellow: { villa: 10, building: 30, hotel: 50 },
  green: { villa: 15, building: 45, hotel: 75 },
  blue: { villa: 20, building: 60, hotel: 100 },
};

/** 도시 칸 정의 헬퍼. tolls 는 [대지료, 별장1, 별장2, 빌딩, 호텔] 순이다. */
function city(
  index: number,
  name: string,
  zone: Zone,
  price: number,
  [none, villa1, villa2, building, hotel]: readonly [number, number, number, number, number],
  buildCost: BuildCost = BUILD_COST[zone],
): Cell {
  return { index, name, kind: 'city', zone, price, buildCost, tolls: { none, villa1, villa2, building, hotel } };
}

/** 건물을 지을 수 없는 칸(한국 3칸 · 탈것 3칸)의 고정 통행료. */
function fixedRent(index: number, name: string, kind: 'korea' | 'vehicle', price: number, toll: number): Cell {
  return { index, name, kind, price, tolls: { none: toll } };
}

function plain(index: number, name: string, kind: CellKind): Cell {
  return { index, name, kind };
}

/** 40칸 배치. 모서리는 0 · 10 · 20 · 30번, 모서리 사이는 각 9칸이다. (계획서 §4.1) */
export const BOARD: readonly Cell[] = [
  plain(0, '출발', 'start'),
  city(1, '타이베이', 'red', 5, [0.2, 1, 3, 9, 25]),
  plain(2, '황금열쇠', 'goldenKey'),
  city(3, '베이징', 'red', 8, [0.4, 2, 6, 18, 45]),
  city(4, '마닐라', 'red', 8, [0.4, 2, 6, 18, 45]),
  fixedRent(5, '제주도', 'korea', 20, 30),
  city(6, '싱가포르', 'red', 10, [0.6, 3, 9, 27, 55]),
  plain(7, '황금열쇠', 'goldenKey'),
  city(8, '카이로', 'red', 10, [0.6, 3, 9, 27, 55]),
  city(9, '이스탄불', 'red', 12, [0.8, 4, 10, 30, 60]),
  plain(10, '무인도', 'island'),
  city(11, '아테네', 'yellow', 14, [1, 5, 15, 45, 75]),
  plain(12, '황금열쇠', 'goldenKey'),
  city(13, '코펜하겐', 'yellow', 16, [1.2, 6, 18, 50, 90]),
  city(14, '스톡홀름', 'yellow', 16, [1.2, 6, 18, 50, 90]),
  fixedRent(15, '콩코드 여객기', 'vehicle', 20, 30),
  city(16, '베른', 'yellow', 18, [1.4, 7, 20, 55, 95]),
  plain(17, '황금열쇠', 'goldenKey'),
  city(18, '베를린', 'yellow', 18, [1.4, 7, 20, 55, 95]),
  city(19, '오타와', 'yellow', 20, [1.6, 8, 22, 60, 100]),
  plain(20, '사회복지기금 수령처', 'welfareReceive'),
  // 부에노스아이레스만 빌딩 건축비가 45가 아니라 40이다.
  city(21, '부에노스아이레스', 'green', 22, [1.8, 9, 25, 70, 105], { villa: 15, building: 40, hotel: 75 }),
  plain(22, '황금열쇠', 'goldenKey'),
  city(23, '상파울루', 'green', 24, [2, 10, 30, 75, 110]),
  city(24, '시드니', 'green', 24, [2, 10, 30, 75, 110]),
  fixedRent(25, '부산', 'korea', 50, 60),
  city(26, '하와이', 'green', 26, [2.2, 11, 33, 80, 115]),
  city(27, '리스본', 'green', 26, [2.2, 11, 33, 80, 115]),
  fixedRent(28, '퀸 엘리자베스 호', 'vehicle', 30, 25),
  city(29, '마드리드', 'green', 28, [2.4, 12, 36, 85, 120]),
  plain(30, '우주여행', 'space'),
  city(31, '도쿄', 'blue', 30, [2.6, 13, 39, 90, 127]),
  fixedRent(32, '컬럼비아호', 'vehicle', 45, 40),
  city(33, '파리', 'blue', 32, [2.8, 15, 45, 100, 140]),
  plain(34, '황금열쇠', 'goldenKey'),
  city(35, '로마', 'blue', 32, [2.8, 15, 45, 100, 140]),
  city(36, '런던', 'blue', 35, [3.5, 17, 50, 110, 150]),
  city(37, '뉴욕', 'blue', 35, [3.5, 17, 50, 110, 150]),
  plain(38, '사회복지기금 접수처', 'welfarePay'),
  fixedRent(39, '서울', 'korea', 100, 200),
];

export const BOARD_SIZE = 40;

/** 0번 출발 칸을 통과할 때마다 받는 월급. (계획서 §3.10) */
export const SALARY = 20;

/** 38번 사회복지기금 접수처에 착지하면 내는 금액. (계획서 §3.9) */
export const WELFARE_CONTRIBUTION = 15;

/** 30번 우주여행 칸에서 우주여행을 이용할 때 컬럼비아호 소유자에게 내는 요금. */
export const SPACE_TRAVEL_FEE = 20;

/** 황금열쇠 칸 번호 6개. */
export const GOLDEN_KEY_CELLS: readonly number[] = BOARD.filter((c) => c.kind === 'goldenKey').map((c) => c.index);

export const START_CELL = 0;
export const ISLAND_CELL = 10;
export const WELFARE_RECEIVE_CELL = 20;
export const SPACE_TRAVEL_CELL = 30;
export const WELFARE_PAY_CELL = 38;
/** 15번 콩코드 — 항공여행 카드가 경유하는 칸. */
export const CONCORDE_CELL = 15;
/** 28번 퀸 엘리자베스 호 — 유람선 여행 카드가 경유하는 칸. */
export const QUEEN_ELIZABETH_CELL = 28;
/** 32번 컬럼비아호 — 우주여행 초대권 카드가 경유하는 칸. */
export const COLUMBIA_CELL = 32;

/** 칸 번호로 칸 데이터를 얻는다. 범위를 벗어나면 던진다. */
export function cellAt(index: number): Cell {
  const cell = BOARD[index];
  if (cell === undefined) throw new RangeError(`보드 칸 번호가 범위를 벗어났습니다: ${index}`);
  return cell;
}

/** 보드를 한 바퀴 도는 나머지 연산. 음수(뒤로 가기)도 올바르게 처리한다. */
export function wrap(index: number): number {
  return ((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
}

/**
 * 개발 단계 d 에서 칸 i 의 통행료.
 *
 * 건물을 지을 수 없는 칸은 개발 단계와 무관하게 고정 통행료를 받는다.
 * 풀하우스는 별장 2채 + 빌딩 + 호텔 통행료의 합이다.
 */
export function tollOf(cell: Cell, level: BuildLevel): number {
  const t = cell.tolls;
  if (t === undefined) return 0;
  if (cell.kind !== 'city') return t.none;
  if (level === 'none') return t.none;
  if (level === 'full') return (t.villa2 ?? 0) + (t.building ?? 0) + (t.hotel ?? 0);
  return t[level] ?? t.none;
}

/**
 * 칸 i 를 개발 단계 d 까지 만드는 데 든 총 투자액 = 매입가 + 건축비.
 *
 * 부루마불은 건물 종류를 골라 짓는 구조라 호텔만 지을 때는 호텔 건축비만 든다.
 * 풀하우스는 별장 2채 + 빌딩 + 호텔을 모두 지은 비용이다.
 */
export function investmentOf(cell: Cell, level: BuildLevel): number {
  const price = cell.price ?? 0;
  const cost = cell.buildCost;
  if (cost === undefined || level === 'none') return price;
  switch (level) {
    case 'villa1':
      return price + cost.villa;
    case 'villa2':
      return price + cost.villa * 2;
    case 'building':
      return price + cost.building;
    case 'hotel':
      return price + cost.hotel;
    case 'full':
      return price + cost.villa * 2 + cost.building + cost.hotel;
  }
}
