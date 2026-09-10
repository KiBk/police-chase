// Stateless seeded route: a coordinate always describes the same piece of road.
export const CHUNK = 40, ROAD_WIDTH = 9.6, LANE = ROAD_WIDTH/4, VERGE_WIDTH = 4, DRIVE_LIMIT = 8;
export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth = x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export function random(seed,index,salt=0){
 let n=(seed^Math.imul(index,374761393)^Math.imul(salt,668265263))>>>0;
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
export class Route {
 constructor(seed){this.seed=seed>>>0;}
 noise(z,scale,salt){const i=Math.floor(z/scale),t=smooth(z/scale-i);return (random(this.seed,i,salt)*(1-t)+random(this.seed,i+1,salt)*t)*2-1;}
 centre(z){return smooth((Math.abs(z)-70)/180)*(18*this.noise(z,260,1)+30*this.noise(z,550,2));}
 slope(z){return (this.centre(z+.25)-this.centre(z-.25))/.5;}
 elevation(z){return smooth((Math.abs(z)-25)/80)*(1.6*this.noise(z,220,3)+.45*this.noise(z,90,4));}
 offset(x,z){return (this.centre(z)-x)/Math.sqrt(1+this.slope(z)**2);}
 point(z,offset=0){const slope=this.slope(z);return{x:this.centre(z)-offset*Math.sqrt(1+slope*slope),y:this.elevation(z),z,yaw:Math.atan2(slope,1)};}
 encounter(index){
  const group=Math.floor(index/8),base=group*8;
  const kind=group===0?'overtake':['overtake','barriers','weave','crossing','bypass'][Math.floor(random(this.seed,group,900)*5)];
  return{kind,base,z:(base+4)*CHUNK,side:random(this.seed,group,901)>.5?1:-1};
 }
 junction(index){const e=this.encounter(index);return e.kind==='crossing'&&index===e.base+4;}
 signal(z,time){const i=Math.round(z/CHUNK),phase=((time+random(this.seed,i,80)*19)%34+34)%34;return phase<18?'green':phase<21?'amber':'red';}
 height(x,z){
  const off=Math.abs(this.offset(x,z)),shoulder=smooth((off-ROAD_WIDTH/2)/VERGE_WIDTH);
  const junction=Math.round(z/CHUNK),cross=this.junction(junction)?1-smooth((Math.abs(z-junction*CHUNK)-3)/3):0;
  const bumps=.025*Math.sin(z*.65+x*.5)+.018*Math.sin(z*.38-x*.7)+.012*Math.sin(z*1.1+x*.8);
  return this.elevation(z)+shoulder*(1-cross)*(-.035+bumps);
 }
 features(index){
  const z=index*CHUNK,features=[],e=this.encounter(index),phase=index-e.base;
  if(index<3)return features;
  const traffic=(direction,speed)=>features.push({kind:'traffic',id:`t${index}-${direction}`,z:z+20,direction,model:(direction>0?['compact','hatchback','wagon','minivan']:['sedan','coupe','suv','pickup'])[Math.floor(random(this.seed,index,12)*4)],speed});
  if(e.kind==='overtake'){if(phase===3)traffic(1,12);if(phase===6)traffic(-1,14);}
  if(e.kind==='crossing'&&phase===2)traffic(1,14);
  if((e.kind==='barriers'&&phase===4)||(e.kind==='weave'&&(phase===3||phase===5))){
   const side=e.side*(phase===5?-1:1);
   for(let k=0;k<3;k++)features.push({kind:'barrier',id:`b${index}-${k}`,z:z+18,offset:side*(LANE+(k-1)*1.15)});
   for(let k=0;k<5;k++)features.push({kind:'cone',id:`c${index}-${k}`,z:z+2+k*2,offset:side*(ROAD_WIDTH/2-.3)});
  }
  if(e.kind==='bypass'&&phase===4)for(let k=0;k<4;k++)features.push({kind:'bale',id:`h${index}-${k}`,z:z+18,offset:(k-1.5)*1.5});
  // Each 320 m encounter has an open entry and exit. Barriers occupy one
  // lane only; both verges remain continuous, including at crossings.
  return features;
 }
 structures(index){
  const result=[],z0=index*CHUNK;
  for(let j=0;j<16;j++)result.push({kind:'tree',id:`tree${index}-${j}`,z:z0+random(this.seed,index,j+200)*CHUNK,offset:(j%2?1:-1)*(12+random(this.seed,index,j+250)*28),h:3+random(this.seed,index,j+300)*4,j,index});
  for(let j=0;j<8;j++)for(const side of[-1,1]){
   if(this.junction(index)&&j<2||random(this.seed,index,j+350)<.22)continue;
   result.push({kind:'post',id:`post${index}-${j}-${side}`,z:z0+j*5+2.5,offset:side*9.4,index});
  }
  if(this.junction(index))for(const direction of[-1,1])result.push({kind:'signal',id:`signal${index}-${direction}`,z:z0-direction*7,offset:direction*9,direction,index});
  if(((index%3)+3)%3===1)result.push({kind:'sign',id:`sign${index}`,z:z0+27,offset:9.2,index});
  return result;
 }
}
