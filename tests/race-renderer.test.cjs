const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../vendor/three-r170.js');global.THREE=T;
require('../scripts/race-model.js');const Core=global.ThomasRaceCore,View=require('../scripts/race-renderer.js');
function race(course='country',opponent='bertie',distance=0){const r=Core.createRace({courseId:course,opponentId:opponent,seed:24});r.phase='racing';r.elapsed=10;r.countdown=0;for(const v of [r.player,r.rival]){v.distance=distance;v.velocity=Core.CRUISE_SPEED;v.wheelTurns=distance*Core.WORLD_SCALE/(2*Math.PI*Core.WHEEL_RADIUS);}return r;}
function named(root,name){let found;root.traverse(o=>{if(o.name===name&&!found)found=o;});return found;}
function all(root,name){const out=[];root.traverse(o=>{if(o.name===name)out.push(o);});return out;}
function near(a,b,eps=1e-8){assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);}
function xyz(a,p,y=0){near(a.x,p.x);near(a.y,p.y+y);near(a.z,p.z);}
function project(b,p,y=0){return new T.Vector3(p.x,p.y+y,p.z).project(b.camera);}
function bounds(b,object){const points=[];object.traverse(o=>{if(!o.geometry)return;for(let p=o;p;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld).project(b.camera));});return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
function pose(r,d){for(const v of [r.player,r.rival]){v.distance=d;v.wheelTurns=d*Core.WORLD_SCALE/(2*Math.PI*Core.WHEEL_RADIUS);}}
test('pinned licensed Three.js stays offline without a browser substitute',()=>{assert.equal(T.REVISION,'170');assert.match(fs.readFileSync(require.resolve('../vendor/three-LICENSE.txt'),'utf8'),/MIT License/);assert.doesNotMatch(fs.readFileSync(require.resolve('../scripts/race-renderer.js'),'utf8'),/https?:\/\/|fetch\(|requestAnimationFrame|TextureLoader|ImageLoader/);});
test('original recognizable engines, faces, wheel assemblies, tender and bus remain',()=>{for(const id of ['thomas','percy','james']){const m=View.makeEngine(id);for(const part of ['recognisable-smiling-face','rounded-boiler','cab-window','red-running-board','funnel','smile'])assert.ok(named(m,part));assert.equal(m.userData.wheels.length,id==='percy'?4:id==='james'?10:6);near(m.userData.wheelRadius,Core.WHEEL_RADIUS,1e-10);assert.equal(m.userData.rods.length,2);if(id==='james')assert.ok(named(m,'james-tender'));}const bus=View.makeBertie();assert.ok(named(bus,'bus-roof'));assert.equal(bus.userData.wheels.length,4);});
test('each course has one continuous Thomas track and one rival surface without points',()=>{for(const course of Object.keys(Core.COURSES))for(const opponent of ['percy','bertie']){const b=View.makeScene(Core,course,opponent),paths=all(b.world,'railway-path');for(const corridor of ['player','rival']){const owned=paths.filter(p=>p.userData.corridor===corridor);assert.equal(owned.length,opponent==='bertie'&&corridor==='rival'?0:Math.ceil((Core.COURSES[course].length+36000)/6000));for(const path of owned){assert.equal(path.userData.offset,corridor==='player'?0:-15);assert.ok(path.userData.end-path.userData.start<=6000);const pos=named(path,'ballast-bed').geometry.attributes.position,p=Core.sampleRoute(course,path.userData.start,path.userData.offset);near((pos.getX(0)+pos.getX(1))/2,p.x,1e-4);near((pos.getZ(0)+pos.getZ(1))/2,p.z,1e-4);}}assert.equal(all(b.world,'railway-turnout-lever').length,0);assert.equal(all(b.world,'turnout-running-rail').length,0);assert.equal(all(b.world,'road-path').length,opponent==='bertie'?Math.ceil((Core.COURSES[course].length+36000)/6000):0);View.disposeScene(b);}});

test('coaches sample shared rails independently through every curve and slope',()=>{for(const course of Object.keys(Core.COURSES))for(const opponent of ['percy','james','bertie']){const b=View.makeScene(Core,course,opponent),r=race(course,opponent);for(const d of [0,8000,18000,31000,48000,64000,74000,81000,90000,Core.courseDistance(95000),100000,110000,116000]){pose(r,d);View.updateScene(b,r);for(const who of ['player','rival']){const coach=b[who+'Coach'],p=Core.sampleCoachRoute(r,who);xyz(coach.position,p,who==='rival'&&opponent==='bertie'?-.015:.30);near(coach.rotation.y,p.heading);near(coach.rotation.x,-p.grade);for(const w of coach.userData.wheels)near(w.rotation.x,(d-Core.getCoachOffset(r,who))*Core.WORLD_SCALE/w.userData.radius);}xyz(b.player.position,Core.sampleVehicleRoute(r,'player'),.30);}View.disposeScene(b);}});
test('James coach clears preserved tender and both drawbars meet shared couplers',()=>{for(const opponent of ['percy','james','bertie']){const b=View.makeScene(Core,'country',opponent),r=race('country',opponent,5000);View.updateScene(b,r);for(const who of ['player','rival']){const engine=b[who],coach=b[who+'Coach'],rear=engine.userData.kind==='james'?-6.6:engine.userData.kind==='bertie'?-2.85:-3.37,a=new T.Vector3(0,.82,rear).applyMatrix4(engine.matrixWorld),z=new T.Vector3(0,.82,2.61).applyMatrix4(coach.matrixWorld),coupler=b[who+'Coupler'];assert.ok(a.distanceTo(z)>.7&&a.distanceTo(z)<2.2);near(coupler.scale.y,a.distanceTo(z));assert.ok(coupler.position.distanceTo(a.clone().add(z).multiplyScalar(.5))<1e-8);}View.disposeScene(b);}});
test('wheel gauge, contact and rods preserve actual wheel rolling',()=>{const b=View.makeScene(Core,'country','james'),r=race('country','james',3000);View.updateScene(b,r);const rail=named(b.world,'running-rail').geometry.attributes.position,p=Core.sampleRoute('country',-6000,0);near(Math.abs((rail.getX(0)+rail.getX(1))/2-p.x),1.02,1e-4);for(const c of [b.playerCoach,b.rivalCoach])for(const wheel of c.userData.wheels){near(Math.abs(wheel.position.x),1.02);near(wheel.position.y-wheel.userData.radius,0);}for(const v of [b.player,b.rival]){const travel=3000*Core.WORLD_SCALE;for(const rod of v.userData.rods){near(rod.position.y,Math.cos(travel/v.userData.wheelRadius)*v.userData.wheelRadius*.48);near(rod.position.z,Math.sin(travel/v.userData.wheelRadius)*v.userData.wheelRadius*.48);}}View.disposeScene(b);});




test('engines emit ordinary exhaust at top speed and the bus emits no steam',()=>{
 for(const opponent of ['james','bertie']){
  const b=View.makeScene(Core,'country',opponent),r=race('country',opponent,10000);
  View.updateScene(b,r);
  const opacity=b.steam.bubbles[0].material.opacity;
  r.player.velocity=r.rival.velocity=1250;
  View.updateScene(b,r);
  assert.equal(b.steam.bubbles[0].material.opacity,opacity);
  assert.ok(b.steam.bubbles.some(puff=>puff.visible));
  assert.equal(b.rivalSteam.bubbles.some(puff=>puff.visible),opponent==='james');
  assert.equal(all(b.scene,'pickup-collection-flash').length,0);
  View.disposeScene(b);
 }
});
test('stable camera frames engines and coaches at laptop and portrait/landscape phone sizes',()=>{for(const course of Object.keys(Core.COURSES))for(const opponent of ['percy','james','bertie']){const b=View.makeScene(Core,course,opponent),r=race(course,opponent);for(const aspect of [310/330,516/145,604/166,752/192,320/420,375/420,1400/800])for(const d of [8000,18000,31000,48000,62000,74000,82000,94000,105000,114000,129000].map(Core.courseDistance)){b.camera.aspect=aspect;pose(r,d);View.updateScene(b,r);for(const obj of [b.player,b.rival,b.playerCoach,b.rivalCoach]){if(!obj.visible)continue;const box=bounds(b,obj);assert.ok(box.minX>=-1&&box.maxX<=1&&box.minY>=-1&&box.maxY<=1,`${course}/${opponent}/${aspect}/${d}/${obj.name}: ${JSON.stringify(box)}`);}assert.deepEqual(b.camera.up.toArray(),[0,1,0]);}View.disposeScene(b);}});




test('starting lamps still show Ready Steady Go',()=>{const b=View.makeScene(Core,'country','bertie'),r=race();r.phase='countdown';r.countdown=Core.START_COUNTDOWN;View.updateScene(b,r);const lamp=named(b.scene,'start-light'),red=lamp.material.color.getHex();r.countdown=Core.START_COUNTDOWN/2;View.updateScene(b,r);assert.notEqual(lamp.material.color.getHex(),red);r.phase='racing';View.updateScene(b,r);assert.notEqual(lamp.material.color.getHex(),red);View.disposeScene(b);});
test('unavailable WebGL reports gracefully without timers, network loaders or leaking',()=>{const original=T.WebGLRenderer,errors=[];T.WebGLRenderer=function(){throw new Error('No WebGL');};try{const view=View.create({canvas:{},onUnavailable:e=>errors.push(e.message)});assert.equal(view.available,false);assert.deepEqual(errors,['No WebGL']);view.render(race());view.resize();view.dispose();view.dispose();}finally{T.WebGLRenderer=original;}});

function deliveryRace(course='country',opponent='percy',theme='passengers',seed=24){const r=Core.createRace({courseId:course,opponentId:opponent,deliveryTheme:theme,seed});r.phase='racing';r.countdown=0;r.elapsed=30;return r;}
function activateJob(r,who,id,phase='ready',progress=0){const v=r[who],s=v.serviceStates.find(s=>s.id===id||s.type===id);v.distance=s.at;v.velocity=0;v.service=s;s.phase=phase;s.duration=s.type==='wash'?.6:s.type.startsWith('passenger')?1:s.type==='water'?4:s.type==='animals'?2:s.type==='drawbridge'?6:5;s.remaining=s.duration*(1-progress);s.progress=progress;s.activeUnit=0;s.startedAt=r.elapsed-s.duration*progress;if(s.type==='passenger-unload'){v.carried.passengers=3;v.serviceStates.find(s=>s.type==='passenger-load').groups.fill(true);}if(s.type==='cargo-unload'){v.carried.container='container-1';v.carried.cargo=true;}if(s.type==='wash'){v.mudPatches.fill(true);v.dirt=1;}return s;}
function targetClick(b,r,obj,w=1400,h=800){const rect=View.projectTarget(b,obj,w,h);return {rect,hit:View.pickScene(b,r,rect.x+rect.width/2,rect.y+rect.height/2,w,h)};}

test('ready delivery loads and unloads have reachable direct selection on laptop and narrow windows',()=>{
  for(const course of Object.keys(Core.COURSES))for(const theme of ['passengers','cargo']){const r=deliveryRace(course,'james',theme),b=View.makeScene(Core,course,'james',theme,r);for(const spec of r.services.filter(s=>s.type.startsWith('passenger')||s.type.startsWith('cargo')))for(const[w,h]of [[1400,800],[375,420],[320,420]]){activateJob(r,'player',spec.id);r.rival.distance=r.player.distance-850;b.camera.aspect=w/h;View.updateScene(b,r);const slot=b.objects.services.find(s=>s.spec.id===spec.id).slots[0],targets=spec.type==='passenger-unload'?b.playerCoach.userData.occupants:spec.type==='cargo-unload'?[b.playerCoach.userData.container]:slot.targets.map(t=>t.object);for(let i=0;i<targets.length;i++){const {rect,hit}=targetClick(b,r,targets[i],w,h);assert.ok(rect.x+rect.width/2>0&&rect.x+rect.width/2<w&&rect.y+rect.height/2>0&&rect.y+rect.height/2<h,`${course}/${theme}/${spec.type}/${w}: ${JSON.stringify(rect)}`);assert.deepEqual(hit,{kind:'service',id:theme==='cargo'?'container-1':'passenger-'+i});}}View.disposeScene(b);}
});
test('seven actual engine dirt patches are directly washable and working sweeps reject pointer cleaning',()=>{const r=deliveryRace(),b=View.makeScene(Core,'country','percy','passengers',r);const spec=r.services.find(s=>s.type==='wash');activateJob(r,'player',spec.id);r.rival.distance=r.player.distance-850;for(const[w,h]of [[1400,800],[375,420],[320,420]]){b.camera.aspect=w/h;View.updateScene(b,r);assert.equal(b.player.userData.mudPatches.filter(p=>p.visible).length,7);for(let i=0;i<7;i++){const {hit}=targetClick(b,r,b.player.userData.mudPatches[i],w,h);assert.deepEqual(hit,{kind:'mud',id:i});}}r.player.service.phase='working';assert.equal(View.pickScene(b,r,200,200,375,420),null);View.disposeScene(b);});
test('passengers walk and wave, open doors, and remain aboard until their own disembarking group',()=>{const r=deliveryRace(),b=View.makeScene(Core,'country','percy','passengers',r),s=activateJob(r,'player','passenger-load','working',.5);r.rival.distance=r.player.distance-850;View.updateScene(b,r);const slot=b.objects.services[0].slots[0];assert.notEqual(b.playerCoach.userData.doors[0].rotation.y,0);near(slot.people[0].position.x,3.35);assert.ok(slot.people[0].position.z<4);s.phase='ready';s.groups[2]=true;s.unitsDone=1;r.player.carried.passengers=1;View.updateScene(b,r);assert.equal(slot.people[2].visible,false);assert.equal(b.playerCoach.userData.occupants[2].visible,true);assert.equal(b.playerCoach.userData.occupants[0].visible,false);const u=activateJob(r,'player','passenger-unload','working',.5);View.updateScene(b,r);const out=b.objects.services.find(b=>b.spec.type==='passenger-unload').slots[0];assert.equal(out.people[0].visible,true);assert.equal(b.playerCoach.userData.occupants[0].visible,false);u.phase='complete';u.groups[0]=true;View.updateScene(b,r);assert.notEqual(named(out.people[0],'passenger-waving-arm').rotation.z,0);View.disposeScene(b);});
test('container remains on its flatbed and cargo crane follows its actual lifted object',()=>{const r=deliveryRace('country','bertie','cargo'),b=View.makeScene(Core,'country','bertie','cargo',r),s=activateJob(r,'player','cargo-load','working',.5);View.updateScene(b,r);const slot=b.objects.services[0].slots[0];assert.ok(slot.container.position.y>3);const hook=slot.crane.hook.getWorldPosition(new T.Vector3()),top=slot.spreader.localToWorld(new T.Vector3(0,.85,0));near(hook.distanceTo(top),0,1e-7);s.phase='complete';r.player.service=null;r.player.carried.container='container-1';r.player.carried.cargo=true;View.updateScene(b,r);assert.equal(b.playerCoach.userData.container.visible,true);assert.equal(slot.container.visible,false);activateJob(r,'player','cargo-unload','working',.5);View.updateScene(b,r);assert.equal(b.playerCoach.userData.container.visible,false);View.disposeScene(b);});
test('animal gates, refill levels, branch lifts, and boat bridge motion derive only from service progress',()=>{for(const type of ['animals','water','tree','drawbridge']){let r;for(let seed=1;seed<40;seed++){r=deliveryRace('country','percy','cargo',seed);if(r.services.some(s=>s.type===type))break;}const b=View.makeScene(Core,'country','percy','cargo',r),s=activateJob(r,'player',type,'working',.5);View.updateScene(b,r);const slot=b.objects.services.find(g=>g.spec.type===type).slots[0];if(type==='animals'){assert.ok(slot.animals[0].position.x>1);near(slot.gate.rotation.y,0);}if(type==='water'){assert.equal(slot.stream.visible,true);const before=b.player.userData.waterGauge.level.scale.y;s.remaining=0;View.updateScene(b,r);assert.ok(b.player.userData.waterGauge.level.scale.y>before);}if(type==='tree')assert.ok(slot.branch.position.y>.8,'branch is supported above the ground during the swing');if(type==='drawbridge'){assert.ok(slot.bridgeLeaf.rotation.x<0);s.remaining=0;View.updateScene(b,r);near(slot.bridgeLeaf.rotation.x,0);}const before=JSON.stringify(b.objects.services.map(g=>g.slots.map(s=>[s.branch?.position.toArray(),s.bridgeLeaf?.rotation.x,s.people.map(p=>p.position.toArray())])));View.updateScene(b,r,{paused:true,time:999999});assert.equal(JSON.stringify(b.objects.services.map(g=>g.slots.map(s=>[s.branch?.position.toArray(),s.bridgeLeaf?.rotation.x,s.people.map(p=>p.position.toArray())]))),before);View.disposeScene(b);}});
test('sustained climbs rise two engine heights above a lower valley and all scenery stays upright',()=>{for(const course of Object.keys(Core.COURSES)){near(Core.sampleRoute(course,Core.courseDistance(90600)).y,8);near(Core.sampleRoute(course,Core.courseDistance(98600)).y,8);near(Core.sampleRoute(course,Core.courseDistance(116600)).y,0);for(let d=Core.courseDistance(72000);d<Core.courseDistance(117000);d+=250)assert.ok(Math.abs(Core.sampleRoute(course,d).grade)<=Math.PI/30);assert.ok(Core.sampleTerrainHeight(course,Core.courseDistance(95000),35)<0);const b=View.makeScene(Core,course,'percy');assert.ok(all(b.world,'exposed-hillside-earth').length===2);for(const o of [...all(b.world,'tree'),...all(b.world,'sodor-cottage')])near(o.rotation.x,0);View.disposeScene(b);}});
test('harbour sea and river surfaces stay horizontal with a single harbour level',()=>{const b=View.makeScene(Core,'harbour','bertie');b.scene.updateMatrixWorld(true);const planes=[...all(b.world,'harbour-water'),...all(b.world,'continuous-harbour-water')];for(const p of planes){const pos=p.geometry.attributes.position;for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(p.matrixWorld);near(v.y,-1.25,p.name==='harbour-water'?.076:1e-5);}}View.disposeScene(b);});


