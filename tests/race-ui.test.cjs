'use strict';
// Standalone adapter/input checks using a DOM simulation, without executing WebGL.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup,html,script,accelerateTo}=require('./helpers/game-harness.cjs');
const KEY='thomas-first-adventure-progress-v1';
const node=(ui,id)=>ui.document.getElementById(id);
function start(ui,keyboard=false){
 keyboard?ui.key('Enter'):ui.click('#startRaceButton');
 assert.equal(ui.state().mode,'race');assert.equal(ui.state().screen,'play');
}
function go(ui){ui.frames(4.7,47);assert.equal(ui.state().phase,'racing');}
function performVisibleJob(ui,keyboard){
 const help=node(ui,'action-race-help'),service=ui.state().race.player.service;
 accelerateTo(ui,keyboard);
 if(!help.hidden && !help.disabled){keyboard?ui.key('Enter'):ui.click('#action-race-help');return true;}
 if(service?.type==='animals' && service.phase==='ready'){
  keyboard?ui.key(' '):ui.click('#action-whistle');return true;
 }
 return false;
}
function complete(ui,keyboard=false){
 for(let i=0;ui.state().phase!=='complete';i++){
  assert.ok(i<3000,'The delivery race finishes from its visible pictures and contextual jobs');
  performVisibleJob(ui,keyboard);
  ui.frames(.25,4);
 }
 return ui.state();
}
function reachJob(ui,type){
 for(let i=0;i<3000;i++){
  const service=ui.state().race.player.service;
  if(service?.type===type && service.phase==='ready')return;
  performVisibleJob(ui,true);
  ui.frames(.25,4);
 }
 assert.fail(`Arrival at visible ${type}`);
}

for(const [rival,seed] of [['percy',17],['james',1000],['bertie',1500]])test(`named selection assigns ${rival}`,()=>{
 const ui=setup(undefined,{seed});ui.choose('opponent',rival);start(ui);assert.equal(ui.state().race.opponentId,rival);
 ui.click('#pauseButton');ui.evaluate("dispatchAction('home')");assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().race,null);
});

