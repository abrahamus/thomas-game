const test=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');const R=ThomasRaceCore;
function fixture(who='player'){
 const r=R.createRace({playerId:who==='player'?'harold':'thomas',opponentId:who==='rival'?'harold':'thomas',seed:24,deliveryTheme:'cargo'});r.phase='racing';r.countdown=0;return {r,v:r[who]};
}
test('Harold’s forward motion at cargo stops follows ordinary race travel without a visual speed multiplier',()=>{
 for(const who of ['player','rival']){const{r,v}=fixture(who),job=v.serviceStates.find(s=>s.type==='wash');v.carried.container='container-1';v.velocity=R.CRUISE_SPEED;
  for(const direction of [-1,1])for(let gap=200;gap<=2500;gap+=100){
   const d=job.at+direction*gap,a=R.getFlightPose(r,who,d),b=R.getFlightPose(r,who,d+10),route=R.sampleVehicleRoute(r,who,d);
   const forward=(b.x-a.x)*Math.sin(route.heading)+(b.z-a.z)*Math.cos(route.heading);
   assert.ok(Math.abs(forward-10*R.WORLD_SCALE)<.002,`${who}/${d}: normal progress moved ${10*R.WORLD_SCALE}, but Harold moved ${forward}`);
  }
 }
});

function enterJob({who='player',type='wash',seed,other='thomas'}={}){
 seed??={wash:1,coal:1,repairs:4,rocks:1,water:3,tree:2}[type];
 const r=R.createRace({playerId:who==='player'?'harold':other,opponentId:who==='rival'?'harold':other,seed,deliveryTheme:'cargo'});r.phase='racing';r.countdown=0;
 for(const role of ['player','rival']){
  const v=r[role],s=v.serviceStates.find(s=>s.type===type);assert.ok(s);
  v.serviceStates.forEach(job=>{if(job.at<s.at)job.completed=true;});v.carried.container='container-1';v.carried.cargo=true;v.distance=s.at-.01;v.velocity=0;
 }
 r.elapsed=1;R.step(r,1/120);return r;
}
function act(r){const s=r.player.service;if(s?.phase==='ready'){if(s.type==='wash')R.cleanMud(r,r.player.mudPatches.findIndex(Boolean));else R.serviceAction(r);}}

test('cargo stops hold both racers for equal checks, and cannot be skipped',()=>{
 for(const who of ['player','rival'])for(const type of ['wash','coal','repairs','rocks','water','tree']){
  const r=enterJob({who,type}),v=r.player,s=v.service,at=v.distance;
  assert.equal(s.phase,'cargo-lowering');assert.equal(r.rival.service.phase,'cargo-lowering');
  const stopped=JSON.stringify(r);for(let i=0;i<12;i++){assert.equal(R.serviceAction(r),false);assert.equal(R.cleanMud(r,0),false);assert.equal(R.whistle(r),false);}
  assert.equal(JSON.stringify(r),stopped,'early inputs do not advance handling');
  R.step(r,4.5);assert.equal(s.phase,'cargo-lowering');assert.equal(v.distance,at);
  R.step(r,.5);assert.equal(s.phase,'ready');assert.equal(r.rival.service.phase,'ready');
  assert.equal(R.getView(r).helpEnabled,true);
  for(let n=0;s.phase!=='cargo-lifting';n++){assert.ok(n<1800);act(r);R.step(r,1/120);}
  assert.equal(s.workComplete,true);assert.equal(s.completed,false);assert.equal(v.distance,at);
  assert.equal(R.getView(r).helpEnabled,false);assert.match(R.getView(r).taskKey,/cargo-lifting$/);
  assert.equal(R.serviceAction(r),false);assert.equal(R.cleanMud(r,0),false);
  R.step(r,4.5);assert.equal(s.completed,false);assert.equal(v.distance,at);assert.equal(v.velocity,0);
  R.step(r,.5);assert.equal(s.completed,true);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
  R.step(r,.5);assert.equal(v.distance,at);
  assert.equal(R.adjustSpeed(r,1),true);
  const before=R.getFlightPose(r,who);R.step(r,1/120);const after=R.getFlightPose(r,who);
  assert.ok(v.velocity>0&&v.velocity<=R.ACCELERATION/60,'departure uses ordinary acceleration');
  if(who==='player')assert.ok(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<.001,'no departure teleport');
  R.step(r,2);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
 }
});

test('Harold lowers, parks, and lifts cargo vertically while forward travel is stopped',()=>{
 for(const type of ['wash','coal','repairs','rocks','water','tree']){
  const r=enterJob({type}),v=r.player,s=v.service,pad=R.sampleRoute(r.courseId,s.at,-3),poses=[];
  for(let n=0;n<1800&&!s.completed;n++){
   const f=R.getFlightPose(r),cargo=f.cargo;assert.equal(v.distance,s.at);assert.equal(v.velocity,0);
   assert.ok(cargo.y>=pad.y-1e-8);assert.ok(Math.hypot(cargo.x-pad.x,cargo.z-pad.z)<1e-8,'cargo never travels sideways by itself');
   if(cargo.attached)assert.ok(Math.hypot(f.x-cargo.x,f.z-cargo.z)<1e-8,'attached cargo stays underneath Harold');
   else assert.ok(Math.abs(cargo.y-pad.y)<1e-8,'detached cargo stays on the ground');
   if(s.phase==='ready'||s.phase==='working'){assert.equal(cargo.phase,'parked');assert.equal(cargo.attached,false);}
   const prev=poses.at(-1);if(prev)assert.ok(Math.hypot(f.x-prev.x,f.y-prev.y,f.z-prev.z)<R.SPEEDS[4]*R.WORLD_SCALE/60,'no sudden helipad position jumps');
   poses.push(f);assert.deepEqual(R.getFlightPose(r),f,'rendering while paused does not advance handling');
   act(r);R.step(r,1/60);
  }
  assert.equal(s.completed,true);const f=R.getFlightPose(r);assert.equal(f.cargo.attached,true);assert.ok(Math.abs(f.cargo.y-pad.y-3.45)<1e-8);
 }
});