function actualMeshVisible(b,object){const parts=[];object.traverse(o=>{if(o.geometry&&o.visible&&(o.name==='passenger-head'||o.name==='mud-splodge'||o.name==='container-body'||o.name==='coal-lump'))parts.push(o);});const blockers=[];b.scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===object||!p.visible)return;blockers.push(o);});let clear=0;for(const part of parts){part.geometry.computeBoundingBox();const box=part.geometry.boundingBox;for(const dy of [0,.2]){const point=box.getCenter(new T.Vector3());point.y+=dy;point.applyMatrix4(part.matrixWorld);const direction=point.clone().sub(b.camera.position),length=direction.length(),ray=new T.Raycaster(b.camera.position.clone(),direction.normalize(),0,length-.04);if(!ray.intersectObjects(blockers,false).length)clear++;}}return clear;}
test('actual passenger, container and dirt targets remain visible against world and vehicle meshes',()=>{const failures=[];for(const theme of ['passengers','cargo'])for(const course of Object.keys(Core.COURSES)){const r=deliveryRace(course,'james',theme),b=View.makeScene(Core,course,'james',theme,r);for(const spec of r.services.filter(s=>s.type.startsWith(theme==='cargo'?'cargo':'passenger')||s.type==='wash'))for(const[w,h]of [[1400,800],[375,420],[320,420]]){activateJob(r,'player',spec.id);r.rival.distance=r.player.distance-850;b.camera.aspect=w/h;View.updateScene(b,r);const slot=b.objects.services.find(s=>s.spec.id===spec.id).slots[0],targets=spec.type==='wash'?b.player.userData.mudPatches:spec.type==='passenger-unload'?b.playerCoach.userData.occupants:spec.type==='cargo-unload'?[b.playerCoach.userData.container]:slot.targets.map(t=>t.object);targets.forEach((obj,i)=>{if(actualMeshVisible(b,obj)<1)failures.push({theme,course,job:spec.type,width:w,target:i});});}View.disposeScene(b);}assert.deepEqual(failures,[]);});

