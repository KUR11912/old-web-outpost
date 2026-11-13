import { MAP } from './map-config';

export type FootstepSurface = 'grass' | 'stone';

interface Footprint { minX: number; maxX: number; minZ: number; maxZ: number }

// PathTile_01 is a 2 x 2 metre slab. These two original paved areas are
// placed in world.ts; the expanded roads and bridge use the shared map data.
const stoneFootprints: Footprint[] = [
  { minX: -1, maxX: 1, minZ: -5, maxZ: 9 },
  { minX: 1, maxX: 3, minZ: -3, maxZ: -1 },
  {
    minX: MAP.bridge.x - MAP.bridge.length / 2,
    maxX: MAP.bridge.x + MAP.bridge.length / 2,
    minZ: MAP.bridge.z - MAP.bridge.width / 2,
    maxZ: MAP.bridge.z + MAP.bridge.width / 2,
  },
];

for (const road of MAP.roads) {
  for (const point of road.points) {
    const isDeckEnd = point.z === MAP.bridge.z
      && Math.abs(point.x - MAP.bridge.x) === MAP.bridge.length / 2;
    // addMapAssetInstances lays an unscaled square slab at every junction,
    // except at bridge ends, where the road stops flush with the bridge deck.
    if (!isDeckEnd) stoneFootprints.push({
      minX: point.x - 1, maxX: point.x + 1,
      minZ: point.z - 1, maxZ: point.z + 1,
    });
  }
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    // The rendered road network consists of axis-aligned rectangular slabs.
    // Square junctions above fill the bends; no rounded grass corners count.
    const halfX = a.x === b.x ? road.width / 2 : 0;
    const halfZ = a.z === b.z ? road.width / 2 : 0;
    stoneFootprints.push({
      minX: Math.min(a.x, b.x) - halfX, maxX: Math.max(a.x, b.x) + halfX,
      minZ: Math.min(a.z, b.z) - halfZ, maxZ: Math.max(a.z, b.z) + halfZ,
    });
  }
}

/** Classify the actual point under the player, without expanding by body radius. */
export function footstepSurfaceAt(x: number, z: number): FootstepSurface {
  return stoneFootprints.some(p => x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ)
    ? 'stone' : 'grass';
}
