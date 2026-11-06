const test=require('node:test'),assert=require('node:assert/strict');
const {setup,accelerateTo}=require('./helpers/game-harness.cjs');
const ids=['thomas','percy','james','bertie','toby','spencer','emily','diesel','bulgy','harold'];
const node=(ui,id)=>ui.document.querySelector('#'+id);
function finish(ui,keyboard){
 for(let n=0;ui.state().phase!=='complete';n++){
  assert.ok(n<2200);const s=ui.state().race.player.service;
  accelerateTo(ui,keyboard);
  if(s?.phase==='ready'){
   if(s.type==='animals')keyboard?ui.key(' '):ui.click('#action-whistle');
   else if(!node(ui,'action-race-help').disabled)keyboard?ui.key('Enter'):ui.click('#action-race-help');
  }
  ui.frames(.25,4);
 }
}
test('portrait panels expose eleven choices each, prevent duplicates and preserve selection/focus',()=>{
 const ui=setup();assert.equal(node(ui,'playerChoices').children.length,11);assert.equal(node(ui,'opponentChoices').children.length,11);
 assert.equal(node(ui,'choose-opponent-thomas').disabled,true);
 ui.choose('player','bulgy');assert.equal(node(ui,'choose-opponent-bulgy').disabled,true);assert.equal(node(ui,'choose-player-bulgy').getAttribute('aria-pressed'),'true');
 ui.choose('opponent','thomas');assert.equal(node(ui,'choose-player-thomas').disabled,true);
 const before=ui.state().selections;ui.document.emit('click',{target:node(ui,'choose-player-thomas')});assert.deepEqual(ui.state().selections,before);
 ui.click('#playerPickerButton');node(ui,'choose-player-percy').focus();ui.key('ArrowLeft');assert.notEqual(ui.document.activeElement,node(ui,'choose-player-thomas'));
 ui.click('#startRaceButton');assert.equal(ui.state().race.playerId,'bulgy');assert.equal(ui.state().race.opponentId,'thomas');
 assert.equal(node(ui,'matchupPlayerName').textContent,'Bulgy');assert.equal(node(ui,'matchupRivalName').textContent,'Thomas');
 assert.equal(node(ui,'matchupPlayerPortrait').getAttribute('href'),'#portrait-bulgy');assert.equal(node(ui,'action-whistle').dataset.narration,'ui.horn');
});
for(const id of ids)for(const theme of ['passengers','cargo'])test(`${id}: complete ${theme} race through ${theme==='passengers'?'keyboard':'pictures'} and preserve racers`,()=>{
 const saved=JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:'country',playerId:'thomas',opponentId:'percy',deliveryTheme:theme==='cargo'?'passengers':'cargo'}});
 const ui=setup(saved),opponent=id==='thomas'?'percy':'thomas';ui.choose('player',id);ui.choose('opponent',opponent);ui.click('#startRaceButton');
 assert.equal(ui.state().race.deliveryTheme,theme);finish(ui,theme==='passengers');
 const r=ui.state().race;assert.equal(r.winner,'player');assert.equal(r.player.serviceStates.filter(s=>s.completed).length,8);
 assert.equal(node(ui,'raceResultPortrait').getAttribute('href'),'#portrait-'+id);assert.ok(ui.state().stickers.includes('race-winner'));
 ui.click('#skipCelebration');ui.click('#rewardAlternative');assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().race,null);
 assert.deepEqual(ui.state().selections,{playerId:id,opponentId:opponent});
 ui.click('#startRaceButton');assert.equal(ui.state().race.playerId,id);assert.equal(ui.state().race.opponentId,opponent);
});
test('random choices stay random across rounds and unavailable WebGL preserves choices',()=>{
 const ui=setup();ui.choose('player','random');ui.choose('opponent','random');ui.click('#startRaceButton');
 const first=ui.state().race;assert.notEqual(first.playerId,first.opponentId);ui.click('#pauseButton');ui.evaluate("dispatchAction('home')");ui.click('#startRaceButton');
 assert.notEqual(ui.state().race.playerId,first.playerId);assert.notEqual(ui.state().race.opponentId,first.opponentId);
 assert.deepEqual(ui.state().selections,{playerId:'random',opponentId:'random'});
 const failed=setup(undefined,{raceUnavailable:true});failed.choose('player','diesel');failed.choose('opponent','bulgy');failed.click('#startRaceButton');
 assert.equal(failed.state().screen,'race-start');assert.deepEqual(failed.state().selections,{playerId:'diesel',opponentId:'bulgy'});
});
test('all computer wins thank the selected player and never award the player win sticker',()=>{
 for(const opponentId of ids){
  const playerId=opponentId==='thomas'?'bulgy':'thomas',ui=setup();ui.choose('player',playerId);ui.choose('opponent',opponentId);ui.click('#startRaceButton');
  ui.evaluate(`{const r=state.race;r.phase='racing';r.countdown=0;r.elapsed=400;for(const who of ['player','rival']){const v=r[who];v.distance=ThomasRaceCore.COURSES[r.courseId].length-(who==='rival'?1:100);v.velocity=ThomasRaceCore.CRUISE_SPEED;v.service=null;v.serviceStates.forEach(s=>{s.completed=true;s.phase='complete'});v.terrainStates.forEach(s=>s.completed=true);}}`);
  ui.frames(1,10);assert.equal(ui.state().phase,'complete');assert.equal(ui.state().race.winner,'rival');assert.equal(node(ui,'raceResultPortrait').getAttribute('href'),'#portrait-'+playerId);
  assert.equal(node(ui,'resultText').textContent,'Our friend wins! Well done. Let’s race again!');assert.equal(ui.state().stars,3);assert.equal(ui.state().stickers.includes('race-winner'),false);
 }
});
