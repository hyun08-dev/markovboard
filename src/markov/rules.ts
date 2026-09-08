/**
 * rules.ts — 칸 효과 함수 테이블. (계획서 §8)
 *
 * `board.ts` 가 순수 데이터라면 이 파일은 **효과**다. 규칙을 데이터에 하드코딩하면
 * 모델 변형 실험마다 코드를 고쳐야 하므로 둘을 분리한다.
 *
 * 여기서 다루는 것은 "말이 어떤 칸에 착지했을 때 위치가 어떻게 바뀌는가"뿐이다.
 * 자산·소유권·건설은 모델링 대상이 아니다. (§2.1)
 */

import { BOARD_SIZE, ISLAND_CELL, SPACE_TRAVEL_CELL, cellAt, wrap } from './board';
import { DECK, DECK_SIZE, type Card } from './cards';
import type { ModelConfig, TeleportPolicy } from './config';

/** 착지 처리가 끝난 뒤의 위치. */
export type Position =
  /** 해당 칸에 서 있다. */
  | { readonly kind: 'cell'; readonly cell: number }
  /** 무인도에 갇혔다 (대기 3턴 시작). */
  | { readonly kind: 'jail' }
  /** 무인도 칸에 있지만 갇히지는 않았다 (A4 를 끈 경우). */
  | { readonly kind: 'islandFree' };

export interface LandingOutcome {
  readonly prob: number;
  readonly position: Position;
  /** 이 착지 처리에서 실제로 밟은 칸들. 카드로 이동하면 두 칸 이상이 된다. */
  readonly landings: readonly number[];
  /** 이 착지 처리에서 출발선을 지난 횟수. */
  readonly salaryPasses: number;
  /** 여기서 턴이 끝나는가. 무인도와 우주여행 칸이 그렇다. */
  readonly endsTurn: boolean;
}

/**
 * `from` 에서 `to` 로 **앞으로** 이동할 때 출발선(0번)을 지나는 횟수.
 *
 * 자료: 특정 장소 이동 카드는 "해당 장소에 도착할 때까지 계속 앞으로 가는 개념"이다.
 * 따라서 목적지가 뒤에 있으면 한 바퀴를 돌아 출발선을 지난다.
 */
export function cellOfPosition(position: Position): number {
  return position.kind === 'cell' ? position.cell : ISLAND_CELL;
}

export function passesStart(from: number, to: number): number {
  const steps = wrap(to - from);
  return steps > 0 && from + steps >= BOARD_SIZE ? 1 : 0;
}

/** 우주여행 목적지 분포. 우주여행 칸으로 되돌아가는 것은 불가능하다. */
export function teleportTargets(policy: TeleportPolicy): ReadonlyMap<number, number> {
  const targets = new Map<number, number>();
  if (policy === 'uniform') {
    // 무한 루프 방지를 위해 우주여행 칸은 제외한다. 남은 39칸에 균등. (가정 A7)
    const p = 1 / (BOARD_SIZE - 1);
    for (let cell = 0; cell < BOARD_SIZE; cell += 1) if (cell !== SPACE_TRAVEL_CELL) targets.set(cell, p);
    return targets;
  }
  const fixed = { seoul: 39, newyork: 37, jail: ISLAND_CELL }[policy];
  targets.set(fixed, 1);
  return targets;
}

/** 카드가 지정하는 목적지와 그때까지 지나는 출발선 횟수. */
function cardDestination(card: Card, from: number): { target: number; salaryPasses: number } | null {
  const effect = card.effect;
  switch (effect.kind) {
    case 'stay':
      return null;
    case 'toIsland':
      // 출발지를 지나도 월급을 받지 못하는 유일한 예외.
      return { target: ISLAND_CELL, salaryPasses: 0 };
    case 'moveBy':
      // '이사'는 뒤로 가는 이동이라 출발선을 앞으로 지나지 않는다.
      return { target: wrap(from + effect.delta), salaryPasses: 0 };
    case 'moveTo': {
      if (effect.salary === 'none') return { target: effect.target, salaryPasses: 0 };
      // 경유 칸이 있으면 두 구간을 각각 세므로 출발선을 두 번 지날 수 있다.
      const passes =
        effect.via === undefined
          ? passesStart(from, effect.target)
          : passesStart(from, effect.via) + passesStart(effect.via, effect.target);
      return { target: effect.target, salaryPasses: passes };
    }
  }
}

