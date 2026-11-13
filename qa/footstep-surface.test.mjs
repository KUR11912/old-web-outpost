import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const sourceRoot = new URL('../src/', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
    ? `${specifier}.ts` : specifier, context);
} });
const [{ footstepSurfaceAt }, { MAP }, environment] = await Promise.all([
  import('../src/footstep-surface.ts'), import('../src/map-config.ts'), import('../src/map-environment.ts'),
]);

test('original outpost pavement, connector and grass sides are distinguished', () => {
  for (const z of [-4.9, -4, -2, 0, 2, 4, 6, 8, 8.99]) {
    assert.equal(footstepSurfaceAt(0, z), 'stone', `original slab at z=${z}`);
    assert.equal(footstepSurfaceAt(-1.01, z), 'grass', `grass west of z=${z}`);
  }
  for (const x of [1, 1.5, 2, 2.99, 3, 4]) assert.equal(footstepSurfaceAt(x, -2), 'stone');
  assert.equal(footstepSurfaceAt(0, 9.01), 'grass');
  assert.equal(footstepSurfaceAt(0, -5.01), 'grass');
  assert.equal(footstepSurfaceAt(1.01, 4), 'grass');
  assert.equal(footstepSurfaceAt(2, -.99), 'grass');
});

test('road junctions are square and bridge approaches have no false end caps', () => {
  assert.equal(footstepSurfaceAt(14.49, -1.01), 'stone', 'outer square corner of junction');
  assert.equal(footstepSurfaceAt(14.51, -1.01), 'grass');
  assert.equal(footstepSurfaceAt(12.49, -3.01), 'grass', 'inside bend grass');
  for (const x of [33.99, 34, 34.01, 39, 43.99, 44, 44.01]) assert.equal(footstepSurfaceAt(x, -8), 'stone');
  assert.equal(footstepSurfaceAt(33.99, -9.5), 'grass');
  assert.equal(footstepSurfaceAt(34.01, -9.5), 'stone');
  assert.equal(footstepSurfaceAt(43.99, -9.5), 'stone');
  assert.equal(footstepSurfaceAt(44.01, -9.5), 'grass');
  assert.equal(footstepSurfaceAt(39, -10.01), 'grass');
  assert.equal(footstepSurfaceAt(39, -5.99), 'grass');
  assert.equal(footstepSurfaceAt(57, -35.99), 'stone');
  assert.equal(footstepSurfaceAt(57, -36.01), 'grass');
});

test('surface classification agrees with actual GLB pavement and production road geometry', async t => {
  // Only texture drawing/decoding is skipped; raycasts use the actual GLB meshes
  // and the production instancing code, independently of the surface rectangles.
  globalThis.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
  }) };
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'QA_skip_texture_decode', loadTexture: () => Promise.resolve(null) }));
  const load = async name => {
    const bytes = await readFile(new URL(`../public/assets/${name}.glb`, import.meta.url));
    return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  };
  const [tile, bridge] = await Promise.all([load('PathTile_01'), load(MAP.bridge.arcade.model)]);
  const tileSize = new THREE.Box3().setFromObject(tile).getSize(new THREE.Vector3());
  assert.ok(Math.abs(tileSize.x - 2) < 1e-5 && Math.abs(tileSize.z - 2) < 1e-5, 'original slab dimensions');
  const scene = new THREE.Scene(), colliders = [];
  environment.addMapStructures(scene, colliders, new THREE.Group(), new THREE.Group(), bridge);
  const names = ['PathTile_01', 'Tree_01', 'Rock_01', 'Grass_01'];
  const models = new Map(names.map(name => [name, name === 'PathTile_01' ? tile : new THREE.Group()]));
  environment.addMapAssetInstances(scene, models, names.map(name => ({ name, instances: 0 })), colliders);
  const originals = new THREE.Group();
  for (let z = 8; z >= -4; z -= 2) {
    const slab = tile.clone(true); slab.position.set(0, -.1, z); originals.add(slab);
  }
  const connector = tile.clone(true); connector.position.set(2, -.1, -2); connector.rotation.y = Math.PI / 2;
  originals.add(connector); scene.add(originals); scene.updateMatrixWorld(true);
  const surfaces = [originals, bridge, ...scene.children.filter(o => o.name === 'Road_extension')];
  const samples = [];
  const offsets = [-1.01, -.99, -.37, 0, .37, .99, 1.01];
  for (const road of MAP.roads) {
    for (const p of road.points) for (const dx of offsets) for (const dz of offsets) samples.push([p.x + dx, p.z + dz]);
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      for (let d = .3; d < length; d += 2.37) for (const side of offsets) {
        samples.push([a.x + dx * d / length - dz * side / length, a.z + dz * d / length + dx * side / length]);
      }
    }
  }
  for (const x of [33.99, 34.01, 35, 39, 43, 43.99, 44.01]) {
    for (const z of [-9.91, -9.89, -9.5, -8, -6.5, -6.11, -6.09]) samples.push([x, z]);
  }
  for (const x of [-1.01, -.99, 0, .99, 1.01]) for (const z of [-5.01, -4.99, -2, 0, 4, 8.99, 9.01]) samples.push([x, z]);
  for (const [x, z] of samples) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 1.65, z), new THREE.Vector3(0, -1, 0), 0, 2);
    const visible = ray.intersectObjects(surfaces, true).length > 0 ? 'stone' : 'grass';
    assert.equal(footstepSurfaceAt(x, z), visible, `rendered ground at (${x},${z})`);
  }
  t.diagnostic(`${samples.length} positions checked against real road and bridge meshes`);
});
