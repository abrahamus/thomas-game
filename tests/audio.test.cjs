const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(__dirname, '..', 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
function inline(id) {
    const found = html.match(new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
    assert.ok(found, `inline ${id} exists`);
    return found[1];
}
const audioSource = process.env.THOMAS_AUDIO_SOURCE ? fs.readFileSync(process.env.THOMAS_AUDIO_SOURCE, 'utf8') : inline('game-audio');
const originalSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'original-audio.js'), 'utf8');
const assets = process.env.THOMAS_NARRATION_SOURCE ? JSON.parse(fs.readFileSync(process.env.THOMAS_NARRATION_SOURCE, 'utf8')) : JSON.parse(inline('narration-data'));

class Param {
    constructor(value = 0) { this.value = value; this.operations = []; }
    setValueAtTime(value, time) { this.value = value; this.operations.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.operations.push(['linear', value, time]); }
    exponentialRampToValueAtTime(value, time) { this.value = value; this.operations.push(['exponential', value, time]); }
    cancelScheduledValues(time) { this.operations.push(['cancel', time]); }
    cancelAndHoldAtTime(time) { this.operations.push(['hold', time]); }
}
class AudioNode {
    constructor(kind) {
        this.kind = kind; this.connections = []; this.frequency = new Param(); this.gain = new Param(); this.Q = new Param();
        this.started = false; this.stopped = 0; this.stopTimes = []; this.disconnected = false;
    }
    connect(target) { this.connections.push(target); }
    disconnect() { this.disconnected = true; }
    start(at = 0) { this.started = true; this.startTime = at; }
    stop(at) { this.stopped++; this.stopTimes.push(at); }
    finish() { if (this.onended) this.onended(); }
}
class FakeAudioContext {
    constructor() {
        this.destination = new AudioNode('destination'); this.currentTime = 3; this.sampleRate = 22050;
        this.state = 'suspended'; this.nodes = []; this.gains = []; this.decoding = []; this.resumes = 0; this.buffers = [];
    }
    node(kind) { const result = new AudioNode(kind); this.nodes.push(result); return result; }
    createGain() { const gain = this.node('gain'); this.gains.push(gain); return gain; }
    createOscillator() { return this.node('oscillator'); }
    createBufferSource() { return this.node('buffer'); }
    createBiquadFilter() { return this.node('filter'); }
    createBuffer(channels, frames, rate) {
        const buffer = { duration: frames / rate, channels, frames, rate, getChannelData: () => new Float32Array(frames) };
        this.buffers.push(buffer); return buffer;
    }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    decodeAudioData(bytes) {
        return new Promise((resolve, reject) => this.decoding.push({ bytes, resolve, reject }));
    }
    resolve(index = 0) { this.decoding[index].resolve({ duration: 2 }); }
    reject(index = 0) { this.decoding[index].reject(new Error('bad audio')); }
}

function setup({ useContext = true, useSpeech = true, voices = [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Serena', lang: 'en-GB' }], narration = {
    first: { text: 'Hello Thomas.', data: Buffer.from('first WAV').toString('base64') },
    second: { text: 'Slow down at the bridge.', data: Buffer.from('second WAV').toString('base64') }
} } = {}) {
    const state = { paused: false, isMuted: false, generation: 1 };
    const speaking = [], spoken = [], synth = { cancellations: 0, getVoices: () => voices,
        cancel() { this.cancellations++; }, speak(value) { spoken.push(value); } };
    const window = { ...(useSpeech ? { speechSynthesis: synth } : {}), ...(useContext ? { AudioContext: FakeAudioContext } : {}) };
    const box = vm.createContext({ window, ThomasNarration: narration,
        atob: data => Buffer.from(data, 'base64').toString('binary'), Uint8Array,
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } });
    vm.runInContext('Math.random = () => 0.5;', box);
    vm.runInContext(audioSource, box, { filename: 'game-audio.js' });
    const audio = box.ThomasAudio.create({ getState: () => state, getGeneration: () => state.generation,
        onSpeaking: value => speaking.push(value) });
    return { audio, state, spoken, speaking, synth };
}

test('no sound starts before a keyboard or click gesture unlocks audio', async () => {
    const { audio, spoken } = setup();
    assert.equal(audio.context, null);
    assert.equal(await audio.speak('first'), false);
    assert.equal(audio.effect('whistle'), false);
    audio.update(10, { speed: 5, place: 'farm' });
    assert.equal(spoken.length, 0);
    audio.unlock();
    assert.ok(audio.context);
    assert.equal(audio.context.resumes, 1, 'resume happens synchronously in unlock');
});

