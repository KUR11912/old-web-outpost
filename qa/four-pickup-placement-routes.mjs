import {readFile,writeFile} from 'node:fs/promises';
const {colliders}=JSON.parse(await readFile(new URL('./four-pickup-placement-plan.json',import.meta.url),'utf8'));
const clear=(p,c)=>c.kind==='circle'?Math.hypot(p[0]-c.x,p[1]-c.z)-c.radius:Math.hypot(Math.max(0,Math.abs(p[0]-c.x)-c.halfX),Math.max(0,Math.abs(p[1]-c.z)-c.halfZ));
const margin=.8;
const valid=p=>p[0]>-15&&p[0]<67&&p[1]>-57&&p[1]<15&&colliders.every(c=>clear(p,c)>=margin);
const line=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1);return Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]).every(valid);};
function find(start,end){
 const near=end.map(v=>Math.round(v*2)/2),key=p=>p.join(','),h=p=>Math.abs(p[0]-near[0])+Math.abs(p[1]-near[1]),open=[{p:start,g:0,f:h(start)}],best=new Map([[key(start),0]]),from=new Map();
 while(open.length){open.sort((a,b)=>a.f-b.f);const c=open.shift();if(key(c.p)===key(near)){const result=[end,near];let k=key(near);while(from.has(k)){const p=from.get(k);result.push(p);k=key(p);}result.reverse();const compact=[result[0]];for(let i=1;i<result.length-1;i++){const a=compact.at(-1),b=result[i],d=result[i+1];if((b[0]-a[0])*(d[1]-b[1])!==(b[1]-a[1])*(d[0]-b[0]))compact.push(b);}compact.push(end);return compact;}
  for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const p=[c.p[0]+dx,c.p[1]+dz],k=key(p),g=c.g+.5;if(g>90||!valid(p)||best.has(k)&&best.get(k)<=g)continue;best.set(k,g);from.set(k,c.p);open.push({p,g,f:g+h(p)});}
 }throw new Error('no route');
}
const inputs=[{id:'01',position:[20.4,-46],start:[13.5,-30],photo:[20.4,-44.3]},{id:'02',position:[24.5,-20],start:[13.5,-20],photo:[24.5,-18.3]},{id:'03',position:[26.6,9],start:[26.5,-8],photo:[26.6,7.3]},{id:'04',position:[60,3],start:[50,-8],photo:[60,1.3]}];
const routes=[[[13.5,-30],[15,-30],[15,-36.8],[16.5,-36.8],[16.5,-44.3],[20.4,-44.3]],[[13.5,-20],[18.5,-20],[18.5,-18.3],[24.5,-18.3]],[[26.6,-8],[26.6,7.3]],[[50,-8],[58,-8],[58,0],[60,0],[60,1.3]]];
for(const [idx,p] of inputs.entries()){p.route=routes[idx];p.start=p.route[0];p.minimumRouteClearance=100;for(let i=1;i<p.route.length;i++){const a=p.route[i-1],b=p.route[i];if(!line(a,b))throw new Error('unsafe');for(let j=0;j<=1000;j++)p.minimumRouteClearance=Math.min(p.minimumRouteClearance,...colliders.map(c=>clear([a[0]+(b[0]-a[0])*j/1000,a[1]+(b[1]-a[1])*j/1000],c)));}p.photoToPickupClear=line(p.photo,p.position);}
console.log(JSON.stringify(inputs,null,2));await writeFile(new URL('./four-pickup-placement-routes.json',import.meta.url),JSON.stringify(inputs,null,2));
