import { useMemo } from "react";
import * as THREE from "three";
import type { SlicePlaneConfig } from "./cfd-viewer-types";

interface SlicePlaneVisualProps {
  config: SlicePlaneConfig;
}

export function SlicePlaneVisual({ config }: SlicePlaneVisualProps) {
  const { position, rotation } = useMemo(() => {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();

    switch (config.axis) {
      case "x":
        pos.set(config.position, 0, 0);
        rot.set(0, Math.PI / 2, 0);
        break;
      case "y":
        pos.set(0, config.position, 0);
        rot.set(Math.PI / 2, 0, 0);
        break;
      case "z":
        pos.set(0, 0, config.position);
        break;
    }

    return { position: pos, rotation: rot };
  }, [config.axis, config.position]);

  if (!config.visible) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2.4, 2.4]} />
      <meshBasicMaterial
        color="#00bcd4"
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
