"use client";

import { useEffect, useState } from "react";

const HEARTS = Array.from({ length: 14 }, (_, i) => ({
  dx: `${Math.round(Math.cos((i / 14) * Math.PI) * 120 + (i % 3) * 8 - 8)}px`,
  rot: `${(i % 2 ? 1 : -1) * (10 + (i % 5) * 6)}deg`,
  delay: `${(i % 5) * 40}ms`,
  size: 14 + (i % 4) * 4,
  left: 50 + ((i % 7) - 3) * 3,
}));

/**
 * The one celebratory moment: a quick burst of hearts. Hidden entirely when
 * the person prefers reduced motion (see globals.css); the status text that
 * accompanies it is what screen readers announce.
 */
export function Celebrate({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1100);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-1/3 z-50 h-0 overflow-visible">
      {HEARTS.map((h, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={h.size}
          height={h.size}
          className="heart-burst absolute"
          style={
            {
              left: `${h.left}%`,
              animationDelay: h.delay,
              color: i % 3 === 0 ? "var(--accent)" : "var(--primary)",
              "--dx": h.dx,
              "--rot": h.rot,
            } as React.CSSProperties
          }
        >
          <path
            fill="currentColor"
            d="M12 20.6s-7.6-4.6-9.4-9.3C1.4 8 3.3 4.6 6.7 4.4c2-.1 3.5 1 4.3 2.4h2c.8-1.4 2.3-2.5 4.3-2.4 3.4.2 5.3 3.6 4.1 6.9-1.8 4.7-9.4 9.3-9.4 9.3Z"
          />
        </svg>
      ))}
    </div>
  );
}
