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
  station('old-terminal', '旧终端', -3.4, 4.5, .805 + .48, .122, .51, .41),
  station('chat-viewer', '聊天记录查看器', 0, 3.9, 1.30, .369, .48, .40),
  station('image-cache', '图片缓存终端', 2.8, 4.2, 1.18, .392, .51, .44),
  station('archive-desk', '整理线索', 5, 7.5, 1.14, .261, .80, .46),
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
  if (!ctx) throw new Error('无法创建档案馆屏幕纹理。');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function screen(parent: THREE.Object3D, texture: THREE.Texture, width: number, height: number, y: number, z: number) {
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
  face.position.set(0, y, z);
  parent.add(face);
}

function displayTexture(kind: string) {
  return pixels((ctx) => {
    ctx.fillStyle = kind === 'old-terminal' ? '#183c33' : '#d5dccc';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#244d77'; ctx.fillRect(0, 0, 128, 17);
    ctx.fillStyle = '#f1efdc'; ctx.font = 'bold 10px monospace';
    ctx.fillText(kind === 'old-terminal' ? 'WEB / TERMINAL' : kind === 'chat-viewer' ? 'CHAT / LOG' : kind === 'image-cache' ? 'IMAGE / CACHE' : 'CLUE / DESK', 5, 12);
    if (kind === 'old-terminal') {
      ctx.fillStyle = '#b5d79b'; ctx.font = '11px monospace';
      ['ARCHIVE_LOCAL', '> OPEN LOG', '> READ TEXT', '> _'].forEach((line, index) => ctx.fillText(line, 9, 35 + index * 23));
      ctx.fillStyle = '#709778'; ctx.fillRect(9, 107, 84, 2);
    } else if (kind === 'chat-viewer') {
      for (let row = 0; row < 3; row++) {
        const x = row % 2 ? 35 : 8;
        ctx.fillStyle = row % 2 ? '#a4bf9b' : '#f6f1d9';
        ctx.fillRect(x, 26 + row * 31, 84, 24);
        ctx.fillStyle = '#64777a';
        ctx.fillRect(x + 7, 33 + row * 31, 60, 3);
        ctx.fillRect(x + 7, 41 + row * 31, 40, 3);
      }
    } else {
      const palette = ['#91afbd', '#789b6e', '#c6b67a', '#a8b4c6'];
      for (let i = 0; i < 4; i++) {
        const x = 9 + (i % 2) * 57, y = 27 + Math.floor(i / 2) * 47;
        ctx.fillStyle = '#f8f2de'; ctx.fillRect(x, y, 48, 40);
        ctx.fillStyle = palette[i]; ctx.fillRect(x + 4, y + 4, 40, 25);
        ctx.fillStyle = '#707c72'; ctx.fillRect(x + 4, y + 33, 28, 2);
      }
    }
  });
}

/** Added after seeded scenery. Sign boards intentionally remain outside raycast targets. */
export function addArchiveObjects(scene: THREE.Scene, colliders: Collider[], terminalModel: THREE.Group): SceneInteractable[] {
  const shell = color('#c8c7b4'), edge = color('#969d90'), dark = color('#3b5261');
  const wood = color('#9d9270'), legs = color('#686e61'), paper = color('#eae7ce');
  return ARCHIVE_OBJECTS.map((config) => {
    const object = new THREE.Group();
    object.name = `${config.id}_interactable`;
    object.position.set(config.position.x, 0, config.position.z);
    scene.add(object);

    if (config.id === 'old-terminal') {
      box(object, [1, .09, .78], [0, .76, 0], wood);
      for (const x of [-.40, .40]) for (const z of [-.28, .28]) box(object, [.08, .72, .08], [x, .36, z], legs);
      // Blender model origin is the desk-level bottom centre; glTF front is +Z.
      // Keep the original table and target group so IDs, collision and saves stay stable.
      const computer = terminalModel.clone(true);
      computer.name = 'OldTerminal_CRT_01_instance';
      computer.position.set(0, .805, 0);
      object.add(computer);
    } else if (config.id === 'chat-viewer') {
      box(object, [.82, .10, .72], [0, .05, 0], edge);
      box(object, [.52, .84, .40], [0, .51, 0], shell);
      box(object, [.92, .76, .40], [0, 1.27, .15], shell);
      box(object, [.82, .65, .03], [0, 1.30, .351], dark);
      screen(object, displayTexture(config.id), .72, .56, 1.30, .369);
      box(object, [.50, .06, .16], [0, .87, .25], dark);
    } else if (config.id === 'image-cache') {
      box(object, [1, .10, .80], [0, .05, 0], edge);
      box(object, [.94, 1.39, .72], [0, .785, 0], shell);
      box(object, [.76, .55, .04], [0, 1.18, .37], dark);
      screen(object, displayTexture(config.id), .66, .45, 1.18, .392);
      for (const y of [.36, .65]) {
        box(object, [.78, .23, .03], [0, y, .375], edge);
        box(object, [.24, .035, .055], [0, y + .025, .40], dark);
      }
    } else {
      box(object, [1.56, .10, .88], [0, .80, 0], wood);
      for (const x of [-.65, .65]) for (const z of [-.32, .32]) box(object, [.09, .75, .09], [x, .375, z], legs);
      box(object, [.89, .56, .07], [0, 1.14, .22], dark);
      screen(object, displayTexture(config.id), .79, .46, 1.14, .261);
      box(object, [.25, .025, .32], [-.55, .865, .08], paper);
      box(object, [.23, .025, .30], [.55, .865, -.02], paper);
    }

    const nameTexture = pixels((ctx) => {
      ctx.fillStyle = '#244d67'; ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = '#d4d1b3'; ctx.strokeRect(1, 1, 126, 30);
      ctx.fillStyle = '#faf1d3'; ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif'; ctx.fillText(config.name, 64, 21);
    }, 32);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .31), new THREE.MeshBasicMaterial({ map: nameTexture, side: THREE.DoubleSide }));
    label.name = `${config.id}_label`;
    label.position.set(config.position.x, 1.89, config.position.z + .05);
    scene.add(label);
    colliders.push({ kind: 'box', x: config.position.x, z: config.position.z, halfX: config.halfX, halfZ: config.halfZ, label: config.name });
    return { id: config.id, name: config.name, object, aim: { ...config.aim }, approach: { ...config.approach } };
  });
}
