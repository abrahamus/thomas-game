const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
function fixture(id,who='player',seed=24){
 const r=R.createRace({playerId:who==='player'?id:'thomas',opponentId:who==='rival'?id:'thomas',seed,deliveryTheme:'cargo'});r.phase='racing';r.countdown=0;
 return{r,v:r[who],b:V.makeScene(R,r.courseId,r.opponentId,r.deliveryTheme,r)};
}
test('buses refuel with a pump and fuel instructions, never a coal bin or coal scoops',()=>{
 for(const id of ['bertie','bulgy'])for(const who of ['player','rival']){
  const{r,v,b}=fixture(id,who),s=v.serviceStates.find(s=>s.type==='coal');v.distance=s.at;v.service=s;s.phase='ready';V.updateScene(b,r);
  const slot=b.objects.services.find(o=>o.spec.id===s.id).slots[who==='player'?0:1];
  assert.equal(!!slot.group.getObjectByName('coal-scoop'),false,`${id}/${who}: uses coal scoops`);
  assert.equal(!!slot.group.getObjectByName('depot-coal-bin'),false);assert.ok(slot.group.getObjectByName('road-fuel-pump'));
  if(who==='player'){assert.match(R.NARRATION[R.getView(r).taskKey],/fuel/);for(let i=0;i<3;i++){assert.equal(R.serviceAction(r,'coal-'+i),true);assert.equal(R.serviceAction(r,'coal-'+i),false);R.step(r,1);}assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);assert.equal(v.fuel,1);assert.equal(v.coal,0);}
  V.disposeScene(b);
 }
});
test('Harold keeps moving sling cargo below the helicopter when approaching and leaving an intermediate stop',()=>{
 for(const who of ['player','rival']){
  const{r,v,b}=fixture('harold',who),job=v.serviceStates.find(s=>s.type==='wash');v.carried.container='container-1';v.velocity=R.CRUISE_SPEED;
  for(const gap of [-1800,-1200,-900,900,1200,1500]){
   v.distance=job.at+gap;V.updateScene(b,r);const payload=b[who+'Coach'],load=payload.userData.container,point=load.getWorldPosition(new T.Vector3()),belly=b[who].localToWorld(new T.Vector3(0,.65,0));
   if(point.y>R.sampleVehicleRoute(r,who,job.at).y+.05)assert.ok(Math.hypot(point.x-belly.x,point.z-belly.z)<.3,`${who}/${gap}: cargo flies sideways independently of helicopter`);
  }V.disposeScene(b);
 }
});

