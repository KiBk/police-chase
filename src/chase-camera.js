import {Vector3,Quaternion} from 'three';
import {clamp} from './route.js';
export class ChaseCamera {
 constructor(camera){this.camera=camera;this.forward=new Vector3(0,0,1);this.desired=new Vector3();this.look=new Vector3();this.bodyForward=new Vector3();this.up=new Vector3();this.rotation=new Quaternion();this.reset();}
 reset(){this.initialized=false;this.yaw=0;this.origin={x:0,z:0};}
 update(frame,velocity,speed,dt,ready,origin){
  // Physics rebases every ~60 m. Translate the camera by exactly that change
  // before smoothing, otherwise it briefly looks backwards across the shift.
  if(this.initialized){this.camera.position.x-=origin.x-this.origin.x;this.camera.position.z-=origin.z-this.origin.z;}
  this.origin.x=origin.x;this.origin.z=origin.z;
  this.rotation.copy(frame.rotation);this.bodyForward.set(0,0,1).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);
  let heading=this.yaw;
  if(this.up.y>.25&&Math.hypot(this.bodyForward.x,this.bodyForward.z)>.3)heading=Math.atan2(this.bodyForward.x,this.bodyForward.z);
  // During a fast slide or rollover, track travel instead of spinning with
  // the chassis. Slow reversing retains the normal behind-the-car view.
  if(speed>6&&(velocity.x*this.bodyForward.x+velocity.z*this.bodyForward.z>0||this.up.y<.25))heading=Math.atan2(velocity.x,velocity.z);
  const difference=Math.atan2(Math.sin(heading-this.yaw),Math.cos(heading-this.yaw));
  if(!this.initialized)this.yaw=heading;else this.yaw+=clamp(difference*(1-Math.exp(-dt*3)), -1.35*dt,1.35*dt);
  this.forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
  this.desired.copy(frame.position).addScaledVector(this.forward,-(ready?15:17+speed*.16));this.desired.y=frame.position.y+(ready?9:10+speed*.045);if(ready)this.desired.x+=8;
  this.look.copy(frame.position).addScaledVector(this.forward,ready?7:14+speed*.25);this.look.y=frame.position.y+1;
  if(!this.initialized){this.camera.position.copy(this.desired);this.initialized=true;}else this.camera.position.lerp(this.desired,1-Math.exp(-dt*7));
  this.camera.lookAt(this.look);return this.forward;
 }
}
