import type { ReactNode } from 'react';

export interface TooltipState {
  readonly x: number;
  readonly y: number;
  readonly content: ReactNode;
}

/**
 * 마우스를 따라다니는 툴팁.
 *
 * **크기를 재지 않는다.** 처음에는 ref 콜백에서 offsetWidth 를 읽어 state 에 넣었는데,
 * ref 콜백은 렌더마다 실행되고 setState 는 새 객체를 만드니 렌더 → setState → 렌더 로
 * 무한 루프가 났다 (React error #185). 정적 빌드를 브라우저에서 직접 굴려 보고서야
 * 드러난 버그다.
 *
 * 지금은 포인터가 화면의 어느 사분면에 있는지만 보고 CSS `transform` 으로 뒤집는다.
 * 측정도 상태도 없으므로 루프가 생길 수 없다.
 */
export function Tooltip({ state }: { state: TooltipState | null }) {
  if (state === null) return null;

  const flipX = state.x > window.innerWidth - 300;
  const flipY = state.y > window.innerHeight - 180;
  const shift = (flip: boolean) => (flip ? 'calc(-100% - 14px)' : '14px');

  return (
    <div
      className="tooltip"
      role="tooltip"
      style={{ left: state.x, top: state.y, transform: `translate(${shift(flipX)}, ${shift(flipY)})` }}
    >
      {state.content}
    </div>
  );
}
