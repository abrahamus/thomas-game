'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');const R=global.ThomasRaceCore;
function nearFinish(settings={},outcome='player'){
 const r=R.createRace(settings),end=R.COURSES[r.courseId].length;r.phase='racing';r.countdown=0;r.elapsed=300;
 r.player.speedPercent=100;
 for(const who of ['player','rival']){const v=r[who];v.distance=end-(outcome==='tie'||outcome===who?1:1800);v.velocity=R.CRUISE_SPEED;v.targetVelocity=R.CRUISE_SPEED;v.serviceStates.forEach(s=>{s.completed=true;s.phase='complete';s.groups.fill(true);});v.terrainStates.forEach(s=>s.completed=true);}
 return r;
}
function finish(r){for(let i=0;r.phase!=='complete';i++){assert.ok(i<1000);R.step(r,.05);}return r;}
for(const c of R.CHARACTERS)for(const role of ['player','rival'])test(`${c.id} as ${role}: win, second and tie preserve results through the festival`,()=>{
 const settings={playerId:role==='player'?c.id:c.id==='thomas'?'percy':'thomas',opponentId:role==='rival'?c.id:c.id==='thomas'?'percy':'thomas'};
 for(const winner of ['player','rival','tie']){
  const r=finish(nearFinish(settings,winner)),saved=JSON.stringify(r),p=R.createFinishPresentation(r);
  assert.equal(r.winner,winner);assert.equal(r.player.finishEvent.time,r.player.finishTime);assert.equal(r.player.finishEvent.speed,R.CRUISE_SPEED);assert.equal(r.player.velocity,0);
  assert.equal(r.events.filter(e=>e.type==='finish'&&e.who==='player').length,1);
  let before=p.race.player.velocity,d=p.race.player.distance;
  for(let i=0;i<90;i++){R.stepFinishPresentation(p,.1);assert.ok(p.race.player.velocity<=before+1e-8);assert.ok(p.race.player.distance>=d);assert.ok(p.race.player.distance-d<=before*.1+.05);before=p.race.player.velocity;d=p.race.player.distance;}
  R.stepFinishPresentation(p,.001);assert.equal(p.results,true);assert.equal(p.stage,'thanks');assert.equal(p.race.player.velocity,0);
  const rear=p.race.player.distance-R.getCoachOffset(r)-R.getCharacter(r).coachRear;assert.ok(rear>R.COURSES[r.courseId].length+100);
  assert.equal(JSON.stringify(r),saved,'presentation never changes results, rewards, jobs or timers');
  assert.equal(R.skipFinishPresentation(p),false);R.stepFinishPresentation(p,30);assert.equal(p.race.winner,winner);assert.equal(JSON.stringify(r),saved);
 }
});
test('rival continues its seeded challenge and route exactly, on an independent copy',()=>{
 const r=nearFinish({seed:24},'player'),job=r.rival.serviceStates.find(s=>s.type==='animals');
 for(const s of r.rival.serviceStates)if(s.index>=job.index){s.completed=false;s.phase='approach';s.groups.fill(false);}
 job.phase='ready';r.rival.service=job;r.rival.distance=job.at;r.rival.velocity=0;
 finish(r);const original=JSON.stringify(r),p=R.createFinishPresentation(r);
 const reference=JSON.parse(original);reference.phase='racing';reference._fixedRemainder=0;reference.events=[];
 reference.player.finishTime=null;reference.player.finishEvent=null;reference.player.distance=-1e9;
 reference.rival.velocity=r.finishMotion.rivalVelocity;reference.rival.targetVelocity=r.finishMotion.rivalTarget;
 reference.rival.service=reference.rival.serviceStates.find(s=>s.id===job.id);
 assert.equal(p.race.rival.service,p.race.rival.serviceStates.find(s=>s.id===job.id),'working job aliases its service state');
 for(let i=0;i<900;i++){R.step(reference,.1);R.stepFinishPresentation(p,.1);
  assert.ok(Math.abs(p.race.rival.distance-reference.rival.distance)<1e-6,'no teleport or catch-up');
  assert.equal(p.race.rival.service?.phase,reference.rival.service?.phase);
 }
 assert.ok(p.race.rival.distance>job.at);assert.equal(p.race.winner,'player');assert.equal(JSON.stringify(r),original);
});
test('presentation stages, immediate/late skip and rejected time inputs are idempotent',()=>{
 for(const at of [0,4.6,8.8]){const r=finish(nearFinish()),p=R.createFinishPresentation(r);R.stepFinishPresentation(p,at);const before=p.elapsed;assert.equal(R.skipFinishPresentation(p),true);assert.equal(p.elapsed,before);assert.equal(R.skipFinishPresentation(p),false);assert.equal(p.results,true);}
 const p=R.createFinishPresentation(finish(nearFinish()));for(const dt of [-1,0,Infinity,NaN])assert.equal(R.stepFinishPresentation(p,dt),false);
 R.stepFinishPresentation(p,4.499);assert.equal(p.stage,'arrival');R.stepFinishPresentation(p,.002);assert.equal(p.stage,'award');R.stepFinishPresentation(p,2.5);assert.equal(p.stage,'thanks');assert.equal(p.results,false);R.stepFinishPresentation(p,2);assert.equal(p.results,true);
});
test('Harold clears the banner before landing beyond the line in either role',()=>{
 for(const who of ['player','rival']){
  const r=nearFinish({playerId:who==='player'?'harold':'bulgy',opponentId:who==='rival'?'harold':'bulgy'},'tie');
  const end=R.COURSES[r.courseId].length;for(const d of [end-1400,end-200,end,end+500,end+950]){r[who].distance=d;assert.ok(R.getFlightPose(r,who).altitude>=7.9,'no premature descent into banner');}
  r[who].distance=end+R.finishRunout(r,who);assert.ok(R.getFlightPose(r,who).altitude<.061);
 }
});
module.exports={nearFinish};
