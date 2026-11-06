'use strict';

// Hold the real fallback speech adapter while exercising narration priority and
// cancellation. These are DOM simulations, not browser listening checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, script } = require('./helpers/game-harness.cjs');

function heldVoice() {
    const ui = setup();
    ui.evaluate(`globalThis.reviewUtterances=[];
        window.speechSynthesis.speak=utterance=>{
            reviewUtterances.push(utterance);
            if(utterance.onstart)utterance.onstart();
        };`);
    return ui;
}
function lastWords(ui) { return ui.evaluate('reviewUtterances.at(-1)?.text'); }
function count(ui) { return ui.evaluate('reviewUtterances.length'); }
function speak(ui, key, options = {}) {
    ui.evaluate(`say(words(${JSON.stringify(key)}),${JSON.stringify(key)},${JSON.stringify(options)})`);
}
function end(ui) { ui.evaluate('reviewUtterances.at(-1).onend()'); }
function start(ui) {
    ui.click('#startRaceButton');
}
function racing(ui, { finishIntro = true } = {}) {
    start(ui);
    const interval = ui.evaluate('ThomasRaceCore.START_COUNTDOWN/2');
    end(ui); ui.frames(interval); end(ui); ui.frames(interval);
    assert.equal(ui.state().phase, 'racing');
    if (finishIntro) {
        end(ui); ui.frames(.01, 100);
        // A delivery round also names its linked passenger/container goal once.
        if (/^Take our /.test(lastWords(ui))) end(ui);
    }
}

test('Ana countdown fits the lights and introduces railway jobs', () => {
    const ui = heldVoice(); start(ui);
    const clips = JSON.parse(script('narration-data'));
    const interval = ui.evaluate('ThomasRaceCore.START_COUNTDOWN/2');
    assert.ok(interval >= clips['race.ready'].duration);
    assert.ok(interval >= clips['race.steady'].duration);
    assert.equal(lastWords(ui), 'Ready.');
    end(ui); ui.frames(interval);
    assert.equal(lastWords(ui), 'Steady.');
    end(ui); ui.frames(interval);
    assert.equal(lastWords(ui), 'Go! Let’s help along the way.');
    assert.equal(ui.state().phase, 'racing');
    ui.frames(1);
    assert.equal(ui.state().velocity,0,'Thomas waits for Up during the introduction');
    ui.key('ArrowUp');ui.frames(1);
    assert.ok(ui.state().velocity>0);
});

test('both racers continue moving without repeated task narration or a stopped quiz', () => {
    const ui = heldVoice(); racing(ui);ui.key('ArrowUp');
    const before = count(ui), distances = ui.state().race;
    ui.frames(2);
    assert.equal(count(ui), before, 'the railway job does not repeat every frame');
    assert.ok(ui.state().race.player.distance > distances.player.distance);
    assert.ok(ui.state().race.rival.distance > distances.rival.distance);
    assert.equal(ui.state().phase, 'racing');
});











test('Repeat describes the current racing task rather than reviving older encouragement', () => {
    const ui = heldVoice(); racing(ui);
    speak(ui, 'race.cruise');
    ui.evaluate("dispatchAction('repeat')");
    assert.equal(lastWords(ui), ui.evaluate('words(ui.taskKey)'));
    assert.equal(lastWords(ui),ui.evaluate('words(ui.taskKey)'));
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
});

test('pause cancels race narration and freezes both vehicles then resume repeats the current task', () => {
    const ui = heldVoice(); racing(ui);
    speak(ui, 'race.cruise');
    ui.key('Escape');
    assert.equal(ui.state().paused, true);
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
    const frozen = ui.state().race;
    ui.frames(10);
    assert.deepEqual(ui.state().race, frozen);
    ui.click('#pauseOverlay [data-action="resume"]');
    assert.equal(ui.state().paused, false);
    assert.equal(lastWords(ui), ui.evaluate('words(ui.taskKey)'));
    assert.equal(ui.evaluate('audio.busy'), true);
});

test('returning to the start screen cancels speech and stale callbacks cannot finish a new race', () => {
    const ui = heldVoice(); racing(ui);
    speak(ui, 'race.cruise');
    ui.evaluate('globalThis.oldRaceOnEnd=reviewUtterances.at(-1).onend');
    ui.click('#pauseButton');ui.evaluate("dispatchAction('home')");
    assert.equal(ui.state().race, null);
    assert.ok(!ui.evaluate('ui.pendingSpeech?.key?.startsWith("race.")'));
    ui.click('#startRaceButton');
    assert.equal(lastWords(ui), 'Ready.');
    ui.evaluate('oldRaceOnEnd()');
    assert.equal(ui.evaluate('audio.busy'), true, 'stale callbacks cannot end the new activity narration');
});

test('mute cancels race speech and unmute repeats the current railway job', () => {
    const ui = heldVoice(); racing(ui);
    speak(ui, 'race.cruise');
    ui.evaluate("dispatchAction('mute')");
    assert.equal(ui.state().isMuted, true);
    assert.equal(ui.evaluate('audio.busy'), false);
    const silentCount = count(ui);
    ui.frames(.1);
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
    assert.equal(count(ui), silentCount);
    ui.evaluate("dispatchAction('mute')");
    assert.equal(ui.state().isMuted, false);
    assert.equal(lastWords(ui),ui.evaluate('words(ui.taskKey)'));
    assert.equal(ui.evaluate('audio.busy'), true);
});

test('results take priority over driving guidance without an obsolete speech queue', () => {
    const ui = heldVoice(); racing(ui);
    speak(ui, 'race.cruise');
    ui.evaluate("state.phase='complete';state.race.phase='complete';state.race.winner='player';ui.festival={stage:'award',results:false}");
    speak(ui, 'race.festival.win');
    assert.equal(lastWords(ui), 'First place! A golden trophy for you!');
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
});

