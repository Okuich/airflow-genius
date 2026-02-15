import * as THREE from "three";

// ─── Field Data Types ──────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface VelocityFieldEntry {
  position: Vec3;
  velocity: Vec3;
  magnitude: number;
}

export interface PressureFieldEntry {
  position: Vec3;
  pressure: number;
}

export interface TemperatureFieldEntry {
  position: Vec3;
  temperature: number;
}

export interface SlicePlaneConfig {
  axis: "x" | "y" | "z";
  position: number;
  visible: boolean;
}

export interface CFDViewerProps {
  velocityField: VelocityFieldEntry[];
  pressureField: PressureFieldEntry[];
  temperatureField: TemperatureFieldEntry[];
  colorMap?: "jet" | "coolwarm" | "viridis" | "turbo";
  showVelocityVectors?: boolean;
  showPressureContour?: boolean;
  showTemperatureContour?: boolean;
}

// ─── Color Maps ────────────────────────────────────────────────────────────

type ColorStop = [number, number, number];

const COLOR_MAPS: Record<string, ColorStop[]> = {
  jet: [
    [0, 0, 0.5],
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 0],
    [1, 0, 0],
    [0.5, 0, 0],
  ],
  coolwarm: [
    [0.23, 0.3, 0.75],
    [0.55, 0.65, 0.95],
    [0.87, 0.87, 0.87],
    [0.95, 0.55, 0.45],
    [0.71, 0.02, 0.15],
  ],
  viridis: [
    [0.27, 0.0, 0.33],
    [0.28, 0.47, 0.63],
    [0.13, 0.66, 0.52],
    [0.55, 0.82, 0.22],
    [0.99, 0.91, 0.15],
  ],
  turbo: [
    [0.19, 0.07, 0.23],
    [0.13, 0.37, 0.84],
    [0.09, 0.73, 0.73],
    [0.53, 0.89, 0.24],
    [0.95, 0.65, 0.11],
    [0.86, 0.21, 0.02],
  ],
};

export function sampleColorMap(t: number, mapName: string = "jet"): THREE.Color {
  const stops = COLOR_MAPS[mapName] || COLOR_MAPS.jet;
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  const c0 = stops[Math.min(idx, stops.length - 1)];
  const c1 = stops[Math.min(idx + 1, stops.length - 1)];

  return new THREE.Color(
    c0[0] + frac * (c1[0] - c0[0]),
    c0[1] + frac * (c1[1] - c0[1]),
    c0[2] + frac * (c1[2] - c0[2])
  );
}

export function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

// ─── Mock Field Data Generator ─────────────────────────────────────────────

export function generateMockFields(gridSize: number = 20): {
  velocityField: VelocityFieldEntry[];
  pressureField: PressureFieldEntry[];
  temperatureField: TemperatureFieldEntry[];
} {
  const velocityField: VelocityFieldEntry[] = [];
  const pressureField: PressureFieldEntry[] = [];
  const temperatureField: TemperatureFieldEntry[] = [];

  const step = 2 / gridSize;

  for (let ix = 0; ix < gridSize; ix++) {
    for (let iy = 0; iy < gridSize; iy++) {
      for (let iz = 0; iz < gridSize; iz++) {
        const x = -1 + ix * step + step / 2;
        const y = -1 + iy * step + step / 2;
        const z = -1 + iz * step + step / 2;
        const r = Math.sqrt(x * x + y * y + z * z);

        // Simulate a swirling flow around Z-axis (centrifugal blower-like)
        const theta = Math.atan2(y, x);
        const tangential = 0.5 + 0.5 * Math.exp(-r * 2);
        const radial = -0.2 * r;
        const axial = 0.3 * (1 - r * r);

        const vx = tangential * (-Math.sin(theta)) + radial * Math.cos(theta);
        const vy = tangential * Math.cos(theta) + radial * Math.sin(theta);
        const vz = axial;
        const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);

        velocityField.push({
          position: { x, y, z },
          velocity: { x: vx, y: vy, z: vz },
          magnitude: mag,
        });

        // Pressure: higher near center (centrifugal effect)
        const pressure = 101325 + 500 * (1 - r) + 200 * Math.sin(theta * 3);
        pressureField.push({ position: { x, y, z }, pressure });

        // Temperature: gradient from hot core to cool outer
        const temperature = 320 - 25 * r + 5 * Math.sin(z * Math.PI);
        temperatureField.push({ position: { x, y, z }, temperature });
      }
    }
  }

  return { velocityField, pressureField, temperatureField };
}

// ─── Field Stats ───────────────────────────────────────────────────────────

export function computeFieldStats<T>(
  field: T[],
  accessor: (entry: T) => number
): { min: number; max: number; mean: number } {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const entry of field) {
    const val = accessor(entry);
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }
  return { min, max, mean: sum / field.length };
}