test('drawbridge leaf has its own real rails and static railway stops at the opened gap',()=>{let r;for(let seed=1;seed<30;seed++){r=deliveryRace('harbour','bertie','cargo',seed);if(r.services.some(s=>s.type==='drawbridge'))break;}const spec=r.services.find(s=>s.type==='drawbridge'),b=View.makeScene(Core,'harbour','bertie','cargo',r);activateJob(r,'player',spec.id,'working',.2);View.updateScene(b,r);const a=spec.at+14/Core.WORLD_SCALE,z=spec.at+23/Core.WORLD_SCALE;for(const p of all(b.world,'railway-path'))assert.ok(p.userData.end<=a+.0001||p.userData.start>=z-.0001);assert.ok(named(b.world,'drawbridge-running-rail'));const slot=b.objects.services.find(b=>b.spec.id===spec.id).slots[0];assert.ok(slot.bridgeLeaf.rotation.x<-.5);View.disposeScene(b);});
test('water and tree equipment are direct targets, while a cargo crane requires selecting its container first',()=>{for(const type of ['water','tree']){let r;for(let seed=1;seed<30;seed++){r=deliveryRace('country','percy','cargo',seed);if(r.services.some(s=>s.type===type))break;}const b=View.makeScene(Core,'country','percy','cargo',r),s=activateJob(r,'player',type);View.updateScene(b,r);const slot=b.objects.services.find(b=>b.spec.id===s.id).slots[0],target=type==='water'?slot.waterTower:slot.crane.group;const {hit}=targetClick(b,r,target);assert.deepEqual(hit,{kind:'service',id:type});View.disposeScene(b);}const r=deliveryRace('country','percy','cargo'),b=View.makeScene(Core,'country','percy','cargo',r),s=activateJob(r,'player','cargo-load');View.updateScene(b,r);const slot=b.objects.services[0].slots[0],tip=slot.crane.boom.getWorldPosition(new T.Vector3()).project(b.camera),x=(tip.x+1)*700,y=(1-tip.y)*400;assert.equal(View.pickScene(b,r,x,y,1400,800),null);s.selectedContainer='container-1';assert.deepEqual(View.pickScene(b,r,x,y,1400,800),{kind:'service',id:'container-1'});View.disposeScene(b);});