test('only the master gain reaches destination; all sounds use separate channel buses', async () => {
    const { audio } = setup(); audio.unlock();
    const context = audio.context;
    const [master, narration, effects] = context.gains;
    assert.equal(master.gain.value, 1); assert.equal(effects.gain.value, 1); assert.equal(narration.gain.value, 0.72);
    assert.deepEqual(master.connections, [context.destination]);
    for (const bus of [narration, effects]) assert.deepEqual(bus.connections, [master]);
    for (const name of ['whistle', 'pop', 'chime', 'animal']) assert.equal(audio.effect(name, 'cow'), true);
    assert.equal(audio.effect('chug'), false, 'motion now owns recorded running audio');
    audio.update(5, { place: 'farm', speed: 2 });
    const promise = audio.speak('first'); context.resolve(); assert.equal(await promise, true);
    assert.deepEqual(context.nodes.filter(node => node.connections.includes(context.destination)), [master]);
});

test('cancelling stale narration preserves the active signal until mute or pause', async () => {
    for (const signal of ['whistle', 'horn', 'radio']) {
        const { audio } = setup(); audio.unlock();
        const pending = audio.speak('first'), context = audio.context;
        audio.effect(signal);
        const sources = context.nodes.filter(node => node.started);
        assert.ok(sources.length > 0);
        audio.stopNarration();
        for (const node of sources) assert.ok(!node.disconnected && node.stopTimes.every(time => time > context.currentTime), `${signal} must keep its scheduled audible duration`);
        context.resolve(); assert.equal(await pending, false, 'Stale narration cannot start later');
        audio.setMuted(true);
        for (const node of sources) assert.ok(node.disconnected, 'Mute still stops the signal');
    }
});

test('a stopped or changed mission cannot play a delayed decoded clip', async () => {
    for (const reason of ['stop', 'generation', 'pause', 'mute']) {
        const { audio, state, spoken } = setup(); audio.unlock();
        const context = audio.context, result = audio.speak('first');
        assert.equal(context.decoding.length, 1);
        if (reason === 'stop') audio.stop();
        if (reason === 'generation') state.generation++;
        if (reason === 'pause') state.paused = true;
        if (reason === 'mute') audio.setMuted(true);
        context.resolve(); assert.equal(await result, false, reason);
        assert.equal(context.nodes.filter(node => node.kind === 'buffer' && node.started).length, 0, reason);
        assert.equal(spoken.length, 0, `${reason}: no fallback may revive a stale task`);
        assert.equal(audio.speaking, false);
    }
});

test('new narration supersedes delayed decoding without changing the restored effects loudness', async () => {
    const { audio, speaking } = setup(); audio.unlock();
    const context = audio.context, old = audio.speak('first'), current = audio.speak('second');
    context.resolve(0); assert.equal(await old, false);
    assert.equal(audio.speaking, false, 'decoding alone does not hide or duck other sounds');
    context.resolve(1); assert.equal(await current, true);
    assert.equal(context.gains[2].gain.value, 1);
    assert.deepEqual(context.gains[2].gain.operations, [], 'effects are never ducked');
    const node = context.nodes.find(node => node.kind === 'buffer' && node.started);
    node.finish();
    assert.equal(audio.speaking, false);
    assert.equal(context.gains[2].gain.value, 1);
    assert.deepEqual(speaking, [true, false]);
});

test('Repeat reuses cached decoding but starts a fresh narrated clip', async () => {
    const { audio } = setup(); audio.unlock();
    const first = audio.speak('first'); audio.context.resolve(); await first;
    const old = audio.context.nodes.find(node => node.kind === 'buffer' && node.started);
    assert.equal(await audio.speak('first'), true);
    assert.equal(audio.context.decoding.length, 1);
    assert.ok(old.stopped > 0);
    assert.equal(audio.context.nodes.filter(node => node.kind === 'buffer' && node.started).length, 2);
});

