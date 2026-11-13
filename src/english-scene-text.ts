import * as THREE from 'three';

/** English lettering for authored props; geometry and original meme images stay intact. */
function pixels(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the English scene lettering.');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UVs, unlike standalone canvas nameplates.
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function archiveSign() {
  return pixels(128, 256, ctx => {
    ctx.fillStyle = '#cec8b7'; ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = '#696e68'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 122, 250);
    ctx.fillStyle = '#865f58'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Compensate for the tall, narrow sign's physical UV aspect ratio.
    const scaleY = .50 / 2.64 * 256 / 128;
    ctx.scale(1, scaleY);
    ctx.font = 'bold 31px Arial, sans-serif'; ctx.fillText('ECHO', 64, 22 / scaleY);
    ctx.font = 'bold 64px Arial, sans-serif';
    [...'ARCHIVE'].forEach((letter, index) => ctx.fillText(letter, 64, (55 + index * 29) / scaleY));
  });
}

function archiveAwning() {
  return pixels(256, 128, ctx => {
    ctx.fillStyle = '#ab7582'; ctx.fillRect(0, 0, 256, 128);
    for (let x = 0; x < 256; x += 51) {
      ctx.fillStyle = '#976a75'; ctx.fillRect(x, 0, 1, 128);
      ctx.fillStyle = '#b78a94'; ctx.fillRect(x + 1, 0, 1, 123);
    }
    ctx.fillStyle = '#8a606e'; ctx.fillRect(0, 123, 256, 5);
    ctx.fillStyle = '#c9beb0'; ctx.fillRect(19, 78, 32, 22);
    ctx.strokeStyle = '#966773'; ctx.lineWidth = 2; ctx.strokeRect(19, 78, 32, 22);
    ctx.beginPath(); ctx.moveTo(20, 79); ctx.lineTo(35, 90); ctx.lineTo(50, 79); ctx.stroke();
    ctx.fillStyle = '#e6d9cc'; ctx.font = 'bold 17px Arial, sans-serif';
    ctx.fillText('OLD WEB ARCHIVE', 66, 94, 181);
    ctx.font = '9px monospace'; ctx.fillText('READ / RECALL / ARCHIVE', 72, 115, 175);
  });
}

function terminalScreen() {
  return pixels(256, 192, ctx => {
    const rect = (x:number,y:number,w:number,h:number,color:string) => { ctx.fillStyle=color;ctx.fillRect(x,y,w,h); };
    const text = (value:string,x:number,y:number,color='#334e61',size=9) => {
      ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.fillText(value,x,y);
    };
    rect(0,0,256,192,'#73aed6');
    ctx.fillStyle='#e0eef0';
    for (const [x,y,w] of [[14,20,48],[175,12,40]]) { ctx.beginPath();ctx.ellipse(x+w/2,y,w/2,7,0,0,Math.PI*2);ctx.fill(); }
    ctx.fillStyle='#80ae54';ctx.beginPath();ctx.moveTo(0,135);ctx.lineTo(80,100);ctx.lineTo(155,120);ctx.lineTo(256,95);ctx.lineTo(256,192);ctx.lineTo(0,192);ctx.fill();
    ctx.fillStyle='#639843';ctx.beginPath();ctx.moveTo(0,168);ctx.lineTo(125,135);ctx.lineTo(256,155);ctx.lineTo(256,192);ctx.lineTo(0,192);ctx.fill();
    const folder=(x:number,y:number,label:string) => {
      rect(x,y+3,20,14,'#31526d');rect(x+1,y,9,5,'#e6cb73');rect(x+1,y+4,18,11,'#e2c06c');
      text(label,x-3,y+27,'#ffffff',8);
    };
    folder(13,20,'FILES');folder(13,65,'CACHE');
    const frame=(x:number,y:number,w:number,h:number,title:string) => {
      rect(x+2,y+2,w,h,'#344b55');rect(x,y,w,h,'#c6c9c3');rect(x,y,w,1,'#f7f7ed');
      rect(x+3,y+3,w-6,13,'#143b78');text(title,x+7,y+13,'#ffffff');
      rect(x+w-14,y+5,8,8,'#d0d3c9');text('x',x+w-13,y+12);
      rect(x+4,y+19,w-8,h-24,'#f5f5e8');
    };
    frame(8,112,85,59,'FILES');folder(15,136,'');text('LOCAL',42,148);
    frame(65,21,182,124,'ARCHIVE_LOCAL');
    text('WEB / TERMINAL',75,52);rect(75,60,161,1,'#b8c8b4');
    text('> FIND A FOLDER',77,78,'#274a3e');text('> SEARCH ITS NAME',77,96,'#274a3e');
    text('RECOVER LOST CONTEXT',75,115,'#1f493b',8);text('[E] OPEN SEARCH',75,134,'#305a7b');
    frame(149,150,98,29,'STATUS');text('READY / LOCAL',154,175,'#345347',7);
    rect(0,181,256,11,'#c5cdc0');rect(3,183,34,7,'#37684f');text('FILES',5,189,'#ffffff',7);
    text('OLD WEB',43,190,'#334b55',8);text('LOCAL',222,190,'#334b55',8);
  });
}

export function localizeSceneText(assetName: string, group: THREE.Group) {
  const replacements: Record<string, () => THREE.Texture> = assetName === 'Archive_01'
    ? { Archive_Vertical_Sign: archiveSign, Archive_DustyRose_Awning: archiveAwning }
    : assetName === 'OldTerminal_CRT_01' ? { CRT_Screen_Glass: terminalScreen } : {};
  const localized = new Map<THREE.Material, THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const replace = (material: THREE.MeshStandardMaterial) => {
      const create = replacements[material.name];
      if (!create) return material;
      if (localized.has(material)) return localized.get(material)!;
      const copy = material.clone(), map = create();
      copy.map = map;
      if (material.emissiveMap) copy.emissiveMap = map;
      copy.needsUpdate = true;
      localized.set(material, copy);
      return copy;
    };
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
}
