const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
const all=(root,name)=>{const found=[];root.traverse(o=>{if(o.name===name)found.push(o);});return found;};
function fixture(playerId='harold',opponentId='bertie',courseId='country',seed=2){const r=R.createRace({playerId,opponentId,courseId,seed,deliveryTheme:'cargo'});r.phase='racing';r.countdown=0;return {r,b:V.makeScene(R,courseId,opponentId,'cargo',r)};}
function job(r,who,type,t=0){const v=r[who],s=v.serviceStates.find(s=>s.type===type);assert.ok(s);r.player.distance=r.rival.distance=s.at;v.velocity=0;v.carried.container='container-1';v.service=s;s.phase='working';s.duration=type==='tree'?R.getBranchLiftSeconds(r):type==='rocks'?2:1.5;s.progress=t;s.remaining=s.duration*(1-t);s.activeUnit=0;return s;}

test('one irregular lake surrounds both routes, with shallow water above road and sleepers but below rail heads',()=>{
 for(const course of ['country','harbour'])for(const [player,opponent]of [['thomas','bertie'],['bertie','harold'],['harold','bulgy']]){
  const{r,b}=fixture(player,opponent,course),lake=b.lakeside,water=all(b.world,'lake-water-surface');assert.equal(water.length,1);
  assert.equal(all(b.world,'shallow-wet-track').length,0);assert.equal(all(b.world,'snow-bank').length,0);
  assert.equal(water[0].material.transparent,true);assert.ok(water[0].material.opacity<.7);assert.equal(water[0].castShadow,false);
  const vertices=water[0].geometry.attributes.position;for(let i=0;i<vertices.count;i++)assert.ok(Math.abs(vertices.getY(i)-lake.level)<1e-6,'water stays level');
  for(const who of ['player','rival'])if(R.getCharacter(r,who).vehicleType!=='air'){
   const p=R.sampleVehicleRoute(r,who,R.courseDistance(128600));assert.ok(p.y+.05<lake.level,'water covers sleepers and pavement');assert.ok(p.y+.3>lake.level,'rail heads remain above the flood');
   const ground=all(b.world,'continuous-ground'),hit=new T.Raycaster(new T.Vector3(p.x,p.y+2,p.z),new T.Vector3(0,-1,0)).intersectObjects(ground)[0];assert.ok(hit&&hit.point.y<p.y-.1,'ground never pokes through the road');
  }
  r.player.distance=r.rival.distance=R.courseDistance(128600);r.player.velocity=r.rival.velocity=330;V.updateScene(b,r);
  for(const who of ['player','rival'])assert.equal(b[who+'Splashes'].visible,R.getCharacter(r,who).vehicleType==='road');
  V.disposeScene(b);
 }
});

test('frozen lake stays beside a raised route, with translucent thin ice and uneven verge snow',()=>{
 const{r,b}=fixture('bertie','thomas','mountain'),lake=b.lakeside;assert.equal(all(b.world,'lake-ice-surface').length,1);assert.equal(all(b.world,'shallow-wet-track').length,0);
 const patches=all(b.world,'thin-route-ice');assert.equal(patches.length,24);assert.ok(all(b.world,'uneven-snow-verge').length>20);
 for(const who of ['player','rival'])assert.ok(R.sampleVehicleRoute(r,who,R.courseDistance(128600)).y>lake.level,'vehicles do not drive through solid lake ice');
 for(const patch of patches){assert.equal(patch.material.transparent,true);assert.ok(patch.material.opacity<.7);assert.equal(patch.castShadow,false);assert.ok(patch.geometry.attributes.position.count>20,'irregular flat patches, not raised boxes');}
 r.player.distance=r.rival.distance=R.courseDistance(128600);r.player.velocity=r.rival.velocity=400;V.updateScene(b,r);assert.equal(b.playerSplashes.visible,false);assert.equal(b.rivalSplashes.visible,false);V.disposeScene(b);
});

test('rain, blowing snow and windsocks move only with the race clock and do not hide either racer',()=>{
 for(const course of ['country','mountain'])for(const pair of [['harold','bertie'],['thomas','harold']]){
  const{r,b}=fixture(...pair,course);r.player.distance=r.rival.distance=R.courseDistance(128600);V.updateScene(b,r);
  const first=Array.from(b.lakeside.particles.instanceMatrix.array);r.elapsed+=.5;V.updateScene(b,r);assert.notDeepEqual(Array.from(b.lakeside.particles.instanceMatrix.array),first);
  const paused=Array.from(b.lakeside.particles.instanceMatrix.array),pose=R.getFlightPose(r,pair[0]==='harold'?'player':'rival');V.updateScene(b,r,{paused:true,time:999});assert.deepEqual(Array.from(b.lakeside.particles.instanceMatrix.array),paused);assert.deepEqual(R.getFlightPose(r,pair[0]==='harold'?'player':'rival'),pose);
  for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){
   b.camera.aspect=w/h;V.updateScene(b,r);
   for(const who of ['player','rival']){const c=R.getCharacter(r,who),point=b[who].localToWorld(new T.Vector3(0,c.vehicleType==='air'?1.1:2.2,1.4)),direction=point.clone().sub(b.camera.position),length=direction.length();
    const hits=new T.Raycaster(b.camera.position,direction.normalize(),0,length-.15).intersectObjects(all(b.world,'weather-cloud'));assert.equal(hits.length,0,`${course}/${who}/${w}: weather clouds hide the racer`);
   }
  }V.disposeScene(b);
 }
});