test('branch is supported during the swing, then rests on the ground before the hook retracts',()=>{
 let r;for(let seed=1;seed<30;seed++){r=deliveryRace('mountain','percy','cargo',seed);if(r.services.some(s=>s.type==='tree'))break;}
 const b=View.makeScene(Core,'mountain','percy','cargo',r),s=activateJob(r,'player','tree','working',.5);
 for(const progress of [.5,.8,.88,.95,1]){s.remaining=s.duration*(1-progress);s.progress=progress;View.updateScene(b,r);const slot=b.objects.services.find(g=>g.spec.id===s.id).slots[0],target=slot.branch.localToWorld(new T.Vector3(0,1.25,0)),hook=slot.crane.hook.getWorldPosition(new T.Vector3());
  if(progress<.9)near(hook.distanceTo(target),0,1e-7);else assert.equal(slot.branch.userData.obstacleSling.visible,false);
  if(progress>=.85){near(slot.branch.position.y,.8);assert.ok(slot.branch.position.x>5,'branch lies clear of the route');}
 }View.disposeScene(b);
});

test('boarding and disembarking walk along the platform and through the actual door threshold',()=>{for(const opponent of ['percy','james','bertie']){const r=deliveryRace('country',opponent,'passengers'),b=View.makeScene(Core,'country',opponent,'passengers',r);for(const who of ['player','rival'])for(const type of ['passenger-load','passenger-unload']){const s=activateJob(r,who,type,'working',0);r.player.distance=s.at;r.rival.distance=s.at;View.updateScene(b,r);const slot=b.objects.services.find(g=>g.spec.type===type).slots.find(slot=>slot.who===who),coach=b[who+'Coach'];for(const t of [.2,.5,.7,.98,1]){s.remaining=1-t;View.updateScene(b,r);const door=coach.userData.doorThresholds[1].getWorldPosition(new T.Vector3());slot.group.worldToLocal(door);const pathT=type==='passenger-unload'?1-t:t,person=slot.people[0];if(pathT<=.7)near(person.position.x,3.35);else near(person.position.z,door.z);if(type==='passenger-load'&&t===1)near(person.position.distanceTo(door),0,1e-7);if(type==='passenger-unload'&&t===1){near(person.position.x,3.35);near(person.position.z,4);}if(type==='passenger-load'&&t===.98)assert.ok(person.position.distanceTo(door)<.04);}}View.disposeScene(b);}});