test('intermediate winching stays vertical, detaches only on the ground and leaves grounded cargo still',()=>{
 for(const who of ['player','rival'])for(const seed of [1,2,3,4]){
  const{r,v,b}=fixture('harold',who,seed);v.carried.container='container-1';v.velocity=R.CRUISE_SPEED;
  for(const type of ['wash','coal','rocks','repairs','water','tree']){
   const job=v.serviceStates.find(s=>s.type===type);if(!job)continue;
   const pad=R.sampleRoute(r.courseId,job.at,who==='rival'?R.ROAD_LANE+3:-3);
   for(const [phase,progress] of [['cargo-lowering',0],['cargo-lowering',.3],['cargo-lowering',.6],['cargo-lowering',.8],['ready',1],['working',.5],['cargo-lifting',0],['cargo-lifting',.2],['cargo-lifting',.4],['cargo-lifting',.5],['cargo-lifting',.6],['cargo-lifting',.7],['cargo-lifting',1]]){
    const gap=phase+'/'+progress;v.distance=job.at;v.velocity=0;v.service=job;job.phase=phase;job.handlingProgress=progress;job.activeUnit=0;if(who==='rival')r.player.distance=v.distance;V.updateScene(b,r);const f=R.getFlightPose(r,who),payload=b[who+'Coach'],load=payload.userData.container,point=load.getWorldPosition(new T.Vector3());
    assert.ok(point.y>=pad.y-1e-8,'load never sinks into the ground');
    assert.equal(payload.userData.sling.visible,f.cargo.ropeVisible??f.cargo.attached);
    if(phase.startsWith('cargo-')){
     assert.equal(V.pickScene(b,r,100,100,320,420),null,'handling stages do not expose job targets');
     const hose=b.objects.services.find(s=>s.spec.id===job.id).slots[who==='player'?0:1].fuelHose;if(hose)assert.equal(hose.visible,false,'fuel hose waits for landing');
    }
    if(f.cargo.phase==='winching'){
     assert.ok(Math.hypot(f.x-pad.x,f.z-pad.z)<1e-8,'Harold hovers directly over the drop spot');
     assert.ok(Math.hypot(point.x-pad.x,point.z-pad.z)<1e-8,'cargo moves only vertically');
    }
    if(f.cargo.phase==='parked')assert.ok(point.distanceTo(new T.Vector3(pad.x,pad.y,pad.z))<1e-8,'detached load stays fixed on the ground');
    for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){
     b.camera.aspect=w/h;V.updateScene(b,r);const screen=point.clone().project(b.camera);assert.ok(Math.abs(screen.x)<.96&&Math.abs(screen.y)<.96,`${who}/${type}/${gap}/${w}: load remains framed ${screen.x},${screen.y}`);
     for(const object of [b[who],payload])object.traverse(mesh=>{if(!mesh.isMesh)return;for(let o=mesh;o;o=o.parent)if(!o.visible)return;
      const vertices=mesh.geometry.attributes.position;for(let i=0;i<vertices.count;i++){const p=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).project(b.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${who}/${type}/${gap}/${w}: ${mesh.name} remains framed`);}
     });
    }
    const pose=point.toArray();V.updateScene(b,r,{paused:true,time:1000});assert.deepEqual(load.getWorldPosition(new T.Vector3()).toArray(),pose,'pause preserves cargo position');
   }
  }
  v.service=null;for(const type of ['animals','level-crossing','drawbridge']){const job=v.serviceStates.find(s=>s.type===type);if(!job)continue;v.distance=job.at;V.updateScene(b,r);assert.equal(R.getFlightPose(r,who).cargo,null,'hover-only stops keep their cargo attached');assert.ok(b[who+'Coach'].userData.sling.visible);}
  V.disposeScene(b);
 }
});
test('non-train job reminders match their actual fuel, road and flight equipment',()=>{
 const{setup}=require('./helpers/game-harness.cjs');
 for(const id of ['bertie','bulgy','harold'])for(const seed of [1,24,40]){
  const ui=setup();ui.choose('player',id);ui.choose('opponent','thomas');ui.click('#startRaceButton');
  ui.evaluate(`state.race=ThomasRaceCore.createRace({playerId:'${id}',opponentId:'thomas',seed:${seed}});state.race.phase='racing';state.race.countdown=0;render()`);
  const jobs=ui.state().race.player.serviceStates;
  for(const s of jobs){
   ui.evaluate(`{const r=state.race,s=r.player.serviceStates.find(s=>s.id==='${s.id}');r.player.distance=s.at;r.player.velocity=0;r.player.service=s;s.phase='ready';render();}`);
   const key=ui.evaluate('ui.taskKey'),picture=ui.evaluate(`raceTaskPicture('${s.type}')`);
   if(id==='harold'){assert.match(key,/^race\.flight\./);assert.doesNotMatch(key,/depot-coal/);continue;}
   if(s.type==='coal'){assert.equal(key,'race.service.road-fuel');assert.equal(picture,'race-fuel');}
   if(s.type==='water'){assert.equal(key,'race.service.depot-water');assert.equal(picture,'race-depot-water');}
   if(s.type==='repairs'){assert.equal(key,'race.service.road-repairs');assert.equal(picture,'race-potholes');}
   if(s.type==='level-crossing'){assert.equal(key,'race.service.road-junction');assert.equal(picture,'race-road-junction');}
   if(s.type==='animals')assert.equal(key,'race.service.horn-animals');
  }
 }
});