test('pause update and mute stop narration and every original effect including whistle vibrato', async () => {
    for (const reason of ['pause', 'mute']) {
        const { audio, state } = setup(); audio.unlock();
        audio.update(5, { speed: 2, place: 'farm' }); audio.effect('whistle');
        const spoken = audio.speak('first'); audio.context.resolve(); await spoken;
        const active = audio.context.nodes.filter(node => ['buffer', 'oscillator'].includes(node.kind) && node.started);
        if (reason === 'pause') { state.paused = true; audio.update(1, { speed: 2, place: 'farm' }); }
        else audio.setMuted(true);
        assert.equal(audio.speaking, false);
        assert.ok(active.every(node => node.stopped > 0 && node.disconnected));
        assert.ok(active.every(node => node.stopTimes.at(-1) === undefined), 'cancellation replaces each future stop with an immediate stop, including vibrato LFOs');
        const nodes = audio.context.nodes.length;
        assert.equal(audio.effect('whistle'), false);
        audio.update(10, { speed: 5, place: 'docks' });
        assert.equal(audio.context.nodes.length, nodes);
        if (reason === 'mute') assert.equal(audio.context.gains[0].gain.value, 0);
    }
});

test('speech fallback works without Web Audio and can be cancelled without stale callbacks', async () => {
    const { audio, spoken, speaking, synth } = setup({ useContext: false }); audio.unlock();
    assert.equal(await audio.speak('missing', 'Slow down at the bridge.'), true);
    const utterance = spoken[0], ended = utterance.onend;
    assert.equal(utterance.lang, 'en-GB'); assert.equal(utterance.voice.name, 'Serena');
    assert.equal(utterance.rate, 0.75); assert.equal(utterance.pitch, 1);
    assert.equal(audio.speaking, true);
    audio.stop(); assert.equal(audio.speaking, false); assert.ok(synth.cancellations > 0);
    await audio.speak('missing', 'Now stop beside the station.');
    ended(); assert.equal(audio.speaking, true, 'a cancelled sentence cannot end the new sentence');
    spoken[1].onend(); assert.equal(audio.speaking, false);
    assert.deepEqual(speaking, [true, false, true, false]);
});

test('failed clip decoding and dynamic text use full browser speech fallback', async () => {
    const { audio, spoken } = setup(); audio.unlock();
    const first = audio.speak('first'); audio.context.reject();
    assert.equal(await first, true); assert.equal(spoken[0].text, 'Hello Thomas.');
    assert.equal(await audio.speak('first', 'A different instruction.'), true);
    assert.equal(spoken[1].text, 'A different instruction.');
    assert.equal(audio.context.decoding.length, 1, 'a mismatched clip is not used');
    const retry = audio.speak('first'); audio.context.resolve(1);
    assert.equal(await retry, true, 'a failed decode can be retried after speech fallback');
});

test('paused UI instructions can decode and play, while gameplay sounds stay paused', async () => {
    const { audio, state } = setup();
    state.paused = true;
    audio.unlock();
    assert.ok(audio.context, 'the first menu gesture can unlock audio during pause');
    const pending = audio.speak('first', undefined, { allowPaused: true });
    audio.update();
    audio.context.resolve();
    assert.equal(await pending, true);
    const node = audio.context.nodes.find(item => item.kind === 'buffer' && item.started);
    audio.update();
    assert.equal(node.stopped, 0, 'pause updates preserve explicitly requested UI narration');
    assert.equal(audio.speaking, true);
    assert.equal(audio.effect('whistle'), false);
    audio.stop();
    assert.equal(node.stopped, 1);
    assert.equal(audio.speaking, false);
});

test('paused UI speech remains guarded against mute, cancellation, and new activities', async () => {
    for (const reason of ['mute', 'stop', 'generation']) {
        const { audio, state } = setup();
        state.paused = true; audio.unlock();
        const pending = audio.speak('first', undefined, { allowPaused: true });
        if (reason === 'mute') audio.setMuted(true);
        if (reason === 'stop') audio.stop();
        if (reason === 'generation') state.generation++;
        audio.context.resolve();
        assert.equal(await pending, false, reason);
        assert.equal(audio.context.nodes.filter(item => item.kind === 'buffer' && item.started).length, 0, reason);
    }
    const { audio, state, spoken } = setup({ useContext: false });
    state.paused = true; audio.unlock();
    assert.equal(await audio.speak('missing', 'Tap to play.', { allowPaused: true }), true);
    assert.equal(spoken[0].text, 'Tap to play.');
    audio.update();
    assert.equal(audio.speaking, true);
    audio.setMuted(true); assert.equal(audio.speaking, false);
    assert.equal(await audio.speak('missing', 'Tap to play.', { allowPaused: true }), false);
});

