'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../scripts/race-model.js');
const R=global.ThomasRaceCore,{accelerateTo}=require('./helpers/race-driver.cjs');
function help(race){
  accelerateTo(R,race,100);
  const s=R.getView(race).currentService;
  if(!s||s.phase!=='ready')return;
  return s.type==='animals'?R.whistle(race):R.serviceAction(race);
}
function reach(type){
  let race;
  for(let seed=1;seed<100;seed++){
    race=R.createRace({seed});if(race.services.some(s=>s.type===type))break;
  }
  for(let i=0;i<6000;i++){
    if(race.player.service?.type===type)return race;
    help(race);R.step(race,.1);
  }
  assert.fail(`Could not reach ${type}`);
}

test('every race has eight distinct railway jobs, including two new jobs and a delivery pair',()=>{
  for(const courseId of Object.keys(R.COURSES))for(let seed=0;seed<40;seed++){
    const race=R.createRace({courseId,seed});
    const types=race.services.map(s=>s.type);
    assert.equal(types.length,8);
    assert.equal(new Set(types).size,8);
    assert.ok(types[0].endsWith('-load'));
    assert.ok(types.at(-1).endsWith('-unload'));
    assert.ok(types.includes('animals')&&types.includes('wash'));
    assert.ok(types.filter(t=>['repairs','rocks','coal','level-crossing'].includes(t)).length>=2);
    assert.equal('mailStops' in race,false);
  }
});

test('new jobs require their complete actions and reject early, overlapping, and repeated work',()=>{
  for(const [type,count,seconds,prefix] of [['repairs',3,1.5,'sleeper'],['rocks',2,2,'rock'],['coal',3,1,'coal'],['level-crossing',1,5,'crossing']]){
    const race=reach(type),s=race.player.service;
    assert.equal(R.serviceAction(race,'invalid'),false);
    for(let unit=0;unit<count;unit++){
      const id=type==='level-crossing'?'crossing':`${prefix}-${unit}`;
      assert.equal(R.serviceAction(race,id),true,type);
      assert.equal(R.serviceAction(race,id),false);
      R.step(race,seconds-.02);assert.equal(s.completed,false);
      R.step(race,.03);
      if(unit<count-1)assert.equal(R.serviceAction(race,id),false);
    }
    assert.equal(s.completed,true);
    assert.equal(race.player.service,null);
    assert.equal(R.serviceAction(race),false);
    assert.equal(race.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
    if(type==='coal')assert.equal(race.player.coal,1);
  }
});

test('a completed job gives feedback once and waits for Up to depart',()=>{
  const race=reach('coal'),job=race.player.service;

  for(let i=0;i<3;i++){
    R.serviceAction(race);R.step(race,1);
    if(i<2)assert.equal(job.completed,false);
  }
  assert.equal(job.completed,true);
  assert.equal(race.events.filter(e=>e.type==='service-done'&&e.serviceId===job.id).length,1);
  const distance=race.player.distance;
  assert.equal(race.player.speedPercent,0);
  assert.equal(R.adjustSpeed(race,-1),false);
  R.step(race,1);
  assert.equal(race.player.distance,distance);
  assert.equal(race.player.velocity,0);
  assert.equal(R.adjustSpeed(race,1),true);
  assert.equal(race.player.speedPercent,25);
  R.step(race,1);
  assert.equal(race.player.targetVelocity,250);
  assert.ok(race.player.velocity>0&&race.player.velocity<250);
});

test('each terrain section completes after the entire train clears, including both tunnels',()=>{
  const race=R.createRace({seed:9,opponentId:'james'});
  for(let i=0;i<5000&&race.phase!=='complete';i++){
    help(race);R.step(race,.1);
    for(const who of ['player','rival'])for(const s of race[who].terrainStates){
      if(s.completed){const section=R.COURSES[race.courseId].sections.find(t=>t.id===s.id);assert.ok(race[who].distance-R.getCoachOffset(race,who)-400>=section.end);}
    }
  }
  assert.equal(race.phase,'complete');
  assert.equal(race.events.some(e=>e.type.includes('boost')),false);
  assert.equal(race.player.terrainStates.filter(s=>s.completed).length,5);
  assert.equal(R.COURSES.country.sections.filter(s=>s.type==='tunnel').length,2);
});

test('crossing departure holds the speed limit until the last coach clears',()=>{
  const race=reach('level-crossing'),s=race.player.service;
  R.serviceAction(race);R.step(race,5);
  assert.equal(R.adjustSpeed(race,1),true,'First Up starts the vehicle');
  assert.equal(R.adjustSpeed(race,1),true,'Second Up reaches the crossing limit');
  while(race.player.distance-R.getCoachOffset(race,'player')-400<=s.at+1400){
    assert.ok(race.player.velocity<=R.SPEEDS[4]*.5+1e-7);
    assert.equal(R.adjustSpeed(race,1),false);
    R.step(race,.05);
  }
  assert.equal(R.adjustSpeed(race,1),true);
});

test('the rival independently completes all jobs and restricted sections',()=>{
  const race=R.createRace({seed:91,opponentId:'bertie'});
  R.step(race,700);
  assert.equal(race.player.serviceStates.filter(s=>s.completed).length,0);
  assert.equal(race.rival.serviceStates.filter(s=>s.completed).length,8);
  assert.equal(race.rival.terrainStates.filter(s=>s.completed).length,5);
  assert.equal(race.events.filter(e=>e.type==='rival-service-done').length,8);
  assert.ok(race.rival.finishTime);
});
