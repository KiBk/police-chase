import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {Route,CHUNK,LANE} from '../src/route.js';
import {ChaseRoad} from '../src/chase-road.js';
import {Chase} from '../src/chase.js';
import {STEP} from '../src/physics.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function drive(c,seconds,input){for(let i=0;i<seconds/STEP;i++)c.step(typeof input==='function'?input(c):input);}
const idle={throttle:0,steer:0};
function onlyPolice(c){for(const[id,o]of c.objects)if(id!=='police'){c.sim.world.removeRigidBody(o.body);c.objects.delete(id);c.actors.delete(id);}}

test('seeded routes are repeatable, different between seeds, continuous and have right-hand lanes',()=>{
 const a=new Route(123),b=new Route(123),c=new Route(456);let changed=0;
 for(let i=-3;i<300;i++){
  const z=i*CHUNK;assert.deepEqual(a.features(i),b.features(i));assert.equal(a.centre(z),b.centre(z));changed+=Math.abs(a.centre(z)-c.centre(z));
  assert.ok(Math.abs(a.centre(z+.001)-a.centre(z-.001))<.004);assert.ok(Math.abs(a.elevation(z+.001)-a.elevation(z-.001))<.001);
  const lane=a.point(z,LANE);assert.ok(Math.abs(a.offset(lane.x,z)-LANE)<1e-9);assert.ok(lane.x<a.centre(z));
 }
 assert.ok(changed>100);assert.notEqual(a.centre(500),a.centre(10500));
});

test('physical terrain samples match raycast contact height before and after rebasing',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),origin={x:0,z:0},road=new ChaseRoad(world,new Route(42),origin);
 try{
  for(const z of[0,61,183]){
   const offset={x:origin.x,z:z-origin.z};origin.x=0;origin.z=z;road.rebase(offset);road.ensure(0,0);world.step();
   for(const x of[-9.2,-1.6,6.2])for(const dz of[-3.3,.2,5.6]){
    const hit=world.castRay(new RAPIER.Ray({x,y:10,z:dz},{x:0,y:-1,z:0}),30,true);
    assert.ok(hit);assert.ok(Math.abs(10-hit.timeOfImpact-road.height(x,dz))<.0001);
   }
   assert.equal(road.tiles.size,9);
  }
 }finally{road.free();world.free();}
});

test('traffic keeps separate lanes, stops at red and resumes at green',()=>{
 const c=new Chase('hatchback',123);try{
  onlyPolice(c);c.route.junction=i=>i===3;c.route.signal=()=> 'red';const a=c.addActor({id:'test-forward',kind:'traffic',model:'compact',direction:1,z:88,speed:12});const b=c.addActor({id:'test-reverse',kind:'traffic',model:'sedan',direction:-1,z:151,speed:12});
  for(let i=0;i<600;i++){c.time+=1/60;c.scan=1;c.updateActors(1/60);c.sim.world.step();}
  assert.ok(a.z<114&&a.z>109);assert.ok(b.z>126&&b.z<131);assert.ok(a.speed<.2&&b.speed<.2);assert.ok(a.offset>0&&b.offset<0);
  const za=a.z,zb=b.z;c.route.signal=()=> 'green';for(let i=0;i<240;i++){c.time+=1/60;c.scan=1;c.updateActors(1/60);c.sim.world.step();}
  assert.ok(a.z>za+12);assert.ok(b.z<zb-12);
 }finally{c.free();}
});

test('soft blockers move under a real player collision without acting as immovable road walls',()=>{
 const c=new Chase('hatchback',123);try{
  onlyPolice(c);c.addProp({kind:'barrier',id:'test-barrier',z:17,offset:LANE});const o=c.objects.get('test-barrier'),start=o.body.translation();c.start();drive(c,9,{throttle:1,steer:0});
  const p=o.body.translation();assert.ok(o.active);assert.ok(Math.hypot(p.x+c.origin.x-start.x,p.z+c.origin.z-start.z)>1);assert.ok(c.barriersHit>0);assert.ok(c.damage<10);assert.ok(c.position.z>23);assert.ok(c.sim.constraintError()<.003);
 }finally{c.free();}
});

test('a stationary player is caught without being bulldozed or winning by police overshoot',()=>{
 for(const seed of[123,0x862eb47b,98765]){const c=new Chase('hatchback',seed);try{c.start();drive(c,20,idle);assert.equal(c.state,'caught');assert.ok(c.distance<1);assert.equal(c.damage,0);assert.ok(c.gap<8);}finally{c.free();}}
});

test('the patrol turns back after passing the player',()=>{
 const c=new Chase('hatchback',123);try{
  onlyPolice(c);c.police.z=32;c.police.x=-LANE;c.police.speed=8;c.police.body.setTranslation({x:-LANE,y:c.police.halfHeight,z:32},true);c.start();drive(c,27,idle);
  assert.equal(c.state,'caught');assert.ok(c.gap<8);
 }finally{c.free();}
});

test('five seconds with a sustained escape gap ends a run; finished runs stop progressing',()=>{
 const c=new Chase('sports',123);try{
  onlyPolice(c);c.police.z=-400;c.police.body.setTranslation({x:-LANE,y:c.police.halfHeight,z:-400},true);c.start();drive(c,28,idle);assert.equal(c.state,'escaped');const before=c.snapshot();drive(c,4,{throttle:1,steer:1});assert.deepEqual(c.snapshot(),before);
 }finally{c.free();}
});
