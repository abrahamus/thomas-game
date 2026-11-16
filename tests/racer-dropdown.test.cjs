const test=require('node:test'),assert=require('node:assert/strict');
const{setup}=require('./helpers/game-harness.cjs');
const node=(ui,id)=>ui.document.querySelector('#'+id);
const visibleChoices=ui=>ui.document.querySelectorAll('.racer-grid button').filter(n=>!n.closest('[hidden]'));
const iPhone='Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) Mobile Safari';
const finger={identifier:1,clientX:100,clientY:100};
function touch(ui,type,target,touches,changedTouches=touches){
 return ui.document.emit(type,{target,touches,changedTouches,cancelable:true});
}

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

for(const [role,character,part] of [['player','percy','use'],['opponent','harold','span']]){
 test(`on iPhone a single finger tap on the ${role} choice selects ${character}`,()=>{
  const ui=setup(undefined,{userAgent:iPhone});
  ui.click('#'+role+'PickerButton');
  const target=node(ui,`choose-${role}-${character}`).querySelector(part);
  ui.document.elementFromPoint=()=>target;
  let activations=0;
  ui.document.addEventListener('click',event=>{
   if(event.target.closest('.racer-grid button'))activations++;
  });

  const start=touch(ui,'touchstart',target,[finger]);
  assert.equal(start.defaultPrevented,false);
  const end=touch(ui,'touchend',target,[],[finger]);
  assert.equal(ui.state().selections[role+'Id'],character);
  assert.equal(end.defaultPrevented,true,'the browser must skip its follow-up click');
  assert.equal(activations,1);
  assert.equal(node(ui,role+'ChoicePortrait').getAttribute('href'),'#portrait-'+character);
  assert.equal(node(ui,role+'PickerMenu').hidden,true);
  const saved=JSON.parse(ui.storage.getItem('thomas-first-adventure-progress-v1'));
  assert.equal(saved.selections[role+'Id'],character);
 });
}

for(const [reason,interrupt] of [
 ['a swipe', (ui,target)=>touch(ui,'touchmove',target,[{...finger,clientY:109}])],
 ['a canceled touch', (ui,target)=>touch(ui,'touchcancel',target,[],[finger])],
 ['another finger', ui=>{
  const second={...finger,identifier:2};
  touch(ui,'touchstart',ui.document.body,[finger,second],[second]);
  touch(ui,'touchend',ui.document.body,[finger],[second]);
 }],
 ['lifting on a different choice', ui=>{ui.document.elementFromPoint=()=>node(ui,'choose-player-james');}],
 ['a choice that became unavailable', (ui,target)=>{target.disabled=true;}],
 ['a choice that became hidden', ui=>{node(ui,'playerPickerMenu').hidden=true;}],
]){
 test(`on iPhone ${reason} does not select a player or cancel scrolling`,()=>{
  const ui=setup(undefined,{userAgent:iPhone});
  ui.click('#playerPickerButton');
  const target=node(ui,'choose-player-percy');
  ui.document.elementFromPoint=()=>target;
  touch(ui,'touchstart',target,[finger]);
  const update=interrupt(ui,target);
  assert.ok(!update?.defaultPrevented);
  const end=touch(ui,'touchend',target,[],[finger]);
  assert.equal(end.defaultPrevented,false);
  assert.equal(ui.state().selections.playerId,'thomas');
 });
}

test('on iPhone a follow-up click after a rejected touch cannot select a racer',()=>{
 const ui=setup(undefined,{userAgent:iPhone});
 ui.click('#playerPickerButton');
 const target=node(ui,'choose-player-percy');
 const moved={...finger,clientX:109};
 ui.document.elementFromPoint=()=>target;
 touch(ui,'touchstart',target,[finger]);
 touch(ui,'touchmove',target,[moved]);
 const end=touch(ui,'touchend',target,[],[moved]);
 assert.equal(end.defaultPrevented,false);

 ui.document.emit('click',{target,detail:1});
 assert.equal(ui.state().selections.playerId,'thomas');
 ui.document.emit('pointerdown',{target,button:0,pointerType:'mouse'});
 ui.click('#choose-player-percy');
 assert.equal(ui.state().selections.playerId,'percy');
});

test('on iPhone a touch that starts outside a choice cannot select it on release',()=>{
 const ui=setup(undefined,{userAgent:iPhone});
 ui.click('#playerPickerButton');
 const grid=node(ui,'playerChoices'), target=node(ui,'choose-player-percy');
 ui.document.elementFromPoint=()=>target;
 touch(ui,'touchstart',grid,[finger]);
 touch(ui,'touchend',grid,[],[finger]);

 ui.document.emit('click',{target,detail:1});
 assert.equal(ui.state().selections.playerId,'thomas');
 target.focus();
 ui.key('Enter');
 assert.equal(ui.state().selections.playerId,'percy');
});
