import {Vector3,Quaternion} from 'three';
import {clamp} from './route.js';
// Full steering lock stays available. Keyboard turn-in is progressive, while
// releasing or reversing the keys catches a slide faster. A small caster-like
// correction only acts beyond ordinary cornering slip, without adding grip.
export class DriverAssist {
 constructor(){this.steer=0;this.forward=new Vector3();this.side=new Vector3();this.q=new Quaternion();}
 update(sim,input,dt){
  this.q.copy(sim.chassis.rotation());this.forward.set(0,0,1).applyQuaternion(this.q);this.side.set(1,0,0).applyQuaternion(this.q);
  const velocity=sim.chassis.linvel(),long=velocity.x*this.forward.x+velocity.z*this.forward.z,lateral=velocity.x*this.side.x+velocity.z*this.side.z,speed=Math.abs(long);
  const slip=Math.atan2(lateral,Math.max(4,speed));
  const excess=Math.sign(slip)*Math.max(0,Math.abs(slip)-.10);
  const upright=1-2*(this.q.x*this.q.x+this.q.z*this.q.z)>.65;
  const grounded=sim.tyres.filter(t=>t.contact).length>=2;
  const counter=long>5&&upright&&grounded?clamp(excess*(input.steer===0?.70:.22),-.15,.15):0;
  const target=clamp(input.steer+counter/.38,-1,1);
  const reversing=input.steer*this.steer<-.02;
  const catching=input.steer*slip>0&&Math.abs(slip)>.10;
  const rate=reversing||catching?3:input.steer===0?2:1.35-.4*clamp(speed/35,0,1);
  this.steer+=clamp(target-this.steer,-rate*dt/.38,rate*dt/.38);
  return{throttle:input.throttle,steer:this.steer,steeringRate:3};
 }
}