for(const keyboard of [true,false])test(`complete muted ${keyboard?'keyboard-only':'click-only'} round from visible pictures and award once`,()=>{
 const ui=setup();ui.evaluate("dispatchAction('mute')");start(ui,keyboard);go(ui);
 const result=complete(ui,keyboard);
 assert.equal(result.race.winner,'player');
 const duration=result.race.elapsed+ui.evaluate('ThomasRaceCore.START_COUNTDOWN');
 assert.ok(duration>=265 && duration<=380,`Continuous delivery duration: ${duration}s`);
 assert.equal(result.race.player.serviceStates.filter(s=>s.completed).length,8);
 assert.equal(result.race.player.carried.passengers,0);assert.equal(result.race.player.carried.container,null);
 assert.equal(result.stars,3);assert.ok(result.stickers.includes('race-finisher'));
 assert.equal(node(ui,'festivalJobs').children.length,8,'Completed job pictures remain in the finish celebration');
 ui.frames(5);ui.evaluate('game.step(20);render()');assert.equal(ui.state().stars,3);
 assert.equal(node(ui,'rewardReplay').dataset.action,'rematch');assert.equal(node(ui,'rewardAlternative').dataset.action,'next-race');
});
test('Next race draws a fresh friend, course, jobs and delivery; Home shows the racer panels',()=>{
 const ui=setup();start(ui);const original=ui.state().race;complete(ui);
 ui.click('#skipCelebration');ui.click('#rewardAlternative');assert.equal(ui.state().screen,'race-start');start(ui);const race=ui.state().race;
 for(const key of ['seed','courseId','opponentId','deliveryTheme'])assert.notEqual(race[key],original[key],key);
 assert.equal(ui.state().stars,3);complete(ui);
 assert.equal(ui.state().phase,'complete');assert.equal(ui.state().stars,6);
 ui.click('#skipCelebration');ui.click('#rewardAlternative');assert.equal(ui.state().screen,'race-start');assert.equal(node(ui,'raceStartOverlay').hidden,false);
});
test('saved pairing varies new races without erasing legacy rewards; invalid storage remains playable',()=>{
 const saved=JSON.stringify({version:1,stars:12,stickers:['apple-delivery','driving-challenges'],lastRace:{courseId:'country',opponentId:'percy'}});
 const ui=setup(saved);start(ui);assert.notEqual(ui.state().race.courseId,'country');assert.notEqual(ui.state().race.opponentId,'percy');
 assert.equal(ui.state().stars,12);assert.deepEqual(ui.state().stickers,['apple-delivery','driving-challenges']);
 const restored=setup(ui.storage.getItem(KEY));start(restored,'surprise');assert.notEqual(restored.state().race.courseId,ui.state().race.courseId);
 for(const options of [{unavailableStorage:true},{saved:'broken'}]){const fallback=setup(options.saved,options);start(fallback);complete(fallback);assert.equal(fallback.state().stars,3);}
});
test('pause, focus loss and hidden pages freeze both racers until explicit resume',()=>{
 const ui=setup();start(ui);go(ui);ui.key('ArrowUp');ui.frames(3);
 ui.key('Escape');const stopped=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,stopped);
 ui.click('#pauseOverlay [data-action="resume"]');ui.frames(.2,5);assert.ok(ui.state().distance>stopped.player.distance);
 ui.windowListeners.get('blur')();const blurred=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,blurred);
 ui.windowListeners.get('focus')();assert.equal(ui.state().paused,true);ui.click('#pauseOverlay [data-action="resume"]');
 ui.document.hidden=true;ui.document.emit('visibilitychange');const hidden=ui.state().race;ui.frames(5);assert.deepEqual(ui.state().race,hidden);
 ui.document.hidden=false;ui.document.emit('visibilitychange');assert.equal(ui.state().paused,true);
});
test('a long frame stops at the next interactive job without completing it or replaying rewards',()=>{
 const ui=setup();start(ui);go(ui);accelerateTo(ui,true,100);
 ui.evaluate('globalThis.recentEffects=[];globalThis.originalEffect=audio.effect.bind(audio);audio.effect=(...args)=>{recentEffects.push(args);return originalEffect(...args);};');
 const spoken=ui.spoken.length;ui.frames(120,1/120);
 assert.equal(ui.state().phase,'racing');assert.ok(ui.state().race.player.service);assert.equal(ui.state().velocity,0);assert.equal(ui.state().stars,0);
 const sounds=ui.evaluate('recentEffects.filter(e=>e[0]==="chime")');
 assert.equal(sounds.length,0,'Automatic arrivals do not replay a backlog');
 assert.ok(ui.spoken.slice(spoken).every(text=>!text.includes('More mail')));
});
test('Home in the pause menu removes the race view and shows one Race picture',()=>{
 const ui=setup();start(ui);go(ui);const generation=ui.state().generation;
 ui.click('#pauseButton');ui.evaluate("dispatchAction('home')");assert.equal(ui.state().race,null);assert.ok(ui.state().generation>generation);
 assert.equal(node(ui,'action-race-help').hidden,true);
 for(const id of ['sceneHud','raceOrder','raceDashboard'])assert.equal(node(ui,id),null);
 assert.equal(node(ui,'raceStartOverlay').hidden,false);assert.equal(ui.evaluate('ui.raceView'),null);
});
test('WebGL unavailable stays on the start screen with an honest error and working controls',()=>{
 const ui=setup(undefined,{raceUnavailable:true});ui.click('#startRaceButton');
 assert.equal(ui.state().screen,'race-start');assert.equal(node(ui,'raceUnavailable').hidden,false);
 assert.match(html,/The race cannot start in this browser/);
 ui.evaluate("dispatchAction('mute')");assert.equal(ui.state().isMuted,true);
});