test('complete tunnel walls and roofs naturally hide trains and loads during passage',()=>{
 for(const course of Object.keys(Core.COURSES))for(const opponent of ['percy','james','bertie']){
  const r=deliveryRace(course,opponent,'cargo'),b=View.makeScene(Core,course,opponent,'cargo',r);
  const tunnels=all(b.world,'railway-tunnel'),solids=[];
  assert.equal(tunnels.length,4);assert.equal(all(b.world,'cutaway-tunnel').length,0);
  for(const tunnel of tunnels)tunnel.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,false);solids.push(o);}});
  const originalMaterial=named(b.player,'rounded-boiler').material;
  for(const aspect of [320/420,375/420,1400/800,1920/900])for(const section of Core.COURSES[course].sections.filter(s=>s.type==='tunnel')){
   for(const who of ['player','rival'])for(const coach of [false,true])for(const stage of ['approach','inside','exit']){
    const center=stage==='approach'?section.start-2500:stage==='exit'?section.end+2500:(section.start+section.end)/2;
    pose(r,center+(coach?Core.getCoachOffset(r,who):0));b.camera.aspect=aspect;
    r.player.carried.container=r.rival.carried.container='container-1';View.updateScene(b,r);
    const object=b[who+(coach?'Coach':'')];
    for(const y of [1.6,2.7]){
     const point=new T.Vector3(0,y,0).applyMatrix4(object.matrixWorld),direction=point.clone().sub(b.camera.position),length=direction.length();
     const hits=new T.Raycaster(b.camera.position.clone(),direction.normalize(),0,length-.1).intersectObjects(solids,false);
     assert.equal(hits.length>0,stage==='inside',`${course}/${opponent}/${aspect}/${object.name}/${stage}`);
    }
    assert.equal(named(b.player,'rounded-boiler').material,originalMaterial,'No artificial material darkening');
   }
  }
  View.disposeScene(b);
 }
});

