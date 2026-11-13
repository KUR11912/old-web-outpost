import * as THREE from 'three';

// A separate seed is essential: terrain placement consumes its own RNG stream.
const TILE_WIDTH = 512;
const TILE_HEIGHT = 256;
const COLUMNS = 8;
const GUTTER = 4;
const ERROR_LINES = [
  'MEMORY NOT FOUND  0x07F', 'CONTEXT LOST / TERRAIN',
  'PAGE_FAULT  0x0000A7', 'BUFFER ... READ FAILED',
  'SYS / MAP_DATA ...', 'RETRY 0x03 ... NULL',
];

function randomForMountain(index: number) {
  let seed = (0x4d46544c ^ Math.imul(index + 1, 2654435761)) >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function paintFault(ctx: CanvasRenderingContext2D, random: () => number,
  x: number, y: number, width: number, height: number) {
  // Broken rock-like lobes, with a few stair-stepped tears rather than a frame.
  const edge = new Path2D();
  const points = 22;
  for (let i = 0; i < points; i++) {
    const angle = i / points * Math.PI * 2;
    const radius = .64 + random() * .4;
    const px = Math.round((x + Math.cos(angle) * width * .5 * radius) / 2) * 2;
    const py = Math.round((y + Math.sin(angle) * height * .5 * radius) / 2) * 2;
    if (i === 0) edge.moveTo(px, py);
    else edge.lineTo(px, py);
    if (i % 3 === 0) edge.lineTo(px + 2 + Math.floor(random() * 3), py);
  }
  edge.closePath();
  ctx.save();
  ctx.clip(edge);
  ctx.fillStyle = '#122be0';
  ctx.fillRect(x - width, y - height, width * 2, height * 2);

  // Tiny missing runs interrupt both the blue surface and the clipped log.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(Math.round(x - width * .4 + random() * width * .8),
      Math.round(y - height * .4 + random() * height * .8), 2 + Math.floor(random() * 9), 1 + Math.floor(random() * 2));
  }
  ctx.restore();

  // Sparse detached chips remain very close to the torn edge.
  ctx.fillStyle = '#122be0';
  for (let i = 0; i < 3; i++) {
    const angle = random() * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(angle) * width * .47),
      Math.round(y + Math.sin(angle) * height * .47), 2 + Math.floor(random() * 3), 1 + Math.floor(random() * 2));
  }
}

