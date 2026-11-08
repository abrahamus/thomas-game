'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup,html}=require('./helpers/game-harness.cjs');
test('one Race picture starts a random rival and retired choices cannot be used',()=>{
 const ui=setup();assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().mode,'race');
 assert.equal(ui.document.getElementById('racePickerOverlay'),null);
 assert.equal(ui.document.getElementById('sodorSvg'),null);
 assert.equal(ui.document.querySelectorAll('#raceStartOverlay [data-action="start-race"]').length,1);
 assert.doesNotMatch(html,/data-action="(?:choose-racer|race-rematch|start-freeplay|start-challenges)"/);
 for(const action of ['start-freeplay','start-challenges','choose-racer','race-rematch'])assert.equal(ui.evaluate(`game.dispatch('${action}')`),false);
 assert.equal(ui.evaluate("game.dispatch('start-race','james')"),false,'No manual rival override');
 assert.equal(ui.spoken.length,0);ui.key('Enter');assert.equal(ui.state().screen,'play');
 assert.ok(ui.evaluate('ThomasRaceCore.CHARACTERS').some(c=>c.id===ui.state().race.opponentId));
 const before=ui.state().generation;ui.key('Enter',{repeat:true});assert.equal(ui.state().generation,before);
 ui.document.emit('click',{target:ui.document.getElementById('startRaceButton'),detail:1});assert.equal(ui.state().generation,before);
 ui.key('Escape');ui.evaluate("dispatchAction('home')");assert.equal(ui.state().screen,'race-start');
});

test('music, mute, and whistle remain independent and music preference survives a new race',()=>{
 const ui=setup();
 assert.equal(ui.document.getElementById('optionsToggle'),null);
 assert.deepEqual(Array.from(ui.evaluate('menuButtons().map(button=>button.id)')),['playerPickerButton','opponentPickerButton','driveModeLight','driveModeFull','startRaceButton']);
 ui.evaluate("dispatchAction('music')");assert.equal(ui.state().musicEnabled,false);
 ui.evaluate("dispatchAction('repeat')");assert.ok(ui.spoken.length>0);
 ui.evaluate("dispatchAction('mute');dispatchAction('music')");assert.equal(ui.state().isMuted,true);assert.equal(ui.state().musicEnabled,true);
 ui.evaluate("dispatchAction('music')");ui.click('#startRaceButton');ui.frames(5,50);
 ui.key(' ',{target:ui.document.getElementById('gameStage')});assert.ok(ui.evaluate('ui.whistle')>0);
 ui.click('#pauseButton');assert.deepEqual(Array.from(ui.evaluate('menuButtons().map(button=>button.dataset.action)')),['resume']);
 ui.click('#pauseOverlay [data-action="resume"]');
 ui.evaluate("dispatchAction('home')");ui.click('#startRaceButton');
 assert.equal(ui.state().musicEnabled,false);assert.equal(ui.state().isMuted,true);
});

test('legacy sticker albums and stars survive saving while retired games remain unavailable',()=>{
 const saved=JSON.stringify({version:1,stars:12,stickers:['apple-delivery','driving-challenges','race-finisher'],completedMissions:['meet-friends','find-toby']});
 const ui=setup(saved);ui.evaluate("dispatchAction('album')");
 assert.equal(ui.document.getElementById('albumItems').children.length,5);
 assert.match(ui.document.getElementById('albumItems').textContent,/Find Toby/);
 ui.click('[data-action="close-album"]');ui.key('Enter');ui.frames(5,50);
 ui.click('#pauseButton');const frozen=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,frozen);
 assert.equal(ui.document.getElementById('pauseOverlay').querySelector('[data-action="album"]'),null);
 ui.click('#pauseOverlay [data-action="resume"]');assert.equal(ui.state().paused,false);
 ui.evaluate('game.save()');const next=setup(ui.storage.getItem('thomas-first-adventure-progress-v1'));
 assert.equal(next.state().stars,12);assert.deepEqual(next.state().completedMissions,['meet-friends','find-toby']);assert.deepEqual(next.state().stickers,['apple-delivery','driving-challenges','race-finisher']);
});

test('hover guidance waits for a dwell and focus loss cancels pending speech',()=>{
 const ui=setup();ui.evaluate('unlockAudio()');const start=ui.document.getElementById('startRaceButton');
 const count=ui.spoken.length;ui.document.emit('mouseover',{target:start});ui.frames(.2);assert.equal(ui.spoken.length,count);
 ui.frames(.2);assert.match(ui.spoken.at(-1),/Choose your character/);
 const picker=ui.document.getElementById('playerPickerButton');ui.document.emit('mouseover',{target:picker});ui.windowListeners.get('blur')();
 assert.equal(ui.evaluate('ui.hoverNode'),null);assert.equal(ui.evaluate('ui.pendingSpeech'),null);
 const after=ui.spoken.length;ui.frames(1);ui.windowListeners.get('focus')();ui.frames(1);assert.equal(ui.spoken.length,after);
});

test('resizing a paused race repaints without advancing either racer',()=>{
 const ui=setup();ui.key('Enter');ui.frames(8,80);ui.key('Escape');
 const before=ui.state().race,renders=ui.evaluate('ui.raceView.renders');ui.windowListeners.get('resize')();
 assert.deepEqual(ui.state().race,before);assert.ok(ui.evaluate('ui.raceView.renders')>renders);
});

test('invalid times, retired actions, modifiers and editable targets cannot mutate race state',()=>{
 const ui=setup();ui.key('Enter');const before=ui.state();
 for(const time of ['NaN','Infinity','-1','0'])assert.equal(ui.evaluate(`game.step(${time})`),false);
 for(const action of ['accelerate','brake','start-freeplay','start-challenges','add-stars','scrub'])assert.equal(ui.evaluate(`game.dispatch('${action}',10)`),false);
 ui.key('Enter',{ctrlKey:true});ui.key(' ',{altKey:true});
 assert.deepEqual(ui.state(),before);
 assert.equal(ui.evaluate("ThomasGameCore.shouldIgnoreKey({key:'Enter',target:{tagName:'INPUT'}})"),true);
});
