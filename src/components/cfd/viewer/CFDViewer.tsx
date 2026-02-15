import { useMemo } from "react";
import CFDViewerInner from "./CFDViewerInner";
import type { CFDViewerProps } from "./cfd-viewer-types";
import { generateMockFields } from "./cfd-viewer-types";

/**
 * Top-level CFDViewer — can accept real field data or fall back to generated mock data.
 */
export function CFDViewer(props: Partial<CFDViewerProps>) {
  const mock = useMemo(() => generateMockFields(16), []);

  const velocityField = props.velocityField ?? mock.velocityField;
  const pressureField = props.pressureField ?? mock.pressureField;
  const temperatureField = props.temperatureField ?? mock.temperatureField;

  return (
    <CFDViewerInner
      velocityField={velocityField}
      pressureField={pressureField}
      temperatureField={temperatureField}
      colorMap={props.colorMap ?? "jet"}
      showVelocityVectors={props.showVelocityVectors ?? true}
      showPressureContour={props.showPressureContour ?? true}
      showTemperatureContour={props.showTemperatureContour ?? false}
    />
  );
}
