import { describe, it, expect } from 'vitest';
import { DECK, DECK_SIZE, POSITION_CHANGING_COUNT, POSITION_CHANGE_PROBABILITY, drawProbability } from '../cards';

describe('황금열쇠 덱', () => {
  it('총 30장이다 (대형 제품 기준)', () => {
    expect(DECK_SIZE).toBe(30);
  });

  it('이동 카드가 12장이다 (대형판 — 우주여행 초대권 1장)', () => {
    const moveCount = DECK.filter((c) => c.category === 'move').reduce((sum, c) => sum + c.count, 0);
    expect(moveCount).toBe(12);
  });

  it('분류별 장수가 이동 12 · 수입 7 · 지출 6 · 기타 5 로 30장에 맞아떨어진다', () => {
    const byCategory = (cat: string) =>
      DECK.filter((c) => c.category === cat).reduce((sum, c) => sum + c.count, 0);
    expect([byCategory('move'), byCategory('income'), byCategory('expense'), byCategory('misc')]).toEqual([12, 7, 6, 5]);
  });

  it('위치를 바꾸는 카드가 11장이다 — 세계일주 초대권은 제자리', () => {
    expect(POSITION_CHANGING_COUNT).toBe(11);
    const worldTour = DECK.find((c) => c.id === 'world-tour');
    expect(worldTour?.effect.kind).toBe('stay');
  });

  it('황금열쇠 칸에서 위치가 바뀔 확률이 11/30 ≈ 36.7%다', () => {
    expect(POSITION_CHANGE_PROBABILITY).toBeCloseTo(11 / 30, 12);
  });

  it('뽑기 확률의 합이 1이다', () => {
    const total = DECK.reduce((sum, c) => sum + drawProbability(c), 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-12);
  });

  it('카드 id가 중복되지 않는다', () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(DECK.length);
  });

  it('우주여행 초대권은 대형판에서 1장이고 이용료가 면제된다', () => {
    const space = DECK.find((c) => c.id === 'space-travel');
    expect(space?.count).toBe(1);
    expect(space?.spaceFeeExempt).toBe(true);
  });

  it('유람선 여행은 대형판에만 있으며 퀸 엘리자베스를 경유해 베이징으로 간다', () => {
    expect(DECK.find((c) => c.id === 'cruise-travel')?.effect).toMatchObject({ kind: 'moveTo', target: 3, via: 28 });
  });

  it("'뒤로 X칸'과 '무인도로 가시오'는 월급을 받지 않는다", () => {
    for (const id of ['move-back-2', 'move-back-3']) {
      const card = DECK.find((c) => c.id === id);
      expect(card?.effect).toMatchObject({ kind: 'moveBy', salary: 'none' });
    }
    expect(DECK.find((c) => c.id === 'go-island')?.effect.kind).toBe('toIsland');
  });
});