test('ordinary gameplay narration cannot bypass pause, and fallback does not prefer Daniel', async () => {
    const { audio, state, spoken } = setup({ useContext: false });
    state.paused = true; audio.unlock();
    assert.equal(await audio.speak('missing', 'Tap right to go.'), false);
    assert.equal(spoken.length, 0);
    state.paused = false;
    await audio.speak('missing', 'Tap right to go.');
    assert.equal(spoken[0].voice.name, 'Serena');
    const onlyDaniel = setup({ useContext: false, voices: [{ name: 'Daniel', lang: 'en-GB' }] });
    onlyDaniel.audio.unlock(); await onlyDaniel.audio.speak('missing', 'Tap right to go.');
    assert.equal(onlyDaniel.spoken[0].voice, null, 'the browser default is preferable to explicitly selecting the rejected voice');
});

test('busy begins synchronously during decoding and ends after the clip, rather than before playback', async () => {
    const { audio } = setup();
    assert.equal(audio.busy, false); audio.unlock();
    const started = audio.speak('first');
    assert.equal(audio.busy, true);
    assert.equal(audio.speaking, false, 'visual speaking starts only with actual playback');
    audio.context.resolve(); assert.equal(await started, true);
    assert.equal(audio.busy, true); assert.equal(audio.speaking, true);
    audio.context.nodes.find(node => node.kind === 'buffer' && node.started).finish();
    assert.equal(audio.busy, false); assert.equal(audio.speaking, false);
});

test('a queue can preserve the welcome and wait until its decoding and playback have finished', async () => {
    const { audio } = setup(); audio.unlock();
    const pending = [], started = [];
    const enqueue = key => {
        if (audio.busy) pending.push(key);
        else started.push(audio.speak(key));
    };
    const flush = () => { if (!audio.busy && pending.length) enqueue(pending.shift()); };
    enqueue('first'); enqueue('second'); flush();
    assert.equal(audio.context.decoding.length, 1);
    assert.deepEqual(pending, ['second']);
    audio.context.resolve(); assert.equal(await started[0], true); flush();
    assert.equal(audio.context.decoding.length, 1, 'queued menu choice does not cancel the welcome');
    audio.context.nodes.find(node => node.kind === 'buffer' && node.started).finish(); flush();
    assert.equal(audio.context.decoding.length, 2);
    assert.equal(audio.busy, true);
    audio.context.resolve(1); assert.equal(await started[1], true);
    audio.context.nodes.filter(node => node.kind === 'buffer' && node.started).at(-1).finish();
    assert.equal(audio.busy, false);
});

test('older decode completions cannot clear the busy state of a newer request', async () => {
    const { audio } = setup(); audio.unlock();
    const first = audio.speak('first'), second = audio.speak('second');
    audio.context.resolve(0); assert.equal(await first, false);
    assert.equal(audio.busy, true); assert.equal(audio.speaking, false);
    audio.context.resolve(1); assert.equal(await second, true);
    const ended = audio.context.nodes.find(node => node.kind === 'buffer' && node.started).onended;
    audio.stop(); assert.equal(audio.busy, false);
    const again = audio.speak('first');
    assert.equal(audio.busy, true);
    ended(); assert.equal(audio.busy, true, 'an old ended callback cannot clear a replacement request');
    await again; audio.stop(); assert.equal(audio.busy, false);
});

test('busy clears for cancelled, muted, paused, or stale-generation requests and fallback failure', async () => {
    for (const reason of ['stop', 'mute', 'pause', 'generation']) {
        const { audio, state } = setup(); audio.unlock();
        const pending = audio.speak('first'); assert.equal(audio.busy, true);
        if (reason === 'stop') audio.stop();
        if (reason === 'mute') audio.setMuted(true);
        if (reason === 'pause') { state.paused = true; audio.update(); }
        if (reason === 'generation') state.generation++;
        if (reason !== 'generation') assert.equal(audio.busy, false, reason);
        audio.context.resolve(); assert.equal(await pending, false, reason);
        assert.equal(audio.busy, false, reason);
    }
    const { audio } = setup({ useSpeech: false }); audio.unlock();
    const failed = audio.speak('first'); assert.equal(audio.busy, true);
    audio.context.reject(); assert.equal(await failed, false);
    assert.equal(audio.busy, false);
    assert.equal(await audio.speak('missing', 'Tap right to go.'), false);
    assert.equal(audio.busy, false);
});

