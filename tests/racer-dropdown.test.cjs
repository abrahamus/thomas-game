const test=require('node:test'),assert=require('node:assert/strict');
const{setup}=require('./helpers/game-harness.cjs');
const node=(ui,id)=>ui.document.querySelector('#'+id);
const visibleChoices=ui=>ui.document.querySelectorAll('.racer-grid button').filter(n=>!n.closest('[hidden]'));

test('startup shows only the two selected portraits and opens one scrollable dropdown at a time',()=>{
 const ui=setup();assert.equal(visibleChoices(ui).length,0);assert.equal(node(ui,'playerChoiceName').textContent,'Thomas');assert.equal(node(ui,'opponentChoiceName').textContent,'Random');
 assert.equal(node(ui,'playerChoicePortrait').getAttribute('href'),'#portrait-thomas');assert.equal(node(ui,'opponentChoicePortrait').getAttribute('href'),'#portrait-random');
 assert.deepEqual(Array.from(ui.evaluate('menuButtons().map(b=>b.id)')),['playerPickerButton','opponentPickerButton','driveModeLight','driveModeFull','startRaceButton']);
 ui.click('#playerPickerButton');assert.equal(visibleChoices(ui).length,11);assert.equal(node(ui,'playerPickerButton').getAttribute('aria-expanded'),'true');
 ui.click('#opponentPickerButton');assert.equal(node(ui,'playerPickerMenu').hidden,true);assert.equal(visibleChoices(ui).length,11);assert.equal(node(ui,'choose-opponent-thomas').disabled,true);
 ui.click('#choose-opponent-harold');assert.equal(visibleChoices(ui).length,0);assert.equal(node(ui,'opponentChoicePortrait').getAttribute('href'),'#portrait-harold');assert.equal(ui.document.activeElement,node(ui,'opponentPickerButton'));
 ui.click('#playerPickerButton');assert.equal(node(ui,'choose-player-harold').disabled,true);
});

test('keyboard opens the dropdown, skips unavailable choices, selects, cancels and closes when Tab leaves',()=>{
 const ui=setup();ui.choose('opponent','percy');node(ui,'playerPickerButton').focus();ui.key('ArrowDown');assert.equal(ui.document.activeElement,node(ui,'choose-player-thomas'));
 ui.key('ArrowDown');assert.equal(ui.document.activeElement,node(ui,'choose-player-james'));ui.key('Enter');assert.equal(ui.state().selections.playerId,'james');assert.equal(node(ui,'playerPickerMenu').hidden,true);
 ui.key('Enter',{repeat:true});assert.equal(node(ui,'playerPickerMenu').hidden,true);
 ui.key('Enter');ui.key('End');assert.equal(ui.document.activeElement,node(ui,'choose-player-random'));ui.key('Escape');assert.equal(ui.state().selections.playerId,'james');assert.equal(ui.document.activeElement,node(ui,'playerPickerButton'));
 ui.key('Enter');ui.key('Home');assert.equal(ui.document.activeElement,node(ui,'choose-player-thomas'));
 // The browser moves focus after Tab; exercise the resulting focus event.
 ui.key('Tab');node(ui,'opponentPickerButton').focus();assert.equal(node(ui,'playerPickerMenu').hidden,true);
 ui.key('Enter');ui.document.emit('click',{target:node(ui,'racerPickerTitle'),detail:1});assert.equal(node(ui,'opponentPickerMenu').hidden,true);assert.equal(ui.document.activeElement,node(ui,'opponentPickerButton'));
});

test('hidden choices cannot activate and restored selections stay collapsed after races and recovery',()=>{
 const ui=setup();const before=ui.state().selections;ui.document.emit('click',{target:node(ui,'choose-player-bulgy')});assert.deepEqual(ui.state().selections,before);
 ui.choose('player','bulgy');ui.choose('opponent','random');const saved=setup(ui.storage.getItem('thomas-first-adventure-progress-v1'));
 assert.equal(node(saved,'playerChoiceName').textContent,'Bulgy');assert.equal(visibleChoices(saved).length,0);
 saved.click('#playerPickerButton');saved.click('#startRaceButton');saved.click('#pauseButton');saved.evaluate("dispatchAction('home')");assert.equal(visibleChoices(saved).length,0);assert.equal(node(saved,'playerChoiceName').textContent,'Bulgy');
 const failed=setup(ui.storage.getItem('thomas-first-adventure-progress-v1'),{raceUnavailable:true});failed.click('#opponentPickerButton');failed.click('#startRaceButton');assert.equal(visibleChoices(failed).length,0);assert.equal(node(failed,'playerChoiceName').textContent,'Bulgy');
});