test('missing embedded delivery clip falls back to the exact model phrase in browser speech', () => {
    const ui = heldVoice();
    ui.evaluate(`unlockAudio();globalThis.ThomasNarration={...ThomasNarration};delete ThomasNarration['race.service.water'];
        say(words('race.service.water'),'race.service.water')`);
    assert.equal(lastWords(ui), 'Let’s fill our engine’s water tank.');
    assert.equal(ui.evaluate('audio.busy'), true);
});

// Put the real model just before its first automatic arrival. This isolates the
// speech adapter from a long approach; service progression still uses real time.
function atFirstService(theme = 'cargo') {
    const ui = heldVoice(); start(ui);
    ui.evaluate(`audio.stop();ui.raceVoiceKey=null;ui.pendingSpeech=null;ui.taskKey='';
        state.race=ThomasRaceCore.createRace({courseId:'country',opponentId:'percy',seed:2,deliveryTheme:${JSON.stringify(theme)}});
        state.race.phase='racing';state.race.countdown=0;state.race.events=[];
        state.phase='racing';state.race.player.distance=state.race.services[0].at-5;
        state.race.player.speedPercent=25;state.race.player.velocity=10;render()`);
    ui.frames(1, 120);
    assert.ok(ui.state().race.player.service, 'Thomas automatically stops at the first delivery job');
    return ui;
}

test('service arrival gives the current useful action and takes priority over driving guidance', () => {
    const ui = atFirstService('passengers');
    assert.equal(lastWords(ui), 'Let’s welcome the passengers aboard.');
    assert.equal(ui.evaluate('ui.taskKey'), 'race.service.passenger-load');
    const before = count(ui);
    speak(ui, 'race.cruise'); speak(ui, 'gear.1');
    assert.equal(count(ui), before, 'incidental control explanations and driving guidance cannot interrupt the job');
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
});

test('Repeat follows container selection into loading rather than repeating the old task', () => {
    const ui = atFirstService('cargo');
    assert.equal(lastWords(ui), 'Choose a container for our journey.');
    ui.evaluate('ThomasRaceCore.serviceAction(state.race);render()');
    assert.equal(lastWords(ui), 'Let’s use the crane to load our container.');
    assert.equal(ui.evaluate('ui.taskKey'), 'race.service.cargo-load');
    ui.evaluate("dispatchAction('repeat')");
    assert.equal(lastWords(ui), 'Let’s use the crane to load our container.');
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
});

test('inactivity gently repeats the current service action once without a recurring speech loop', () => {
    const ui = atFirstService('passengers'); end(ui);
    const before = count(ui);
    ui.frames(6.2, 20);
    assert.equal(count(ui), before + 1);
    assert.equal(lastWords(ui), 'Let’s welcome the passengers aboard.');
    end(ui); ui.frames(18, 10);
    assert.equal(count(ui), before + 1, 'an untouched job has one inactivity reminder');
    assert.equal(ui.state().race.player.service.phase, 'ready', 'the player has unlimited time');
});

test('obsolete queued service instructions are discarded after their stage changes', () => {
    const ui = atFirstService('cargo');
    ui.evaluate('ThomasRaceCore.serviceAction(state.race);render()');
    assert.equal(lastWords(ui), 'Let’s use the crane to load our container.');
    ui.evaluate(`ui.pendingSpeech={text:words('race.service.cargo-select'),key:'race.service.cargo-select',generation:state.generation}`);
    const before = count(ui); end(ui); ui.frames(.1, 10);
    assert.equal(count(ui), before, 'a prior container-selection instruction cannot play during crane loading');
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
});

test('pause and mute cancel delivery speech, then repeat the current job when resumed', () => {
    const ui = atFirstService('cargo');
    ui.key('Escape');
    const frozen = ui.state().race;
    ui.frames(10, 10); assert.deepEqual(ui.state().race, frozen);
    assert.equal(ui.evaluate('ui.pendingSpeech'), null);
    ui.click('#pauseOverlay [data-action="resume"]');
    assert.equal(lastWords(ui), 'Choose a container for our journey.');
    ui.evaluate("dispatchAction('mute')");
    assert.equal(ui.evaluate('audio.busy'), false);
    ui.evaluate("dispatchAction('mute')");
    assert.equal(lastWords(ui), 'Choose a container for our journey.');
});

test('the linked delivery goal is spoken once after the introduction without repeating during travel', () => {
    const ui = heldVoice(); racing(ui);
    const goals = () => ui.evaluate('reviewUtterances.filter(item=>/^Take our /.test(item.text)).length');
    assert.equal(goals(), 1);
    ui.frames(3, 10);
    assert.equal(goals(), 1);
});

test('an inactivity reminder never restarts a task phrase that is still speaking', () => {
    const ui = atFirstService('passengers');
    const before = count(ui);
    ui.frames(7, 10);
    assert.equal(count(ui), before, 'the held narration finishes naturally instead of being interrupted by its own reminder');
    assert.equal(ui.evaluate('ui.pendingSpeech'), null, 'a duplicate phrase is not queued immediately afterward');
});

test('boarding an individual group does not repeat its whole task narration', () => {
    const ui = atFirstService('passengers'); end(ui);
    const before = count(ui);
    ui.evaluate('ThomasRaceCore.serviceAction(state.race);render()');
    ui.frames(1.2, 20);
    assert.equal(ui.state().race.player.carried.passengers, 1);
    assert.equal(count(ui), before, 'boarding is shown by animation rather than another copy of the instruction');
});
