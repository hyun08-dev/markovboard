/**
 * urlState.ts — 설정을 URL 쿼리로 인코딩한다. (계획서 §6.4)
 *
 * 발표할 때 특정 조합을 링크 하나로 바로 띄울 수 있어야 한다.
 * 기본값과 같은 항목은 넣지 않으므로 주소가 짧게 유지된다.
 */

import { DEFAULT_CONFIG, type ModelConfig } from './markov';

type Key = keyof ModelConfig;

/** 주소에 실을 항목. edition 처럼 화면에서 바꾸지 않는 값은 뺀다. */
const KEYS: readonly Key[] = [
  'jailModel',
  'jailOnBackstep',
  'teleportPolicy',
  'cardDeck',
  'chainCardMoves',
  'cardMoveEndsTurn',
  'buildLevel',
  'diceFaces',
  'diceCount',
  'enableGoldenKey',
  'enableSpaceTravel',
  'enableJail',
  'spaceEndsTurn',
];

export function encodeConfig(config: ModelConfig): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = config[key];
    if (JSON.stringify(value) === JSON.stringify(DEFAULT_CONFIG[key])) continue;
    params.set(key, Array.isArray(value) ? value.join('') : String(value));
  }
  return params.toString();
}

export function decodeConfig(search: string): ModelConfig {
  const params = new URLSearchParams(search);
  const config: Record<string, unknown> = { ...DEFAULT_CONFIG };

  for (const key of KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;
    const fallback = DEFAULT_CONFIG[key];
    if (typeof fallback === 'boolean') config[key] = raw === 'true';
    else if (typeof fallback === 'number') config[key] = Number(raw);
    else if (Array.isArray(fallback)) config[key] = [...raw].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    else config[key] = raw;
  }

  // 눈 목록이 비면 계산이 무너지므로 기본값으로 되돌린다.
  const faces = config['diceFaces'];
  if (!Array.isArray(faces) || faces.length === 0) config['diceFaces'] = DEFAULT_CONFIG.diceFaces;
  if (config['diceCount'] !== 1 && config['diceCount'] !== 2) config['diceCount'] = DEFAULT_CONFIG.diceCount;

  return config as unknown as ModelConfig;
}
