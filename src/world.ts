import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAP, type MapBounds } from './map-config';
import { makeExpandedTerrain, addMapStructures, addMapAssetInstances } from './map-environment';
import { addArchiveObjects, type SceneInteractable } from './archive-scene';
import { createPickupObjects, type PickupObjects } from './pickups';
import { createSkyEnclosure } from './sky-enclosure';

/** Ground-plane colliders, in metres. Foliage intentionally has no collider. */
export interface Collider {
  kind: 'circle' | 'box';
  x: number;
  z: number;
  radius?: number;
  halfX?: number;
  halfZ?: number;
  label: string;
}

export interface AssetEntry {
  name: string;
  url: string;
  meshes: number;
  triangles: number;
  texturedMaterials: number;
  alphaCutoutMaterials: number;
  dimensions: { x: number; y: number; z: number };
  instances: number;
  nodeNames?: string[];
  materialDetails?: Array<{
    name: string;
    type: string;
    roughness: number;
    metalness: number;
    map: { width: number; height: number } | null;
    emissiveMap: { width: number; height: number } | null;
    transparent?: boolean;
    opacity?: number;
    emissive?: string;
    emissiveIntensity?: number;
  }>;
}

const WORLD_SEED = MAP.preserved.seed;

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function material(color: THREE.ColorRepresentation) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function box(parent: THREE.Object3D, size: number[], position: number[], mat: THREE.Material) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  object.position.set(position[0], position[1], position[2]);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器无法创建场景标牌纹理。');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function addOutpost(scene: THREE.Scene, colliders: Collider[], building: THREE.Group) {
  const site=MAP.locations.outpost.position;
  const offset={x:site.x,z:site.z+7.5};
  // Blender export: metres, bottom-centre origin, front +Z after glTF conversion.
  building.name = 'Outpost_01_instance';
  building.position.set(MAP.locations.outpost.position.x, 0, MAP.locations.outpost.position.z);
  scene.add(building);
  const trim = material('#6d7254');
  const timber = material('#71644b');

  // Keep Chinese text editable in the existing canvas pipeline. The small plaque
  // fits between the double doors and the lowest row of windows.
  const signTexture = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#244a67'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#d5d3bb'; ctx.lineWidth = 5; ctx.strokeRect(7, 7, 498, 114);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f2edda';
    ctx.font = 'bold 70px "Microsoft YaHei", sans-serif';
    ctx.fillText('旧 网 驿 站', 256, 91);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.20), new THREE.MeshBasicMaterial({ map: signTexture }));
  sign.name = 'Outpost_editable_nameplate';
  sign.position.set(offset.x, 1.82, -4.88+offset.z);
  scene.add(sign);
  colliders.push({ kind: 'box', x: site.x, z: site.z, halfX: 2.85, halfZ: 2.55, label: '驿站外墙' });
  // The roof overhang is above head-height; only the side ladder needs added
  // ground-plane clearance. Players can still pass around either side.
  colliders.push({ kind: 'box', x: site.x-2.97, z: site.z, halfX: 0.22, halfZ: 1.1, label: '驿站侧梯' });

  // A simple bench reinforces that this is a small outdoor stop, not an interior.
  const bench = new THREE.Group();
  bench.position.set(offset.x,0,offset.z);
  box(bench, [1.9, 0.12, 0.55], [4.1, 0.56, -5.4], timber);
  box(bench, [1.9, 0.49, 0.12], [4.1, 0.99, -5.62], timber);
  box(bench, [0.16, 0.5, 0.43], [3.43, 0.25, -5.4], trim);
  box(bench, [0.16, 0.5, 0.43], [4.77, 0.25, -5.4], trim);
  scene.add(bench);
  colliders.push({ kind: 'box', x: 4.1+offset.x, z: -5.4+offset.z, halfX: 0.98, halfZ: 0.35, label: '长椅' });
}

function addMailbox(scene: THREE.Scene, colliders: Collider[]) {
  const mailbox = new THREE.Group();
  mailbox.name = 'Mailbox_interactable';
  mailbox.position.set(MAP.mailbox.x, 0, MAP.mailbox.z);
  const post = material('#75684c');
  const red = material('#bf4d3e');
  box(mailbox, [0.14, 1.0, 0.14], [0, 0.5, 0], post);
  box(mailbox, [0.72, 0.62, 0.48], [0, 1.25, 0], red);
  box(mailbox, [0.8, 0.08, 0.57], [0, 1.58, 0], material('#913d34'));
  box(mailbox, [0.45, 0.035, 0.025], [0, 1.43, 0.251], material('#382e2c'));
  box(mailbox, [0.035, 0.38, 0.035], [0.43, 1.5, 0.02], material('#e1b65a'));
  box(mailbox, [0.19, 0.13, 0.035], [0.51, 1.65, 0.02], material('#e1b65a'));
  const envelopeTexture = canvasTexture(128, 64, (ctx) => {
    ctx.fillStyle = '#bf4d3e'; ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#f5e8c9'; ctx.lineWidth = 4;
    ctx.strokeRect(31, 9, 66, 44);
    ctx.beginPath(); ctx.moveTo(32, 10); ctx.lineTo(64, 34); ctx.lineTo(96, 10); ctx.stroke();
  });
  const envelope = new THREE.Mesh(new THREE.PlaneGeometry(0.61, 0.305), new THREE.MeshBasicMaterial({ map: envelopeTexture }));
  envelope.position.set(0, 1.16, 0.245);
  mailbox.add(envelope);
  const plinth = box(mailbox, [0.58, 0.08, 0.58], [0, 0.04, 0], material('#9a9884'));
  plinth.name = 'Mailbox_foot';
  scene.add(mailbox);
  colliders.push({ kind: 'box', x: MAP.mailbox.x, z: MAP.mailbox.z, halfX: 0.4, halfZ: 0.31, label: '邮箱' });
  return mailbox;
}

