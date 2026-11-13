import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Node's native TS support needs an extension for Vite's local module imports.
const sourceRoot = new URL('../src/', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
} });
const [{ MAP }, { resolveMovement, PLAYER_RADIUS, PLAYER_HEIGHT }, environment] = await Promise.all([
  import('../src/map-config.ts'), import('../src/player.ts'), import('../src/map-environment.ts'),
]);

// Drawing pixels is irrelevant to collision/geometry QA. Everything else uses
// production Three.js geometry, production scene generation and movement code.
globalThis.document = { createElement(tag) {
  assert.equal(tag, 'canvas');
  return { width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) };
} };
const loader = new GLTFLoader();
loader.register(() => ({ name: 'QA_skip_texture_decode', loadTexture: () => Promise.resolve(null) }));
async function loadModel(name) {
  const bytes = await readFile(new URL(`../public/assets/${name}.glb`, import.meta.url));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
const scene = new THREE.Scene();
const colliders = [];
const bridgeModel = await loadModel(MAP.bridge.arcade.model);
environment.addMapStructures(scene, colliders, new THREE.Group(), new THREE.Group(), bridgeModel);
const assets = ['Tree_01', 'Rock_01', 'Grass_01', 'PathTile_01'];
const models = new Map(await Promise.all(assets.map(async name => [name, await loadModel(name)])));
const reports = assets.map(name => ({ name, instances: 0 }));
environment.addMapAssetInstances(scene, models, reports, colliders);
scene.updateMatrixWorld(true);
const bridge = MAP.bridge;
const columns = colliders.filter(c => c.label === '拱廊桥石柱');
const curbs = colliders.filter(c => c.label === '拱廊桥石缘');
const west = { x: bridge.x - bridge.length / 2, z: bridge.z };
const east = { x: bridge.x + bridge.length / 2, z: bridge.z };
const move = (from, to) => resolveMovement(from, { x: to.x - from.x, z: to.z - from.z }, colliders, MAP.bounds);
const close = (actual, expected, message, epsilon = 1e-4) => assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} vs ${expected}`);
function isClear(p) {
  return colliders.every(c => {
    const gap = c.kind === 'circle'
      ? Math.hypot(p.x - c.x, p.z - c.z) - c.radius
      : Math.hypot(Math.max(0, Math.abs(p.x - c.x) - c.halfX), Math.max(0, Math.abs(p.z - c.z) - c.halfZ));
    return gap >= PLAYER_RADIUS - .00011;
  });
}
function meshesMatching(pattern) {
  const result = [];
  bridgeModel.traverse(object => {
    if (object.isMesh && pattern.test(object.name)) result.push({ object, box: new THREE.Box3().setFromObject(object) });
  });
  return result;
}

test('actual bridge has eight separate columns, two edges and no old rail or solid deck obstacles', () => {
  assert.equal(columns.length, 8);
  assert.equal(curbs.length, 2);
  assert.equal(colliders.filter(c => c.label === '桥栏').length, 0);
  assert.equal(scene.getObjectByName('Bridge_railings'), undefined);
  assert.equal(scene.getObjectByName('Bridge_flush_walkable_deck'), undefined);
  assert.equal(bridge.crossingOpen, true);
  // The long move fails if any accidental whole-bridge collider is introduced.
  const across = move(west, east);
  assert.equal(across.collided, false);
  close(across.x, east.x, 'west-to-east endpoint');
  const back = move(across, west);
  assert.equal(back.collided, false);
  close(back.x, west.x, 'east-to-west endpoint');
});

test('the full two-metre road centre corridor is walkable in both directions', () => {
  for (const z of [bridge.z - 1, bridge.z, bridge.z + 1]) {
    for (const [from, to] of [[west, east], [east, west]]) {
      const result = move({ ...from, z }, { ...to, z });
      assert.equal(result.collided, false, `blocked at z=${z}`);
      close(result.x, to.x, 'offset route endpoint');
      close(result.z, z, 'offset route remains straight');
    }
  }
});

test('sideways approaches stop at all eight actual column bases without tunnelling', () => {
  for (const column of columns) {
    const side = Math.sign(column.z - bridge.z);
    const result = move({ x: column.x, z: bridge.z }, { x: column.x, z: column.z + side * 2 });
    assert.equal(result.collided, true);
    close(result.z, column.z - side * (column.halfZ + PLAYER_RADIUS), 'column contact', .0002);
    assert.ok(isClear(result), 'column contact must remain outside every obstacle');
    const onward = move(result, { x: column.x, z: bridge.z });
    close(onward.z, bridge.z, 'player can leave the column');
  }
});

test('stone edges stop side exits on land; original water boundary stops side exits over the river', () => {
  for (const x of [west.x + .1, bridge.x, east.x - .1]) {
    for (const side of [-1, 1]) {
      const result = move({ x, z: bridge.z }, { x, z: bridge.z + side * 4 });
      assert.equal(result.collided, true);
      assert.ok(isClear(result));
      assert.ok(Math.abs(result.z - bridge.z) < bridge.width / 2 - PLAYER_RADIUS);
      const returnToPath = move(result, { x, z: bridge.z });
      close(returnToPath.z, bridge.z, 'player can leave edge');
    }
  }
  for (const z of [bridge.z - 6, bridge.z + 6]) {
    for (const [from, to] of [[west, east], [east, west]]) {
      const blocked = move({ ...from, z }, { ...to, z });
      assert.ok(blocked.collided && Math.abs(blocked.x - from.x) < 2, 'crossing outside bridge stays blocked');
    }
  }
});

test('old saved poses embedded in any new pillar recover and can reach the middle corridor', () => {
  for (const column of columns) {
    for (const dx of [-.2, 0, .2]) for (const dz of [-.2, 0, .2]) {
      const saved = { x: column.x + dx, z: column.z + dz };
      const recovered = resolveMovement(saved, { x: 0, z: 0 }, colliders, MAP.bounds);
      assert.equal(recovered.collided, true);
      assert.ok(isClear(recovered), `saved pose is stuck: ${JSON.stringify({ saved, recovered })}`);
      const resetAgain = resolveMovement(recovered, { x: 0, z: 0 }, colliders, MAP.bounds);
      close(resetAgain.x, recovered.x, 'restoration stable x');
      close(resetAgain.z, recovered.z, 'restoration stable z');
      let inward = move(recovered, { x: recovered.x, z: bridge.z });
      if (Math.abs(inward.z - bridge.z) > .001) {
        // An old pose on the outward side of an end pillar can validly recover
        // onto the bank beyond the curb. Walk around that nearby bridge end.
        const side = recovered.x < bridge.x ? -1 : 1;
        const outsideX = bridge.x + side * (bridge.length / 2 + PLAYER_RADIUS + .1);
        const around = move(recovered, { x: outsideX, z: recovered.z });
        close(around.x, outsideX, 'restored player can walk around bridge end');
        inward = move(around, { x: outsideX, z: bridge.z });
        close(inward.z, bridge.z, 'restored player can rejoin approach road');
        inward = move(inward, { x: bridge.x, z: bridge.z });
      }
      close(inward.z, bridge.z, 'restored player reaches central corridor');
    }
  }
});

test('actual GLB column bases and stone edges match their boxes; arches clear player height', t => {
  const bases = meshesMatching(/Column_.*Square_Base/);
  assert.equal(bases.length, columns.length);
  const edges = meshesMatching(/Low_Stone_Edge/);
  assert.equal(edges.length, curbs.length);
  for (const { object, box } of [...bases, ...edges]) {
    const center = box.getCenter(new THREE.Vector3());
    const collider = [...columns, ...curbs].find(c => Math.abs(c.x - center.x) < .001 && Math.abs(c.z - center.z) < .001);
    assert.ok(collider, `no matching collider for ${object.name}`);
    close(box.min.x, collider.x - collider.halfX, `${object.name} minX`);
    close(box.max.x, collider.x + collider.halfX, `${object.name} maxX`);
    close(box.min.z, collider.z - collider.halfZ, `${object.name} minZ`);
    close(box.max.z, collider.z + collider.halfZ, `${object.name} maxZ`);
  }
  const overhead = meshesMatching(/Arch|Capital/);
  assert.ok(overhead.length > 0, 'GLB contains overhead arch geometry');
  const lowest = Math.min(...overhead.map(({ box }) => box.min.y));
  assert.ok(lowest > PLAYER_HEIGHT + .35, `overhead clearance is too low: ${lowest}`);
  const lowestArch = Math.min(...meshesMatching(/Arch/).map(({ box }) => box.min.y));
  t.diagnostic(`Lowest capital/arch: ${lowest.toFixed(3)}m; lowest arch: ${lowestArch.toFixed(3)}m; player eye: ${PLAYER_HEIGHT}m`);
  for (const dx of bridge.arcade.columnOffsetsX) {
    const up = new THREE.Raycaster(new THREE.Vector3(bridge.x + dx, PLAYER_HEIGHT, bridge.z), new THREE.Vector3(0, 1, 0));
    const arch = up.intersectObject(bridgeModel, true)[0];
    assert.ok(arch && /Arch/.test(arch.object.name), 'crossing arch exists over each column pair');
    assert.ok(arch.point.y > PLAYER_HEIGHT + .35);
  }
  for (let i = 1; i < bridge.arcade.columnOffsetsX.length; i++) {
    const x = bridge.x + (bridge.arcade.columnOffsetsX[i - 1] + bridge.arcade.columnOffsetsX[i]) / 2;
    const up = new THREE.Raycaster(new THREE.Vector3(x, PLAYER_HEIGHT, bridge.z), new THREE.Vector3(0, 1, 0));
    assert.equal(up.intersectObject(bridgeModel, true).length, 0, 'bay stays open to the sky without a solid roof');
  }
});

test('road approach joints meet the real bridge deck, with no nearby trees or residual scene mesh', () => {
  assert.deepEqual(MAP.roads.find(r => r.id === 'west-bridge').points.at(-1), west);
  assert.deepEqual(MAP.roads.find(r => r.id === 'east-lighthouse').points[0], east);
  const bridgeBounds = new THREE.Box3().setFromObject(bridgeModel);
  close(bridgeBounds.min.x, west.x, 'physical west bridge endpoint');
  close(bridgeBounds.max.x, east.x, 'physical east bridge endpoint');
  for (const endpoint of [west, east]) {
    const down = new THREE.Raycaster(new THREE.Vector3(endpoint.x, PLAYER_HEIGHT, endpoint.z), new THREE.Vector3(0, -1, 0));
    const contacts = down.intersectObjects(scene.children, true);
    assert.ok(contacts.length, 'no road or bridge surface at the join');
    close(contacts[0].point.y, MAP.roadTop, 'actual visible surface at road join');
    for (const tree of colliders.filter(c => c.label === '树干')) {
      assert.ok(Math.hypot(tree.x - endpoint.x, tree.z - endpoint.z) > tree.radius + 2, 'tree overlaps bridge entrance');
    }
    const approach = { x: endpoint.x + (endpoint.x < bridge.x ? -3 : 3), z: endpoint.z };
    assert.equal(move(approach, endpoint).collided, false, 'road-to-bridge approach is clear');
  }
});
