import RAPIER from '@dimforge/rapier3d-compat';
import {Road} from './terrain.js';
import {ROAD_WIDTH,smooth} from './route.js';
const SIZE=20,STEP=.5,CELLS=SIZE/STEP;
export class ChaseRoad extends Road {
 constructor(world,route,origin){
  super(world,'flat',origin);world.removeCollider(this.plane,true);this.plane=null;this.handles.clear();
  this.route=route;this.events=new RAPIER.EventQueue(true);this.ensure(0,0);
 }
 height(x,z){
  x+=this.origin.x;z+=this.origin.z;
  const ix=Math.floor(x/STEP),iz=Math.floor(z/STEP),u=x/STEP-ix,v=z/STEP-iz;
  const h=(a,b)=>Math.fround(this.route.height((ix+a)*STEP,(iz+b)*STEP));
  const a=h(0,0),b=h(1,0),c=h(0,1),d=h(1,1);
  return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
 }
 verge(x,z){return smooth((Math.abs(this.route.offset(x+this.origin.x,z+this.origin.z))-ROAD_WIDTH/2)/2);}
 gripAt(x,z){return 1-.09*this.verge(x,z);}
 rollingAt(x,z){return 1+.18*this.verge(x,z);}
 ensure(x,z){
  const tx=Math.floor((x+this.origin.x)/SIZE),tz=Math.floor((z+this.origin.z)/SIZE);
  if(tx===this.tx&&tz===this.tz)return;this.tx=tx;this.tz=tz;const keep=new Set();
  for(let i=tx-1;i<=tx+1;i++)for(let j=tz-1;j<=tz+1;j++){
   const key=`${i},${j}`;keep.add(key);if(this.tiles.has(key))continue;
   const n=CELLS+1,h=new Float32Array(n*n);
   for(let a=0;a<n;a++)for(let b=0;b<n;b++)h[a*n+b]=this.route.height(i*SIZE+a*STEP,j*SIZE+b*STEP);
   const collider=this.world.createCollider(RAPIER.ColliderDesc.heightfield(CELLS,CELLS,h,{x:SIZE,y:1,z:SIZE},RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES).setTranslation((i+.5)*SIZE-this.origin.x,0,(j+.5)*SIZE-this.origin.z).setFriction(.65).setRestitution(.01).setCollisionGroups(0x00010006));
   this.tiles.set(key,collider);this.handles.add(collider.handle);
  }
  for(const[key,c]of this.tiles)if(!keep.has(key)){this.handles.delete(c.handle);this.world.removeCollider(c,true);this.tiles.delete(key);}
 }
}