for(const theme of ['passengers','cargo'])for(const keyboard of [true,false])test(`${theme} loading and delivery with ${keyboard?'keyboard':'picture clicks'}`,()=>{
 const saved=JSON.stringify({version:1,stars:9,stickers:['apple-delivery'],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:theme==='passengers'?'cargo':'passengers'}});
 const ui=setup(saved);start(ui,keyboard);assert.equal(ui.state().race.deliveryTheme,theme);
 const type=theme==='passengers'?'passenger-load':'cargo-load';reachJob(ui,type);
 assert.equal(node(ui,'action-race-help').hidden,false);
 assert.equal(node(ui,'action-race-help').getAttribute('aria-keyshortcuts'),'Enter');
 const before=ui.state().race.player.service;performVisibleJob(ui,keyboard);
 if(theme==='passengers'){
  assert.equal(ui.state().race.player.service.unitsDone,0);assert.equal(ui.state().race.player.service.phase,'working');
  ui.key('Enter',{repeat:true});assert.equal(ui.state().race.player.service.unitsDone,0);
  ui.frames(1.1,22);assert.equal(ui.state().race.player.carried.passengers,1);
 }else{
  assert.equal(ui.state().race.player.service.selectedContainer,'container-1');assert.equal(ui.state().race.player.carried.container,null);
  performVisibleJob(ui,keyboard);assert.equal(ui.state().race.player.service.phase,'working');
  ui.frames(5.1,51);assert.equal(ui.state().race.player.carried.container,'container-1');
 }
 complete(ui,keyboard);assert.equal(ui.state().stars,12);
 const states=ui.state().race.player.serviceStates;
 assert.ok(states[0].completedAt<states.at(-1).startedAt,'Loading precedes delivery');
 assert.equal(ui.state().race.player.carried.passengers,0);assert.equal(ui.state().race.player.carried.container,null);
});
test('Enter uses one contextual action, native button access activates once, and working jobs reject repeats',()=>{
 const ui=setup(JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:"country",opponentId:"percy",deliveryTheme:"passengers"}}));start(ui);reachJob(ui,'cargo-load');
 const help=node(ui,'action-race-help');help.focus();ui.key('Enter');
 assert.equal(ui.state().race.player.service.phase,'ready');assert.equal(ui.state().race.player.service.selectedContainer,'container-1');
 assert.equal(node(ui,'raceHelpPicture').getAttribute('href'),'#race-crane','Selected container changes the picture to its crane action');
 ui.key('Enter',{repeat:true});assert.equal(ui.state().race.player.service.phase,'ready');
 ui.key('Enter');assert.equal(ui.state().race.player.service.phase,'working');
 const remaining=ui.state().race.player.service.remaining;ui.key('Enter');assert.equal(ui.state().race.player.service.remaining,remaining);
});
test('animals wait for the whistle and jobs keep the race clock and independent rival moving',()=>{
 const ui=setup();start(ui);reachJob(ui,'animals');const before=ui.state().race;
 assert.equal(node(ui,'action-race-help').hidden,true);assert.equal(node(ui,'action-whistle').classList.contains('hint'),true);
 ui.key('Enter');ui.frames(2);assert.equal(ui.state().race.player.service.phase,'ready');
 assert.ok(ui.state().race.elapsed>before.elapsed);assert.equal(ui.state().distance,before.player.distance);
 assert.ok(ui.state().race.rival.distance>before.rival.distance || ui.state().race.rival.service,'Rival still moves or works');
 ui.key(' ');assert.equal(ui.state().race.player.service.phase,'working');
 ui.frames(1);assert.equal(ui.state().velocity,0);ui.frames(1.2);assert.equal(ui.state().race.player.service,null);
});
test('trackpad pointer cleans actual renderer targets without holding a click, with pause and mode guards',()=>{
 const ui=setup();start(ui);reachJob(ui,'wash');
 ui.evaluate('ui.raceView.pick=()=>({kind:"mud",id:0})');
 const canvas=node(ui,'raceCanvas');ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});
 assert.equal(ui.state().race.player.mudPatches[0],false);assert.equal(ui.state().race.player.mudPatches.filter(Boolean).length,6);
 ui.evaluate('ui.raceView.pick=()=>({kind:"mud",id:1})');ui.key('Escape');const race=ui.state().race;
 ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});ui.frames(4);assert.deepEqual(ui.state().race,race);
 ui.click('#pauseOverlay [data-action="resume"]');
 ui.document.emit('click',{target:canvas,clientX:40,clientY:40});assert.equal(ui.state().race.player.mudPatches[1],false);
 ui.click('#pauseButton');ui.evaluate("dispatchAction('home')");
 ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});assert.equal(ui.state().race,null);assert.equal(ui.state().stars,0);
});
test('direct objects and contextual controls share passenger/container actions',()=>{
 const ui=setup(JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:"country",opponentId:"percy",deliveryTheme:"passengers"}}));start(ui);reachJob(ui,'cargo-load');
 ui.evaluate('ui.raceView.pick=()=>({kind:"service",id:"container-1"})');
 const canvas=node(ui,'raceCanvas');ui.document.emit('click',{target:canvas,clientX:20,clientY:20});
 assert.equal(ui.state().race.player.service.selectedContainer,'container-1');
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.phase,'working');
});
test('pause freezes active service animation, wash sweep, rival and clock until explicit resume',()=>{
 const ui=setup();start(ui);reachJob(ui,'wash');ui.key('Enter');ui.frames(.2,20);ui.key('Escape');
 const paused=ui.state().race;ui.frames(7);assert.deepEqual(ui.state().race,paused);
 assert.equal(node(ui,'action-race-help').disabled,true);ui.click('#pauseOverlay [data-action="resume"]');
 ui.frames(.5,20);assert.equal(ui.state().race.player.mudPatches.filter(Boolean).length,6);
});