test('new job targets are visible, framed and selectable in narrow and wide scenes',()=>{
 for(const type of ['repairs','rocks','coal','level-crossing'])for(const opponent of ['percy','james','bertie']){
  let r;for(let seed=1;seed<100;seed++){r=deliveryRace('country',opponent,'cargo',seed);if(r.services.some(s=>s.type===type))break;}
  const b=View.makeScene(Core,'country',opponent,'cargo',r);const state=activateJob(r,'player',type);
  for(const [w,h] of [[320,420],[375,420],[1400,800],[1920,900]]){
   b.camera.aspect=w/h;View.updateScene(b,r);
   const slot=b.objects.services.find(s=>s.spec.type===type).slots[0];
   for(const target of slot.targets){
    const {rect,hit}=targetClick(b,r,target.object,w,h);
    assert.ok(rect.x>=0&&rect.x+rect.width<=w&&rect.y>=0&&rect.y+rect.height<=h,`${type}/${w} is framed`);
    assert.deepEqual(hit,{kind:'service',id:target.id},`${type}/${w}`);
    const point=new T.Box3().setFromObject(target.object).getCenter(new T.Vector3()),direction=point.clone().sub(b.camera.position),length=direction.length(),blockers=[];
    b.scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===target.object||!p.visible)return;blockers.push(o);});
    const hits=new T.Raycaster(b.camera.position.clone(),direction.normalize(),0,length-.05).intersectObjects(blockers,false);
    assert.equal(hits.length,0,`${type}/${target.id}/${w}: ${hits[0]?.object.name}`);
   }
  }
  state.phase='working';assert.equal(View.pickScene(b,r,200,200,375,420),null);View.disposeScene(b);
 }
});

