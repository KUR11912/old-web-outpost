/** Fixed, metres-based stage enclosure. North is -Z, as in MAP. */
export type SkyFaceName = 'north' | 'east' | 'south' | 'west' | 'top';

export interface SkyFaceStyle {
  /** UV repeats, kept proportional to physical face dimensions. */
  repeat: readonly [number, number];
  offset: readonly [number, number];
  /** Radians in UV space; walls stay upright at zero. */
  rotation: number;
  tint: string;
  /** Multiplies the unlit material colour in linear colour space. */
  intensity: number;
}

const bounds = { minX: -44, maxX: 96, minZ: -86, maxZ: 44 };
const bottomY = -6;
const topY = 36;
const width = bounds.maxX - bounds.minX;
const depth = bounds.maxZ - bounds.minZ;
const height = topY - bottomY;
// The 540m perimeter contains 12 mirrored tiles, closing the final wall corner.
const tileMetres = 45;

export const SKY_ENCLOSURE = {
  revision: 1,
  bounds,
  bottomY,
  topY,
  dimensions: { width, depth, height },
  centre: { x: (bounds.minX + bounds.maxX) / 2, y: (topY + bottomY) / 2, z: (bounds.minZ + bounds.maxZ) / 2 },
  cameraFar: 260,
  texture: {
    asset: 'assets/cloud-sky.png',
    tileMetres,
    wrap: 'MirroredRepeatWrapping',
    filter: 'NearestFilter',
    /** The supplied image is copied byte-for-byte, without any processing. */
    sourceSha256: 'dd93b323de256ae2b40b0afc1e89fb9f91a957269505360b30d1bf4716472a85',
  },
  /** Separate texture transforms allow each surface to be art-directed. */
  faces: {
    north: { repeat: [width / tileMetres, height / tileMetres], offset: [0, 0], rotation: 0, tint: '#f4f2ff', intensity: 0.96 },
    east: { repeat: [depth / tileMetres, height / tileMetres], offset: [width / tileMetres, 0], rotation: 0, tint: '#f7f5ff', intensity: 0.99 },
    south: { repeat: [width / tileMetres, height / tileMetres], offset: [(width + depth) / tileMetres, 0], rotation: 0, tint: '#f2efff', intensity: 0.94 },
    west: { repeat: [depth / tileMetres, height / tileMetres], offset: [(2 * width + depth) / tileMetres, 0], rotation: 0, tint: '#f1f3ff', intensity: 0.95 },
    top: { repeat: [width / tileMetres, depth / tileMetres], offset: [0, 0], rotation: 0, tint: '#ffffff', intensity: 1.03 },
  } satisfies Record<SkyFaceName, SkyFaceStyle>,
};