function describeAsset(name: string, url: string, group: THREE.Group): AssetEntry {
  const entry: AssetEntry = {
    name, url, meshes: 0, triangles: 0, texturedMaterials: 0, alphaCutoutMaterials: 0,
    dimensions: { x: 0, y: 0, z: 0 }, instances: 0,
  };
  const materials = new Set<THREE.Material>();
  if (name === 'OldTerminal_CRT_01' || name === 'Lighthouse_01' || name === 'ArcadeBridge_01') entry.materialDetails = [];
  if (name === 'Lighthouse_01' || name === 'ArcadeBridge_01') entry.nodeNames = [];
  const textureSize = (texture: THREE.Texture | null) => {
    const image = texture?.image as { width: number; height: number } | undefined;
    return image ? { width: Number(image.width), height: Number(image.height) } : null;
  };
  group.traverse((object) => {
    if (object.name) entry.nodeNames?.push(object.name);
    if (!(object instanceof THREE.Mesh)) return;
    entry.meshes++;
    const geometry = object.geometry as THREE.BufferGeometry;
    entry.triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((mat: THREE.MeshStandardMaterial) => {
      // Preserve the CRT's authored plastic, opaque glass and smooth bevels.
      // The five established environment assets retain their existing treatment.
      if (name !== 'OldTerminal_CRT_01' && name !== 'Lighthouse_01') {
        mat.roughness = name === 'Archive_01' ? .94 : 1;
        mat.metalness = 0;
        mat.flatShading = true;
      } else {
        if (name === 'OldTerminal_CRT_01') {
          mat.transparent = false;
          mat.depthWrite = true;
        }
        for (const texture of [mat.emissiveMap, mat.roughnessMap, mat.metalnessMap, mat.normalMap]) {
          if (!texture) continue;
          texture.magFilter = texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;
        }
      }
      if (mat.map) {
        mat.map.magFilter = THREE.NearestFilter;
        mat.map.minFilter = THREE.NearestFilter;
        mat.map.generateMipmaps = false;
        mat.map.needsUpdate = true;
      }
      if (name !== 'Lighthouse_01' && (mat.alphaTest > 0 || /leaves|grass/i.test(mat.name))) {
        mat.alphaTest = 0.5;
        mat.transparent = false;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      }
      mat.needsUpdate = true;
      if (!materials.has(mat)) {
        if (mat.map) entry.texturedMaterials++;
        if (mat.alphaTest > 0) entry.alphaCutoutMaterials++;
        entry.materialDetails?.push({
          name: mat.name, type: mat.type, roughness: mat.roughness, metalness: mat.metalness,
          map: textureSize(mat.map), emissiveMap: textureSize(mat.emissiveMap),
          ...(name === 'Lighthouse_01' ? {
            transparent: mat.transparent, opacity: mat.opacity,
            emissive: mat.emissive?.getHexString(), emissiveIntensity: mat.emissiveIntensity,
          } : {}),
        });
        materials.add(mat);
      }
    });
    // Transparent lantern glass must not cast an opaque block over its lamp core.
    object.castShadow = name !== 'Grass_01' && !(name === 'Lighthouse_01' && meshMaterials.some(mat => mat.transparent));
    object.receiveShadow = true;
  });
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(group).getSize(size);
  entry.dimensions = { x: size.x, y: size.y, z: size.z };
  if (entry.meshes === 0 || entry.texturedMaterials === 0) throw new Error(`${name}.glb 未包含有效网格或贴图，请重新复制原始资产。`);
  return entry;
}