test('ground crews clear heavy obstacles without helicopter swoops',()=>{
 for(const who of ['player','rival']){
  const{r,v}=fixture(who);
  for(const type of ['repairs','rocks']){
   const s=v.serviceStates.find(s=>s.type===type);if(!s)continue;
   v.distance=s.at;v.velocity=0;v.service=s;s.phase='working';s.progress=0;const start=R.getFlightPose(r,who);
   for(let t=0;t<=1;t+=.05){s.progress=t;const f=R.getFlightPose(r,who);assert.equal(f.x,start.x);assert.equal(f.z,start.z);}
  }
 }
});

test('pausing either cargo-handling stage freezes both racers and shows the correct waiting reminder',()=>{
 const{setup}=require('./helpers/game-harness.cjs');
 for(const who of ['player','rival'])for(const phase of ['cargo-lowering','cargo-lifting']){
  const ui=setup();ui.click('#startRaceButton');
  const r=enterJob({who});for(const role of ['player','rival']){r[role].service.phase=phase;r[role].service.handlingProgress=.2;r[role].service.remaining=4;}
  ui.evaluate(`state.phase='racing';state.race=${JSON.stringify(r)};render()`);
  const prefix=who==='player'?'flight':'service';assert.equal(ui.evaluate('ui.taskKey'),`race.${prefix}.${phase}`);
  assert.equal(ui.document.getElementById('raceHelpPicture').getAttribute('href'),'#rule-wait');
  assert.equal(ui.document.getElementById('action-race-help').disabled,true);
  const before=ui.state().race;ui.key('Enter');assert.deepEqual(ui.state().race,before);
  ui.key('Escape');assert.equal(ui.state().paused,true);const paused=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,paused);
  ui.click('#pauseOverlay [data-action="resume"]');ui.frames(.25,4);assert.ok(ui.state().race.player.service.handlingProgress>.2);
 }
});

test('equal handling pauses retain exact seeded rematches and do not change sheep or final unloading',()=>{
 const{drive}=require('./helpers/race-driver.cjs');
 for(const playerId of ['harold','bertie']){
  const options={playerId,opponentId:playerId==='harold'?'bertie':'harold',seed:24,deliveryTheme:'cargo',reaction:.35,washSeconds:10};
  const a=drive(R,options),b=drive(R,options);assert.deepEqual(a,b);
  const handling=a.player.serviceStates.filter(s=>s.cargoHandling).map(s=>s.id);
  assert.deepEqual(a.rival.serviceStates.filter(s=>s.cargoHandling).map(s=>s.id),handling);
  assert.ok(handling.length>=3);
  for(const v of [a.player,a.rival])for(const s of v.serviceStates.filter(s=>['animals','cargo-load','cargo-unload','drawbridge','level-crossing'].includes(s.type)))assert.equal(s.cargoHandling,false);
 }
});

test('Harold pays out an empty cargo rope smoothly before reconnecting and lifting the parked load',()=>{
 const T=require('../vendor/three-r170.js');global.THREE=T;const V=require('../scripts/race-renderer.js');
 for(const who of ['player','rival']){
  const r=enterJob({who,type:'tree'}),v=r[who],s=v.service;
  for(let n=0;s.phase!=='cargo-lifting';n++){assert.ok(n<3600);act(r);R.step(r,1/120);}
  const b=V.makeScene(R,r.courseId,r.opponentId,'cargo',r),payload=b[who+'Coach'];let previousLength=0,sawEmptyRope=false;
  for(let frame=0;frame<=600;frame++){
   s.handlingProgress=frame/600;s.remaining=R.CARGO_HANDLING_SECONDS*(1-s.handlingProgress);V.updateScene(b,r);
   const f=R.getFlightPose(r,who),anchor=payload.localToWorld(new T.Vector3(0,.65,0)),hook=payload.userData.hook.getWorldPosition(new T.Vector3());
   const length=payload.userData.sling.visible?anchor.distanceTo(hook):0;
   assert.ok(Math.abs(length-previousLength)<.13,`${who}/${frame}: rope appeared or jumped by ${length-previousLength}`);
   previousLength=length;
   if(payload.userData.sling.visible&&!f.cargo.attached){sawEmptyRope=true;assert.ok(Math.abs(f.cargo.y-R.sampleVehicleRoute(r,who,s.at).y)<1e-8,'load stays grounded while the empty hook descends');}
   if(f.cargo.attached)assert.ok(hook.distanceTo(new T.Vector3(f.cargo.x,f.cargo.y+.72,f.cargo.z))<1e-7,'hook meets the cargo before lifting');
  }
  assert.equal(sawEmptyRope,true,'rope lowers before attachment');
  const hook=payload.userData.hook.position.toArray();V.updateScene(b,r,{paused:true,time:99999});assert.deepEqual(payload.userData.hook.position.toArray(),hook);V.disposeScene(b);
 }
});