test('heavy rocks are supported by a ground crane and repair packages stay on handcarts',()=>{
 for(const who of ['player','rival'])for(const [type,seed]of [['rocks',1],['repairs',4]]){
  const{r,b}=fixture(who==='player'?'harold':'bertie',who==='rival'?'harold':'bertie','country',seed),s=job(r,who,type),slot=b.objects.services.find(x=>x.spec.id===s.id)?.slots.find(x=>x.who===who);
  V.updateScene(b,r);const actual=slot||b.objects.services.find(x=>x.spec.id===s.id).slots.find(x=>x.who===who);
  for(const t of [0,.2,.5,.8,1]){s.progress=t;s.remaining=s.duration*(1-t);V.updateScene(b,r);assert.equal(actual.winch.visible,false,'Harold’s rope does not move heavy objects');assert.ok(R.getFlightPose(r,who).altitude<.1,'Harold waits on the pad');
   if(type==='rocks'){const rock=actual.airRocks[0],hook=actual.groundCrane.hook.getWorldPosition(new T.Vector3()),target=rock.localToWorld(new T.Vector3(0,rock.userData.slingTop,0));if(t>=.3&&t<.9)assert.ok(hook.distanceTo(target)<1e-6);else assert.ok(hook.y>target.y,'empty hook lowers before attachment and retracts after release');
    for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){b.camera.aspect=w/h;V.updateScene(b,r);const solid=[];actual.groundCrane.group.traverse(o=>{if(o.isMesh)solid.push(o);});for(const role of ['player','rival']){const point=b[role].localToWorld(new T.Vector3(0,2,2)),delta=point.clone().sub(b.camera.position),length=delta.length();assert.equal(new T.Raycaster(b.camera.position,delta.normalize(),0,length-.12).intersectObjects(solid).length,0,'ground crane keeps both faces visible');}}
   }
   else for(const [i,crate]of actual.packages.entries()){assert.equal(crate.parent,actual.handcarts[i]);assert.equal(crate.position.y,.32);assert.equal(actual.handcarts[i].position.y,0);assert.equal(new T.Box3().setFromObject(actual.handcarts[i]).intersectsBox(new T.Box3().setFromObject(b[who+'Coach'].userData.container)),false,'handcarts stay clear of the parked delivery cargo');}
  }V.disposeScene(b);
 }
});

test('small branches stay under Harold on a supporting sling, touch down before detachment and remain framed',()=>{
 for(const who of ['player','rival']){
  const{r,b}=fixture(who==='player'?'harold':'bertie',who==='rival'?'harold':'bertie'),s=job(r,who,'tree');V.updateScene(b,r);const slot=b.objects.services.find(x=>x.spec.id===s.id).slots.find(x=>x.who===who);let previous;
  for(let i=0;i<=240;i++){
   s.progress=i/240;s.remaining=s.duration*(1-s.progress);const f=R.getFlightPose(r,who),lift=R.getBranchLiftPose(s.progress);
   if(previous)assert.ok(Math.hypot(f.x-previous.x,f.y-previous.y,f.z-previous.z)<6.6*12/240,'service flight remains slower than normal cruise');previous=f;
   if(i%10)continue;V.updateScene(b,r);const load=slot.airBranch.getWorldPosition(new T.Vector3()),padY=R.sampleVehicleRoute(r,who,s.at).y;
   assert.ok(load.y>=padY+.3-1e-6);
   if(lift.attached){assert.ok(Math.hypot(load.x-f.x,load.z-f.z)<1e-6,'a rope cannot steer the load separately');assert.ok(slot.hook.getWorldPosition(new T.Vector3()).distanceTo(load.clone().add(new T.Vector3(0,.3,0)))<1e-6);assert.equal(slot.branchSlings.visible,true);}
   if(lift.seconds>=9.5)assert.ok(Math.abs(load.y-padY-.3)<1e-6,'detach only on the ground');
   for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){b.camera.aspect=w/h;V.updateScene(b,r);for(const object of [b[who],slot.airBranch]){const box=new T.Box3().setFromObject(object);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).project(b.camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1,`${who}/${i}/${w}: clipped sling work`);}}}
   const snapshot=slot.airBranch.position.toArray();V.updateScene(b,r,{paused:true,time:99999});assert.deepEqual(slot.airBranch.position.toArray(),snapshot);
  }V.disposeScene(b);
 }
});

test('both racers get the same branch work duration and early input cannot skip the lift or complete the job twice',()=>{
 for(const pair of [['harold','bertie'],['bulgy','harold'],['thomas','percy']]){
  const r=R.createRace({playerId:pair[0],opponentId:pair[1],seed:2,deliveryTheme:'passengers'});r.phase='racing';r.countdown=0;
  for(const who of ['player','rival']){const v=r[who],s=v.serviceStates.find(s=>s.type==='tree');v.serviceStates.forEach(x=>{if(x.at<s.at)x.completed=true;});v.distance=s.at;v.velocity=0;v.service=s;s.phase='ready';}
  assert.equal(R.serviceAction(r),true);assert.equal(R.serviceAction(r),false);const s=r.player.service,seconds=pair.includes('harold')?12:5;assert.equal(s.duration,seconds);
  R.step(r,seconds-.1);assert.equal(s.completed,false);assert.equal(r.rival.service.duration,seconds);R.step(r,.1);assert.equal(s.completed,true);
  assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);R.serviceAction(r);R.step(r,2);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
 }
});
