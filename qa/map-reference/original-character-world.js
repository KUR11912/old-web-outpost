import { SITES, HERBS, PATROLS, currentQuest, questState } from './engine.js';
export function createWorld() {
  const width = 104, height = 48;
  const tiles = Array.from({ length: height }, () => Array(width).fill(' '));
  const types = Array.from({ length: height }, () => Array(width).fill('ground'));
  const solid = Array.from({ length: height }, () => Array(width).fill(false));
  let seed = 7291;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function put(x, y, ch, type = 'ground', block = false) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    tiles[y][x] = ch; types[y][x] = type; solid[y][x] = block;
  }
  function stamp(x, y, art, type, block = true) { art.forEach((line, j) => [...line].forEach((c, i) => { if (c !== ' ') put(x + i, y + j, c, type, block); })); }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const n = random(); if (n < .045) put(x, y, "'", 'grass'); else if (n < .14) put(x, y, '.', 'dust');
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) put(x, y, ' ', 'edge', true);
  }
  const tree = [' ___ ', '[:::]', '[___]', '  |  '];
  [[5,15],[10,17],[6,21],[21,15],[26,17],[18,20],[26,22],[34,7],[29,9],[49,5],[53,9],[48,14],[54,17],[8,36],[23,37],[29,39],[33,35],[39,37],[47,34],[53,37],[73,7],[78,9],[74,13],[75,32],[82,33],[87,30],[92,32],[95,25],[94,19]].forEach(([x,y])=>stamp(x,y,tree,'tree'));
  const peak = ['    /\\    ', '   /  \\   ', '  / /\\ \\  ', ' /_/  \\_\\ '];
  [[2,3],[10,1],[18,3],[3,7],[17,7],[27,2],[39,1],[45,40],[54,42],[37,42],[5,42],[14,41],[84,40],[92,38],[97,5]].forEach(([x,y])=>stamp(x,y,peak,'rock'));
  for(let y=1;y<height-1;y++) {
    const rx = 65 + Math.round(Math.sin(y / 8) * 3);
    for(let k=-2;k<=2;k++) put(rx+k,y,k===-2?'(':k===2?')':'~', 'water', true);
    if (rx-4>0 && y%3===0) put(rx-4,y,'.','waterbank');
  }
  function road(x1,y1,x2,y2) {
    const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1); let x=x1,y=y1;
    while(true) { put(x,y,'·','road'); if(x===x2&&y===y2)break; x+=dx;y+=dy; }
  }
  [[16,33,26,33],[26,33,26,28],[26,28,44,28],[33,28,33,20],[33,20,44,20],[44,20,44,15],[44,20,44,28],[44,28,75,28],[75,28,75,20],[75,20,87,20],[87,20,87,15]].forEach(a=>road(...a));
  for(let y=27;y<=29;y++)for(let x=59;x<=72;x++)put(x,y,y===28?'=':'-','bridge');
  stamp(9,26,['       /\\       ', '      /  \\      ', '     / /\\ \\     ', '    /_/  \\_\\    ', '    |      |    ', ' ___|______|___ '],'camp');
  stamp(20,30,[' .--. ', ' |:>| ', ' |__| ', ' =||= '],'fire',false);
  stamp(37,8,['     _______     ', '   _/ / / / \\_   ', '  /  _______  \\  ', ' /  /       \\  \\ ', '|  |  .   .  |  |', '|__|         |__|'],'mine');
  for (let x=43;x<=45;x++) for(let y=12;y<=16;y++)put(x,y,' ','mine',false);
  stamp(82,4,['     /\\     ', '    /__\\    ', '    |<>|    ', '   _|__|_   ', '  /______\\  ', '   | :: |   ', '   | :: |   ', '   | :: |   ', '   | __ |   ', ' __||  ||__ ', '/___|__|___\\'],'tower');
  for(let y=13;y<=16;y++)put(87,y,y===14?'_':' ','tower',false);
  for (const p of [...SITES,...HERBS,...PATROLS,{x:17,y:35}]) {
    solid[p.y][p.x]=false;
    if (p.x>1)solid[p.y][p.x-1]=false;
    if (p.x<width-2)solid[p.y][p.x+1]=false;
  }
  return { width,height,tiles,types,solid };
}
const COLORS = { ground:'#738187',grass:'#6a8e98',dust:'#425056',road:'#9b9577',tree:'#6c9caa',rock:'#707e87',water:'#427c96',waterbank:'#395b5e',bridge:'#a69b80',camp:'#b7c7c7',fire:'#c5b787',mine:'#8ca9b6',tower:'#b6c6c8',edge:'#39434a' };
export class WorldRenderer {
  constructor(canvas,map,getState,onFrame) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.map=map;this.getState=getState;this.onFrame=onFrame;
    this.hover=null;this.reveal=false;this.frame=0;this.resize=()=>this.draw();
    if(typeof ResizeObserver==='function'){this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas.parentElement);}else window.addEventListener('resize',this.resize);
    this.timer=setInterval(()=>{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden){this.frame++;this.draw();}},220);
  }
  draw() {
    const c=this.canvas,ctx=this.ctx,m=this.map,s=this.getState();if(!s)return;
    const w=c.parentElement.clientWidth,h=c.parentElement.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);if(!w||!h)return;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c151c';ctx.fillRect(0,0,w,h);
    const isSmall=w<650&&!this.reveal;
    const cw=isSmall?Math.max(11,w/48):w/(m.width+4),ch=isSmall?cw*1.55:Math.min(cw*1.55,h/(m.height+3));
    const cols=Math.min(m.width,Math.floor(w/cw)-2),rows=Math.min(m.height,Math.floor(h/ch)-2);
    const ox=Math.max(0,Math.min(m.width-cols,Math.floor(s.x-cols/2))),oy=Math.max(0,Math.min(m.height-rows,Math.floor(s.y-rows/2)));
    const px=(w-cols*cw)/2,py=(h-rows*ch)/2;
    this.view={cw,ch,ox,oy,px,py,cols,rows};
    ctx.font=`${Math.max(isSmall?9:4,cw*1.24)}px "Courier New",monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    const draw=(x,y,text,color)=>{if(x<ox||y<oy||x>=ox+cols||y>=oy+rows)return;ctx.fillStyle=color;ctx.fillText(text,px+(x-ox+.5)*cw,py+(y-oy+.5)*ch);};
    const progress=questState(s);
    if(progress.stage==='archived') {
      const gx=px+(87-ox+.5)*cw,gy=py+(7-oy+.5)*ch;
      const g=ctx.createRadialGradient(gx,gy,4,gx,gy,w*.5);g.addColorStop(0,'#e7be5033');g.addColorStop(1,'#e7be5000');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    for(let y=oy;y<oy+rows;y++)for(let x=ox;x<ox+cols;x++) {
      let t=m.tiles[y][x],type=m.types[y][x];
      if(type==='water' && t==='~' && (x+y+this.frame)%7===0)t='≈';
      if(type==='fire' && (this.frame+x)%3===0 && t==='>')t='_';
      if(type==='bridge' && x>=63 && x<=68 && y===28 && !progress.linked)t='x';
      const dist=Math.hypot(x-s.x,(y-s.y)*1.3);ctx.globalAlpha=this.reveal?1:dist<15?1:dist<32?.78:.53;
      draw(x,y,t,type==='bridge'?(progress.linked?'#87bca8':'#866c6c'):COLORS[type]);
    }ctx.globalAlpha=1;
    const q=currentQuest(s);
    for(const p of SITES){
      const done=p.id==='camp'?progress.stage!=='not_started':p.id==='mine'?progress.linked:progress.stage==='archived';
      draw(p.x,p.y,done?'◆':'◇',done?'#83b99a':'#e2b76a');
      if(p.x>=ox&&p.x<ox+cols&&p.y>=oy&&p.y<oy+rows){
        ctx.font=`${Math.max(10,Math.min(12,cw*1.2))}px system-ui,sans-serif`;
        const labelAbove=Math.abs(s.x-p.x)<8&&Math.abs(s.y-(p.y+2.4))<1;
        const tx=px+(p.x-ox+.5)*cw,ty=py+(p.y-oy+(labelAbove?-1.2:2.4))*ch;
        const label=`${p.tag} ${p.name}`;const tw=ctx.measureText(label).width;
        ctx.fillStyle='#0c151cdd';ctx.fillRect(tx-tw/2-5,ty-8,tw+10,17);ctx.fillStyle=q.target===p.id?'#e2b76a':'#a6b4bd';ctx.fillText(label,tx,ty);
        ctx.font=`${Math.max(isSmall?9:4,cw*1.24)}px "Courier New",monospace`;
      }
    }
    draw(65,26,progress.linked?'↔':'×',progress.linked?'#a2d7c2':'#c89687');
    const x=px+(s.x-ox+.5)*cw,y=py+(s.y-oy+.5)*ch;
    ctx.fillStyle='#e6bc6222';ctx.fillRect(x-cw*.75,y-ch*.6,cw*1.5,ch*1.2);
    ctx.font=`bold ${Math.max(14,cw*1.6)}px "Courier New",monospace`;ctx.fillStyle='#f5d38e';ctx.shadowColor='#f4ba65';ctx.shadowBlur=8;ctx.fillText('@',x,y);ctx.shadowBlur=0;
    if(this.hover && Math.abs(this.hover.x-s.x)+Math.abs(this.hover.y-s.y)===1)draw(this.hover.x,this.hover.y,'·','#f0d69b');
    this.onFrame?.(this.view);
  }
  cellAt(clientX,clientY) { const r=this.canvas.getBoundingClientRect(),v=this.view;return v?{x:Math.floor((clientX-r.left-v.px)/v.cw)+v.ox,y:Math.floor((clientY-r.top-v.py)/v.ch)+v.oy}:null; }
}
