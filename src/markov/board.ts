/**
 * board.ts — 부루마불 신나는 세계여행(2016년 이후판 · 대형) 40칸 순수 데이터.
 *
 * 이 파일은 **데이터만** 담는다. 칸 효과(황금열쇠 추첨, 무인도 강제 이동 등)의
 * 동작은 rules.ts / transition.ts 가 담당한다. 규칙을 데이터에 하드코딩하면
 * 모델 변형 실험마다 코드를 고쳐야 하기 때문이다. (계획서 §8)
 *
 * 금액 단위는 모두 **만 원**이다. (예: 25 = 25만 원)
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

/** 개발 단계. 통행료가 단계별로 다르다. */
export type BuildLevel = 'none' | 'villa' | 'building' | 'hotel';

/** 구조물별 건축비. */
export interface BuildCost {
  readonly villa: number;
  readonly building: number;
  readonly hotel: number;
}

/** 개발 단계별 통행료. 아직 실물 대조가 끝나지 않은 단계는 undefined 로 둔다. */
export type TollTable = Partial<Record<BuildLevel, number>>;

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
  /** 도시 칸: 개발 단계별 통행료. 한국·탈것: none 하나만 채운 고정 통행료. */
  readonly tolls?: TollTable;
}

/** 구역별 건축비 (계획서 §4.2). 부에노스아이레스만 빌딩비가 예외라 개별 지정한다. */
const BUILD_COST: Record<Zone, BuildCost> = {
  red: { villa: 5, building: 15, hotel: 25 },
  yellow: { villa: 10, building: 30, hotel: 50 },
  green: { villa: 15, building: 45, hotel: 75 },
  blue: { villa: 20, building: 60, hotel: 100 },
};

/**
 * 도시 칸 정의 헬퍼.
 *
 * 현재 채운 통행료는 **호텔료뿐**이다. 기본 시나리오가 호텔 1채(가정 A8)이므로
 * 기본 결과에는 영향이 없으나, 개발 단계를 전환하는 실험(§10 실험 5)에는
 * 대지료·별장료·빌딩료가 필요하다. 실물 증서 대조 후 채운다.
 * 미확정 항목은 docs/board-table.md 에 목록으로 남긴다.
 */
function city(
  index: number,
  name: string,
  zone: Zone,
  price: number,
  hotelToll: number,
  extraTolls: TollTable = {},
  buildCost: BuildCost = BUILD_COST[zone],
): Cell {
  return { index, name, kind: 'city', zone, price, buildCost, tolls: { ...extraTolls, hotel: hotelToll } };
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
  city(1, '타이베이', 'red', 5, 25),
  plain(2, '황금열쇠', 'goldenKey'),
  city(3, '베이징', 'red', 8, 45),
  city(4, '마닐라', 'red', 8, 45),
  fixedRent(5, '제주도', 'korea', 20, 30),
  city(6, '싱가포르', 'red', 10, 55),
  plain(7, '황금열쇠', 'goldenKey'),
  city(8, '카이로', 'red', 10, 55),
  city(9, '이스탄불', 'red', 12, 60),
  plain(10, '무인도', 'island'),
  city(11, '아테네', 'yellow', 14, 75),
  plain(12, '황금열쇠', 'goldenKey'),
  city(13, '코펜하겐', 'yellow', 16, 90),
  city(14, '스톡홀름', 'yellow', 16, 90),
  fixedRent(15, '콩코드 여객기', 'vehicle', 20, 30),
  city(16, '베른', 'yellow', 18, 95),
  plain(17, '황금열쇠', 'goldenKey'),
  city(18, '베를린', 'yellow', 18, 95),
  city(19, '오타와', 'yellow', 20, 100),
  plain(20, '사회복지기금 수령처', 'welfareReceive'),
  // 부에노스아이레스만 빌딩비가 45가 아니라 40이다. (계획서 §4.2)
  city(21, '부에노스아이레스', 'green', 22, 105, {}, { villa: 15, building: 40, hotel: 75 }),
  plain(22, '황금열쇠', 'goldenKey'),
  city(23, '상파울루', 'green', 24, 110),
  city(24, '시드니', 'green', 24, 110),
  fixedRent(25, '부산', 'korea', 50, 60),
  city(26, '하와이', 'green', 26, 115),
  city(27, '리스본', 'green', 26, 115),
  fixedRent(28, '퀸 엘리자베스 호', 'vehicle', 30, 25),
  city(29, '마드리드', 'green', 28, 120),
  plain(30, '우주여행', 'space'),
  city(31, '도쿄', 'blue', 30, 127),
  fixedRent(32, '컬럼비아호', 'vehicle', 45, 40),
  city(33, '파리', 'blue', 32, 140),
  plain(34, '황금열쇠', 'goldenKey'),
  city(35, '로마', 'blue', 32, 140),
  city(36, '런던', 'blue', 35, 150),
  city(37, '뉴욕', 'blue', 35, 150),
  plain(38, '사회복지기금 접수처', 'welfarePay'),
  fixedRent(39, '서울', 'korea', 100, 200),
];

