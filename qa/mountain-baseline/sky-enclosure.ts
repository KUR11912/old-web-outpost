import * as THREE from 'three';
import { SKY_ENCLOSURE, type SkyFaceName, type SkyFaceStyle } from './sky-config';

type Triple = [number, number, number];

export interface SkyFaceReport {
  name: SkyFaceName;
  size: [number, number];
  position: Triple;
  inwardNormal: Triple;
  rotation: Triple;
  uv: SkyFaceStyle;
  material: {
    type: 'MeshBasicMaterial';
    fog: false;
    toneMapped: false;
    side: 'FrontSide';
    castShadow: false;
    receiveShadow: false;
  };
}

export interface SkyEnclosureReport {
  revision: number;
  bounds: typeof SKY_ENCLOSURE.bounds;
  bottomY: number;
  topY: number;
  dimensions: typeof SKY_ENCLOSURE.dimensions;
  cameraFar: number;
  texture: {
    url: string;
    width: number;
    height: number;
    sourceSha256: string;
    tileMetres: number;
    colourSpace: 'srgb';
    wrapping: 'MirroredRepeatWrapping';
    minFilter: 'NearestFilter';
    magFilter: 'NearestFilter';
    mipmaps: false;
  };
  faces: SkyFaceReport[];
  followsCamera: false;
  colliders: 0;
}

/** Five adjoining inward-facing planes, fixed to the world rather than the camera. */
export async function createSkyEnclosure(scene: THREE.Scene): Promise<{ group: THREE.Group; report: SkyEnclosureReport }> {
  const config = SKY_ENCLOSURE;
  const { width, height, depth } = config.dimensions;
  const { minX, maxX, minZ, maxZ } = config.bounds;
  const { x, y, z } = config.centre;
  const url = `${import.meta.env.BASE_URL}${config.texture.asset}`;
  const source = await new THREE.TextureLoader().loadAsync(url).catch(() => {
    throw new Error(`天空云纹加载失败：${url}。请检查本地图片资源是否完整。`);
  });
  source.colorSpace = THREE.SRGBColorSpace;
  source.wrapS = source.wrapT = THREE.MirroredRepeatWrapping;
  source.magFilter = source.minFilter = THREE.NearestFilter;
  source.generateMipmaps = false;

  const group = new THREE.Group();
  group.name = 'CloudSkyEnclosure';
  group.userData = { backgroundOnly: true, followsCamera: false, collider: false };

  const layout: Array<{ name: SkyFaceName; size: [number, number]; position: Triple; rotation: Triple; inwardNormal: Triple }> = [
    { name: 'north', size: [width, height], position: [x, y, minZ], rotation: [0, 0, 0], inwardNormal: [0, 0, 1] },
    { name: 'east', size: [depth, height], position: [maxX, y, z], rotation: [0, -Math.PI / 2, 0], inwardNormal: [-1, 0, 0] },
    { name: 'south', size: [width, height], position: [x, y, maxZ], rotation: [0, Math.PI, 0], inwardNormal: [0, 0, -1] },
    { name: 'west', size: [depth, height], position: [minX, y, z], rotation: [0, Math.PI / 2, 0], inwardNormal: [1, 0, 0] },
    { name: 'top', size: [width, depth], position: [x, config.topY, z], rotation: [Math.PI / 2, 0, 0], inwardNormal: [0, -1, 0] },
  ];

  const faces: SkyFaceReport[] = [];
  for (const face of layout) {
    const style = config.faces[face.name];
    // Clones share the original image but retain independent UV transforms.
    const texture = source.clone();
    texture.name = `CloudSky_${face.name}_originalImage`;
    texture.repeat.set(...style.repeat);
    texture.offset.set(...style.offset);
    texture.center.set(0, 0);
    texture.rotation = style.rotation;
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      name: `CloudSky_${face.name}_unlit`,
      map: texture,
      color: new THREE.Color(style.tint).multiplyScalar(style.intensity),
      side: THREE.FrontSide,
      fog: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...face.size), material);
    mesh.name = `CloudSky_${face.name}`;
    mesh.position.set(...face.position);
    mesh.rotation.set(...face.rotation);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData = { backgroundOnly: true, collider: false, inwardNormal: face.inwardNormal };
    group.add(mesh);
    faces.push({ ...face, uv: style, material: { type: 'MeshBasicMaterial', fog: false, toneMapped: false, side: 'FrontSide', castShadow: false, receiveShadow: false } });
  }

  const report: SkyEnclosureReport = {
    revision: config.revision,
    bounds: config.bounds,
    bottomY: config.bottomY,
    topY: config.topY,
    dimensions: config.dimensions,
    cameraFar: config.cameraFar,
    texture: {
      url,
      width: source.image.width,
      height: source.image.height,
      sourceSha256: config.texture.sourceSha256,
      tileMetres: config.texture.tileMetres,
      colourSpace: 'srgb',
      wrapping: 'MirroredRepeatWrapping',
      minFilter: 'NearestFilter',
      magFilter: 'NearestFilter',
      mipmaps: false,
    },
    faces,
    followsCamera: false,
    colliders: 0,
  };
  // The five materials keep their own clones; the unused loader texture can go.
  source.dispose();
  group.userData.skyReport = report;
  scene.add(group);
  return { group, report };
}