test('a directly selected passenger group boards once and cannot be selected again',()=>{
 const saved=JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:'cargo'}});
 const ui=setup(saved);start(ui);reachJob(ui,'passenger-load');
 ui.evaluate('ui.raceView.pick=()=>({kind:"service",id:2})');const canvas=node(ui,'raceCanvas');
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.activeUnit,2);
 ui.frames(1.1,22);assert.equal(ui.state().race.player.carried.passengers,1);assert.equal(ui.state().race.player.service.groups[2],true);
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.phase,'ready');assert.equal(ui.state().race.player.carried.passengers,1);
});
test('invalid optional delivery history preserves existing stars and stickers',()=>{
 const ui=setup(JSON.stringify({version:1,stars:21,stickers:['apple-delivery','race-finisher'],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:'broken'}}));
 assert.equal(ui.state().stars,21);start(ui);assert.ok(['passengers','cargo'].includes(ui.state().race.deliveryTheme));
 const saved=JSON.parse(ui.storage.getItem(KEY));assert.equal(saved.lastRace.deliveryTheme,ui.state().race.deliveryTheme);assert.equal(saved.stars,21);
});

test('jobs use the bottom action without a top dashboard or toolbar',()=>{
 const ui=setup();start(ui);go(ui);
 for(const id of ['sceneHud','raceDashboard','raceTaskPreview','raceOrder','raceBoostBadge'])assert.equal(node(ui,id),null);
 assert.equal(ui.document.querySelector('.topbar'),null);
 for(const id of ['pauseButton','action-whistle'])assert.ok(node(ui,'footerDashboard').contains(node(ui,id)));
 assert.equal(node(ui,'homeButton'),null);
 const loading=ui.state().race.deliveryTheme==='passengers'?'passenger-load':'cargo-load';reachJob(ui,loading);
 assert.equal(node(ui,'action-race-help').hidden,false);
 assert.equal(node(ui,'raceHelpPicture').getAttribute('href'),loading==='passenger-load'?'#race-board':'#race-container');
 assert.equal(node(ui,'action-race-help').getAttribute('aria-label'),ui.evaluate('words(ThomasRaceCore.getView(state.race).taskKey)'));
 node(ui,'pauseButton').focus();ui.key(' ');assert.equal(ui.state().paused,true);
 const frozen=ui.state().race;ui.frames(2);assert.deepEqual(ui.state().race,frozen);
 ui.click('#pauseOverlay [data-action="resume"]');assert.equal(ui.state().paused,false);
 node(ui,'pauseButton').focus();ui.key(' ');
 assert.equal(ui.document.querySelector('#pauseOverlay [data-action="home"]'),null);
 assert.deepEqual(Array.from(ui.evaluate('menuButtons().map(button=>button.dataset.action)')),['resume']);
 assert.equal(node(ui,'gameOptions'),null);
 assert.equal(node(ui,'optionsToggle'),null);
 ui.document.querySelector('#pauseOverlay [data-action="resume"]').focus();ui.key(' ');assert.equal(ui.state().paused,false);
});

