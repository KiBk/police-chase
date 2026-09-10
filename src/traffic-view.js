import * as T from 'three';
import {instantiateVehicle} from './car-assets.js';
import {SETUPS} from './setups.js';
const boxGeo=new T.BoxGeometry(1,1,1);
export class TrafficView {
 constructor(scene){this.scene=scene;this.cars=new Map();}
 create(a){
  const cfg=SETUPS[a.model],built=instantiateVehicle(a.model,0,cfg),root=new T.Group();root.add(built.group);
  built.wheels.forEach((w,i)=>{w.position.fromArray(cfg.wheels[i].position);root.add(w);});this.scene.add(root);
  const bars=[];
  if(a.kind==='police'){
   for(const m of built.shells){if(m.material.name.startsWith('Body')){m.material.color.set('#c6dfef');m.material.metalness=.25;}}
   const add=(size,pos,color,glow=false)=>{const mat=new T.MeshStandardMaterial({color,emissive:glow?color:0,emissiveIntensity:glow?2:0,roughness:.45});const m=new T.Mesh(boxGeo,mat);m.scale.set(...size);m.position.set(...pos);root.add(m);return m;};
   add([1.15,.07,.27],[0,cfg.height+.05,0],'#203442');
   for(const x of[-.37,.37])bars.push(add([.45,.14,.25],[x,cfg.height+.15,0],x>0?'#3c98ff':'#fa4b55',true));
   for(const side of[-1,1])for(let j=0;j<5;j++)for(let row=0;row<2;row++)add([.018,.18,.40],[side*cfg.width*.475,.75+row*.18,-.8+j*.41],(j+row)%2?'#b9dc58':'#427cc0');
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#f2f2dc';ctx.fillRect(0,0,256,64);ctx.fillStyle='#25405a';ctx.font='bold 47px sans-serif';ctx.textAlign='center';ctx.fillText('POLICE',128,50);
   const texture=new T.CanvasTexture(canvas),label=new T.Mesh(new T.PlaneGeometry(.93,.24),new T.MeshBasicMaterial({map:texture}));label.position.set(0,.95,-cfg.length*.486);label.rotation.y=Math.PI;root.add(label);
  }
  const car={root,wheels:built.wheels,bars,spin:0};this.cars.set(a.id,car);return car;
 }
 update(game,dt){
  for(const a of game.actors.values()){
   const c=this.cars.get(a.id)??this.create(a);c.root.position.copy(a.body.translation());c.root.position.y-=a.halfHeight;c.root.quaternion.copy(a.body.rotation());
   c.spin+=a.speed*dt/SETUPS[a.model].radius;for(const w of c.wheels)w.rotation.x=c.spin;
   c.bars.forEach((m,i)=>{const on=(Math.floor(game.time*8)%4<2)===(i===0);m.material.emissiveIntensity=on?4:.12;m.material.color.set(on?(i?'#fd6c6b':'#69bcff'):'#304354');});
  }
  for(const[id,c]of this.cars)if(!game.actors.has(id)){this.disposeCar(c);this.cars.delete(id);}
 }
 disposeCar(c){c.root.removeFromParent();c.root.traverse(m=>{if(!m.isMesh)return;if(!m.userData.assetGeometry&&m.geometry!==boxGeo)m.geometry.dispose();if(m.material?.map?.isCanvasTexture)m.material.map.dispose();m.material.dispose();});}
 clear(){for(const c of this.cars.values())this.disposeCar(c);this.cars.clear();}
}
