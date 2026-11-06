const test=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');require('../scripts/game-shell.js');
const R=ThomasRaceCore,G=ThomasGameCore;
test('Harold can be either racer, persist as a preference and join Random without duplicates',()=>{
 assert.equal(R.character('harold')?.vehicleType,'air');
 for(const playerId of ['harold','thomas','bertie'])for(const opponentId of ['harold','thomas','bulgy']){
  if(playerId===opponentId){assert.throws(()=>R.createRace({playerId,opponentId}),/different/);continue;}
  const r=R.createRace({playerId,opponentId});assert.equal(r.playerId,playerId);assert.equal(r.opponentId,opponentId);
 }
 let saved;const storage={getItem:()=>saved,setItem:(_,s)=>saved=s},game=G.createGame(storage);
 game.dispatch('select-player','harold');assert.equal(game.dispatch('select-opponent','harold'),false);game.dispatch('select-opponent','bulgy');
 assert.deepEqual(G.createGame(storage).state.selections,{playerId:'harold',opponentId:'bulgy'});
 const picks=new Set();for(let i=0;i<100;i++){const p=R.chooseRace({playerId:'random',opponentId:'random',random:()=>i/100});picks.add(p.playerId);picks.add(p.opponentId);assert.notEqual(p.playerId,p.opponentId);}assert.ok(picks.has('harold'));
});
test('Harold flies clear of scenery, lands for passengers and flies longer marked sections without a shortcut reward',()=>{
 const r=R.createRace({playerId:'harold',opponentId:'thomas',seed:24,deliveryTheme:'passengers'});r.phase='racing';r.countdown=0;
 r.player.distance=3000;assert.ok(R.getFlightPose(r,'player').altitude>=7);
 const first=r.player.serviceStates[0];r.player.distance=first.at;r.player.service=first;first.phase='ready';
 assert.ok(R.getFlightPose(r,'player').altitude<.1);assert.match(R.getView(r).taskKey,/flight/);
 r.player.service=null;first.completed=true;r.player.distance=first.at+R.courseDistance(2000);assert.ok(R.getFlightPose(r,'player').altitude>7);
 const section=R.COURSES[r.courseId].sections.find(s=>s.type==='tunnel');r.player.distance=(section.start+section.end)/2;
 assert.ok(R.getFlightPose(r,'player').altitude>9,'flight route clears the old tunnel envelope with a hanging load');
 const air=R.getTravelSections(r,'player').find(s=>s.id===section.id),ground=R.getTravelSections(r,'rival').find(s=>s.id===section.id);
 assert.ok(air.end>ground.end);assert.equal(air.end+R.getCharacter(r).coachRear,ground.end+R.getCoachOffset(r,'rival')+R.getCharacter(r,'rival').coachRear);
 const pose=R.getFlightPose(r,'player');assert.deepEqual(R.getFlightPose(r,'player'),pose,'drawing is deterministic and does not advance the race');
});
test('fuel work completes once and flight terrain stays restricted until the tail clears',()=>{
 const r=R.createRace({playerId:'harold',opponentId:'percy',seed:24});r.phase='racing';r.countdown=0;const s=r.player.serviceStates.find(s=>s.type==='coal');
 r.player.distance=s.at;r.player.service=s;r.player.velocity=0;s.phase='ready';
 for(let i=0;i<3;i++){assert.equal(R.serviceAction(r,'coal-'+i),true);assert.equal(R.serviceAction(r,'coal-'+i),false);R.step(r,1);if(i<2)assert.equal(R.serviceAction(r,'coal-'+i),false);}
 assert.equal(s.completed,true);assert.equal(r.player.fuel,1);assert.equal(r.player.coal,0);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
 const t=R.createRace({playerId:'harold',opponentId:'percy',seed:24});t.phase='racing';t.countdown=0;const section=R.getTravelSections(t).find(s=>s.type==='tunnel');t.player.serviceStates.forEach(s=>{if(s.at<section.end)s.completed=true;});
 t.player.distance=section.end+R.character('harold').coachRear-.1;t.player.velocity=0;R.step(t,.01);assert.equal(t.player.terrainStates.find(s=>s.id===section.id).completed,false);
 t.player.distance+=1;R.step(t,.01);assert.equal(t.player.terrainStates.find(s=>s.id===section.id).completed,true);const cleared=t.player.terrainStates.find(s=>s.id===section.id).completedAt;R.step(t,.1);assert.equal(t.player.terrainStates.find(s=>s.id===section.id).completedAt,cleared);
});
