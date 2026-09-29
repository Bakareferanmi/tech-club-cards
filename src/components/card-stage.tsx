import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function CardStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const inner = innerRef.current;
    if (!stage || !inner) return;

    const update = () => {
      const width = inner.offsetWidth || 1;
      const next = stage.clientWidth / width;
      if (Number.isFinite(next) && next > 0) setScale(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(stage);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={stageRef} className="card-stage">
      <div
        ref={innerRef}
        className="card-stage__inner"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