export const BOARD_SIZE = 40;

/** 0번 출발 칸을 통과할 때마다 받는 월급. (계획서 §3.10) */
export const SALARY = 20;

/** 38번 사회복지기금 접수처에 착지하면 내는 금액. (계획서 §3.9) */
export const WELFARE_CONTRIBUTION = 15;

/** 30번 우주여행 칸에서 우주여행을 이용할 때 내는 요금. 황금열쇠 우주여행 카드는 면제. */
export const SPACE_TRAVEL_FEE = 20;

/** 황금열쇠 칸 번호 6개. */
export const GOLDEN_KEY_CELLS: readonly number[] = BOARD.filter((c) => c.kind === 'goldenKey').map((c) => c.index);

export const START_CELL = 0;
export const ISLAND_CELL = 10;
export const WELFARE_RECEIVE_CELL = 20;
export const SPACE_TRAVEL_CELL = 30;
export const WELFARE_PAY_CELL = 38;
/** 15번 콩코드 — 항공여행 카드가 경유하는 칸. (계획서 §3.10) */
export const CONCORDE_CELL = 15;
/** 28번 퀸 엘리자베스 호 — 관광여행(유람선) 카드가 경유하는 칸. */
export const QUEEN_ELIZABETH_CELL = 28;

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
 * 개발 단계 d 에서 칸 i 의 통행료. 소유·개발이 불가능하거나 아직 자료가
 * 확정되지 않은 단계는 0 을 돌려준다.
 */
export function tollOf(cell: Cell, level: BuildLevel): number {
  if (cell.tolls === undefined) return 0;
  // 건물을 지을 수 없는 칸은 개발 단계와 무관하게 고정 통행료를 받는다.
  if (cell.kind === 'korea' || cell.kind === 'vehicle') return cell.tolls.none ?? 0;
  return cell.tolls[level] ?? 0;
}

/**
 * 칸 i 를 개발 단계 d 까지 만드는 데 든 총 투자액 = 매입가 + 건축비.
 *
 * 건축비 누적 방식은 config 의 buildCostMode 가 결정한다.
 * - 'direct'      호텔을 바로 짓는다고 보고 해당 구조물 비용만 더한다.
 * - 'cumulative'  별장 → 빌딩 → 호텔 순으로 지었다고 보고 모두 더한다.
 * 두 해석 중 어느 쪽이 실물 규칙인지는 docs/board-table.md 에서 확정한다.
 */
export function investmentOf(cell: Cell, level: BuildLevel, mode: 'direct' | 'cumulative'): number {
  const price = cell.price ?? 0;
  if (cell.buildCost === undefined || level === 'none') return price;
  const { villa, building, hotel } = cell.buildCost;
  if (mode === 'direct') {
    return price + (level === 'villa' ? villa : level === 'building' ? building : hotel);
  }
  const cumulative = level === 'villa' ? villa : level === 'building' ? villa + building : villa + building + hotel;
  return price + cumulative;
}