/** 카드 이동을 재추첨할 때의 재귀 상한. A6 을 끄면 실제로는 2를 넘지 않는다. */
const MAX_CARD_CHAIN = 8;

/**
 * 칸 `cell` 에 착지했을 때의 결과 분포.
 *
 * `depth > 0` 은 카드로 이동해 다시 착지한 상황이다. 이때 황금열쇠를 다시 뽑을지는
 * `chainCardMoves`(가정 A6)가 결정한다. 기본값은 뽑지 않는 것으로, 무한 루프를 막는다.
 * (실제로 대형판 이동 카드의 목적지 중 황금열쇠 칸은 없으므로 기본 설정에서 이
 * 분기는 우주여행으로 이동한 경우에만 의미가 있다.)
 */
export function resolveLanding(cell: number, config: ModelConfig, depth = 0): LandingOutcome[] {
  const kind = cellAt(cell).kind;

  if (kind === 'island' && config.enableJail) {
    return [{ prob: 1, position: { kind: 'jail' }, landings: [cell], salaryPasses: 0, endsTurn: true }];
  }

  if (kind === 'space' && config.enableSpaceTravel) {
    // 자료: "더블과 관계 없이 즉시 멈춰 턴을 종료한다."
    return [
      { prob: 1, position: { kind: 'cell', cell }, landings: [cell], salaryPasses: 0, endsTurn: config.spaceEndsTurn },
    ];
  }

  const redraw = depth === 0 || config.chainCardMoves;
  if (kind === 'goldenKey' && config.enableGoldenKey && redraw && depth < MAX_CARD_CHAIN) {
    return DECK.flatMap((card) => expandCard(card, cell, config, depth));
  }

  return [{ prob: 1, position: { kind: 'cell', cell }, landings: [cell], salaryPasses: 0, endsTurn: false }];
}

function expandCard(card: Card, from: number, config: ModelConfig, depth: number): LandingOutcome[] {
  const drawProb = card.count / DECK_SIZE;
  const destination = cardDestination(card, from);

  // 위치를 바꾸지 않는 카드 — 비이동 18장과 세계일주 초대권.
  if (destination === null) {
    return [
      {
        prob: drawProb,
        position: { kind: 'cell', cell: from },
        landings: [from],
        // 세계일주 초대권은 제자리이지만 한 바퀴를 돈 것으로 쳐서 월급을 받는다.
        salaryPasses: card.grantsSalaryInPlace === true ? 1 : 0,
        endsTurn: false,
      },
    ];
  }

  const { target, salaryPasses } = destination;

  // '이사'로 무인도에 들어갈 때 갇히는지는 A4 가 결정한다.
  if (target === ISLAND_CELL && card.effect.kind === 'moveBy' && !config.jailOnBackstep) {
    return [
      {
        prob: drawProb,
        position: config.enableJail ? { kind: 'islandFree' } : { kind: 'cell', cell: ISLAND_CELL },
        landings: [from, target],
        salaryPasses,
        endsTurn: config.cardMoveEndsTurn,
      },
    ];
  }

  return resolveLanding(target, config, depth + 1).map((outcome) => ({
    prob: drawProb * outcome.prob,
    position: outcome.position,
    landings: [from, ...outcome.landings],
    salaryPasses: salaryPasses + outcome.salaryPasses,
    // 무인도·우주여행이면 언제나 턴이 끝나고, 그 밖에는 A11 이 결정한다.
    endsTurn: outcome.endsTurn || config.cardMoveEndsTurn,
  }));
}
