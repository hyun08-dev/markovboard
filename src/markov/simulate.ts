/**
 * simulate.ts — 몬테카를로 시뮬레이터. (계획서 §11.4 · Phase 7)
 *
 * **규칙 정의는 공유하되 계산 경로는 완전히 분리한다.** `transition.ts` 가 확률을
 * 모아 행렬을 만든다면 여기서는 주사위를 실제로 굴려 말을 옮긴다. 두 결과가
 * 맞으면 서로를 검증한다.
 *
 * 몬테카를로 표본은 **독립이 아니다.** 한 체인을 길게 돌리면 연속 표본이 상관되므로
 * 신뢰구간을 √(π(1−π)/N) 로 계산하면 과소평가된다. 그래서 **다중 독립 체인**을
 * 돌리고 체인 간 분산으로 구간을 만든다.
 */

import { BOARD_SIZE, ISLAND_CELL, SALARY, SPACE_TRAVEL_CELL, WELFARE_CONTRIBUTION, WELFARE_PAY_CELL, WELFARE_RECEIVE_CELL, cellAt, wrap } from './board';
import { DECK, type Card } from './cards';
import type { ModelConfig } from './config';
import { passesStart, teleportTargets } from './rules';
import { diceOutcomes } from './transition';

/**
 * 재현 가능한 난수 발생기 (mulberry32).
 *
 * `Math.random` 을 쓰면 실험을 다시 돌릴 수 없다. 씨앗을 기록해 두면 같은 결과가
 * 나오므로 보고서의 수치를 재현할 수 있다.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 말 하나의 상태. 무인도 대기 턴 수를 함께 들고 다닌다. */
interface Runner {
  cell: number;
  /** 남은 무인도 대기 턴. 0이면 갇혀 있지 않다. */
  jailTurns: number;
}

export interface SimulationOptions {
  readonly chains?: number;
  readonly turnsPerChain?: number;
  /** 앞부분 몇 턴을 버릴지. 초기 분포의 영향을 지운다. */
  readonly burnIn?: number;
  readonly seed?: number;
}

export interface SimulationResult {
  /** 칸별 경험 방문 확률 (턴 시작 시점). 길이 40. */
  readonly piByCell: number[];
  /** 칸별 경험 착지 빈도 v̂. 길이 40. */
  readonly v: number[];
  /** 체인마다 따로 잰 칸별 방문 확률. 체인 간 분산을 여기서 구한다. */
  readonly perChain: number[][];
  /** 턴당 출발선 통과 횟수. */
  readonly salaryRate: number;
  /** 사회복지기금 적립액의 경험 분포 — 수령 시점의 금액별 도수. */
  readonly welfarePayouts: number[];
  /** 칸별 평균 재귀시간 (Kac 검증용). 관측이 없으면 NaN. */
  readonly returnTimes: number[];
  readonly chains: number;
  readonly effectiveTurns: number;
}

/** 체인 간 분산으로 만든 95% 신뢰구간. */
export interface ConfidenceInterval {
  readonly mean: number;
  readonly halfWidth: number;
  readonly low: number;
  readonly high: number;
}

export function chainConfidence(perChain: readonly (readonly number[])[], cell: number): ConfidenceInterval {
  const samples = perChain.map((chain) => chain[cell] ?? 0);
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, halfWidth: Number.NaN, low: Number.NaN, high: Number.NaN };
  const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
  // 체인 평균의 표준오차. 체인끼리는 독립이므로 √n 으로 나눌 수 있다.
  const halfWidth = 1.96 * Math.sqrt(variance / n);
  return { mean, halfWidth, low: mean - halfWidth, high: mean + halfWidth };
}

/** 복원 추출(A5) 또는 비복원 추출로 카드 한 장을 뽑는 장치. */
function createDrawer(config: ModelConfig, random: () => number): () => Card {
  const flat: Card[] = DECK.flatMap((card) => Array.from({ length: card.count }, () => card));
  if (config.cardDeck === 'shuffle') {
    return () => flat[Math.floor(random() * flat.length)] as Card;
  }
  // 비복원 — 덱을 다 쓰면 다시 섞는다. A5 근사의 영향을 재는 데 쓴다.
  let remaining: Card[] = [];
  return () => {
    if (remaining.length === 0) {
      remaining = [...flat];
      for (let i = remaining.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j] as Card, remaining[i] as Card];
      }
    }
    return remaining.pop() as Card;
  };
}

