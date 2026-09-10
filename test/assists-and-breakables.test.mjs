import test from 'node:test';
import assert from 'node:assert/strict';
import {Suspension,STEP} from '../src/physics.js';
import {Chase} from '../src/chase.js';
import {DriverAssist} from '../src/driver-assist.js';
import {Vector3} from 'three';
function launch(s,speed=22){s.setDriving(true);for(const b of s.dynamic)b.setLinvel({x:0,y:0,z:speed},true);s.tyres.forEach((t,i)=>{t.omega=speed/s.wheelParts[i].radius;});}
test('brake assistance preserves wheel rotation during an emergency stop',()=>{
 const result=[];
 for(const enabled of[false,true]){const s=new Suspension('hatchback');try{launch(s);s.brakeAssist=enabled;s.setInput(-1,0);let locked=0,samples=0,k=0;
  for(;k<240*6;k++){s.step();for(const t of s.tyres)if(t.contact&&Math.abs(t.longitudinal)>8){samples++;if(Math.abs(t.omega)<.5)locked++;}if(s.groundSpeed<1)break;}
  assert.ok(k<240*4);result.push({locked:locked/samples,distance:s.z+s.worldOrigin.z});
 }finally{s.free();}}
 assert.ok(result[0].locked>.5);assert.ok(result[1].locked<.05);assert.ok(result[1].distance<result[0].distance*1.25);
});
test('keyboard steering retains original turn authority at speed and reverses faster to catch a slide',()=>{
 for(const model of['hatchback','sports']){
  const results=[];
  for(const enabled of[false,true]){const s=new Suspension(model),assist=new DriverAssist();try{
   launch(s);let reverseTime=null,peakSteer=0,x1=0,peakSlip=0;
   for(let i=0;i<480;i++){
    const input={throttle:.35,steer:i<240?1:-1},a=enabled?assist.update(s,input,STEP):input;
    s.steeringRate=a.steeringRate;s.setInput(a.throttle,a.steer);s.step();
    if(i<240)peakSteer=Math.max(peakSteer,s.steering);
    if(i===239)x1=s.x+s.worldOrigin.x;
    if(i>=240&&s.steering<-.10&&reverseTime===null)reverseTime=(i-240)*STEP;
    const f=new Vector3(0,0,1).applyQuaternion(s.chassis.rotation()),v=s.chassis.linvel();peakSlip=Math.max(peakSlip,Math.abs(Math.atan2(v.x*f.z-v.z*f.x,Math.max(1,v.x*f.x+v.z*f.z))));
   }
   assert.ok(peakSteer>.32);assert.ok(peakSlip>.08);assert.ok(Math.abs(s.roll)<.3);results.push({x1,reverseTime});
  }finally{s.free();}}
  assert.ok(results[1].x1>results[0].x1*.9&&results[1].x1<results[0].x1*1.1);assert.ok(results[1].reverseTime<results[0].reverseTime*.7);
 }
});
test('releasing steering helps an induced slide recover without eliminating the slide',()=>{
 const results=[];
 for(const enabled of[false,true]){const s=new Suspension('sports'),assist=new DriverAssist();try{
  launch(s);for(let i=0;i<240;i++)s.step();
  const centre=s.chassis.translation();for(const b of s.dynamic){const p=b.translation();b.setLinvel({x:-6+.7*(p.z-centre.z),y:0,z:22-.7*(p.x-centre.x)},true);b.setAngvel({x:0,y:.7,z:0},true);}s.tyres.forEach((t,i)=>t.omega=22/s.wheelParts[i].radius);
  let peakSlip=0,settled=null;
  for(let i=0;i<720;i++){const input={throttle:0,steer:0},a=enabled?assist.update(s,input,STEP):input;s.steeringRate=a.steeringRate;s.setInput(a.throttle,a.steer);s.step();
   const f=new Vector3(0,0,1).applyQuaternion(s.chassis.rotation()),v=s.chassis.linvel(),slip=Math.abs(Math.atan2(v.x*f.z-v.z*f.x,v.x*f.x+v.z*f.z));peakSlip=Math.max(peakSlip,slip);
   if(settled===null&&slip<.035&&Math.abs(s.chassis.angvel().y)<.1)settled=i*STEP;
  }
  assert.ok(peakSlip>.2&&settled!==null);results.push({peakSlip,settled});
 }finally{s.free();}}
 assert.ok(Math.abs(results[0].peakSlip-results[1].peakSlip)<.01);assert.ok(results[1].settled<results[0].settled*.9);
});
test('fast off-centre impacts release posts and traffic before contact without flipping the player',()=>{
 for(const kind of['post','sign','tree','traffic'])for(const side of[-1,1]){
  const c=new Chase('hatchback',123);try{
   for(const[id,o]of c.objects)if(id!=='police'){c.sim.world.removeRigidBody(o.body);c.objects.delete(id);c.actors.delete(id);}c.ensure=()=>{};
   const spec={kind,id:'target',z:kind==='traffic'?19:16,offset:1.6+side*.72,h:5,j:0,index:0};
   kind==='traffic'?c.addActor({...spec,model:'wagon',direction:1,speed:0}):c.addProp(spec);
   c.state='running';launch(c.sim,30);let roll=0,pitch=0,vy=0,releasedBeforeHit=false;const o=c.objects.get('target');
   for(let i=0;i<360;i++){c.step({throttle:0,steer:0});roll=Math.max(roll,Math.abs(c.sim.roll));pitch=Math.max(pitch,Math.abs(c.sim.pitch));vy=Math.max(vy,Math.abs(c.sim.vy));if(o.body.isDynamic()&&o.lastImpact<0&&!o.hit)releasedBeforeHit=true;}
   assert.ok(releasedBeforeHit);assert.ok(roll<.2&&pitch<.15&&vy<3);assert.ok(c.sim.constraintError()<.015);
   if(kind==='traffic'){assert.equal(o.mode,'loose');assert.ok(c.sim.groundSpeed>16&&c.damage<45);}else{assert.ok(o.hit);assert.ok(c.sim.groundSpeed>27);assert.equal(c.damage,0);}
  }finally{c.free();}
 }
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