test('paused UI narration remains busy through decoding and speech fallback finishes cleanly', async () => {
    const { audio, state } = setup(); state.paused = true; audio.unlock();
    const pending = audio.speak('first', undefined, { allowPaused: true });
    audio.update(); assert.equal(audio.busy, true);
    audio.context.resolve(); assert.equal(await pending, true);
    assert.equal(audio.busy, true); audio.stop(); assert.equal(audio.busy, false);
    const fallback = setup({ useContext: false }); fallback.state.paused = true; fallback.audio.unlock();
    assert.equal(await fallback.audio.speak('missing', 'Tap to play.', { allowPaused: true }), true);
    assert.equal(fallback.audio.busy, true);
    fallback.spoken[0].onend(); assert.equal(fallback.audio.busy, false);
});

function legacyAudio() {
    const window = { AudioContext: FakeAudioContext };
    const box = vm.createContext({ window, ui: { audioUnlocked: true }, state: { paused: false, isMuted: false } });
    vm.runInContext('Math.random = () => 0.5;', box);
    vm.runInContext(originalSource + `
        globalThis.original = {
            effect(name, payload) {
                if (name === 'whistle') playPeepPeepWhistle();
                if (name === 'chug') playChugSound();
                if (name === 'pop') playPopSound(payload);
                if (name === 'chime') playStarChime(payload);
                if (name === 'animal') playCharacterSound(payload);
            },
            get context() { return audioCtx; }
        };
    `, box);
    return box.original;
}

function effectTrace(context, skipBuses = 0) {
    const nodes = context.nodes.slice(skipBuses);
    const names = new Map([[context.destination, 'destination']]);
    if (skipBuses) names.set(context.gains[2], 'destination');
    nodes.forEach((node, index) => {
        names.set(node, index);
        for (const param of ['frequency', 'gain', 'Q']) names.set(node[param], `${index}.${param}`);
    });
    return nodes.map(node => ({
        kind: node.kind, type: node.type, startTime: node.startTime, stopTimes: node.stopTimes,
        bufferDuration: node.buffer && node.buffer.duration, loop: node.loop,
        connections: node.connections.map(target => names.get(target)),
        frequency: { value: node.frequency.value, operations: node.frequency.operations },
        gain: { value: node.gain.value, operations: node.gain.operations },
        Q: { value: node.Q.value, operations: node.Q.operations }
    }));
}

for (const [label, commands] of [
    ['two-blast whistle with four tones, vibrato, and steam', [['whistle']]],
    ['UI, stop, and cleaning pops', [250, 300, 420, 500, 700, 740, 800].map(pitch => ['pop', pitch])],
    ['star and reward chimes', [['chime', false], ['chime', true]]],
    ['cow, sheep, and boat horn', [['animal', 'cow'], ['animal', 'sheep'], ['animal', 'docks']]]
]) {
    test(`restored ${label} exactly matches the original Web Audio scheduling`, () => {
        const { audio } = setup(); audio.unlock(); const original = legacyAudio();
        for (const [name, payload] of commands) { audio.effect(name, payload); original.effect(name, payload); }
        assert.deepEqual(effectTrace(audio.context, 5), effectTrace(original.context));
        assert.equal(audio.context.buffers[0].duration, 1.5, 'original steam-noise buffer length');
        assert.deepEqual(audio.context.buffers.map(item => [item.channels, item.frames, item.rate]),
            original.context.buffers.map(item => [item.channels, item.frames, item.rate]));
    });
}

test('audio update without valid running motion adds no ambience or music', () => {
    const { audio } = setup(); audio.unlock(); const before = audio.context.nodes.length;
    for (const place of ['menu', 'farm', 'woodland', 'station', 'bridge', 'docks', 'wash']) {
        audio.update(10, { place, speed: 5 });
    }
    assert.equal(audio.context.nodes.length, before, 'recorded running needs explicit motion and embedded assets');
    assert.equal(audio.effect('brake'), false); assert.equal(audio.effect('wash'), false);
    assert.equal(audio.setMusic, undefined);
});

function wavInfo(data) {
    const bytes = Buffer.from(data, 'base64');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    let format = null, pcm = null;
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const name = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
        assert.ok(offset + 8 + size <= bytes.length);
        if (name === 'fmt ') format = bytes.subarray(offset + 8, offset + 8 + size);
        if (name === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + (size % 2);
    }
    assert.ok(format && pcm && pcm.length > 0);
    assert.equal(format.readUInt16LE(0), 1, 'uncompressed PCM');
    assert.equal(format.readUInt16LE(2), 1, 'mono');
    assert.equal(format.readUInt32LE(4), 22050);
    assert.equal(format.readUInt16LE(14), 16);
    assert.ok(pcm.some(sample => sample !== 0), 'narration contains actual sound, not silent sandbox output');
    return pcm.length / 2 / 22050;
}

