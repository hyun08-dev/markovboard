import { describe, it, expect } from 'vitest';
import {
  BOARD,
  BOARD_SIZE,
  GOLDEN_KEY_CELLS,
  cellAt,
  wrap,
  investmentOf,
  tollOf,
  ISLAND_CELL,
  START_CELL,
  SPACE_TRAVEL_CELL,
  WELFARE_RECEIVE_CELL,
} from '../board';

describe('보드 데이터 구조', () => {
  it('40칸이 빠짐없이 정의된다', () => {
    expect(BOARD).toHaveLength(BOARD_SIZE);
  });

  it('칸 번호가 0부터 39까지 순서대로 매겨진다', () => {
    BOARD.forEach((cell, i) => expect(cell.index).toBe(i));
  });

  it('모든 칸에 이름이 있다', () => {
    for (const cell of BOARD) expect(cell.name.length).toBeGreaterThan(0);
  });

  it('모서리 4칸이 0 · 10 · 20 · 30번이다', () => {
    expect([START_CELL, ISLAND_CELL, WELFARE_RECEIVE_CELL, SPACE_TRAVEL_CELL]).toEqual([0, 10, 20, 30]);
    expect(cellAt(0).kind).toBe('start');
    expect(cellAt(10).kind).toBe('island');
    expect(cellAt(20).kind).toBe('welfareReceive');
    expect(cellAt(30).kind).toBe('space');
  });

  it('황금열쇠가 6칸이다 (대형 제품 기준)', () => {
    expect(GOLDEN_KEY_CELLS).toEqual([2, 7, 12, 17, 22, 34]);
  });

  it('28번은 황금열쇠가 아니라 퀸 엘리자베스 호다 (대형 제품)', () => {
    expect(cellAt(28).kind).toBe('vehicle');
    expect(cellAt(28).name).toBe('퀸 엘리자베스 호');
  });
});

describe('계획서 §4.1 교차 검증', () => {
  it('사회복지기금 접수처가 38번이다', () => {
    expect(cellAt(38).kind).toBe('welfarePay');
  });

  it('부에노스아이레스(21)와 스톡홀름(14)이 출발지 기준 7의 배수다', () => {
    expect(cellAt(21).name).toBe('부에노스아이레스');
    expect(cellAt(14).name).toBe('스톡홀름');
    expect(21 % 7).toBe(0);
    expect(14 % 7).toBe(0);
  });

  it("2번 황금열쇠에서 '뒤로 3칸'이면 39번 서울이다", () => {
    expect(wrap(2 - 3)).toBe(39);
    expect(cellAt(39).name).toBe('서울');
  });

  it("12번 황금열쇠에서 '뒤로 2칸'이면 10번 무인도다", () => {
    expect(wrap(12 - 2)).toBe(ISLAND_CELL);
  });

  it('무인도에서 더블(4·6·8)로 탈출하면 스톡홀름 · 베른 · 베를린에 닿는다', () => {
    const names = [4, 6, 8].map((step) => cellAt(wrap(ISLAND_CELL + step)).name);
    expect(names).toEqual(['스톡홀름', '베른', '베를린']);
  });
});

describe('wrap', () => {
  it('한 바퀴를 넘어가면 되돌아온다', () => {
    expect(wrap(40)).toBe(0);
    expect(wrap(45)).toBe(5);
  });

  it('음수(뒤로 가기)도 올바르게 처리한다', () => {
    expect(wrap(-1)).toBe(39);
    expect(wrap(-3)).toBe(37);
  });
});

describe('통행료와 투자액', () => {
  it('건물 불가 칸은 개발 단계와 무관하게 고정 통행료를 받는다', () => {
    const seoul = cellAt(39);
    expect(tollOf(seoul, 'none')).toBe(200);
    expect(tollOf(seoul, 'hotel')).toBe(200);
    expect(tollOf(cellAt(32), 'hotel')).toBe(40); // 컬럼비아호
  });

  it('도시 칸의 호텔료가 계획서 §4.2와 일치한다', () => {
    expect(tollOf(cellAt(1), 'hotel')).toBe(25); // 타이베이
    expect(tollOf(cellAt(19), 'hotel')).toBe(100); // 오타와
    expect(tollOf(cellAt(31), 'hotel')).toBe(127); // 도쿄
  });

  it('부에노스아이레스만 빌딩 건축비가 40으로 예외다', () => {
    expect(cellAt(21).buildCost?.building).toBe(40);
    expect(cellAt(23).buildCost?.building).toBe(45); // 상파울루 — 초록 구역 표준
  });

  it('투자액이 매입가 + 건축비다 — 부루마불은 건물 종류를 골라 짓는다', () => {
    // 타이베이: 매입가 5 + 호텔 건축비 25
    expect(investmentOf(cellAt(1), 'hotel')).toBe(30);
    // 건물을 못 짓는 칸은 매입가만.
    expect(investmentOf(cellAt(39), 'hotel')).toBe(100);
  });

  it('풀하우스 통행료가 별장2 + 빌딩 + 호텔의 합이다', () => {
    // 자료의 '타이베이 풀하우스 37만' 서술과 일치해야 한다. (3 + 9 + 25)
    expect(tollOf(cellAt(1), 'full')).toBeCloseTo(37, 10);
  });

  it('뉴욕 풀하우스 투자액이 자료의 반액대매출 117만 5천과 맞물린다', () => {
    // 매입가 35 + 별장 20×2 + 빌딩 60 + 호텔 100 = 235, 그 반값이 117.5
    expect(investmentOf(cellAt(37), 'full')).toBe(235);
    expect(investmentOf(cellAt(37), 'full') / 2).toBeCloseTo(117.5, 10);
  });

  it('§4.3 불일치 항목이 자료 대조로 확정되었다', () => {
    expect(tollOf(cellAt(16), 'building')).toBe(55); // 베른
    expect(tollOf(cellAt(18), 'building')).toBe(55); // 베를린
    expect(tollOf(cellAt(19), 'building')).toBe(60); // 오타와
  });

  it('대지료가 만 원 미만이다', () => {
    expect(tollOf(cellAt(1), 'none')).toBeCloseTo(0.2, 10); // 타이베이 2천 원
    expect(tollOf(cellAt(37), 'none')).toBeCloseTo(3.5, 10); // 뉴욕 3만 5천 원
  });
});
