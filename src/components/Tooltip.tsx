import { useEffect, useState, type ReactNode } from 'react';

export interface TooltipState {
  readonly x: number;
  readonly y: number;
  readonly content: ReactNode;
}

/** 마우스를 따라다니는 툴팁. 화면 밖으로 나가지 않도록 접는다. */
export function Tooltip({ state }: { state: TooltipState | null }) {
  const [size, setSize] = useState({ w: 220, h: 90 });
  useEffect(() => {
    if (state === null) setSize({ w: 220, h: 90 });
  }, [state]);
  if (state === null) return null;
  const left = Math.min(state.x + 14, window.innerWidth - size.w - 12);
  const top = Math.min(state.y + 14, window.innerHeight - size.h - 12);
  return (
    <div
      className="tooltip"
      role="tooltip"
      style={{ left, top }}
      ref={(node) => {
        if (node !== null) setSize({ w: node.offsetWidth, h: node.offsetHeight });
      }}
    >
      {state.content}
    </div>
  );
}