test('all embedded narration is valid mono PCM and covers adventure, gears, washing, Free Drive and racing', () => {
    assert.ok(Object.keys(assets).length >= 25);
    for (const [key, asset] of Object.entries(assets)) {
        assert.equal(typeof asset.text, 'string', key);
        assert.equal(asset.voice, 'en-US-AnaNeural', key);
        assert.equal(asset.rate, '-25%', key);
        assert.equal(asset.language, 'en-US', key);
        const duration = wavInfo(asset.data);
        assert.ok(duration > 0.2 && duration < 45, key);
        assert.ok(Math.abs(asset.duration - duration) < 0.001, key);
    }
    if (!process.env.THOMAS_AUDIO_SOURCE || process.env.THOMAS_CORE_SOURCE) {
        const model = vm.createContext({});
        vm.runInContext(inline('race-core'), model);
        vm.runInContext(process.env.THOMAS_CORE_SOURCE ? fs.readFileSync(process.env.THOMAS_CORE_SOURCE, 'utf8') : inline('game-core'), model);
        for (const [key, text] of Object.entries(model.ThomasGameCore.NARRATION)) assert.equal(assets[key]?.text, text, key);
    }
    for (const key of ['ui.pause','ui.resume','ui.whistle','ui.album.empty']) assert.ok(assets[key],key);
    assert.ok(!Object.keys(assets).some(key=>/^(drive|challenge|gear|menu)\./.test(key)), 'Retired 2D narration is absent');
    for (const key of ['race.menu', 
        'race.ready', 'race.steady', 'race.go', 'race.cruise', 'race.service.repairs', 'race.service.rocks', 'race.service.coal', 'race.service.level-crossing',
        'race.delivery.passengers','race.delivery.cargo','race.service.passenger-load','race.service.passenger-unload',
        'race.service.cargo-select','race.service.cargo-load','race.service.cargo-unload','race.service.animals',
        'race.service.animals-wait','race.service.wash','race.service.water','race.service.tree','race.service.drawbridge','race.service.done',
        'race.complete.win', 'race.complete.lose', 'race.complete.tie', 'race.next']) {
        assert.ok(assets[key], `${key}: new race guidance is embedded`);
    }
    const uiBlock = html.match(/<script\b[^>]*id=["']ui-narration-data["'][^>]*>([\s\S]*?)<\/script>/);
    const uiCatalogue = process.env.THOMAS_UI_NARRATION_SOURCE ? JSON.parse(fs.readFileSync(process.env.THOMAS_UI_NARRATION_SOURCE, 'utf8')) : uiBlock ? JSON.parse(uiBlock[1]) : {};
    for (const [key, text] of Object.entries(uiCatalogue)) assert.equal(assets[key]?.text, text, key);
    for (const id of ['driver', 'apple-delivery', 'race-finisher', 'race-winner', 'meet-friends', 'wash-visit', 'fallen-tree', 'closed-bridge', 'find-james', 'find-toby']) assert.ok(assets[`ui.sticker.${id}`], id);
    assert.doesNotMatch(audioSource, /fetch\(|new Audio\(|https?:/);
    assert.ok(!Object.keys(assets).some(key => /^(explore|mission|clue|hint|junction|route)\./.test(key)), 'unused exploration narration is removed');
});

test('original festival melody and handclaps are finite, duck under speech and cancel on pause/mute/exit',async()=>{
 for(const reason of ['pause','mute','exit']){
  const {audio,state}=setup();audio.unlock();audio.effect('festival');audio.effect('applause');
  const context=audio.context,bus=context.gains[4],sources=context.nodes.filter(n=>['buffer','oscillator'].includes(n.kind)&&n.started);
  assert.equal(sources.length,36);assert.ok(sources.every(n=>n.stopTimes.length===1&&n.stopTimes[0]<context.currentTime+2));
  const speech=audio.speak('first');context.resolve();await speech;assert.equal(bus.gain.value,.16);assert.equal(context.gains[2].gain.value,1,'signals remain audible');
  if(reason==='pause'){state.paused=true;audio.update(0,{});}else if(reason==='mute')audio.setMuted(true);else audio.stop();
  assert.ok(sources.every(n=>n.disconnected&&n.stopped>0),reason);
 }
});
