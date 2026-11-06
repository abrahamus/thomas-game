const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');
const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
function fixture(playerId,opponentId,type,seed=24){
 const r=R.createRace({playerId,opponentId,seed,deliveryTheme:'passengers'});r.phase='racing';r.countdown=0;
 for(const who of ['player','rival']){const v=r[who],s=v.serviceStates.find(x=>x.type===type);assert.ok(s);v.distance=s.at;v.velocity=0;v.service=s;s.phase='ready';v.serviceStates.forEach(x=>{if(x.at<s.at)x.completed=true;});}
 const b=V.makeScene(R,r.courseId,opponentId,r.deliveryTheme,r);V.updateScene(b,r);return {r,b,slots:b.objects.services.find(x=>x.spec.type===type).slots};
}
function progress(s,t,duration=5){s.phase='working';s.duration=duration;s.remaining=duration*(1-t);s.progress=t;s.activeUnit=0;}
test('rock and branch lifting has fixed arms, supported loads, safe release and continuous hook motion',()=>{
 for(const type of ['rocks','tree'])for(const pair of [['thomas','bertie'],['harold','bulgy'],['bertie','harold']]){
  const {r,b,slots}=fixture(...pair,type,2);
  for(const slot of slots){if(type==='tree'&&slot.air)continue;const s=r[slot.who].service,crane=slot.groundCrane||slot.crane,load=slot.airRocks?.[0]||slot.rocks?.[0]||slot.branch;
   let previous,restY;const arm=crane.boom.getObjectByName('fixed-crane-arm'),length=arm.geometry.boundingBox?.getSize(new T.Vector3()).x||9;
   const initialCable=crane.cable.geometry;
   for(let i=0;i<=100;i++){
    const t=i/100;progress(s,t,type==='rocks'?2:5);V.updateScene(b,r);const hook=crane.hook.getWorldPosition(new T.Vector3());restY??=load.position.y;
    assert.deepEqual(crane.boom.scale.toArray(),[1,1,1]);assert.equal(crane.cable.geometry,initialCable,'rope updates reuse the geometry buffer');assert.ok(length>8);
    assert.equal(new T.Box3().setFromObject(load).intersectsBox(new T.Box3().setFromObject(b[slot.who])),false,'the load swings away from the waiting vehicle');
    if(previous)assert.ok(hook.distanceTo(previous)<2,'hook never snaps into or out of existence');previous=hook;
    if(t>=.3&&t<.9){const top=load.localToWorld(new T.Vector3(0,load.userData.slingTop,0));assert.ok(hook.distanceTo(top)<1e-6,'hook is attached to the actual sling apex');}
    if(t<.3||t>=.85)assert.ok(Math.abs(load.position.y-restY)<1e-6,'attachment and release happen on the ground');
    if(t>=.9){assert.equal(load.userData.obstacleSling.visible,false);assert.ok(load.position.x>5,'cleared load remains beside the route');}
    assert.ok(crane.cable.geometry.attributes.position.array.every(Number.isFinite));
   }
   const pose=crane.hook.getWorldPosition(new T.Vector3());V.updateScene(b,r,{paused:true,time:9999});assert.ok(pose.distanceTo(crane.hook.getWorldPosition(new T.Vector3()))<1e-8);
  }V.disposeScene(b);
 }
});
test('all crossing equivalents wait for one activation, keep five seconds, and reward once',()=>{
 for(const pair of [['thomas','bertie'],['bertie','bulgy'],['bulgy','harold'],['harold','thomas']]){
  const {r,b}=fixture(...pair,'level-crossing');const s=r.player.service;
  r.player.carried.container='container-1';r.player.carried.cargo=true;
  R.step(r,1);assert.equal(s.phase,'ready');assert.equal(r.player.velocity,0);
  assert.equal(R.serviceAction(r,'crossing'),true);assert.equal(s.duration,5);assert.equal(R.serviceAction(r,'crossing'),false);
  R.step(r,4.9);assert.equal(s.completed,false);R.step(r,.1);assert.equal(s.completed,true);assert.equal(r.player.carried.container,'container-1');
  assert.equal(R.serviceAction(r,'crossing'),false);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);V.disposeScene(b);
 }
});
test('Harold holds his cargo, air traffic stays clear, and radio/road controls remain reachable',()=>{
 for(const pair of [['harold','bertie'],['bulgy','harold']]){
  const {r,b,slots}=fixture(...pair,'level-crossing');const air=slots.find(x=>x.air),road=slots.find(x=>x.road),s=r[air.who].service;
  r[air.who].carried.container='container-1';r[air.who].carried.cargo=true;
  assert.equal(road.barriers.length,0);assert.equal(air.car,undefined);assert.ok(air.crossingAircraft);assert.ok(air.group.getObjectByName('airfield-control-tower'));
  for(const [w,h]of [[320,420],[375,640],[844,390],[1366,768],[1920,900]]){
   b.camera.aspect=w/h;
   for(const t of [0,.2,.5,.8,1]){
    progress(s,t);V.updateScene(b,r);assert.ok(R.getFlightPose(r,air.who).altitude>5.9);assert.equal(R.getFlightPose(r,air.who).cargo,null,'the carried sling is never parked for clearance');
    assert.equal(new T.Box3().setFromObject(air.crossingAircraft).intersectsBox(new T.Box3().setFromObject(b[air.who])),false,'crossing aircraft clears Harold and his rotor');
    const point=air.crossingAircraft.getWorldPosition(new T.Vector3()).project(b.camera);if(t<=.5)assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'aircraft is visible ahead before clearance');
   }
   for(const slot of slots){const state=r[slot.who].service;state.phase='ready';V.updateScene(b,r);const centre=new T.Box3().setFromObject(slot.control).getCenter(new T.Vector3()),p=centre.clone().project(b.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'control stays framed');
    const blockers=[];b.scene.traverse(o=>{if(!o.isMesh)return;for(let parent=o;parent;parent=parent.parent)if(!parent.visible||parent===slot.control)return;blockers.push(o);});
    const ray=centre.clone().sub(b.camera.position),length=ray.length(),hits=new T.Raycaster(b.camera.position,ray.normalize(),0,length-.06).intersectObjects(blockers,false);assert.equal(hits.length,0,`clear sight to ${slot.who} control: ${hits[0]?.object.name}`);
    if(slot.who==='player')assert.deepEqual(V.pickScene(b,r,(p.x+1)*w/2,(1-p.y)*h/2,w,h),{kind:'service',id:'crossing'});
   }
  }
  progress(s,.5);V.updateScene(b,r);const snapshot=air.crossingAircraft.position.toArray(),rotor=air.crossingRotor.rotation.y;V.updateScene(b,r,{paused:true,time:99999});assert.deepEqual(air.crossingAircraft.position.toArray(),snapshot);assert.equal(air.crossingRotor.rotation.y,rotor);
  s.phase='complete';s.completed=true;s.completedAt=r.elapsed;V.updateScene(b,r);assert.equal(air.signal.material.color.getHex(),0x58ad50);V.disposeScene(b);
 }
});
