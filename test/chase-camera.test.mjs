import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {ChaseCamera} from '../src/chase-camera.js';
test('camera world position and heading remain continuous through repeated physics origin shifts',()=>{
 const a=new ChaseCamera(new PerspectiveCamera()),b=new ChaseCamera(new PerspectiveCamera());let origin={x:0,z:0};
 for(let i=0;i<900;i++){
  const z=i*.7,x=Math.sin(z/80)*15,rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.2*Math.cos(z/80));
  if(z-origin.z>60)origin={x,z};
  a.update({position:new Vector3(x,.6,z),rotation},{x:1,z:22},22,1/60,false,{x:0,z:0});
  b.update({position:new Vector3(x-origin.x,.6,z-origin.z),rotation},{x:1,z:22},22,1/60,false,origin);
  assert.ok(a.camera.position.distanceTo(b.camera.position.clone().add(new Vector3(origin.x,0,origin.z)))<1e-6);
  assert.ok(a.camera.quaternion.angleTo(b.camera.quaternion)<1e-6,'rebase must not turn the camera');
 }
});
test('rollovers keep the camera upright and follow travel without a heading flip',()=>{
 const camera=new PerspectiveCamera(),rig=new ChaseCamera(camera),frame={position:new Vector3(0,.6,0),rotation:new Quaternion()};
 rig.update(frame,{x:0,z:20},20,1/60,false,{x:0,z:0});
 for(let i=0;i<240;i++){
  frame.rotation.setFromAxisAngle(new Vector3(1,0,0),i*.05);frame.position.z+=.3;const previous=rig.yaw;
  rig.update(frame,{x:0,z:20},20,1/60,false,{x:0,z:0});assert.ok(Math.abs(rig.yaw-previous)<=1.35/60+1e-8);assert.ok(Math.abs(rig.yaw)<.03);
  assert.ok(new Vector3(0,1,0).applyQuaternion(camera.quaternion).y>.8);
 }
});
