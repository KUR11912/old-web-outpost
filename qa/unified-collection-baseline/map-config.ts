/** Shared metres-based layout. North = -Z. Existing outpost coordinates are retained. */
export interface MapPoint { x:number; z:number }
export interface MapBounds { minX:number; maxX:number; minZ:number; maxZ:number }
export interface MapRoad { id:string; width:number; points:MapPoint[] }
const point=(x:number,z:number):MapPoint=>({x,z});

export const MAP = {
  revision:2,
  seed:63112027,
  bounds:{minX:-16,maxX:68,minZ:-58,maxZ:16} as MapBounds,
  spawn:{x:0,z:9,yaw:0,pitch:0},
  groundY:0,
  roadTop:.02,
  source:{file:'../ember-courier/dist/world.js',size:[104,48],oldSites:{outpost:[16,33],archive:[44,15],lighthouse:[87,15]},oldRiverX:65,oldBridgeRow:28},
  locations:{
    outpost:{id:'outpost',name:'旧网驿站',tag:'01',position:point(0,-7.5),approach:point(0,-2),size:{width:5.6,depth:5,height:5.18},region:{minX:-14,maxX:14,minZ:-15,maxZ:16},note:'文件夹拾取 · 邮箱留言'},
    archive:{id:'archive',name:'回声档案馆',tag:'02',position:point(20,-40),approach:point(20,-35),size:{width:5,depth:6,height:7.3},region:{minX:10,maxX:31,minZ:-52,maxZ:-25},note:'三处调查 · 整理线索'},
    bridge:{id:'bridge',name:'断链桥',tag:'03',position:point(39,-8),approach:point(34,-8),size:{width:10,depth:3.8,height:4.62},region:{minX:30,maxX:48,minZ:-15,maxZ:-1},note:'石质拱廊 · 开放通行'},
    lighthouse:{id:'lighthouse',name:'记忆灯塔',tag:'04',position:point(57,-41),approach:point(57,-35),size:{width:3.84,depth:5.41,height:14.3},region:{minX:47,maxX:67,minZ:-53,maxZ:-26},note:'地标区域 · 后续任务'},
  },
  mailbox:point(1.5,-3.7),
  lighthouse:{baseRadius:1.9,hut:{width:3.4,depth:2.4,z:2.2},sign:{y:2.4,z:3.495,width:1.55,height:.22}},
  river:{minX:36,maxX:42,minZ:-58,maxZ:16,waterY:-.28,bankWidth:.5},
  bridge:{x:39,z:-8,length:10,width:3.8,deckTop:.02,crossingOpen:true,
    arcade:{model:'ArcadeBridge_01',deckThickness:.20,columnOffsetsX:[-4.2,-1.4,1.4,4.2],columnZ:1.55,columnHalfWidth:.28,
      curbWidth:.13,curbHeight:.16,springHeight:2.35,archHeight:4.6},
  },
  roads:[
    {id:'outpost-archive',width:2,points:[point(2,-2),point(13.5,-2),point(13.5,-30),point(20,-30),point(20,-35)]},
    {id:'west-bridge',width:2,points:[point(13.5,-8),point(34,-8)]},
    {id:'east-lighthouse',width:2,points:[point(44,-8),point(50,-8),point(50,-35),point(57,-35)]},
  ] as MapRoad[],
  timedRoutes:[
    {id:'outpost-archive',name:'旧网驿站 → 回声档案馆',points:[point(0,-2),point(13.5,-2),point(13.5,-30),point(20,-30),point(20,-35)]},
    {id:'archive-bridge',name:'回声档案馆 → 桥中央',points:[point(20,-35),point(20,-30),point(13.5,-30),point(13.5,-8),point(39,-8)]},
    {id:'bridge-lighthouse',name:'桥中央 → 记忆灯塔',points:[point(39,-8),point(50,-8),point(50,-35),point(57,-35)]},
  ],
  futureHooks:[
    {id:'archive_investigation',locationId:'archive',position:point(20,-35),enabled:true},
    {id:'bridge_unlock',locationId:'bridge',position:point(34,-8),enabled:false},
    {id:'lighthouse_task',locationId:'lighthouse',position:point(57,-35),enabled:false},
  ],
  preserved:{
    seed:63111999,
    bounds:{minX:-14,maxX:14,minZ:-14,maxZ:14},
    trees:[[-5.5,6.5,.95],[5.7,7.5,.9],[-7,1.4,1.03],[6.1,.6,1.08],[-5.6,-4.4,.83],[7.8,-5.4,.95],[-9.4,-9.4,1.1],[8.7,-10.5,1.07],[-11.4,7.9,1.03],[11.3,6.2,.94],[-10.8,-1.8,.9],[11.6,-.8,1],[-5.8,-11.9,.8],[4.6,-11.8,.91]],
    rocks:[[-3.7,3.4,1.35],[4.1,2.2,1],[-8.1,-5.4,.8],[8.6,9.7,1.5],[-10,11,1.2],[10.6,-8.4,1.2]],
  },
};

export function currentRegion(x:number,z:number):string {
  if(x>=MAP.river.minX&&x<=MAP.river.maxX)return '断链桥 · 走测开放';
  for(const site of Object.values(MAP.locations)){
    const r=site.region;if(x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ)return site.name;
  }
  return x>MAP.river.maxX?'河东林地':'西岸步道';
}