test('Race has no postal controls and horizontal arrows do not queue actions',()=>{
 const ui=setup();start(ui);go(ui);
 for(const id of ['action-race-left','action-race-right','raceUpcomingPreview','raceMailCollected','raceJobsCompleted','raceCarriedLoad'])assert.equal(node(ui,id),null);
 const before=ui.state().race.player;ui.key('ArrowLeft');ui.key('ArrowRight');assert.deepEqual(ui.state().race.player,before);
});
test('keyboard and on-screen Up take one step per press, with no Down control',()=>{
 const ui=setup();start(ui);
 const up=node(ui,'action-accelerate');
 const speed=()=>ui.state().race.player.speedPercent;
 assert.equal(node(ui,'action-slow-down'),null);
 assert.equal(up.disabled,true);
 ui.key('ArrowUp');assert.equal(speed(),0);
 go(ui);assert.equal(up.disabled,false);
 assert.equal(ui.state().race.player.distance,0);
 ui.key('ArrowUp');assert.equal(speed(),25);
 ui.key('ArrowUp',{repeat:true});assert.equal(speed(),25);
 ui.click('#action-accelerate');assert.equal(speed(),50);
 ui.key('ArrowDown');assert.equal(speed(),50);
 ui.key('Escape');assert.equal(up.disabled,true);
 ui.key('ArrowUp');assert.equal(speed(),50);
 ui.key('Escape');assert.equal(up.disabled,false);
 for(const percent of [75,100,125,150]){
    ui.key('ArrowUp');assert.equal(speed(),percent);
 }
 assert.equal(up.disabled,true);
 ui.key('ArrowUp');assert.equal(speed(),150);
 const loading=ui.state().race.deliveryTheme==='passengers'?'passenger-load':'cargo-load';
 reachJob(ui,loading);
 assert.equal(up.disabled,true);assert.equal(speed(),0);
 ui.key('ArrowUp');ui.document.emit('click',{target:up,detail:1});assert.equal(speed(),0);
 complete(ui);
 assert.equal(up.hidden,true);
 ui.key('ArrowUp');assert.equal(speed(),150);
 assert.equal(ui.evaluate("game.dispatch('rematch')"),true);
 assert.equal(speed(),0);
});
test('the train waits for Up without a start banner',()=>{
 const ui=setup();start(ui);
 assert.equal(node(ui,'speedCue'),null);
 go(ui);
 assert.equal(node(ui,'action-accelerate').hidden,false);
 ui.frames(8,80);
 assert.equal(ui.state().race.player.distance,0);
 complete(ui);ui.click('#skipCelebration');ui.click('#rewardReplay');go(ui);
 assert.equal(ui.state().race.player.distance,0);
});

