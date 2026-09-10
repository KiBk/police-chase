import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Chase} from './chase.js';
import {ChaseCamera} from './chase-camera.js';
import {STEP} from './physics.js';
import {makeCar} from './model.js';
import {loadVehicleAsset} from './car-assets.js';
import {SETUPS,SETUP_ORDER,cycleSetup} from './setups.js';
import {DrivingInput} from './driving-input.js';
import {VehicleAudio} from './sound.js';
import {WorldView} from './world-view.js';
import {TrafficView} from './traffic-view.js';
import {CHUNK,clamp} from './route.js';
const $=id=>document.getElementById(id),seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const input=new DrivingInput(),sound=new VehicleAudio();
let game,car,paused=false,busy=false,last=performance.now(),accumulator=0,uiTime=0,previousState='',best=0,siren=null,sirenGain=null,frameDuration=16.7;
try{best=Number(localStorage.getItem('police-chase-best'))||0;}catch{}
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
catch{ $('title').textContent='The road needs 3D.';$('intro').textContent='WebGL could not start. Enable hardware acceleration or try another browser.';throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
$('viewport').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Procedural countryside road with player car, traffic and pursuing police');
const scene=new T.Scene();scene.background=new T.Color('#b9ccce');scene.fog=new T.Fog('#bac9c4',110,350);
const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.08);scene.environment=environment.texture;studio.dispose();pmrem.dispose();
scene.add(new T.HemisphereLight('#fff4de','#68836b',2.5));
const sun=new T.DirectionalLight('#ffedcc',2.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:100});sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const fill=new T.DirectionalLight('#bfdce4',.9);fill.position.set(10,15,20);scene.add(fill);
const land=new T.Mesh(new T.PlaneGeometry(1600,1600),new T.MeshStandardMaterial({color:'#8c9a72',roughness:1}));land.rotation.x=-Math.PI/2;land.position.y=-4;scene.add(land);
const player=new T.Group();scene.add(player);const world=new WorldView(scene),traffic=new TrafficView(scene);
const camera=new T.PerspectiveCamera(52,1,.12,450);
const cameraRig=new ChaseCamera(camera),right=new T.Vector3(),map=$('map').getContext('2d');
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function clearInput(){input.clear();for(const b of document.querySelectorAll('[data-drive]'))b.classList.remove('held');}
function persist(){try{localStorage.setItem('police-chase-best',String(best));}catch{}}
function setPause(value){if(!game||!['running','countdown'].includes(game.state))return;paused=value;clearInput();persist();sound.setBlocked(paused||document.hidden);previousState='';renderUI();}
async function newGame(id='hatchback'){
 if(busy)return;busy=true;$('start').disabled=true;$('prev').disabled=$('next').disabled=true;clearInput();sound.reset();persist();
 try{await loadVehicleAsset(id);const replacement=new Chase(id,seed());traffic.clear();world.clear();game?.free();game=replacement;car??=makeCar(player,{detail:false});car.update(game.sim);world.update(game);traffic.update(game,0);paused=false;sound.setBlocked(document.hidden);cameraRig.reset();accumulator=0;previousState='';renderUI();}
 catch(error){$('title').textContent='The garage needs a restart.';$('intro').textContent='A model could not load. Reload the page to try again.';console.error(error);}
 finally{busy=false;$('start').disabled=false;$('prev').disabled=$('next').disabled=false;last=performance.now();}
}
function start(){if(busy||!game)return;if(paused){setPause(false);return;}if(game.state==='ready'){game.start();clearInput();previousState='';renderUI();}else newGame(game.sim.setupId);}
$('start').addEventListener('click',start);$('prev').addEventListener('click',()=>newGame(cycleSetup(game.sim.setupId,-1)));$('next').addEventListener('click',()=>newGame(cycleSetup(game.sim.setupId,1)));
$('pause').addEventListener('click',()=>setPause(!paused));$('help').addEventListener('click',()=>{setPause(true);$('instructions').showModal();});$('close-help').addEventListener('click',()=>$('instructions').close());
$('sound').addEventListener('click',async()=>{
 const b=$('sound');b.disabled=true;try{const enabled=await sound.toggle();b.textContent=enabled?'Sound on':'Sound off';b.setAttribute('aria-label',enabled?'Mute sound':'Enable sound');b.setAttribute('aria-pressed',String(enabled));
  if(enabled&&!siren){siren=sound.context.createOscillator();siren.type='triangle';const filter=sound.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1300;sirenGain=sound.context.createGain();sirenGain.gain.value=0;siren.connect(filter).connect(sirenGain).connect(sound.gain);siren.start();}
 }catch(e){await sound.dispose();siren=null;b.textContent='Retry sound';console.warn('Audio unavailable',e.message);}finally{b.disabled=false;}
});
const keyMap={w:'ArrowUp',s:'ArrowDown',a:'ArrowLeft',d:'ArrowRight',' ':'ArrowDown'};
addEventListener('keydown',e=>{
 if($('instructions').open)return;const k=keyMap[e.key.toLowerCase()]??e.key;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)){e.preventDefault();if(game?.state==='running'&&!paused)input.set(k,true);}
 if(e.repeat)return;if(e.key==='Escape'||e.key.toLowerCase()==='p'){e.preventDefault();setPause(!paused);}if(e.key.toLowerCase()==='r'&&game)newGame(game.sim.setupId);if(e.key==='Enter'&&document.activeElement===document.body)start();
});
addEventListener('keyup',e=>input.set(keyMap[e.key.toLowerCase()]??e.key,false));
for(const b of document.querySelectorAll('[data-drive]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(game?.state!=='running'||paused)return;b.setPointerCapture(e.pointerId);input.set(b.dataset.drive,true);b.classList.add('held');});
 for(const type of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>{input.set(b.dataset.drive,false);b.classList.remove('held');});
}
addEventListener('blur',()=>{clearInput();setPause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);last=performance.now();accumulator=0;sound.setBlocked(paused||document.hidden);});
function renderUI(){
 if(!game)return;const state=paused?'paused':game.state;$('game').dataset.state=state;$('game').dataset.fps=String(Math.round(1000/frameDuration));
 if(state!==previousState){
  previousState=state;const intro=state==='ready',ended=['caught','wrecked','escaped'].includes(state);
  $('garage').hidden=!intro;$('result').hidden=!ended;$('hint').hidden=!intro;$('pause').disabled=!['running','countdown','paused'].includes(state);$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Resume chase':'Pause chase');
  if(intro){$('title').innerHTML='A different road.<br>The same <em>trouble.</em>';$('intro').innerHTML='One patrol on your tail. Two lanes to choose from.<br>Find a gap, risk the verge, and make your escape.';$('start').innerHTML='Start the chase <span>↗</span>';}
  else if(paused){$('title').innerHTML='Take a <em>breather.</em>';$('intro').textContent='Your chase is paused. The patrol can wait.';$('start').innerHTML='Back to the chase <span>↗</span>';}
  else if(ended){clearInput();sound.setBlocked(true);persist();$('title').innerHTML=state==='escaped'?'Out of <em>sight.</em>':state==='wrecked'?'End of <em>the road.</em>':'The road<br><em>caught up.</em>';$('intro').textContent=state==='escaped'?'You lost the patrol. A fresh road is waiting.':state==='wrecked'?'Too many hard hits. Pick another car and try a different route.':'The patrol caught you. There is always another way through.';$('start').innerHTML='Find a new road <span>↗</span>';$('result').innerHTML=`<span>DISTANCE<strong>${(game.distance/1000).toFixed(2)} km</strong></span><span>SCORE<strong>${game.score}</strong></span><span>CLOSE CALLS<strong>${game.nearMisses}</strong></span>`;}
  $('overlay').setAttribute('aria-hidden',String(state==='running'||state==='countdown'));$('overlay').inert=state==='running'||state==='countdown';
 }
 const cfg=game.sim.setup;$('car-name').textContent=cfg.name;$('car-spec').textContent=`${cfg.powertrain.hp} hp · ${cfg.drive.length===4?'AWD':cfg.drive[0]===0?'FWD':'RWD'} · ${Math.round(cfg.mass).toLocaleString()} kg`;
 $('seed').textContent=game.route.seed.toString(16).padStart(8,'0').toUpperCase();best=Math.max(best,game.distance);
 $('distance').innerHTML=`${(game.distance/1000).toFixed(2)} <small>km</small>`;$('best').innerHTML=`${(best/1000).toFixed(2)} <small>km</small>`;
 $('speed').textContent=Math.round(game.sim.groundSpeed*3.6);$('gear').textContent=game.sim.drivetrain?.snapshot().gear??'N';
 $('condition').textContent=`${Math.round(100-game.damage)}%`;$('health-bar').style.width=`${100-game.damage}%`;$('health-bar').style.background=game.damage>60?'#b86249':'#64836a';
 $('gap').textContent=`${Math.round(game.gap)} m`;$('pursuit-bar').style.width=`${clamp(1-game.gap/180,0,1)*100}%`;
 $('pursuit-label').textContent=game.capture>.1?`MOVE! ${Math.max(0,3-game.capture).toFixed(1)} s`:game.escape>0?`ESCAPING · ${Math.ceil(5-game.escape)} s`:game.gap<15?'RIGHT BEHIND YOU':'LOSE THEM AT 160 M';
 const p=game.position,off=Math.abs(game.route.offset(p.x,p.z));$('surface').textContent=off>3.6?'ROUGH VERGE · LOW GRIP':'ASPHALT · FULL GRIP';
 $('countdown').textContent=game.state==='countdown'?Math.ceil(game.countdown):'';$('message').textContent=game.message;$('message').classList.toggle('visible',game.state==='running'&&game.time<game.messageUntil&&!paused);
}
function drawMap(){
 const p=game.position,route=game.route,cx=route.centre(p.z),x=(wx)=>130-(wx-cx)*2.6,y=z=>280-(z-p.z)*.92;
 map.clearRect(0,0,260,320);map.lineJoin='round';map.lineCap='round';map.strokeStyle='#69857944';map.lineWidth=23;map.beginPath();for(let d=-30;d<=290;d+=4){const z=p.z+d;d===-30?map.moveTo(x(route.centre(z)),y(z)):map.lineTo(x(route.centre(z)),y(z));}map.stroke();map.strokeStyle='#f0f0df';map.lineWidth=1;map.stroke();
 for(const a of game.actors.values())if(a.z>p.z-25&&a.z<p.z+270){map.fillStyle=a.kind==='police'?'#5388b0':a.direction===-1?'#ab6252':'#667462';map.fillRect(x(a.x)-2.5,y(a.z)-4,5,8);}
 for(const i of game.chunks)if(route.junction(i)&&i*CHUNK>p.z&&i*CHUNK<p.z+250){const state=game.signal(i*CHUNK);map.fillStyle=state==='red'?'#b85c48':state==='amber'?'#bd9a52':'#5c8b6a';map.beginPath();map.arc(x(route.centre(i*CHUNK))+18,y(i*CHUNK),4,0,Math.PI*2);map.fill();}
 map.fillStyle='#d77942';map.beginPath();map.moveTo(x(p.x),y(p.z)-8);map.lineTo(x(p.x)-5,y(p.z)+5);map.lineTo(x(p.x)+5,y(p.z)+5);map.closePath();map.fill();
}
function render(dt){
 const frame=car.update(game.sim),p=frame.position,speed=game.sim.groundSpeed;
 const forward=cameraRig.update(frame,game.sim.chassis.linvel(),speed,dt,game.state==='ready',game.origin);
 sun.position.copy(p).add(new T.Vector3(-25,38,-12));sun.target.position.copy(p);sun.target.updateMatrixWorld();land.position.x=p.x;land.position.z=p.z;
 world.update(game);traffic.update(game,paused?0:dt);
 renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setScissorTest(false);renderer.autoClear=true;renderer.render(scene,camera);
 if(sound.enabled){right.set(1,0,0).applyQuaternion(camera.quaternion);sound.render(frame,camera.position,right,1);if(siren){const t=sound.context.currentTime;siren.frequency.setTargetAtTime(Math.floor(game.time*1.8)%2?780:590,t,.025);sirenGain.gain.setTargetAtTime(game.state==='running'&&!paused?.011*clamp(1-game.gap/200,.03,1):0,t,.06);}}
}
function loop(now){
 frameDuration+=(Math.min(200,now-last)-frameDuration)*.05;const dt=Math.min(.05,(now-last)/1000);last=now;
 if(game&&!busy){
  if(!paused&&['running','countdown'].includes(game.state)){accumulator=Math.min(accumulator+dt,.05);while(accumulator>=STEP){game.step(input.axes);sound.sample(game.sim,STEP);accumulator-=STEP;}}else accumulator=0;
  render(dt);uiTime+=dt;if(uiTime>.08){uiTime=0;renderUI();drawMap();}
 }
 requestAnimationFrame(loop);
}
try{
 let loaded=0;await Promise.all(SETUP_ORDER.map(async id=>{await loadVehicleAsset(id);loaded++;$('start').textContent=`Loading the garage ${loaded} / ${SETUP_ORDER.length}`;}));
 await newGame();$('start').disabled=false;requestAnimationFrame(loop);
}catch(error){$('title').textContent='The road is taking a moment.';$('intro').textContent='Some car files could not load. Reload the page to try again.';$('start').textContent='Reload the page';$('start').disabled=false;$('start').onclick=()=>location.reload();console.error(error);}
window.policeChase={snapshot:()=>game?.snapshot()};
