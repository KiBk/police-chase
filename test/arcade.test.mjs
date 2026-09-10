import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {Chase} from '../src/chase.js';
import {STEP} from '../src/physics.js';
import {Route,LANE,CHUNK,ROAD_WIDTH,VERGE_WIDTH} from '../src/route.js';
function isolate(c){for(const[id,o]of c.objects)if(id!=='police'){c.sim.world.removeRigidBody(o.body);c.objects.delete(id);c.actors.delete(id);}c.ensure=()=>{};c.state='running';}
function launch(c,speed=22){for(const b of c.sim.dynamic)b.setLinvel({x:0,y:0,z:speed},true);c.sim.tyres.forEach((t,i)=>t.omega=speed/c.sim.wheelParts[i].radius);c.sim.refresh();}
const offset=c=>c.route.offset(c.position.x,c.position.z);
const heading=c=>{const q=c.sim.chassis.rotation();return 2*Math.atan2(q.y,q.w);};

test('four vehicle types change lanes in about a second and settle after releasing the key',()=>{
 for(const model of['compact','hatchback','sports','pickup'])for(const speed of[14,28]){const c=new Chase(model,123);try{
  isolate(c);launch(c,speed);let atOne=0,maxRoll=0,maxError=0;
  for(let i=0;i<720;i++){c.step({throttle:0,steer:i<192?1:0});if(i===287)atOne=offset(c);maxRoll=Math.max(maxRoll,Math.abs(c.sim.roll));maxError=Math.max(maxError,c.sim.constraintError());}
  assert.ok(atOne< -LANE+.65,`${model} at ${speed}: ${atOne}`);assert.ok(Math.abs(offset(c)+LANE)<.15);assert.ok(Math.abs(heading(c)-Math.atan(c.route.slope(c.position.z)))<.06);assert.ok(maxRoll<.2&&maxError<.006);
 }finally{c.free();}}
});

test('the open verge keeps useful speed, visible suspension motion and a recoverable path back',()=>{
 const c=new Chase('hatchback',123);try{isolate(c);launch(c);let maxVy=0,maxRoll=0,verge=0;
  for(let i=0;i<1680;i++){const t=i*STEP;c.step({throttle:0,steer:t<1.4?-1:t<4.4?0:t<5.4?1:0});if(t>2&&t<4)verge=Math.min(verge||offset(c),offset(c));maxVy=Math.max(maxVy,Math.abs(c.sim.vy));maxRoll=Math.max(maxRoll,Math.abs(c.sim.roll));}
  assert.ok(verge>7.5);assert.ok(c.sim.groundSpeed>19);assert.ok(Math.abs(offset(c)-2)<.2);assert.ok(maxVy>.15&&maxVy<1.7);assert.ok(maxRoll>.005&&maxRoll<.15);assert.equal(c.recoveries,0);
 }finally{c.free();}
});

test('arcade control does not steer or hold the car up in the air',()=>{
 const runs=[];
 for(const steer of[0,1]){const c=new Chase('hatchback',123);try{isolate(c);launch(c);for(const b of c.sim.dynamic){const p=b.translation();b.setTranslation({x:p.x,y:p.y+5,z:p.z},true);}c.sim.tyres.forEach(t=>{t.contact=false;t.load=0;});const start=c.sim.chassis.translation().y;
  for(let i=0;i<72;i++)c.step({throttle:0,steer});runs.push({x:c.position.x,y:c.position.y-start,yaw:heading(c),vy:c.sim.vy});assert.ok(c.sim.vy< -2.8);assert.ok(c.position.y-start<-.4);
 }finally{c.free();}}
 assert.ok(Math.abs(runs[0].x-runs[1].x)<.01);assert.ok(Math.abs(runs[0].yaw-runs[1].yaw)<.01);
});

test('a completely inverted car rights itself promptly with intact suspension and capture grace',()=>{
 for(const model of['sports','pickup']){const c=new Chase(model,123);try{isolate(c);const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI),centre=new Vector3().copy(c.sim.chassis.translation());
  for(const b of c.sim.dynamic){const p=new Vector3().copy(b.translation()).sub(centre).applyQuaternion(q).add(centre);p.y+=1.3;b.setTranslation(p,true);b.setRotation(q.clone().multiply(new Quaternion().copy(b.rotation())),true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);}c.sim.refresh();
  for(let i=0;i<264;i++)c.step({throttle:0,steer:0});assert.equal(c.recoveries,1);assert.ok(c.graceUntil>c.time+2);assert.equal(c.state,'running');assert.equal(c.capture,0);
  for(let i=0;i<480;i++)c.step({throttle:1,steer:0});const r=c.sim.chassis.rotation();assert.ok(1-2*(r.x*r.x+r.z*r.z)>.9);assert.ok(c.sim.constraintError()<.005);assert.ok(c.sim.groundSpeed>5);
 }finally{c.free();}}
});

test('seeded encounters leave open approaches and continuous usable verges',()=>{
 const kinds=new Set();
 for(const seed of[123,456,789]){const r=new Route(seed);for(let group=1;group<100;group++){
  const e=r.encounter(group*8);kinds.add(e.kind);assert.deepEqual(e,new Route(seed).encounter(group*8));
  for(const phase of[0,1,7])assert.equal(r.features(group*8+phase).length,0);
  for(let phase=0;phase<8;phase++)for(const f of r.features(group*8+phase))if(f.kind!=='traffic')assert.ok(Math.abs(f.offset)<ROAD_WIDTH/2);
  for(const f of r.structures(group*8))if(f.kind==='post'||f.kind==='sign')assert.ok(Math.abs(f.offset)>ROAD_WIDTH/2+VERGE_WIDTH);
  for(const side of[-1,1]){const p=r.point(e.z,side*7);assert.ok(Math.abs(r.height(p.x,p.z)-r.elevation(p.z))<.07);}
 }}assert.equal(kinds.size,5);
});

test('cross traffic gets at least three seconds of approach distance before it can spawn',()=>{
 const c=new Chase('hatchback',123);try{isolate(c);c.route.junction=i=>i===3;c.route.signal=()=> 'red';c.time=7;c.scan=0;c.updateActors(STEP);const count=[...c.actors.values()].filter(a=>a.kind==='cross').length;assert.equal(count,1);
  for(const b of c.sim.dynamic){const p=b.translation();b.setTranslation({x:p.x,y:p.y,z:p.z+55},true);}c.time=14;c.scan=0;c.updateActors(STEP);assert.equal([...c.actors.values()].filter(a=>a.kind==='cross').length,count);
 }finally{c.free();}
});

test('a sustained verge run follows bends and streams bounded scenery without steering corrections',()=>{
 const c=new Chase('hatchback',123);try{c.finish=()=>{};c.start();let maxError=0,maxObjects=0;
  for(let i=0;i<240*65;i++){
   const steer=c.time>3&&c.time<4.1?-1:0;c.step({throttle:1,steer});maxError=Math.max(maxError,c.sim.constraintError());maxObjects=Math.max(maxObjects,c.objects.size);if(c.state==='escaped')break;
  }
  assert.ok(c.distance>1000);assert.ok(c.origin.z>950);assert.ok(offset(c)>6.7&&offset(c)<8.6);assert.equal(c.recoveries,0);assert.ok(maxError<.02);assert.ok(maxObjects<650);assert.equal(c.chunks.size,13);assert.equal(c.sim.road.tiles.size,9);assert.ok(c.sim.road.gripAt(c.sim.x,c.sim.z)>.9);
 }finally{c.free();}
});
