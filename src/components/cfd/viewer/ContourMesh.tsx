import { useMemo } from "react";
import * as THREE from "three";
import type { PressureFieldEntry, TemperatureFieldEntry, SlicePlaneConfig } from "./cfd-viewer-types";
import { sampleColorMap, normalise, computeFieldStats } from "./cfd-viewer-types";

interface ContourMeshProps {
  pressureField: PressureFieldEntry[];
  temperatureField: TemperatureFieldEntry[];
  colorMap: string;
  showPressure: boolean;
  showTemperature: boolean;
  slicePlane: SlicePlaneConfig;
  pointSize?: number;
}

export function ContourMesh({
  pressureField,
  temperatureField,
  colorMap,
  showPressure,
  showTemperature,
  slicePlane,
  pointSize = 0.06,
}: ContourMeshProps) {
  const geometry = useMemo(() => {
    const field = showPressure ? pressureField : showTemperature ? temperatureField : [];
    if (field.length === 0) return null;

    // Filter by slice plane
    const tolerance = 0.15;
    const filtered = slicePlane.visible
      ? field.filter((entry) => {
          const pos = "pressure" in entry ? entry.position : (entry as TemperatureFieldEntry).position;
          const val = pos[slicePlane.axis as keyof typeof pos];
          return Math.abs(val - slicePlane.position) < tolerance;
        })
      : field;

    if (filtered.length === 0) return null;

    const accessor = showPressure
      ? (e: PressureFieldEntry | TemperatureFieldEntry) => (e as PressureFieldEntry).pressure
      : (e: PressureFieldEntry | TemperatureFieldEntry) => (e as TemperatureFieldEntry).temperature;

    const stats = computeFieldStats(filtered as (PressureFieldEntry | TemperatureFieldEntry)[], accessor);

    const positions = new Float32Array(filtered.length * 3);
    const colors = new Float32Array(filtered.length * 3);

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const pos = "pressure" in entry ? entry.position : (entry as TemperatureFieldEntry).position;

      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const val = accessor(entry as PressureFieldEntry | TemperatureFieldEntry);
      const t = normalise(val, stats.min, stats.max);
      const color = sampleColorMap(t, colorMap);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [pressureField, temperatureField, colorMap, showPressure, showTemperature, slicePlane]);

  if (!geometry) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={pointSize}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