export async function createWorld(
  scene: THREE.Scene,
  onProgress: (loaded: number, total: number, name: string) => void,
): Promise<{
  colliders: Collider[];
  mailbox: THREE.Object3D;
  mailboxTarget: THREE.Vector3;
  spawn: THREE.Vector3;
  bounds: MapBounds;
  assetReport: AssetEntry[];
  interactables: SceneInteractable[];
  pickups: PickupObjects;
  sky: Awaited<ReturnType<typeof createSkyEnclosure>>;
  bridge: THREE.Group;
}> {
  scene.background = new THREE.Color('#8fcbe4');
  scene.fog = new THREE.Fog('#b3d6dc', 35, 115);
  const hemisphere = new THREE.HemisphereLight('#e6f4ff', '#687b41', 2.0);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff1cf', 2.3);
  sun.position.set(-4, 55, 9);
  sun.target.position.set(26,0,-21);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -61;
  sun.shadow.camera.right = sun.shadow.camera.top = 61;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 150;
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  makeExpandedTerrain(scene);
  const colliders: Collider[] = [];

  const names = ['Tree_01', 'Rock_01', 'Grass_01', 'PathTile_01', 'Outpost_01', 'OldTerminal_CRT_01', 'Archive_01', 'Lighthouse_01', 'MemeFolder_01', 'ArcadeBridge_01'] as const;
  const loader = new GLTFLoader();
  const models = new Map<string, THREE.Group>();
  const assetReport: AssetEntry[] = [];
  let loaded = 0;
  await Promise.all(names.map(async (name) => {
    const url = `${import.meta.env.BASE_URL}assets/${name}.glb`;
    try {
      const gltf = await loader.loadAsync(url);
      const report = describeAsset(name, url, gltf.scene);
      models.set(name, gltf.scene);
      assetReport.push(report);
      onProgress(++loaded, names.length, name);
    } catch (error) {
      throw new Error(`资源加载失败：${name}.glb。请确认 public/assets 中的文件完整，并通过本地服务器打开。${error instanceof Error ? `（${error.message}）` : ''}`);
    }
  }));
  const sky = await createSkyEnclosure(scene);

  addOutpost(scene, colliders, models.get('Outpost_01')!);
  assetReport.find((entry) => entry.name === 'Outpost_01')!.instances = 1;
  const mailbox = addMailbox(scene, colliders);

  const plant = (name: string, x: number, z: number, scale = 1, rotation = 0, y = 0) => {
    const model = models.get(name)!.clone(true);
    model.name = `${name}_instance`;
    model.position.set(x, y, z);
    model.scale.setScalar(scale);
    model.rotation.y = rotation;
    scene.add(model);
    assetReport.find((entry) => entry.name === name)!.instances++;
    return model;
  };
  const random = seededRandom(WORLD_SEED);
  const trees = MAP.preserved.trees;
  for (const [x, z, scale] of trees) {
    plant('Tree_01', x, z, scale, random() * Math.PI * 2);
    colliders.push({ kind: 'circle', x, z, radius: 0.48 * scale, label: '树干' });
  }
  const rocks = MAP.preserved.rocks;
  for (const [x, z, scale] of rocks) {
    plant('Rock_01', x, z, scale, random() * Math.PI * 2);
    colliders.push({ kind: 'circle', x, z, radius: 0.64 * scale, label: '石头' });
  }
  for (let i = 0; i < 110; i++) {
    const x = (random() * 2 - 1) * 12.8;
    const z = (random() * 2 - 1) * 12.8;
    if ((Math.abs(x) < 2.5 && z > -5.1) || (Math.abs(x) < 3.5 && z < -4.3) || (x > 2.8 && x < 5.3 && z < -4.5 && z > -6.2)) continue;
    plant('Grass_01', x, z, 0.65 + random() * 0.55, random() * Math.PI * 2);
  }
  for (let z = 8; z >= -4; z -= 2) {
    // The 12 cm original slab is placed 10 cm below grade: only a walkable lip shows.
    const tile = plant('PathTile_01', 0, z, 1, 0, -0.10);
    tile.name = `Path_at_${z}`;
  }
  plant('PathTile_01', 2, -2, 1, Math.PI / 2, -0.10);
  addMapStructures(scene, colliders, models.get('Archive_01')!, models.get('Lighthouse_01')!, models.get('ArcadeBridge_01')!);
  assetReport.find((entry) => entry.name === 'ArcadeBridge_01')!.instances = 1;
  assetReport.find((entry) => entry.name === 'Archive_01')!.instances = 1;
  assetReport.find((entry) => entry.name === 'Lighthouse_01')!.instances = 1;
  addMapAssetInstances(scene, models, assetReport, colliders);
  const interactables: SceneInteractable[] = [
    { id: 'mailbox', name: '旧邮箱', object: mailbox,
      aim: { x: MAP.mailbox.x, y: 1.25, z: MAP.mailbox.z + .245 },
      approach: { x: MAP.mailbox.x, z: MAP.mailbox.z + 1.8 } },
    ...addArchiveObjects(scene, colliders, models.get('OldTerminal_CRT_01')!),
  ];
  assetReport.find((entry) => entry.name === 'OldTerminal_CRT_01')!.instances = 1;
  const pickups = createPickupObjects(scene, models.get('MemeFolder_01')!);
  assetReport.find((entry) => entry.name === 'MemeFolder_01')!.instances = pickups.length;
  return {
    colliders, mailbox, interactables, pickups, sky, bridge:models.get('ArcadeBridge_01')!, mailboxTarget: new THREE.Vector3(MAP.mailbox.x, 1.25, MAP.mailbox.z+.26),
    spawn: new THREE.Vector3(MAP.spawn.x, 1.65, MAP.spawn.z), bounds: MAP.bounds,
    assetReport: names.map((name) => assetReport.find((entry) => entry.name === name)!),
  };
}
