import { useMemo } from "react";
import * as THREE from "three";
import type { VelocityFieldEntry, SlicePlaneConfig } from "./cfd-viewer-types";
import { sampleColorMap, normalise, computeFieldStats } from "./cfd-viewer-types";

interface VelocityVectorsProps {
  velocityField: VelocityFieldEntry[];
  colorMap: string;
  slicePlane: SlicePlaneConfig;
  scale?: number;
  density?: number;
}

export function VelocityVectors({
  velocityField,
  colorMap,
  slicePlane,
  scale = 0.15,
  density = 0.3,
}: VelocityVectorsProps) {
  const { positions, colors, lineCount } = useMemo(() => {
    const tolerance = 0.15;

    // Filter by slice and subsample
    let filtered = slicePlane.visible
      ? velocityField.filter(
          (e) => Math.abs(e.position[slicePlane.axis as keyof typeof e.position] - slicePlane.position) < tolerance
        )
      : velocityField;

    // Subsample for performance
    const step = Math.max(1, Math.floor(1 / density));
    filtered = filtered.filter((_, i) => i % step === 0);

    const stats = computeFieldStats(filtered, (e) => e.magnitude);

    const posArr = new Float32Array(filtered.length * 6); // 2 points per line
    const colArr = new Float32Array(filtered.length * 6);
    let count = 0;

    for (const entry of filtered) {
      const t = normalise(entry.magnitude, stats.min, stats.max);
      const color = sampleColorMap(t, colorMap);
      const len = scale * (0.3 + 0.7 * t);

      const i = count * 6;

      // Start point
      posArr[i] = entry.position.x;
      posArr[i + 1] = entry.position.y;
      posArr[i + 2] = entry.position.z;

      // End point (position + velocity * scale)
      posArr[i + 3] = entry.position.x + entry.velocity.x * len;
      posArr[i + 4] = entry.position.y + entry.velocity.y * len;
      posArr[i + 5] = entry.position.z + entry.velocity.z * len;

      // Color for both points
      colArr[i] = color.r * 0.5;
      colArr[i + 1] = color.g * 0.5;
      colArr[i + 2] = color.b * 0.5;
      colArr[i + 3] = color.r;
      colArr[i + 4] = color.g;
      colArr[i + 5] = color.b;

      count++;
    }

    return {
      positions: posArr.slice(0, count * 6),
      colors: colArr.slice(0, count * 6),
      lineCount: count,
    };
  }, [velocityField, colorMap, slicePlane, scale, density]);

  const geometry = useMemo(() => {
    if (lineCount === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors, lineCount]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} linewidth={1} />
    </lineSegments>
  );
}
