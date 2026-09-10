import {clamp,DRIVE_LIMIT} from './route.js';
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

// The player requests a continuous position across the road. A bounded planar
// controller supplies the arcade response; gravity, springs, roll and contacts
// still come from the articulated vehicle. Never correct an airborne vehicle.
export class ArcadeDriver {
 constructor(offset=null){this.reset(offset);}
 reset(offset=null){this.targetOffset=offset;this.lateral=0;this.input={throttle:0,steer:0};}
 prepare(game,input,dt){
  this.input=input;const s=game.sim,p=game.position,offset=game.route.offset(p.x,p.z);
  if(this.targetOffset===null)this.targetOffset=offset;
  const speed=s.groundSpeed,mobility=clamp(speed/7,0,1),maxLateral=6*mobility;
  this.targetOffset=clamp(this.targetOffset-input.steer*maxLateral*dt,-DRIVE_LIMIT,DRIVE_LIMIT);
  const target=clamp((offset-this.targetOffset)*8,-maxLateral,maxLateral);
  this.lateral+=clamp(target-this.lateral,-20*dt,20*dt);
  const yaw=this.heading(game),q=s.chassis.rotation(),bodyYaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));
  const desiredYaw=yaw+Math.atan2(this.lateral,Math.max(8,speed))*.8;
  const steer=clamp(Math.atan(angle(desiredYaw-bodyYaw)*5*s.wheelbase/Math.max(6,speed))/.38,-.8,.8);
  return{throttle:input.throttle,steer};
 }
 heading(game){return Math.atan(game.route.slope(game.position.z+game.sim.groundSpeed*.18));}
 afterStep(game,dt){
  const s=game.sim,q=s.chassis.rotation(),p=s.chassis.translation();
  if(1-2*(q.x*q.x+q.z*q.z)<.55||s.tyres.filter(t=>t.contact).length<2){
   this.reset(game.route.offset(game.position.x,game.position.z));return;
  }
  const yaw=this.heading(game),fx=Math.sin(yaw),fz=Math.cos(yaw),lx=fz,lz=-fx,v=s.chassis.linvel();
  const longitudinal=v.x*fx+v.z*fz,lateral=v.x*lx+v.z*lz;
  const dv=clamp((this.lateral-lateral)*(1-Math.exp(-dt*16)),-18*dt,18*dt);
  let forward=0;
  if(this.input.throttle>0&&longitudinal<27)forward=this.input.throttle*1.5*dt;
  if(longitudinal>30)forward=-Math.min(longitudinal-30,12*dt);
  if(longitudinal< -6)forward=Math.min(-6-longitudinal,6*dt);
  const bodyYaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));
  const desired=yaw+(longitudinal>2?Math.atan2(this.lateral,Math.max(8,longitudinal))*.8:0);
  const yawRate=clamp(angle(desired-bodyYaw)*6,-1.5,1.5),dw=clamp((yawRate-s.chassis.angvel().y)*(1-Math.exp(-dt*15)),-9*dt,9*dt);
  // Apply one rigid planar correction across every linked body. Relative
  // suspension velocities and vertical/roll/pitch modes are preserved.
  for(const b of s.dynamic){
   const at=b.translation(),vel=b.linvel(),spin=b.angvel();
   b.setLinvel({x:vel.x+lx*dv+fx*forward+dw*(at.z-p.z),y:vel.y,z:vel.z+lz*dv+fz*forward-dw*(at.x-p.x)},true);
   b.setAngvel({x:spin.x,y:spin.y+dw,z:spin.z},true);
  }
  s.refresh();
 }
}