/**
 * 체인 하나를 돌린다.
 *
 * 반환값은 턴 시작 위치의 도수, 착지 도수, 출발선 통과 수, 사회복지기금 수령액이다.
 */
function runChain(config: ModelConfig, options: Required<SimulationOptions>, seed: number) {
  const random = createRandom(seed);
  const draw = createDrawer(config, random);
  const dice = diceOutcomes(config.diceFaces, config.diceCount);
  const teleport = [...teleportTargets(config.teleportPolicy)];

  const rollDice = (): { sum: number; isDouble: boolean } => {
    let u = random();
    for (const outcome of dice) {
      u -= outcome.prob;
      if (u <= 0) return outcome;
    }
    return dice[dice.length - 1] as { sum: number; isDouble: boolean };
  };

  const visits = new Array<number>(BOARD_SIZE).fill(0);
  const landings = new Array<number>(BOARD_SIZE).fill(0);
  const lastVisit = new Array<number>(BOARD_SIZE).fill(-1);
  const returnGaps = new Array<number>(BOARD_SIZE).fill(0);
  const returnCounts = new Array<number>(BOARD_SIZE).fill(0);
  const welfarePayouts: number[] = [];
  let salaryPasses = 0;
  let welfareBalance = 0;

  const runner: Runner = { cell: 0, jailTurns: 0 };

  /** 착지 칸의 효과를 적용한다. 턴이 끝나면 true 를 돌려준다. */
  const land = (cell: number, counted: boolean, turn: number): boolean => {
    if (counted) landings[cell] = (landings[cell] ?? 0) + 1;
    runner.cell = cell;

    if (cell === WELFARE_PAY_CELL) welfareBalance += WELFARE_CONTRIBUTION;
    if (cell === WELFARE_RECEIVE_CELL) {
      if (counted) welfarePayouts.push(welfareBalance);
      welfareBalance = 0;
    }

    if (cell === ISLAND_CELL && config.enableJail) {
      runner.jailTurns = 3;
      return true;
    }
    if (cell === SPACE_TRAVEL_CELL && config.enableSpaceTravel) return config.spaceEndsTurn;
    if (cellAt(cell).kind === 'goldenKey' && config.enableGoldenKey) return applyCard(counted, turn);
    return false;
  };

  const applyCard = (counted: boolean, turn: number): boolean => {
    const card = draw();
    const from = runner.cell;
    const effect = card.effect;

    if (effect.kind === 'stay') {
      if (card.grantsSalaryInPlace && counted) salaryPasses += 1;
      return config.cardMoveEndsTurn;
    }
    if (effect.kind === 'toIsland') {
      if (counted) landings[ISLAND_CELL] = (landings[ISLAND_CELL] ?? 0) + 1;
      runner.cell = ISLAND_CELL;
      if (config.enableJail) runner.jailTurns = 3;
      return true;
    }
    if (effect.kind === 'moveBy') {
      const target = wrap(from + effect.delta);
      if (target === ISLAND_CELL && !config.jailOnBackstep) {
        if (counted) landings[target] = (landings[target] ?? 0) + 1;
        runner.cell = target;
        return true;
      }
      return land(target, counted, turn) || config.cardMoveEndsTurn;
    }
    // moveTo
    if (effect.salary === 'passing' && counted) {
      salaryPasses +=
        effect.via === undefined
          ? passesStart(from, effect.target)
          : passesStart(from, effect.via) + passesStart(effect.via, effect.target);
    }
    return land(effect.target, counted, turn) || config.cardMoveEndsTurn;
  };

  for (let turn = 0; turn < options.turnsPerChain; turn += 1) {
    const counted = turn >= options.burnIn;

    if (counted) {
      const cell = runner.cell;
      visits[cell] = (visits[cell] ?? 0) + 1;
      if ((lastVisit[cell] ?? -1) >= 0) {
        returnGaps[cell] = (returnGaps[cell] ?? 0) + (turn - (lastVisit[cell] as number));
        returnCounts[cell] = (returnCounts[cell] ?? 0) + 1;
      }
      lastVisit[cell] = turn;
    }

    // 우주여행 — 주사위를 굴리지 않고 정책대로 이동한다.
    if (runner.cell === SPACE_TRAVEL_CELL && config.enableSpaceTravel) {
      let u = random();
      let target = teleport[teleport.length - 1]?.[0] ?? 0;
      for (const [cell, prob] of teleport) {
        u -= prob;
        if (u <= 0) {
          target = cell;
          break;
        }
      }
      if (counted) salaryPasses += passesStart(SPACE_TRAVEL_CELL, target);
      land(target, counted, turn);
      continue;
    }

    // 무인도 대기 — 한 번 굴려 더블이면 탈출, 아니면 카운터가 하나 준다.
    if (runner.jailTurns > 0) {
      const { sum, isDouble } = rollDice();
      if (isDouble) {
        runner.jailTurns = 0;
        const target = wrap(ISLAND_CELL + sum);
        if (counted) salaryPasses += passesStart(ISLAND_CELL, target);
        land(target, counted, turn);
      } else {
        runner.jailTurns -= 1;
      }
      continue;
    }

    // 정상 턴 — 더블이면 계속 굴린다.
    for (let roll = 0; roll < 64; roll += 1) {
      const { sum, isDouble } = rollDice();
      const from = runner.cell;
      const target = wrap(from + sum);
      if (counted) salaryPasses += passesStart(from, target);
      const ended = land(target, counted, turn);
      if (ended || !isDouble) break;
    }
  }

  return { visits, landings, salaryPasses, welfarePayouts, returnGaps, returnCounts };
}