test('crossing arms hinge across the road and stay down until the coach has passed',()=>{
 let r;for(let seed=1;seed<100;seed++){r=deliveryRace('country','james','cargo',seed);if(r.services.some(s=>s.type==='level-crossing'))break;}
 const b=View.makeScene(Core,'country','james','cargo',r),s=activateJob(r,'player','level-crossing');
 View.updateScene(b,r);const slot=b.objects.services.find(x=>x.spec.type===s.type).slots[0];
 const pivots=slot.barriers.map(arm=>arm.getWorldPosition(new T.Vector3()));
 for(const progress of [0,.3,.6,.8,1]){
  s.phase='working';s.duration=5;s.remaining=5*(1-progress);View.updateScene(b,r);
  slot.barriers.forEach((arm,i)=>assert.ok(arm.getWorldPosition(new T.Vector3()).distanceTo(pivots[i])<1e-8));
  if(progress<=.6)slot.barriers.forEach(arm=>near(arm.rotation.x,-Math.PI/2));
  if(progress===1)slot.barriers.forEach(arm=>near(arm.rotation.x,0));
 }
 s.phase='complete';s.completed=true;r.player.service=null;r.player.distance=s.at+1400+Core.getCoachOffset(r,'player')+399;View.updateScene(b,r);
 slot.barriers.forEach(arm=>near(arm.rotation.x,0));
 r.player.distance+=602;View.updateScene(b,r);slot.barriers.forEach(arm=>near(arm.rotation.x,-Math.PI/2));
 View.disposeScene(b);
});

test('steam engines show filled coal and Bertie shows fuel at a pump',()=>{
 for(const opponent of ['percy','james','bertie']){
  let r;for(let seed=1;seed<100;seed++){r=deliveryRace('country',opponent,'cargo',seed);if(r.services.some(s=>s.type==='coal'))break;}
  const b=View.makeScene(Core,'country',opponent,'cargo',r);
  for(const who of ['player','rival'])activateJob(r,who,'coal');
  View.updateScene(b,r);const bundle=b.objects.services.find(s=>s.spec.type==='coal');
  for(const who of ['player','rival']){
   const slot=bundle.slots.find(s=>s.who===who);
   if(slot.road){const before=slot.fuelLevel.scale.x;r[who].service.unitsDone=3;r[who].service.phase='complete';View.updateScene(b,r);assert.ok(slot.fuelLevel.scale.x>before);assert.equal(all(slot.group,'coal-scoop').length,0);continue;}
   const fill=b[who].userData.coalFill||slot.coalFill;
   assert.ok(fill,`${opponent}/${who} has a real coal destination`);
   const before=new T.Box3().setFromObject(fill).max.y;
   r[who].coal=1;r[who].service.phase='complete';View.updateScene(b,r);
   assert.ok(new T.Box3().setFromObject(fill).max.y>before+.15);
   assert.ok(actualMeshVisible(b,fill)>=1,`${opponent}/${who} filled coal is visible`);
  }
  View.disposeScene(b);
 }
});

