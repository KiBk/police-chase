import test from 'node:test';
import assert from 'node:assert/strict';
import {Suspension,STEP} from '../src/physics.js';
import {Chase} from '../src/chase.js';
import {DriverAssist} from '../src/driver-assist.js';
function launch(s){s.setDriving(true);for(const b of s.dynamic)b.setLinvel({x:0,y:0,z:22},true);s.tyres.forEach((t,i)=>{t.omega=22/s.wheelParts[i].radius;});}
test('brake assistance preserves wheel rotation during an emergency stop',()=>{
 const result=[];
 for(const enabled of[false,true]){const s=new Suspension('hatchback');try{launch(s);s.brakeAssist=enabled;s.setInput(-1,0);let locked=0,samples=0,k=0;
  for(;k<240*6;k++){s.step();for(const t of s.tyres)if(t.contact&&Math.abs(t.longitudinal)>8){samples++;if(Math.abs(t.omega)<.5)locked++;}if(s.groundSpeed<1)break;}
  assert.ok(k<240*4);result.push({locked:locked/samples,distance:s.z+s.worldOrigin.z});
 }finally{s.free();}}
 assert.ok(result[0].locked>.5);assert.ok(result[1].locked<.05);assert.ok(result[1].distance<result[0].distance*1.25);
});
test('assisted sustained keyboard steering turns without a sudden slide or rollover',()=>{
 const s=new Suspension('hatchback'),assist=new DriverAssist();try{launch(s);let maxRoll=0,maxG=0;
  for(let i=0;i<240*5;i++){const a=assist.update(s,{throttle:.4,steer:1},STEP);s.setInput(a.throttle,a.steer);s.step();maxRoll=Math.max(maxRoll,Math.abs(s.roll));maxG=Math.max(maxG,Math.abs(s.lateralG));}
  assert.ok(maxRoll<.2);assert.ok(maxG>.2&&maxG<1);assert.ok(Math.abs(s.chassis.rotation().y)>.1);assert.ok(s.constraintError()<.001);
 }finally{s.free();}
});
test('trees, roadside posts, signs and traffic lights release and move under a player hit',()=>{
 for(const kind of['tree','post','signal','sign']){const c=new Chase('hatchback',123);try{
  for(const[id,o]of c.objects)if(id!=='police'){c.sim.world.removeRigidBody(o.body);c.objects.delete(id);c.actors.delete(id);}
  c.addProp({kind,id:'hit-target',z:17,offset:1.6,h:5,j:0,index:0});const o=c.objects.get('hit-target');assert.equal(o.body.isKinematic(),true);c.start();for(let i=0;i<240*9;i++)c.step({throttle:1,steer:0});
  assert.ok(o.hit&&o.active);assert.ok(o.body.isDynamic());assert.ok(Math.abs(o.body.rotation().x)>.15);assert.ok(Math.abs(o.body.translation().z+c.origin.z-17)>.5);assert.ok(c.damage<=3);assert.ok(c.sim.constraintError()<.003);
 }finally{c.free();}}
});
test('destroying both signal heads releases the junction instead of leaving an invisible red light',()=>{
 const c=new Chase('hatchback',123);try{c.route.signal=()=> 'red';assert.equal(c.signal(120),'red');c.objects.get('signal3--1').hit=true;assert.equal(c.signal(120),'red');c.objects.get('signal3-1').hit=true;assert.equal(c.signal(120),'green');}finally{c.free();}
});
