import * as T from 'three';
import {CHUNK,ROAD_WIDTH,LANE,random} from './route.js';
const up=new T.Vector3(0,1,0),dummy=new T.Object3D();
const mat=color=>new T.MeshStandardMaterial({color,roughness:1});
const materials={road:mat('#515959'),line:mat('#dedcc8'),grass:mat('#8c9a6b'),trunk:mat('#756958'),leaves:mat('#607653'),hedge:mat('#637352'),brick:mat('#b5a18c'),roof:mat('#636665'),window:mat('#bacac8'),pole:mat('#4d5759'),white:mat('#efe9d7'),orange:mat('#dc783e'),hay:mat('#b7a16a')};
const geometries={box:new T.BoxGeometry(1,1,1),trunk:new T.CylinderGeometry(.13,.22,1,6),leaf:new T.IcosahedronGeometry(1,1),cone:new T.ConeGeometry(.23,.55,12),sign:new T.PlaneGeometry(.74,.74)};
const hidden=new T.Matrix4().makeScale(0,0,0);
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function box(parent,size,pos,material){const m=mesh(geometries.box,material,parent,...pos);m.scale.set(...size);return m;}
function instances(parent,geometry,material,items){
 const m=new T.InstancedMesh(geometry,material,items.length);items.forEach((a,i)=>{dummy.position.set(...a.p);dummy.scale.set(...a.s);dummy.rotation.set(0,a.yaw??0,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.receiveShadow=true;parent.add(m);return m;
}
function strip(route,z0,min,max,step=1,raised=0){
 const positions=[],colors=[],indices=[],cols=Math.ceil((max-min)/1.5),rows=CHUNK/step;
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const z=z0+i*step,o=min+(max-min)*j/cols,p=route.point(z,o);
  positions.push(p.x,route.height(p.x,z)+raised,z-z0);
  const v=.88+random(route.seed,Math.floor(z/4),Math.floor(o)+100)*.19;colors.push(v,v,v);
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export class WorldView {
 constructor(scene){this.scene=scene;this.chunks=new Map();this.props=new Map();this.anchors=new Map();this.signals=[];this.route=null;materials.grass.vertexColors=true;}
 sign(parent,base=0){
  if(!this.signMaterial){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#bd604c';x.beginPath();x.arc(64,64,62,0,Math.PI*2);x.fill();x.fillStyle='#f4f1df';x.beginPath();x.arc(64,64,51,0,Math.PI*2);x.fill();x.fillStyle='#283c38';x.font='bold 57px sans-serif';x.textAlign='center';x.fillText('50',64,83);this.signMaterial=new T.MeshStandardMaterial({map:new T.CanvasTexture(c),transparent:true,side:T.DoubleSide,roughness:.8});}
  box(parent,[.075,2.5,.075],[0,base+1.25,0],materials.pole);const m=mesh(geometries.sign,this.signMaterial,parent,0,base+2.12,0);m.rotation.y=Math.PI;
 }
 reset(game){this.clear();this.route=game.route;}
 build(index){
  const route=this.route,z0=index*CHUNK,group=new T.Group();this.scene.add(group);const own=[];
  for(const[min,max,material,lift]of[[-46,-ROAD_WIDTH/2,materials.grass,0],[ROAD_WIDTH/2,46,materials.grass,0],[-ROAD_WIDTH/2,ROAD_WIDTH/2,materials.road,.012]]){
   const geometry=strip(route,z0,min,max,1,lift);own.push(geometry);mesh(geometry,material,group);
  }
  const marks=[];
  for(let z=z0;z<z0+CHUNK;z+=2){
   for(const offset of[-ROAD_WIDTH/2+.12,ROAD_WIDTH/2-.12]){const p=route.point(z+1,offset);marks.push({p:[p.x,p.y+.029,z+1-z0],s:[.07,.012,2.06],yaw:p.yaw});}
   if(Math.floor(z/2)%3===0&&!route.junction(index)){const p=route.point(z+1);marks.push({p:[p.x,p.y+.03,z+1-z0],s:[.11,.013,2.4],yaw:p.yaw});}
  }
  instances(group,geometries.box,materials.line,marks);
  const trunks=[],leaves=[],hedges=[],posts=[],bricks=[],roofs=[],windows=[];
  for(let j=0;j<16;j++){
   const z=z0+random(route.seed,index,j+200)*CHUNK,side=j%2?1:-1,o=side*(12+random(route.seed,index,j+250)*28),p=route.point(z,o),h=3+random(route.seed,index,j+300)*4;
   trunks.push({p:[p.x,p.y+h*.42,z-z0],s:[1,h*.84,1]});
   leaves.push({p:[p.x,p.y+h,z-z0],s:[h*.37,h*.45,h*.35],yaw:j});
   leaves.push({p:[p.x+1,p.y+h*.79,z-z0+.7],s:[h*.31,h*.34,h*.3],yaw:j+1});
  }
  for(let j=0;j<8;j++)for(const side of[-1,1]){
   const z=z0+j*5+2.5;if(route.junction(index)&&j<2)continue;
   if(random(route.seed,index,j+350)<.22)continue;
   const p=route.point(z,side*11);hedges.push({p:[p.x,p.y+.65,z-z0],s:[1.2,1.3,4.8],yaw:p.yaw});
   const f=route.point(z,side*9.4);posts.push({p:[f.x,f.y+.45,z-z0],s:[.09,.9,.09]});
  }
  if(index%6===3||index%6===4)for(const side of[-1,1])for(let j=0;j<3;j++){
   const z=z0+j*12+5,p=route.point(z,side*(19+j%2*2));
   bricks.push({p:[p.x,p.y+2,z-z0],s:[6,4,7],yaw:p.yaw});roofs.push({p:[p.x,p.y+4.2,z-z0],s:[6.6,.7,7.5],yaw:p.yaw});
   for(const y of[1.3,2.9])for(const dz of[-1.8,1.8])windows.push({p:[p.x-side*3.03,p.y+y,z-z0+dz],s:[.07,1,1.15],yaw:p.yaw});
  }
  const trunkMesh=instances(group,geometries.trunk,materials.trunk,trunks),leafMesh=instances(group,geometries.leaf,materials.leaves,leaves),postMesh=instances(group,geometries.box,materials.white,posts);
  instances(group,geometries.box,materials.hedge,hedges);
  for(let j=0;j<16;j++)this.anchors.set(`tree${index}-${j}`,{owner:group,instances:[[trunkMesh,j],[leafMesh,j*2],[leafMesh,j*2+1]]});
  route.structures(index).filter(f=>f.kind==='post').forEach((f,j)=>this.anchors.set(f.id,{owner:group,instances:[[postMesh,j]]}));
  const sign=route.structures(index).find(f=>f.kind==='sign');if(sign){const p=route.point(sign.z,sign.offset),g=new T.Group();g.position.set(p.x,route.height(p.x,sign.z),sign.z-z0);g.rotation.y=p.yaw;group.add(g);this.sign(g);this.anchors.set(sign.id,{owner:group,group:g});}
  if(bricks.length){instances(group,geometries.box,materials.brick,bricks);instances(group,geometries.box,materials.roof,roofs);instances(group,geometries.box,materials.window,windows);}
  if(route.junction(index)){
   const p=route.point(z0),cross=box(group,[33,.035,ROAD_WIDTH],[p.x,p.y+.018,0],materials.road);cross.rotation.y=p.yaw;
   for(const direction of[-1,1]){
    const s=route.point(z0-direction*7,direction*9),g=new T.Group();g.position.set(s.x,s.y,z0-direction*7-z0);g.rotation.y=s.yaw+(direction<0?Math.PI:0);group.add(g);
    box(g,[.10,3.8,.10],[0,1.9,0],materials.pole);box(g,[.37,.98,.25],[0,3.65,0],materials.pole);
    this.anchors.set(`signal${index}-${direction}`,{owner:group,group:g});
    const lights=[];for(let k=0;k<3;k++){const lm=new T.MeshStandardMaterial({color:'#282e2d',emissive:0,roughness:.5});const m=mesh(new T.SphereGeometry(.105,10,8),lm,g,0,3.92-k*.27,-.15);m.scale.z=.4;lights.push(m);own.push(m.geometry);}
    this.signals.push({index,lights,group});
    const stop=route.point(z0-direction*7,direction*LANE);const marking=box(group,[ROAD_WIDTH/2-.3,.02,.35],[stop.x,stop.y+.055,-direction*7],materials.line);marking.rotation.y=stop.yaw;
   }
  }
  this.chunks.set(index,{group,own});
 }
 makeProp(o){
  const g=new T.Group();this.scene.add(g);
  if(o.kind==='tree'){
   const h=o.h,b=o.sizes[1],trunk=mesh(geometries.trunk,materials.trunk,g);trunk.scale.y=h*.84;
   const a=mesh(geometries.leaf,materials.leaves,g,0,h-b,0);a.scale.set(h*.37,h*.45,h*.35);a.rotation.y=o.j;
   const c=mesh(geometries.leaf,materials.leaves,g,1,h*.79-b,.7);c.scale.set(h*.31,h*.34,h*.3);c.rotation.y=o.j+1;
  }else if(o.kind==='post')box(g,[.09,.9,.09],[0,0,0],materials.white);
  else if(o.kind==='sign')this.sign(g,-o.sizes[1]);
  else if(o.kind==='signal'){box(g,[.10,3.8,.10],[0,-.1,0],materials.pole);box(g,[.37,.98,.25],[0,1.65,0],materials.pole);}
  else if(o.kind==='cone'){box(g,[.44,.045,.44],[0,-.29,0],materials.pole);mesh(geometries.cone,materials.orange,g,0,-.015,0);box(g,[.20,.06,.20],[0,.065,0],materials.white);}
  else if(o.kind==='bale')box(g,[1.3,1.06,1.06],[0,0,0],materials.hay);
  else{box(g,[1.12,.86,.6],[0,0,0],materials.orange);box(g,[1.14,.2,.62],[0,.08,0],materials.white);for(const x of[-.42,.42])box(g,[.24,.16,.8],[x,-.4,0],materials.orange);}
  g.traverse(m=>{if(m.isMesh)m.castShadow=true;});this.props.set(o.id,g);return g;
 }
 update(game){
  if(this.route!==game.route)this.reset(game);
  for(const i of game.chunks)if(!this.chunks.has(i))this.build(i);
  for(const[i,c]of this.chunks){
   if(!game.chunks.has(i)){c.group.removeFromParent();c.own.forEach(g=>g.dispose());this.signals.filter(s=>s.group===c.group).forEach(s=>s.lights.forEach(m=>m.material.dispose()));c.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();});this.signals=this.signals.filter(s=>s.group!==c.group);for(const[id,a]of this.anchors)if(a.owner===c.group)this.anchors.delete(id);this.chunks.delete(i);continue;}
   c.group.position.set(-game.origin.x,0,i*CHUNK-game.origin.z);
  }
  for(const s of this.signals){const phase=game.signal(s.index*CHUNK),on=['red','amber','green'].indexOf(phase),colors=['#fa5944','#ffc867','#83d198'];s.lights.forEach((m,i)=>{m.material.color.set(i===on?colors[i]:'#222c29');m.material.emissive.set(i===on?colors[i]:'#000000');m.material.emissiveIntensity=i===on?1.7:0;});}
  for(const[id,o]of game.objects)if(!game.actors.has(id)){
   if(o.anchored&&!o.hit)continue;
   if(o.anchored){const a=this.anchors.get(id);if(a&&!a.hidden){a.hidden=true;if(a.group)a.group.visible=false;for(const[m,i]of a.instances??[]){m.setMatrixAt(i,hidden);m.instanceMatrix.needsUpdate=true;}}}
   const g=this.props.get(id)??this.makeProp(o);g.position.copy(o.body.translation());g.quaternion.copy(o.body.rotation());
  }
  for(const[id,g]of this.props)if(!game.objects.has(id)){g.removeFromParent();this.props.delete(id);}
 }
 clear(){for(const c of this.chunks.values()){c.group.removeFromParent();c.own.forEach(g=>g.dispose());c.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();});}for(const s of this.signals)s.lights.forEach(m=>m.material.dispose());for(const g of this.props.values())g.removeFromParent();this.chunks.clear();this.props.clear();this.anchors.clear();this.signals=[];}
}