/**
 * 다중 독립 체인 몬테카를로.
 *
 * 기본값은 계획서 §11.4 의 500체인 × 2000턴, 앞 200턴 burn-in 이다.
 */
export function simulate(config: ModelConfig, options: SimulationOptions = {}): SimulationResult {
  const settings: Required<SimulationOptions> = {
    chains: options.chains ?? 500,
    turnsPerChain: options.turnsPerChain ?? 2000,
    burnIn: options.burnIn ?? 200,
    seed: options.seed ?? 20260908,
  };

  const perChain: number[][] = [];
  const totalVisits = new Array<number>(BOARD_SIZE).fill(0);
  const totalLandings = new Array<number>(BOARD_SIZE).fill(0);
  const totalGaps = new Array<number>(BOARD_SIZE).fill(0);
  const totalReturns = new Array<number>(BOARD_SIZE).fill(0);
  const welfarePayouts: number[] = [];
  let salaryPasses = 0;

  const countedTurns = settings.turnsPerChain - settings.burnIn;

  for (let chain = 0; chain < settings.chains; chain += 1) {
    const run = runChain(config, settings, settings.seed + chain * 7919);
    perChain.push(run.visits.map((count) => count / countedTurns));
    for (let cell = 0; cell < BOARD_SIZE; cell += 1) {
      totalVisits[cell] = (totalVisits[cell] ?? 0) + (run.visits[cell] ?? 0);
      totalLandings[cell] = (totalLandings[cell] ?? 0) + (run.landings[cell] ?? 0);
      totalGaps[cell] = (totalGaps[cell] ?? 0) + (run.returnGaps[cell] ?? 0);
      totalReturns[cell] = (totalReturns[cell] ?? 0) + (run.returnCounts[cell] ?? 0);
    }
    welfarePayouts.push(...run.welfarePayouts);
    salaryPasses += run.salaryPasses;
  }

  const effectiveTurns = countedTurns * settings.chains;
  return {
    piByCell: totalVisits.map((count) => count / effectiveTurns),
    v: totalLandings.map((count) => count / effectiveTurns),
    perChain,
    salaryRate: salaryPasses / effectiveTurns,
    welfarePayouts,
    returnTimes: totalGaps.map((gap, cell) => ((totalReturns[cell] ?? 0) === 0 ? Number.NaN : gap / (totalReturns[cell] as number))),
    chains: settings.chains,
    effectiveTurns,
  };
}

/** 턴당 기대 월급 수입 (시뮬레이션). */
export function simulatedSalaryPerTurn(result: SimulationResult): number {
  return result.salaryRate * SALARY;
}