function createErrorGlyphs() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the mountain error text.');
  ctx.fillStyle = '#e0e8ff';
  ctx.font = '9px monospace';
  ctx.textBaseline = 'top';
  ERROR_LINES.slice(0, 5).forEach((text, index) => {
    ctx.fillText(text + ' ... 0x00', index % 2 ? -13 : 8, 8 + index * 17);
  });
  for (const [x, y, width] of [[42, 10, 13], [112, 27, 23], [76, 63, 18], [155, 80, 30]]) {
    ctx.clearRect(x, y, width, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Mountain_surface_error_glyphs';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/** Modify only the albedo of the existing instanced mountain surfaces.
 * No new mesh/decal planes, positions, indices, camera state or colliders.
 */
export function applyMountainFaults(peaks: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>) {
  const rows = Math.ceil(peaks.count / COLUMNS);
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * TILE_WIDTH;
  canvas.height = rows * TILE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the mountain glitch texture.');
  const offsets = new Float32Array(peaks.count * 2);
  for (let index = 0; index < peaks.count; index++) {
    const column = index % COLUMNS, row = Math.floor(index / COLUMNS);
    offsets[index * 2] = column / COLUMNS;
    offsets[index * 2 + 1] = 1 - (row + 1) / rows;
    // Several complete mountains are left intact among the damaged ones.
    if (index % 5 === 2) continue;
    const random = randomForMountain(index);
    ctx.save();
    ctx.translate(column * TILE_WIDTH, row * TILE_HEIGHT);
    ctx.beginPath();
    // Leave the summit, base seam and atlas borders untouched.
    ctx.rect(GUTTER, 32, TILE_WIDTH - GUTTER * 2, TILE_HEIGHT - 40);
    ctx.clip();
    for (let patch = 0; patch < 4; patch++) {
      // Separate angular sectors, independently varied heights: never a blue belt.
      const x = 58 + patch * 128 + (random() - .5) * 35;
      const y = (0.26 + ((index * .23 + patch * .29 + random() * .2) % 1) * .53) * TILE_HEIGHT;
      const width = 48 + random() * 62;
      const height = 45 + random() * 57;
      paintFault(ctx, random, x, y, width, height);
    }
    ctx.restore();
  }

  const atlas = new THREE.CanvasTexture(canvas);
  atlas.name = 'Mountain_fault_albedo_atlas';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.NearestFilter;
  // Distance filtering lets tiny far-away characters merge naturally, not sparkle.
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.anisotropy = 4;
  peaks.geometry.setAttribute('mountainFaultTile', new THREE.InstancedBufferAttribute(offsets, 2));
  // ConeGeometry puts each triangle's apex UV at the right corner. Centre it
  // for this six-sided cone's fault layer, giving each face a planar projection
  // instead of shearing the text. Original UVs and all mesh data stay intact.
  const faultUv = peaks.geometry.getAttribute('uv').clone();
  const position = peaks.geometry.getAttribute('position');
  const normal = peaks.geometry.getAttribute('normal');
  for (let i = 0; i < faultUv.count; i++) {
    if (position.getY(i) > .49 && normal.getY(i) > 0) {
      faultUv.setX(i, faultUv.getX(i) - 1 / 12);
    }
  }
  peaks.geometry.setAttribute('mountainFaultUv', faultUv);
  // A small shared glyph texture samples at an independent surface density.
  // This preserves letter proportions without a huge high-resolution mask atlas.
  const errorGlyphs = createErrorGlyphs();
  const material = peaks.material;
  material.name = 'Mountain_green_with_local_blue_screen';
  material.onBeforeCompile = shader => {
    shader.uniforms.mountainFaultAtlas = { value: atlas };
    shader.uniforms.mountainErrorText = { value: errorGlyphs };
    shader.uniforms.mountainTextRepeat = { value: new THREE.Vector2(14, 5) };
    shader.uniforms.mountainTextOffsetScale = { value: new THREE.Vector2(7.3, 11.7) };
    shader.uniforms.mountainFaultTileSize = { value: new THREE.Vector2(1 / COLUMNS, 1 / rows) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      attribute vec2 mountainFaultTile;
      attribute vec2 mountainFaultUv;
      uniform vec2 mountainFaultTileSize;
      uniform vec2 mountainTextRepeat;
      uniform vec2 mountainTextOffsetScale;
      varying vec2 vMountainFaultUv;
      varying vec2 vMountainTextUv;
      varying float vMountainSide;
    `).replace('#include <uv_vertex>', `
      #include <uv_vertex>
      vMountainFaultUv = mountainFaultTile + mountainFaultUv * mountainFaultTileSize;
      vMountainTextUv = mountainFaultUv * mountainTextRepeat + mountainFaultTile * mountainTextOffsetScale;
      vMountainSide = step(-0.5, normal.y);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform sampler2D mountainFaultAtlas;
      uniform sampler2D mountainErrorText;
      varying vec2 vMountainFaultUv;
      varying vec2 vMountainTextUv;
      varying float vMountainSide;
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      vec4 mountainFault = texture2D(mountainFaultAtlas, vMountainFaultUv);
      vec4 mountainGlyph = texture2D(mountainErrorText, vMountainTextUv);
      vec3 faultColor = mix(mountainFault.rgb, mountainGlyph.rgb, mountainGlyph.a);
      diffuseColor.rgb = mix(diffuseColor.rgb, faultColor, mountainFault.a * vMountainSide);
    `);
  };
  material.customProgramCacheKey = () => 'mountain-local-fault-albedo-v3';
  material.needsUpdate = true;
  material.addEventListener('dispose', () => { atlas.dispose(); errorGlyphs.dispose(); });
}