for(const deliveryTheme of ['passengers','cargo'])test(`Up resumes after ${deliveryTheme} unloading and reaches top speed after the final bend`,()=>{
 const ui=setup();start(ui);
 ui.evaluate(`{
    const r=ThomasRaceCore.createRace({deliveryTheme:'${deliveryTheme}'});
    state.race=r;r.phase='racing';r.countdown=0;r.elapsed=300;state.phase='racing';
    const v=r.player,job=v.serviceStates.at(-1);
    v.speedPercent=150;
    for(const earlier of v.serviceStates.slice(0,-1))earlier.completed=true;
    v.carried.passengers=r.deliveryTheme==='passengers'?3:0;
    v.carried.container=r.deliveryTheme==='cargo'?'container-1':null;
    v.carried.cargo=r.deliveryTheme==='cargo';
    v.distance=job.at-.01;v.velocity=0;game.step(.1);render();
 }`);
 const up=node(ui,'action-accelerate');
 assert.equal(up.disabled,true);
 for(let i=0;ui.state().race.player.service;i++){
    assert.ok(i<100,'unloading finishes');
    performVisibleJob(ui,false);ui.frames(.2,20);
 }
 assert.equal(up.disabled,false);
 const stop=ui.state().race.player.distance;
 assert.equal(node(ui,'speedReading').textContent,'0');
 assert.equal(node(ui,'speedNeedle').getAttribute('transform'),'rotate(-135 50 50)');
 ui.key('ArrowUp',{repeat:true});ui.frames(3,30);
 assert.equal(ui.state().race.player.distance,stop);
 assert.equal(ui.state().race.player.speedPercent,0);
 ui.key('Escape');ui.key('ArrowUp');ui.key('Escape');
 assert.equal(ui.state().race.player.speedPercent,0);
 for(const percent of [25,50,75,100,125,150]){
    if(deliveryTheme==='passengers')ui.key('ArrowUp');
    else ui.click('#action-accelerate');
    assert.equal(ui.state().race.player.speedPercent,percent);
    if(percent===25){
        ui.frames(2,20);
        assert.equal(ui.state().race.player.velocity,250);
        assert.equal(node(ui,'speedReading').textContent,'25');
    }
 }
 assert.equal(up.disabled,true);
 assert.equal(node(ui,'speedReading').textContent,'25');
 for(let i=0;ui.state().race.player.velocity<1500-1e-7;i++){
    assert.ok(i<200,'the player reaches top speed after the final bend');
    if(!up.disabled)ui.key('ArrowUp');
    ui.frames(.1,10);
 }
 ui.frames(.1,10);
 assert.equal(node(ui,'speedReading').textContent,'150');
 assert.equal(node(ui,'speedNeedle').getAttribute('transform'),'rotate(135 50 50)');
 const result=complete(ui);
 assert.equal(result.race.player.distance,242000);
 assert.equal(up.hidden,true);
});
test('each new job is usable through the canvas and its contextual keyboard control',()=>{
 for(const type of ['repairs','rocks','coal','level-crossing']){
  const ui=setup();start(ui);ui.evaluate(`{
    let r;for(let seed=1;seed<100;seed++){r=ThomasRaceCore.createRace({seed});if(r.services.some(s=>s.type==='${type}'))break;}
    state.race=r;r.phase='racing';r.countdown=0;state.phase='racing';
    const s=r.player.serviceStates.find(s=>s.type==='${type}');for(const q of r.player.serviceStates)if(q.at<s.at)q.completed=true;
    r.player.distance=s.at-.01;r.player.velocity=0;game.step(.1);render();
  }`);
  const id={repairs:'sleeper-1',rocks:'rock-1',coal:'coal-1','level-crossing':'crossing'}[type];
  ui.evaluate(`ui.raceView.pick=()=>({kind:'service',id:'${id}'})`);
  ui.document.emit('click',{target:node(ui,'raceCanvas'),clientX:20,clientY:20});
  assert.equal(ui.state().race.player.service.phase,'working');
  for(let i=0;i<100&&ui.state().race.player.service;i++){ui.frames(.2,20);if(!node(ui,'action-race-help').disabled)ui.key('Enter');}
  assert.equal(ui.state().race.player.service,null,type);
  assert.equal(ui.state().race.player.serviceStates.find(job=>job.type===type).completed,true);

 }
});

