import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {Suspension,STEP} from './physics.js';
import {SETUPS} from './setups.js';
import {Route,CHUNK,LANE,clamp} from './route.js';
import {ChaseRoad} from './chase-road.js';
import {DriverAssist} from './driver-assist.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),up=V(0,1,0);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export class Chase {
 constructor(id='hatchback',seed=1){
  this.route=new Route(seed);this.sim=new Suspension(id);this.sim.road.free();
  this.sim.road=new ChaseRoad(this.sim.world,this.route,this.sim.worldOrigin);this.sim.ground=null;
  this.sim.setDriving(true);this.time=0;this.state='ready';this.countdown=3;this.damage=0;this.distance=0;this.nearMisses=0;this.barriersHit=0;this.capture=0;this.escape=0;this.overturned=0;
  this.assist=new DriverAssist();this.sim.brakeAssist=true;
  this.actors=new Map();this.objects=new Map();this.chunks=new Set();this.crossings=new Map();this.contacts=new Map();this.message='';this.messageUntil=0;this.origin=this.sim.worldOrigin;this.scan=0;
  this.playerHandles=new Set(this.sim.dynamic.map(b=>b.handle));
  for(const b of this.sim.dynamic){
   const p=b.translation();b.setTranslation({x:p.x-LANE,y:p.y,z:p.z+8},true);
   for(let j=0;j<b.numColliders();j++){const c=b.collider(j);if(c.collisionGroups()){c.setCollisionGroups(0x00020005);c.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);}}
  }
  this.sim.refresh();this.sim.onRebase=offset=>{
   for(const item of this.objects.values()){const p=item.body.translation();item.body.setTranslation({x:p.x-offset.x,y:p.y,z:p.z-offset.z},true);}
  };
  this.sim.road.onForce=e=>this.collision(e);
  this.police=this.addActor({id:'police',kind:'police',model:'wagon',z:-26,direction:1,speed:0});
  this.ensure();
 }
 get position(){const p=this.sim.chassis.translation();return{x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z};}
 get gap(){const p=this.position,a=this.police;return Math.hypot(p.x-a.x,p.z-a.z);}
 get score(){return Math.floor(this.distance)+this.nearMisses*100+this.barriersHit*25;}
 signal(z){const i=Math.round(z/CHUNK);return [-1,1].every(d=>this.objects.get(`signal${i}-${d}`)?.hit)?'green':this.route.signal(z,this.time);}
 start(){if(this.state==='ready'){this.state='countdown';this.countdown=3;}}
 tell(message){this.message=message;this.messageUntil=this.time+2.3;}
 addActor(spec){
  if(this.objects.has(spec.id))return this.objects.get(spec.id);
  const offset=spec.offset??LANE*spec.direction,p=this.route.point(spec.z,offset),cfg=SETUPS[spec.model];
  const halfHeight=Math.max(.42,cfg.height*.35),yaw=p.yaw+(spec.direction<0?Math.PI:0),q=new Quaternion().setFromAxisAngle(up,yaw);
  const body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x-this.origin.x,p.y+halfHeight,spec.z-this.origin.z).setRotation(q).setCcdEnabled(true));
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(cfg.width*.46,halfHeight,cfg.length*.46).setMass(cfg.mass*.35).setFriction(.10).setRestitution(.02).setCollisionGroups(0x00040007).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),body);
  const actor={...spec,body,collider,offset,x:p.x,y:p.y,z:spec.z,yaw,speed:spec.speed??0,cruise:spec.speed??16,halfHeight,stun:0,passed:false,mode:'guided',lastImpact:-10};
  this.actors.set(spec.id,actor);this.objects.set(spec.id,actor);return actor;
 }
 addProp(spec){
  if(this.objects.has(spec.id))return;
  const p=this.route.point(spec.z,spec.offset),sizes=spec.kind==='tree'?[.18,spec.h*.42,.18]:spec.kind==='post'?[.05,.45,.05]:spec.kind==='signal'?[.23,2,.18]:spec.kind==='sign'?[.34,1.25,.10]:spec.kind==='cone'?[.22,.32,.22]:spec.kind==='bale'?[.65,.53,.53]:[.56,.43,.3],q=new Quaternion().setFromAxisAngle(up,p.yaw+(spec.direction<0?Math.PI:0));
  const mass=spec.kind==='tree'?45:spec.kind==='post'?1.2:spec.kind==='signal'?16:spec.kind==='sign'?5:spec.kind==='cone'?2:spec.kind==='bale'?24:10,anchored=['tree','post','signal','sign'].includes(spec.kind);
  const body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x-this.origin.x,this.route.height(p.x,p.z)+sizes[1],p.z-this.origin.z).setRotation(q).setCcdEnabled(true));
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(...sizes).setMass(mass).setFriction(.18).setRestitution(.02).setCollisionGroups(anchored?0x00040003:0x00040007).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),body);
  this.objects.set(spec.id,{...spec,body,collider,sizes,mass,anchored,active:false,lastImpact:-10});
 }
 nearPlayer(o,margin=.25){
  // Oriented bounds plus a short relative-motion margin release bodies BEFORE
  // contact solving. Kinematic bodies otherwise deliver an immovable first hit.
  const p=this.sim.chassis.translation(),b=o.body.translation(),v=this.sim.chassis.linvel(),w=o.body.linvel();
  const dx=b.x-p.x,dz=b.z-p.z,m=margin+Math.hypot(v.x-w.x,v.z-w.z)*.04,cfg=this.sim.setup;
  const size=o.sizes??[SETUPS[o.model].width*.46,o.halfHeight,SETUPS[o.model].length*.46];
  if(Math.abs(b.y-p.y)>size[1]+cfg.height*.55+.25)return false;
  if(Math.hypot(dx,dz)>cfg.length*.65+Math.hypot(size[0],size[2])+m)return false;
  const q=this.sim.chassis.rotation(),r=o.body.rotation(),yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z)),other=Math.atan2(2*(r.w*r.y+r.x*r.z),1-2*(r.y*r.y+r.z*r.z));
  const axes=[[Math.cos(yaw),-Math.sin(yaw)],[Math.sin(yaw),Math.cos(yaw)],[Math.cos(other),-Math.sin(other)],[Math.sin(other),Math.cos(other)]];
  for(const[x,z]of axes){const projection=(a)=>Math.abs(x*a[0]+z*a[1]);if(Math.abs(dx*x+dz*z)>cfg.width*.57*projection(axes[0])+cfg.length*.53*projection(axes[1])+size[0]*projection(axes[2])+size[2]*projection(axes[3])+m)return false;}
  return true;
 }
 prepareContacts(){
  for(const o of this.objects.values()){
   if(this.actors.has(o.id)){
    if(o.mode==='guided'&&this.nearPlayer(o,.12)){
     o.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);o.mode='loose';o.stun=.35;
     o.body.setLinvel({x:Math.sin(o.yaw)*o.speed,y:0,z:Math.cos(o.yaw)*o.speed},true);
    }
   }else if(o.anchored&&!o.active&&this.nearPlayer(o)){
    // Stay visually planted until struck, but yield with finite mass on the
    // very first contact. Gravity is restored by the actual contact event.
    o.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);o.body.setGravityScale(0,true);o.active=true;
   }
  }
 }
 ensure(){
  const p=this.position,index=Math.floor(p.z/CHUNK),keep=new Set();
  for(let i=index-3;i<=index+9;i++){
   keep.add(i);if(this.chunks.has(i))continue;this.chunks.add(i);
   for(const f of this.route.features(i))f.kind==='traffic'?this.addActor(f):this.addProp(f);
   for(const f of this.route.structures(i))this.addProp(f);
  }
  for(const i of this.chunks)if(!keep.has(i))this.chunks.delete(i);
  for(const[id,o]of this.objects){
   if(id==='police'||o.anchored&&!o.hit&&keep.has(o.index))continue;const z=o.body.translation().z+this.origin.z;
   if(z<p.z-110||z>p.z+440){this.sim.world.removeRigidBody(o.body);this.objects.delete(id);this.actors.delete(id);this.contacts.delete(id);}
  }
  for(const k of this.crossings.keys())if(Math.abs(k*CHUNK-p.z)>460)this.crossings.delete(k);
 }
 collision(e){
  const ca=this.sim.world.getCollider(e.collider1()),cb=this.sim.world.getCollider(e.collider2());
  if(!ca||!cb)return;const a=ca.parent(),b=cb.parent();if(!a||!b)return;
  const playerA=this.playerHandles.has(a.handle),playerB=this.playerHandles.has(b.handle);
  if(!playerA&&!playerB)return;const other=playerA?b:a;
  const o=[...this.objects.values()].find(o=>o.body.handle===other.handle);if(!o)return;
  const impulse=e.totalForceMagnitude()*STEP;if(impulse<(this.actors.has(o.id)?20:.25))return;
  if(o.anchored&&!o.hit){
   o.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);o.body.setGravityScale(1,true);o.collider.setCollisionGroups(0x00040007);o.active=true;
  }
  if(impulse>300)this.sim.solverBoostUntil=this.sim.time+.5;
  if(this.actors.has(o.id)){
   o.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);o.mode='loose';o.stun=2.5;
  }
  if(this.time-o.lastImpact<.55)return;o.lastImpact=this.time;
  if(o.kind==='traffic'||o.kind==='police'){
   this.damage=clamp(this.damage+clamp((impulse-120)*.010,0,35),0,100);this.tell(o.kind==='police'?'PATROL CONTACT':'TRAFFIC COLLISION');
  }else if(!o.hit){o.hit=true;this.barriersHit++;this.damage=clamp(this.damage+Math.min(o.anchored?clamp(o.mass/30,.1,3):8,Math.max(0,impulse-1300)*.0015),0,100);this.tell(o.kind==='tree'?'TREE DOWN':o.kind==='sign'||o.kind==='signal'?'SIGN DOWN':'BARRIER CLEARED');}
 }
 updateActors(dt){
  const p=this.position,speed=this.sim.groundSpeed;
  for(const o of this.objects.values())if(!this.actors.has(o.id)&&!o.anchored&&!o.active&&Math.hypot(o.body.translation().x+this.origin.x-p.x,o.z-p.z)<27){o.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);o.active=true;}
  for(const a of this.actors.values()){
   if(a.mode==='loose'){
    const b=a.body.translation();a.x=b.x+this.origin.x;a.z=b.z+this.origin.z;a.y=b.y-a.halfHeight;a.offset=this.route.offset(a.x,a.z);a.stun-=dt;
    a.yaw=Math.atan2(2*(a.body.rotation().w*a.body.rotation().y+a.body.rotation().x*a.body.rotation().z),1-2*(a.body.rotation().y**2+a.body.rotation().z**2));
    const q=a.body.rotation();
    if(a.stun>0||this.nearPlayer(a,.65)||1-2*(q.x*q.x+q.z*q.z)<.7)continue;
    a.speed=Math.min(10,Math.hypot(a.body.linvel().x,a.body.linvel().z));a.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);a.mode='guided';
   }
   if(a.kind==='cross'){
    a.offset+=a.direction*6*dt;const target=this.route.point(a.z,a.offset);a.x=target.x;a.y=target.y;a.yaw=target.yaw-(a.direction>0?Math.PI/2:-Math.PI/2);
   }else{
    let target=a.kind==='police'?clamp(speed+2+(p.z-a.z)*.035,15,36):a.cruise;
    let targetOffset=LANE*a.direction;
    if(a.kind==='police'){
     targetOffset=clamp(this.route.offset(p.x,p.z),-5.6,5.6);
     if(speed<5&&this.gap<16)target=Math.min(target,Math.max(0,(this.gap-5)*.8));
     const blocked=[...this.actors.values()].some(b=>b!==a&&b.kind==='traffic'&&b.direction===1&&b.z-a.z>0&&b.z-a.z<22&&Math.abs(b.offset-a.offset)<2);
     if(blocked)targetOffset=-LANE;
     if(Math.abs(a.offset)>3.6)target*=.76;
    }else{
     const j=Math.round((a.z+a.direction*32)/CHUNK);
     for(let k=j-1;k<=j+1;k++)if(this.route.junction(k)&&this.signal(k*CHUNK)!=='green'){
      const gap=(k*CHUNK-a.z)*a.direction-7;if(gap>=-1&&gap<65)target=Math.min(target,Math.sqrt(Math.max(0,2*3.7*gap)));
     }
     for(const b of this.actors.values())if(b!==a&&b.direction===a.direction&&b.kind!=='cross'&&Math.abs(b.offset-a.offset)<2.1){const gap=(b.z-a.z)*a.direction;if(gap>0&&gap<40)target=Math.min(target,Math.max(0,(gap-7)*.75));}
    }
    if(a.kind==='police'){
     // Pure pursuit follows a point along the route, then the player nearby.
     // Heading changes continuously, including a U-turn after an overshoot.
     const z=p.z>a.z?Math.min(p.z,a.z+Math.max(9,a.speed*.65)):p.z;
     const aim=this.route.point(z,targetOffset),error=angle(Math.atan2(aim.x-a.x,z-a.z)-a.yaw);
     target=Math.min(target,36/(1+Math.abs(error)*4));
     for(const b of this.actors.values())if(b!==a&&Math.abs(b.offset-a.offset)<1.8&&b.z-a.z>0&&b.z-a.z<17)target=Math.min(target,Math.max(3,(b.z-a.z-5)*.7));
     a.speed+=clamp(target-a.speed,-7*dt,2.8*dt);a.yaw+=clamp(error,-1.15*dt,1.15*dt);
     a.x+=Math.sin(a.yaw)*a.speed*dt;a.z+=Math.cos(a.yaw)*a.speed*dt;a.offset=this.route.offset(a.x,a.z);a.y=this.route.height(a.x,a.z);
    }else{
     a.speed+=clamp(target-a.speed,-6*dt,2.8*dt);a.offset+=clamp(targetOffset-a.offset,-2.7*dt,2.7*dt);
     a.z+=a.direction*a.speed*dt/Math.sqrt(1+this.route.slope(a.z)**2);
     const targetPoint=this.route.point(a.z,a.offset);a.x=targetPoint.x;a.y=targetPoint.y;a.yaw=targetPoint.yaw+(a.direction<0?Math.PI:0);
    }
   }
   const q=new Quaternion().setFromAxisAngle(up,a.yaw);a.body.setNextKinematicTranslation({x:a.x-this.origin.x,y:a.y+a.halfHeight,z:a.z-this.origin.z});a.body.setNextKinematicRotation(q);
   if(a.kind==='traffic'&&!a.passed&&a.z<p.z-3&&a.z>p.z-8){a.passed=true;if(Math.abs(a.x-p.x)<3.2&&this.sim.groundSpeed>12&&this.time-a.lastImpact>2){this.nearMisses++;this.tell('CLOSE CALL +100');}}
  }
  if(this.scan>0)return;
  for(const i of this.chunks)if(this.route.junction(i)&&Math.abs(i*CHUNK-p.z)<180&&this.signal(i*CHUNK)==='red'){
   const tick=Math.floor(this.time/5),previous=this.crossings.get(i);if(previous===tick)continue;this.crossings.set(i,tick);
   const id=`cross-${i}-${tick}`;this.addActor({id,kind:'cross',model:tick%2?'compact':'hatchback',z:i*CHUNK,direction:tick%2?1:-1,offset:tick%2?-15:15,speed:6});
  }
  for(const[id,a]of this.actors)if(a.kind==='cross'&&Math.abs(a.offset)>23){this.sim.world.removeRigidBody(a.body);this.actors.delete(id);this.objects.delete(id);}
 }
 step(input,dt=STEP){
  if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.state='running';this.tell('LOSE THE PATROL');}return;}
  if(this.state!=='running')return;
  this.time+=dt;this.scan-=dt;if(this.scan<=0)this.ensure();
  const assisted=this.assist.update(this.sim,input,dt);this.sim.steeringRate=assisted.steeringRate;this.sim.setInput(assisted.throttle,assisted.steer);
  this.updateActors(dt);this.prepareContacts();if(this.scan<=0)this.scan=.3;
  this.sim.step(dt);const p=this.position;
  this.distance=Math.max(this.distance,p.z-8);
  if(this.time>4){
   this.capture=this.gap<8&&this.sim.groundSpeed<4?this.capture+dt:Math.max(0,this.capture-dt*2);
   this.escape=this.gap>160?this.escape+dt:0;
   this.overturned=Math.abs(this.sim.roll)>1.05||Math.abs(this.sim.pitch)>1.05?this.overturned+dt:Math.max(0,this.overturned-dt);
   if(this.damage>=100)this.finish('wrecked');else if(this.capture>3||this.overturned>4)this.finish('caught');else if(this.escape>5)this.finish('escaped');
  }
 }
 finish(reason){this.state=reason;this.sim.setInput(0,0);}
 snapshot(){return{state:this.state,seed:this.route.seed,setup:this.sim.setupId,time:this.time,distance:this.distance,score:this.score,damage:this.damage,gap:this.gap,capture:this.capture,escape:this.escape,nearMisses:this.nearMisses,objects:this.objects.size,chunks:this.chunks.size,tiles:this.sim.road.tiles.size,position:this.position,physics:this.sim.snapshot()};}
 free(){this.sim.free();}
}