test('road rivals repair potholes and fill depot water instead of railway sleepers or steam tanks',()=>{
 for(const type of ['repairs','water']){
  let r;for(let seed=1;seed<100;seed++){r=deliveryRace('country','bertie','cargo',seed);if(r.services.some(s=>s.type===type))break;}
  const b=View.makeScene(Core,'country','bertie','cargo',r),s=activateJob(r,'rival',type);r.player.distance=r.rival.distance;View.updateScene(b,r);
  const slot=b.objects.services.find(g=>g.spec.type===type).slots[1];
  if(type==='repairs'){
   assert.equal(all(slot.group,'repair-sleeper').length,0);assert.equal(all(slot.group,'road-pothole').length,3);
   s.phase='working';s.activeUnit=1;s.duration=1.5;s.remaining=.75;View.updateScene(b,r);
   const patch=all(slot.group,'road-pothole')[1],before=patch.material.color.getHex();
   s.groups[1]=true;s.phase='ready';View.updateScene(b,r);assert.notEqual(patch.material.color.getHex(),before);
  }else{
   assert.equal(all(slot.group,'water-column-arm').length,0);assert.ok(named(slot.group,'depot-water-store'));
   const level=named(slot.group,'depot-water-level'),before=level.scale.y;
   s.phase='working';s.duration=4;s.remaining=2;View.updateScene(b,r);assert.ok(level.scale.y>before);
   s.phase='complete';View.updateScene(b,r);near(level.scale.y,1);assert.equal(b.rival.userData.waterGauge.group.visible,false);
  }
  View.disposeScene(b);
 }
});

test('Bertie waits at traffic lights for road traffic, with no railway barriers',()=>{
 const r=Core.createRace({courseId:'country',playerId:'harold',opponentId:'bertie',deliveryTheme:'cargo',seed:24});r.phase='racing';r.countdown=0;
 const b=View.makeScene(Core,'country','bertie','cargo',r),s=activateJob(r,'rival','level-crossing');r.player.distance=r.rival.distance;
 View.updateScene(b,r);const slot=b.objects.services.find(g=>g.spec.type==='level-crossing').slots[1];
 assert.ok(slot.car);assert.equal(slot.crossingTrain,undefined);assert.equal(slot.barriers.length,0);assert.ok(slot.group.getObjectByName('junction-stop-line'));
 for(const t of [0,.3,.59,.8,.95,1]){s.phase='working';s.duration=5;s.remaining=5*(1-t);View.updateScene(b,r);assert.equal(slot.trafficLights[2].material.color.getHex(),0x344441,'green stays off until the job completes');if(t>=.6)assert.ok(slot.car.position.x<-6,'cross traffic clears the bus');}
 s.phase='complete';View.updateScene(b,r);assert.equal(slot.trafficLights[2].material.color.getHex(),0x58ad50);
 const position=slot.car.position.toArray();View.updateScene(b,r,{paused:true,time:999});assert.deepEqual(slot.car.position.toArray(),position);View.disposeScene(b);
});

test('shared road crossing traffic stays separated during independent bus and train jobs',()=>{
 let r;for(let seed=1;seed<100;seed++){r=deliveryRace('country','bertie','cargo',seed);if(r.services.some(s=>s.type==='level-crossing'))break;}
 const b=View.makeScene(Core,'country','bertie','cargo',r);
 const player=activateJob(r,'player','level-crossing'),rival=activateJob(r,'rival','level-crossing');
 View.updateScene(b,r);const [railSlot,roadSlot]=b.objects.services.find(g=>g.spec.type==='level-crossing').slots;
 function boundsInFrame(object){
  const bounds=new T.Box3(),inverse=railSlot.group.matrixWorld.clone().invert();
  object.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
   o.geometry.computeBoundingBox();const box=o.geometry.boundingBox,matrix=inverse.clone().multiply(o.matrixWorld);
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])bounds.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(matrix));
  });return bounds;
 }
 for(const playerProgress of [null,0,.3,.59,.8,1])for(const rivalProgress of [0,.15,.3,.45,.55,.59,.6,.8,1]){
  player.phase=playerProgress===null?'ready':playerProgress===1?'complete':'working';player.duration=5;player.remaining=5*(1-(playerProgress||0));
  rival.phase=rivalProgress===1?'complete':'working';rival.duration=5;rival.remaining=5*(1-rivalProgress);
  for(const travel of playerProgress===1?[0,600,1250,2000]:[0]){
   r.player.distance=player.at+travel;View.updateScene(b,r);
   if(!roadSlot.car.visible)continue;
   const train=boundsInFrame(roadSlot.car);
   if(railSlot.car.visible)assert.equal(train.intersectsBox(boundsInFrame(railSlot.car)),false,`Train/car: ${playerProgress}/${rivalProgress}`);
   for(const vehicle of [b.player,b.playerCoach])assert.equal(train.intersectsBox(boundsInFrame(vehicle)),false,`Train/player: ${playerProgress}/${rivalProgress}/${travel}`);
  }
 }
 View.disposeScene(b);
});
