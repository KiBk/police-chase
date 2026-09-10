import {Vector3,Quaternion} from 'three';
import {clamp} from './route.js';
// Assists the driver's requested turn and countersteers a developing slide.
// It has no knowledge of the route, lane or traffic: the player chooses a path.
export class DriverAssist {
 constructor(){this.steer=0;this.forward=new Vector3();this.side=new Vector3();this.q=new Quaternion();}
 update(sim,input,dt){
  this.q.copy(sim.chassis.rotation());this.forward.set(0,0,1).applyQuaternion(this.q);this.side.set(1,0,0).applyQuaternion(this.q);
  const velocity=sim.chassis.linvel(),long=velocity.x*this.forward.x+velocity.z*this.forward.z,lateral=velocity.x*this.side.x+velocity.z*this.side.z,speed=Math.abs(long);
  const angle=Math.min(.38,Math.atan(7.8*sim.wheelbase/(speed*speed+4)));
  const slip=Math.atan2(lateral,Math.max(4,speed)),counter=speed>5?clamp(slip*.58-sim.chassis.angvel().y*.065,-.15,.15):0;
  const target=clamp((input.steer*angle+counter)/.38,-1,1);
  this.steer+=(target-this.steer)*(1-Math.exp(-dt*8));
  return{throttle:input.throttle,steer:this.steer};
 }
}
