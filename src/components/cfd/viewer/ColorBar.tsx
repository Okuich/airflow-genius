import { useMemo } from "react";
import * as THREE from "three";
import { sampleColorMap } from "./cfd-viewer-types";

interface ColorBarProps {
  min: number;
  max: number;
  label: string;
  unit: string;
  colorMap: string;
}

export function ColorBar({ min, max, label, unit, colorMap }: ColorBarProps) {
  const steps = 10;

  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = sampleColorMap(t, colorMap);
      const color = new THREE.Color(c.r, c.g, c.b);
      stops.push(`#${color.getHexString()}`);
    }
    return `linear-gradient(to top, ${stops.join(", ")})`;
  }, [colorMap]);

  const ticks = useMemo(() => {
    const arr: { value: string; pct: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const val = min + t * (max - min);
      arr.push({
        value: val < 1000 ? val.toFixed(1) : val.toExponential(2),
        pct: `${100 - t * 100}%`,
      });
    }
    return arr;
  }, [min, max]);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1.5 z-10 pointer-events-none">
      <div className="flex flex-col justify-between py-0.5">
        {ticks.map((tick, i) => (
          <span
            key={i}
            className="text-[9px] font-mono text-foreground/70 leading-none text-right"
            style={{ position: "absolute", top: tick.pct, transform: "translateY(-50%)" }}
          >
            {tick.value}
          </span>
        ))}
      </div>
      <div
        className="w-3 h-40 rounded-sm border border-surface-border"
        style={{ background: gradient }}
      />
      <div className="flex flex-col justify-center">
        <span className="text-[9px] font-mono text-foreground/80 whitespace-nowrap writing-mode-vertical">
          {label} ({unit})
        </span>
      </div>
    </div>
  );
}