test('every static railway picture reference resolves to a retained SVG symbol',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of html.matchAll(/<use\b[^>]*href="#([^"]+)"/g))assert.ok(ids.has(match[1]),match[1]);
});

test('Space sounds one horn call for either bus and held-key repeats never retrigger it',()=>{
 for(const id of ['bertie','bulgy']){
  const ui=setup();ui.choose('player',id);ui.choose('opponent','thomas');start(ui);go(ui);
  ui.evaluate('globalThis.signalCalls=[];audio.effect=(name)=>{signalCalls.push(name);return true;};');
  ui.key(' ');for(let i=0;i<50;i++)ui.key(' ',{repeat:true});ui.frames(2);
  assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),1);
  ui.document.emit('keyup',{key:' ',target:ui.document.activeElement});ui.key(' ');assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),2);
  ui.key('Escape');ui.key(' ');assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),2,'paused Space cannot sound the horn');
 }
});

test('holding Up or the dial builds speed and releasing ends acceleration input',()=>{
 for(const pointer of [false,true]){
    const ui=setup();start(ui);go(ui);
    const dial=node(ui,'action-accelerate');
    if(pointer)ui.document.emit('pointerdown',{target:dial,button:0,pointerId:1});
    else ui.key('ArrowUp',{hold:true});
    ui.frames(2,60);
    const speed=ui.state().race.player.speedPercent;
    assert.ok(speed>25&&speed<150);
    if(pointer){
        ui.document.emit('pointerup',{target:dial,pointerId:1});
        ui.document.emit('click',{target:dial,detail:1});
    }else ui.document.emit('keyup',{key:'ArrowUp'});
    ui.frames(.5,60);
    assert.equal(ui.state().race.player.speedPercent,speed);
 }
});
test('one continuous Up hold reaches full speed',()=>{
 const ui=setup();start(ui);go(ui);ui.key('ArrowUp',{hold:true});
 ui.frames(9,60);
 assert.equal(ui.state().race.player.velocity,1500);
});

test('the cab lever selects Light from the keyboard, saves the mode, and repeats it on Rematch',()=>{
 const ui=setup(JSON.stringify({version:1,stars:2,stickers:[]}));
 assert.equal(node(ui,'driveModeFull').getAttribute('aria-pressed'),'true');
 ui.key('ArrowLeft');ui.key('ArrowLeft');ui.key('Enter');
 assert.equal(ui.document.activeElement,node(ui,'driveModeLight'));
 assert.equal(node(ui,'driveModeLight').getAttribute('aria-pressed'),'true');
 assert.equal(node(ui,'driveModeControl').getAttribute('data-selected'),'light');
 const restored=setup(ui.storage.getItem(KEY));
 assert.equal(node(restored,'driveModeLight').getAttribute('aria-pressed'),'true');
 restored.click('#driveModeFull');
 assert.equal(node(restored,'driveModeFull').getAttribute('aria-pressed'),'true');
 restored.click('#driveModeLight');
 start(restored);go(restored);restored.frames(6,60);
 assert.equal(restored.state().race.driveMode,'light');
 assert.equal(restored.state().race.player.velocity,1250);
 assert.match(node(restored,'statusText').textContent,/^Use Up to speed up\./);
 complete(restored);
 restored.click('#skipCelebration');restored.click('#rewardReplay');
 assert.equal(restored.state().race.driveMode,'light');
});
