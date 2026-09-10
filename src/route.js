// Stateless seeded route: a coordinate always describes the same piece of road.
export const CHUNK = 40, ROAD_WIDTH = 6.4, LANE = 1.6;
export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth = x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export function random(seed,index,salt=0){
 let n=(seed^Math.imul(index,374761393)^Math.imul(salt,668265263))>>>0;
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
export class Route {
 constructor(seed){this.seed=seed>>>0;}
 noise(z,scale,salt){const i=Math.floor(z/scale),t=smooth(z/scale-i);return (random(this.seed,i,salt)*(1-t)+random(this.seed,i+1,salt)*t)*2-1;}
 centre(z){return smooth((Math.abs(z)-30)/100)*(24*this.noise(z,170,1)+42*this.noise(z,430,2));}
 slope(z){return (this.centre(z+.25)-this.centre(z-.25))/.5;}
 elevation(z){return smooth((Math.abs(z)-25)/80)*(1.6*this.noise(z,220,3)+.45*this.noise(z,90,4));}
 offset(x,z){return (this.centre(z)-x)/Math.sqrt(1+this.slope(z)**2);}
 point(z,offset=0){const slope=this.slope(z);return{x:this.centre(z)-offset*Math.sqrt(1+slope*slope),y:this.elevation(z),z,yaw:Math.atan2(slope,1)};}
 junction(index){return Math.abs(index)>1&&((index%6)+6)%6===3;}
 signal(z,time){const i=Math.round(z/CHUNK),phase=((time+random(this.seed,i,80)*19)%34+34)%34;return phase<18?'green':phase<21?'amber':'red';}
 height(x,z){
  const off=Math.abs(this.offset(x,z)),shoulder=smooth((off-ROAD_WIDTH/2)/2.6);
  const junction=Math.round(z/CHUNK),cross=this.junction(junction)?1-smooth((Math.abs(z-junction*CHUNK)-3)/3):0;
  const bumps=.065*Math.sin(z*1.5+x*.8)+.045*Math.sin(z*.73-x*1.9)+.025*Math.sin(z*2.4+x*1.4);
  return this.elevation(z)+shoulder*(1-cross)*(-.11+bumps);
 }
 features(index){
  const z=index*CHUNK,features=[];
  if(Math.abs(index)>1){
   if(random(this.seed,index,10)>.22)features.push({kind:'traffic',id:`t${index}a`,z:z+8+random(this.seed,index,11)*17,direction:1,model:['compact','hatchback','wagon','minivan','suv','pickup'][Math.floor(random(this.seed,index,12)*6)],speed:11+random(this.seed,index,13)*6});
   if(random(this.seed,index,14)>.28)features.push({kind:'traffic',id:`t${index}b`,z:z+12+random(this.seed,index,15)*24,direction:-1,model:['sedan','coupe','hatchback','offroad'][Math.floor(random(this.seed,index,16)*4)],speed:14+random(this.seed,index,17)*6});
  }
  if(Math.abs(index)>2&&((index%5)+5)%5===2){
   const side=random(this.seed,index,20)>.5?1:-1;
   for(let k=0;k<3;k++)features.push({kind:'barrier',id:`b${index}-${k}`,z:z+14,offset:side*(1.1+k*1.1)});
   for(let k=0;k<6;k++)features.push({kind:'cone',id:`c${index}-${k}`,z:z+3+k*2,offset:side*3.3});
  }
  if(Math.abs(index)>2&&((index%4)+4)%4===1)for(let k=0;k<3;k++)features.push({kind:'bale',id:`h${index}-${k}`,z:z+18+k*1.3,offset:(random(this.seed,index,21)>.5?1:-1)*6});
  return features;
 }
 structures(index){
  const result=[],z0=index*CHUNK;
  for(let j=0;j<16;j++)result.push({kind:'tree',id:`tree${index}-${j}`,z:z0+random(this.seed,index,j+200)*CHUNK,offset:(j%2?1:-1)*(12+random(this.seed,index,j+250)*28),h:3+random(this.seed,index,j+300)*4,j,index});
  for(let j=0;j<8;j++)for(const side of[-1,1]){
   if(this.junction(index)&&j<2||random(this.seed,index,j+350)<.22)continue;
   result.push({kind:'post',id:`post${index}-${j}-${side}`,z:z0+j*5+2.5,offset:side*5.8,index});
  }
  if(this.junction(index))for(const direction of[-1,1])result.push({kind:'signal',id:`signal${index}-${direction}`,z:z0-direction*7,offset:direction*3.8,direction,index});
  if(((index%3)+3)%3===1)result.push({kind:'sign',id:`sign${index}`,z:z0+27,offset:4.4,index});
  return result;
 }
}
