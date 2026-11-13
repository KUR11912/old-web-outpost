import * as THREE from 'three';
import { MAP } from './map-config';
import type { Collider } from './world';

export interface SceneInteractable {
  id: string;
  name: string;
  object: THREE.Object3D;
  aim: { x: number; y: number; z: number };
  approach: { x: number; z: number };
}

// Metres; all screens face +Z. Offsets follow the shared archive location.
// No random placement: adding investigation props must preserve existing trees.
const site = MAP.locations.archive.position;
const station = (id: string, name: string, dx: number, dz: number, aimY: number, front: number, halfX: number, halfZ: number) => ({
  id, name, position: { x: site.x + dx, z: site.z + dz },
  aim: { x: site.x + dx, y: aimY, z: site.z + dz + front },
  approach: { x: site.x + dx, z: site.z + dz + 1.8 },
  halfX, halfZ,
});

export const ARCHIVE_OBJECTS = [
  station('old-terminal', 'Old Terminal', -3.4, 4.5, .805 + .48, .122, .51, .41),
] as const;

function color(value: string) {
  return new THREE.MeshLambertMaterial({ color: value, flatShading: true });
}

function box(parent: THREE.Object3D, size: number[], at: number[], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(at[0], at[1], at[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pixels(draw: (ctx: CanvasRenderingContext2D) => void, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the archive screen texture.');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Added after seeded scenery. Sign boards intentionally remain outside raycast targets. */
export function addArchiveObjects(scene: THREE.Scene, colliders: Collider[], terminalModel: THREE.Group): SceneInteractable[] {
  const wood = color('#9d9270'), legs = color('#686e61');
  return ARCHIVE_OBJECTS.map((config) => {
    const object = new THREE.Group();
    object.name = `${config.id}_interactable`;
    object.position.set(config.position.x, 0, config.position.z);
    scene.add(object);

    box(object, [1, .09, .78], [0, .76, 0], wood);
    for (const x of [-.40, .40]) for (const z of [-.28, .28]) box(object, [.08, .72, .08], [x, .36, z], legs);
    // Blender model origin is the desk-level bottom centre; glTF front is +Z.
    // Keep the original table and target group so IDs, collision and saves stay stable.
    const computer = terminalModel.clone(true);
    computer.name = 'OldTerminal_CRT_01_instance';
    computer.position.set(0, .805, 0);
    object.add(computer);

    const nameTexture = pixels((ctx) => {
      ctx.fillStyle = '#244d67'; ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = '#d4d1b3'; ctx.strokeRect(1, 1, 126, 30);
      ctx.fillStyle = '#faf1d3'; ctx.textAlign = 'center';
      ctx.font = 'bold 13px Arial, sans-serif'; ctx.fillText(config.name, 64, 21, 118);
    }, 32);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .31), new THREE.MeshBasicMaterial({ map: nameTexture, side: THREE.DoubleSide }));
    label.name = `${config.id}_label`;
    label.position.set(config.position.x, 1.89, config.position.z + .05);
    scene.add(label);
    colliders.push({ kind: 'box', x: config.position.x, z: config.position.z, halfX: config.halfX, halfZ: config.halfZ, label: config.name });
    return { id: config.id, name: config.name, object, aim: { ...config.aim }, approach: { ...config.approach } };
  });
}
