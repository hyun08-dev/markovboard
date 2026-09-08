import { describe, it, expect } from 'vitest';
import { DECK, DECK_SIZE, POSITION_CHANGING_COUNT, POSITION_CHANGE_PROBABILITY, drawProbability } from '../cards';

describe('황금열쇠 덱', () => {
  it('총 30장이다 (대형 제품 기준)', () => {
    expect(DECK_SIZE).toBe(30);
  });

  it('이동 카드가 13장이다', () => {
    const moveCount = DECK.filter((c) => c.category === 'move').reduce((sum, c) => sum + c.count, 0);
    expect(moveCount).toBe(13);
  });

  it('위치를 바꾸는 카드가 12장이다 — 세계일주는 제자리', () => {
    expect(POSITION_CHANGING_COUNT).toBe(12);
    const worldTour = DECK.find((c) => c.id === 'world-tour');
    expect(worldTour?.effect.kind).toBe('stay');
  });

  it('황금열쇠 칸에서 위치가 바뀔 확률이 40%다', () => {
    expect(POSITION_CHANGE_PROBABILITY).toBeCloseTo(0.4, 12);
  });

  it('뽑기 확률의 합이 1이다', () => {
    const total = DECK.reduce((sum, c) => sum + drawProbability(c), 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-12);
  });

  it('카드 id가 중복되지 않는다', () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(DECK.length);
  });

  it('우주여행 카드가 2장이고 이용료가 면제된다', () => {
    const space = DECK.find((c) => c.id === 'space-travel');
    expect(space?.count).toBe(2);
    expect(space?.spaceFeeExempt).toBe(true);
  });

  it("'뒤로 X칸'과 '무인도로 가시오'는 월급을 받지 않는다", () => {
    for (const id of ['back-2', 'back-3']) {
      const card = DECK.find((c) => c.id === id);
      expect(card?.effect).toMatchObject({ kind: 'moveBy', salary: 'none' });
    }
    expect(DECK.find((c) => c.id === 'go-island')?.effect.kind).toBe('toIsland');
  });
});
