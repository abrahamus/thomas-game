'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/game-harness.cjs');

function atStop(playerId,type){
 const ui=setup();ui.choose('player',playerId);ui.click('#startRaceButton');
 ui.evaluate(`{
  let race;
  for(let seed=1;seed<100;seed++){
   race=ThomasRaceCore.createRace({playerId:${JSON.stringify(playerId)},opponentId:'percy',seed});
   if(race.services.some(s=>s.type===${JSON.stringify(type)}))break;
  }
  state.race=race;race.phase='racing';race.countdown=0;
  const s=race.player.serviceStates.find(s=>s.type===${JSON.stringify(type)});
  race.player.serviceStates.forEach(t=>t.completed=t.index<s.index);
  race.player.distance=s.at;race.player.velocity=0;game.step(.01);render();focusStage();
 }`);
 return ui;
}

test('road and air clearance controls support keyboard, picture and direct activation with pause and repeat protection',()=>{
 for(const player of ['bertie','bulgy','harold'])for(const method of ['keyboard','picture','direct']){
  const ui=atStop(player,'level-crossing');
  assert.equal(ui.document.getElementById('raceHelpLabel').textContent,player==='harold'?'Call':'Lights');
  assert.equal(ui.document.getElementById('raceHelpPicture').getAttribute('href'),player==='harold'?'#race-flight-clearance':'#race-road-junction');
  ui.evaluate(`globalThis.clearanceEffects=[];const clearanceEffect=audio.effect.bind(audio);audio.effect=(...args)=>{clearanceEffects.push(args[0]);return clearanceEffect(...args);};`);
  if(method==='keyboard')ui.key('Enter');else if(method==='picture')ui.click('#action-race-help');else ui.evaluate("dispatchAction('race-help','crossing')");
  assert.equal(ui.state().race.player.service.duration,5);
  ui.key('Enter',{repeat:true});assert.equal(ui.evaluate("dispatchAction('race-help','crossing')"),false);
  if(player==='harold')assert.deepEqual(JSON.parse(ui.evaluate('JSON.stringify(clearanceEffects)')),['radio']);
  ui.click('#pauseButton');const remaining=ui.state().race.player.service.remaining;ui.frames(2,60);assert.equal(ui.state().race.player.service.remaining,remaining);
  ui.click('[data-action="resume"]');ui.frames(5.1,60);const job=ui.state().race.player.serviceStates.find(s=>s.type==='level-crossing');assert.equal(job.completed,true);
 }
});

test('sheep signals survive the stale instruction cleanup for keyboard and picture controls',()=>{
 for(const player of ['thomas','bertie','bulgy','diesel','harold'])for(const keyboard of [true,false]){
  const ui=atStop(player,'animals'),effect=player==='harold'?'radio':['bertie','bulgy','diesel'].includes(player)?'horn':'whistle';
  // Capture the real dispatch/cleanup order, not a standalone sound call.
  ui.evaluate(`globalThis.signalTrace=[];
   const originalEffect=audio.effect.bind(audio),originalStop=audio.stop.bind(audio);
   audio.effect=(...args)=>{signalTrace.push(args[0]);return originalEffect(...args);};
   audio.stop=(...args)=>{signalTrace.push('stop-all');return originalStop(...args);};`);
  keyboard?ui.key(' '):ui.click('#action-whistle');
  assert.equal(ui.state().race.player.service.phase,'working');
  const trace=ui.evaluate('JSON.stringify(signalTrace)');
  assert.ok(JSON.parse(trace).includes(effect),`${player}: ${trace}`);
  assert.ok(!JSON.parse(trace).slice(JSON.parse(trace).indexOf(effect)+1).includes('stop-all'),`${player}: signal immediately cancelled: ${trace}`);
  ui.key(' ',{repeat:true});
  assert.equal(ui.evaluate(`signalTrace.filter(s=>s===${JSON.stringify(effect)}).length`),1);
  ui.click('#pauseButton');assert.equal(ui.evaluate('signalTrace.at(-1)'),'stop-all','Pause still stops all sounds');
 }
});

test('harbour waits for Enter or its job picture, then completes once after six seconds',()=>{
 for(const player of ['thomas','bertie','harold'])for(const keyboard of [true,false]){
  const ui=atStop(player,'drawbridge');
  assert.equal(ui.state().race.player.service.phase,'ready');
  const help=ui.document.getElementById('action-race-help');
  assert.equal(help.hidden,false);assert.equal(help.disabled,false);
  ui.frames(10);assert.equal(ui.state().race.player.service.phase,'ready','Waiting alone cannot send the boat through');
  keyboard?ui.key('Enter'):ui.click('#action-race-help');
  const begun=ui.state().race.player.service;
  assert.equal(begun.phase,'working');assert.equal(begun.duration,6);
  ui.key('Enter',{repeat:true});ui.key('Enter');
  assert.equal(ui.state().race.player.service.remaining,begun.remaining);
  ui.frames(2);ui.click('#pauseButton');const paused=ui.state().race.player.service;
  ui.frames(3);assert.deepEqual(ui.state().race.player.service,paused);
  ui.click('#pauseOverlay [data-action="resume"]');ui.frames(4.1,20);
  assert.equal(ui.state().race.player.service,null);
  assert.equal(ui.state().race.player.serviceStates.find(s=>s.id===begun.id).completed,true);
 }
});

test('Harold’s direct sheep radio control plays the radio signal rather than a generic click',()=>{
 const ui=atStop('harold','animals');
 ui.evaluate(`globalThis.directEffects=[];const original=audio.effect.bind(audio);
  audio.effect=(...args)=>{directEffects.push(args[0]);return original(...args);};
  ui.raceView.pick=()=>({kind:'service',id:'animals'});`);
 ui.document.emit('click',{target:ui.document.getElementById('raceCanvas'),clientX:50,clientY:50});
 assert.equal(ui.state().race.player.service.phase,'working');
 assert.deepEqual(JSON.parse(ui.evaluate('JSON.stringify(directEffects)')),['radio']);
});
