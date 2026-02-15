import { useState, useMemo, useCallback, memo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Stats } from "@react-three/drei";
import type { CFDViewerProps, SlicePlaneConfig } from "./cfd-viewer-types";
import { computeFieldStats } from "./cfd-viewer-types";
import { ContourMesh } from "./ContourMesh";
import { VelocityVectors } from "./VelocityVectors";
import { SlicePlaneVisual } from "./SlicePlaneVisual";
import { BoundingBox } from "./BoundingBox";
import { ColorBar } from "./ColorBar";
import { Layers, Wind, Thermometer, Gauge, Eye, EyeOff, Move3D, RotateCcw } from "lucide-react";

const CFDViewerInner = memo(function CFDViewerInner({
  velocityField,
  pressureField,
  temperatureField,
  colorMap = "jet",
  showVelocityVectors: initialShowVelocity = true,
  showPressureContour: initialShowPressure = true,
  showTemperatureContour: initialShowTemp = false,
}: CFDViewerProps) {
  const [showVelocity, setShowVelocity] = useState(initialShowVelocity);
  const [showPressure, setShowPressure] = useState(initialShowPressure);
  const [showTemperature, setShowTemperature] = useState(initialShowTemp);
  const [activeColorMap, setActiveColorMap] = useState<string>(colorMap);
  const [vectorDensity, setVectorDensity] = useState(0.3);
  const [vectorScale, setVectorScale] = useState(0.15);
  const [pointSize, setPointSize] = useState(0.06);
  const [showStats, setShowStats] = useState(false);

  const [slicePlane, setSlicePlane] = useState<SlicePlaneConfig>({
    axis: "z",
    position: 0,
    visible: false,
  });

  const pressureStats = useMemo(
    () => computeFieldStats(pressureField, (e) => e.pressure),
    [pressureField]
  );
  const temperatureStats = useMemo(
    () => computeFieldStats(temperatureField, (e) => e.temperature),
    [temperatureField]
  );
  const velocityStats = useMemo(
    () => computeFieldStats(velocityField, (e) => e.magnitude),
    [velocityField]
  );

  const handleSliceAxis = useCallback((axis: "x" | "y" | "z") => {
    setSlicePlane((prev) => ({ ...prev, axis }));
  }, []);

  const handleSlicePosition = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlicePlane((prev) => ({ ...prev, position: parseFloat(e.target.value) }));
  }, []);

  const handleSliceToggle = useCallback(() => {
    setSlicePlane((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const activeField = showPressure ? "Pressure" : showTemperature ? "Temperature" : showVelocity ? "Velocity" : null;
  const activeStats = showPressure ? pressureStats : showTemperature ? temperatureStats : velocityStats;
  const activeUnit = showPressure ? "Pa" : showTemperature ? "K" : "m/s";

  return (
    <div className="relative w-full h-full">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [2.5, 2, 2.5], fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ background: "hsl(220, 25%, 6%)" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />

          <BoundingBox />

          {(showPressure || showTemperature) && (
            <ContourMesh
              pressureField={pressureField}
              temperatureField={temperatureField}
              colorMap={activeColorMap}
              showPressure={showPressure}
              showTemperature={showTemperature}
              slicePlane={slicePlane}
              pointSize={pointSize}
            />
          )}

          {showVelocity && (
            <VelocityVectors
              velocityField={velocityField}
              colorMap={activeColorMap}
              slicePlane={slicePlane}
              scale={vectorScale}
              density={vectorDensity}
            />
          )}

          <SlicePlaneVisual config={slicePlane} />

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            zoomSpeed={0.8}
            makeDefault
          />

          {showStats && <Stats />}
        </Suspense>
      </Canvas>

      {/* Color bar */}
      {activeField && (
        <ColorBar
          min={activeStats.min}
          max={activeStats.max}
          label={activeField}
          unit={activeUnit}
          colorMap={activeColorMap}
        />
      )}

      {/* Controls Overlay */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        {/* Layer toggles */}
        <div className="surface-panel rounded-lg p-3 space-y-2 min-w-[180px]">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-data-cyan" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Layers</span>
          </div>

          <LayerToggle
            icon={<Wind className="w-3.5 h-3.5" />}
            label="Velocity Vectors"
            active={showVelocity}
            onToggle={() => setShowVelocity(!showVelocity)}
            color="text-data-cyan"
          />
          <LayerToggle
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Pressure Contour"
            active={showPressure}
            onToggle={() => { setShowPressure(!showPressure); if (!showPressure) setShowTemperature(false); }}
            color="text-data-emerald"
          />
          <LayerToggle
            icon={<Thermometer className="w-3.5 h-3.5" />}
            label="Temperature"
            active={showTemperature}
            onToggle={() => { setShowTemperature(!showTemperature); if (!showTemperature) setShowPressure(false); }}
            color="text-data-amber"
          />
        </div>

        {/* Slice controls */}
        <div className="surface-panel rounded-lg p-3 space-y-2 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Move3D className="w-3.5 h-3.5 text-data-violet" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Slice Plane</span>
            </div>
            <button
              onClick={handleSliceToggle}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {slicePlane.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex gap-1">
            {(["x", "y", "z"] as const).map((axis) => (
              <button
                key={axis}
                onClick={() => handleSliceAxis(axis)}
                className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${
                  slicePlane.axis === axis
                    ? "bg-primary text-primary-foreground"
                    : "surface-raised text-muted-foreground hover:text-foreground"
                }`}
              >
                {axis.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Position</span>
              <span className="text-[10px] font-mono text-foreground">{slicePlane.position.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={slicePlane.position}
              onChange={handleSlicePosition}
              className="w-full h-1 rounded-full appearance-none cursor-pointer accent-primary bg-surface-overlay"
            />
          </div>
        </div>

        {/* Rendering settings */}
        <div className="surface-panel rounded-lg p-3 space-y-2 min-w-[180px]">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Rendering</span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Color Map</label>
            <select
              value={activeColorMap}
              onChange={(e) => setActiveColorMap(e.target.value)}
              className="w-full rounded-md surface-raised border border-surface-border px-2 py-1 text-[11px] text-foreground bg-transparent"
            >
              <option value="jet">Jet</option>
              <option value="coolwarm">Cool-Warm</option>
              <option value="viridis">Viridis</option>
              <option value="turbo">Turbo</option>
            </select>
          </div>

          {showVelocity && (
            <>
              <SliderControl label="Vector Density" value={vectorDensity} min={0.05} max={1} step={0.05} onChange={setVectorDensity} />
              <SliderControl label="Vector Scale" value={vectorScale} min={0.05} max={0.5} step={0.01} onChange={setVectorScale} />
            </>
          )}

          {(showPressure || showTemperature) && (
            <SliderControl label="Point Size" value={pointSize} min={0.02} max={0.15} step={0.005} onChange={setPointSize} />
          )}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute left-4 bottom-4 z-10 surface-panel rounded-lg p-3 min-w-[200px]">
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label="Points" value={pressureField.length.toLocaleString()} />
          <StatBlock label="Vel Range" value={`${velocityStats.min.toFixed(2)} – ${velocityStats.max.toFixed(2)} m/s`} />
          <StatBlock
            label="P Range"
            value={`${((pressureStats.max - pressureStats.min)).toFixed(0)} Pa`}
          />
        </div>
      </div>
    </div>
  );
});

// ─── Sub-components ──────────────────────────────────────────────────────────

function LayerToggle({
  icon,
  label,
  active,
  onToggle,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[11px] transition-colors ${
        active
          ? `surface-raised ${color}`
          : "text-muted-foreground/60 hover:text-muted-foreground"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-current" : "bg-muted-foreground/30"}`}
      />
    </button>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-primary bg-surface-overlay"
      />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">{label}</span>
      <span className="text-[11px] font-mono text-foreground">{value}</span>
    </div>
  );
}

export default CFDViewerInner;
