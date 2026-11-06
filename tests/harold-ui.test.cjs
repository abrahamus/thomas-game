const test=require('node:test'),assert=require('node:assert/strict');
const {setup,accelerateTo}=require('./helpers/game-harness.cjs');
function target(s,v){
 if(s.type==='wash')return{kind:'mud',id:v.mudPatches.findIndex(Boolean)};
 if(s.type.startsWith('passenger-'))return{kind:'service',id:'passenger-'+s.groups.findIndex(x=>!x)};
 if(s.type.startsWith('cargo-'))return{kind:'service',id:'container-1'};
 if(['repairs','rocks','coal'].includes(s.type))return{kind:'service',id:({repairs:'sleeper',rocks:'rock',coal:'coal'})[s.type]+'-'+s.groups.findIndex(x=>!x)};
 return{kind:'service',id:s.type==='level-crossing'?'crossing':s.type==='tree'?'branch':s.type};
}
for(const seed of [1,24,40])for(const theme of ['passengers','cargo'])test(`Harold ${theme}/${seed}: complete all eight aviation jobs using ${theme==='cargo'?'direct selection':'keyboard'}`,()=>{
 const ui=setup();ui.choose('player','harold');ui.choose('opponent','thomas');ui.click('#startRaceButton');
 ui.evaluate(`state.race=ThomasRaceCore.createRace({playerId:'harold',opponentId:'thomas',seed:${seed},deliveryTheme:'${theme}'});render()`);
 assert.equal(ui.document.getElementById('action-whistle').dataset.narration,'ui.radio');
 const seen=new Set();
 for(let n=0;ui.state().phase!=='complete';n++){
  assert.ok(n<2200);const v=ui.state().race.player,s=v.service;
  accelerateTo(ui,theme==='passengers');
  if(s?.phase==='ready'){
   assert.match(ui.evaluate('ui.taskKey'),/^race\.flight\./);seen.add(s.id);
   if(theme==='passengers')ui.key(s.type==='animals'?' ':'Enter');
   else{const pick=target(s,v);ui.evaluate(`ui.raceView.pick=()=>(${JSON.stringify(pick)})`);ui.document.emit('click',{target:ui.document.getElementById('raceCanvas'),clientX:50,clientY:50});}
  }
  ui.frames(.25,4);
 }
 const v=ui.state().race.player;assert.equal(v.serviceStates.filter(s=>s.completed).length,8);assert.equal(v.carried.container,null);assert.equal(v.carried.passengers,0);assert.equal(ui.state().race.winner,'player');
 if(v.serviceStates.some(s=>s.type==='coal')){assert.equal(v.fuel,1);assert.equal(v.coal,0);}
 assert.equal(ui.document.getElementById('raceResultPortrait').getAttribute('href'),'#portrait-harold');ui.click('#skipCelebration');ui.click('#rewardAlternative');assert.equal(ui.state().selections.playerId,'harold');
});
