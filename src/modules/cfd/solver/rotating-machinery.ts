import type { FanSimulationConfig, RotatingMeshAdjustments } from "../domain/models";

/**
 * Generates mesh adjustments optimised for rotating machinery (fans/blowers).
 *
 * Computes blade-tip refinement zones, interface sizing, and boundary-layer
 * recommendations based on the fan geometry and operating RPM.
 */
export function generateRotatingFrameMeshAdjustments(
  config: FanSimulationConfig
): RotatingMeshAdjustments {
  const { rpm, bladeCount, rotatingZoneRadius, bladeTipRefinement, meshSettings } = config;

  // ── Tip-speed driven sizing ───────────────────────────────────────────────
  const angularVelocity = (rpm * 2 * Math.PI) / 60;
  const tipSpeed = angularVelocity * rotatingZoneRadius; // m/s

  // Scale base cell size inversely with tip speed (higher speed → finer mesh)
  const tipSpeedFactor = Math.min(1, 50 / Math.max(tipSpeed, 1));
  const adjustedBaseSize = meshSettings.baseSize * Math.max(tipSpeedFactor, 0.25);
  const adjustedMinSize = Math.min(
    bladeTipRefinement.minCellSize,
    adjustedBaseSize * 0.1
  );

  // ── Blade-tip refinement zone ─────────────────────────────────────────────
  const innerRadius = rotatingZoneRadius - bladeTipRefinement.refinementRadius;
  const outerRadius = rotatingZoneRadius + bladeTipRefinement.tipClearance * 2;
  const axialExtent = bladeTipRefinement.refinementRadius * 1.5;
  const tipCellSize = bladeTipRefinement.minCellSize;
  const tipRefinementLevels = bladeTipRefinement.refinementLevels;

  // ── Interface refinement (MRF / sliding-mesh boundary) ────────────────────
  const interfaceCellSize = adjustedBaseSize * 0.5;
  const transitionLayers = Math.max(3, Math.ceil(Math.log2(meshSettings.baseSize / interfaceCellSize)));

  // ── Boundary layer recommendations ────────────────────────────────────────
  // y+ ≈ 1 target for SST, y+ ≈ 30 for k-epsilon wall functions
  const isSST = config.turbulenceModel.type === "k-omega-sst";
  const recommendedBoundaryLayers = isSST ? 20 : 12;
  const recommendedGrowthRate = isSST ? 1.15 : 1.25;

  // ── Cell count estimate ───────────────────────────────────────────────────
  // Rough volumetric estimate: V_zone / cell³ + blade surface layers
  const zoneVolume = Math.PI * rotatingZoneRadius ** 2 * axialExtent * 2;
  const avgCellVol = adjustedBaseSize ** 3;
  const baseCells = Math.ceil(zoneVolume / avgCellVol);

  // Blade surface cells (approximate each blade as a flat plate)
  const bladeChord = rotatingZoneRadius * 0.3; // typical chord ≈ 30% of radius
  const bladeSpan = rotatingZoneRadius * 0.8;
  const bladeSurfaceCells = Math.ceil(
    (bladeChord * bladeSpan * 2) / (tipCellSize ** 2) * bladeCount
  );

  const estimatedCellCount = baseCells + bladeSurfaceCells;

  return {
    adjustedBaseSize,
    adjustedMinSize,
    bladeTipRefinementZone: {
      innerRadius,
      outerRadius,
      axialExtent,
      cellSize: tipCellSize,
      refinementLevels: tipRefinementLevels,
    },
    interfaceRefinement: {
      cellSize: interfaceCellSize,
      transitionLayers,
    },
    recommendedBoundaryLayers,
    recommendedGrowthRate,
    estimatedCellCount,
  };
}
