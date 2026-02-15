import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Subtle wireframe bounding box with engineering grid lines */
export function BoundingBox() {
  return (
    <group>
      {/* Outer wireframe */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2, 2, 2)]} />
        <lineBasicMaterial color="#334155" transparent opacity={0.4} />
      </lineSegments>

      {/* Axis labels */}
      <AxisTick position={[1.15, -1.15, -1.15]} label="X" />
      <AxisTick position={[-1.15, 1.15, -1.15]} label="Y" />
      <AxisTick position={[-1.15, -1.15, 1.15]} label="Z" />

      {/* Grid on XY plane at z=-1 */}
      <gridHelper
        args={[2, 10, "#1e293b", "#1e293b"]}
        position={[0, -1, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

function AxisTick({ position, label }: { position: [number, number, number]; label: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[0.15, 0.15]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
