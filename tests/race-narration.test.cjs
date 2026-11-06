'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const box = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/race-model.js'), 'utf8'), box);
const model = box.ThomasRaceCore;
const clips = JSON.parse(fs.readFileSync(path.join(root, 'audio/race-narration.json'), 'utf8'));
const extra = {
    'race.unavailable': 'The race cannot start in this browser. Please try another browser.',
    'ui.album.empty': 'Finish a race to earn your first sticker.'
};
const hardwareWords = /\b(?:press|tap|space|enter|arrows?|buttons?|keys?|left|right)\b/i;

function readWav(bytes) {
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, 'complete RIFF container');
    let format, data;
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const id = bytes.toString('ascii', offset, offset + 4);
        const length = bytes.readUInt32LE(offset + 4);
        assert.ok(offset + 8 + length <= bytes.length, `complete ${id} chunk`);
        if (id === 'fmt ') format = bytes.subarray(offset + 8, offset + 8 + length);
        if (id === 'data') data = bytes.subarray(offset + 8, offset + 8 + length);
        offset += 8 + length + (length % 2);
    }
    assert.ok(format && data, 'format and PCM chunks');
    return { format, data };
}

test('every race action and updated menu has an exact slow Ana recording', () => {
    const expected = { ...model.NARRATION, ...extra };
    assert.deepEqual(Object.keys(clips).sort(), Object.keys(expected).sort());
    for (const [key, words] of Object.entries(expected)) {
        assert.equal(clips[key].text, words, key);
        assert.doesNotMatch(words, hardwareWords, key);
        assert.equal(clips[key].voice, 'en-US-AnaNeural', key);
        assert.equal(clips[key].language, 'en-US', key);
        assert.equal(clips[key].rate, '-25%', key);
    }
});

test('embedded race recordings are complete non-silent mono PCM WAVs and match source cache', () => {
    for (const [key, clip] of Object.entries(clips)) {
        const bytes = Buffer.from(clip.data, 'base64');
        const { format, data } = readWav(bytes);
        assert.equal(format.readUInt16LE(0), 1, `${key}: linear PCM`);
        assert.equal(format.readUInt16LE(2), 1, `${key}: mono`);
        assert.equal(format.readUInt32LE(4), 22050, `${key}: sample rate`);
        assert.equal(format.readUInt16LE(14), 16, `${key}: sample width`);
        const seconds = data.length / (22050 * 2);
        assert.ok(seconds > .2 && seconds < 45, `${key}: plausible duration`);
        assert.ok(Math.abs(clip.duration - seconds) < .001, `${key}: accurate embedded duration`);
        let peak = 0;
        for (let offset = 0; offset < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)));
        assert.ok(peak > 100, `${key}: audible non-silent speech`);
        const digest = crypto.createHash('sha256').update(`${clip.voice}:${clip.rate}:22050:${clip.text}`).digest('hex').slice(0, 16);
        assert.deepEqual(bytes, fs.readFileSync(path.join(root, 'audio/race-narration-clips', `${digest}.wav`)), `${key}: embedded and editable clip match`);
    }
});

const deliveryPhrases = {
    'race.delivery.passengers': 'Take our passengers to their station.',
    'race.delivery.cargo': 'Take our container to its new home.',
    'race.service.passenger-load': 'Let’s welcome the passengers aboard.',
    'race.service.passenger-unload': 'We’ve arrived. Help our passengers step off.',
    'race.service.cargo-select': 'Choose a container for our journey.',
    'race.service.cargo-load': 'Let’s use the crane to load our container.',
    'race.service.cargo-unload': 'We’ve arrived. Lift the container onto the ground.',
    'race.service.animals': 'Blow the whistle so the animals can move along.',
    'race.service.animals-wait': 'Here they go. Let’s wait until the track is clear.',
    'race.service.wash': 'Let’s wash our vehicle. Wipe away the mud.',
    'race.service.water': 'Let’s fill our engine’s water tank.',
    'race.service.tree': 'Call the crane to lift the branch.',
    'race.service.drawbridge': 'Let the boat through. Then the bridge can come down.',
    'race.service.done': 'All done! Off we go!'
};

test('rival choices, railway challenges, delivery jobs and results are all voiced', () => {
    for (const key of ['race.menu', 
        'race.ready', 'race.steady', 'race.go', 'race.cruise', 'race.service.repairs','race.service.rocks','race.service.coal','race.service.level-crossing',
        'race.complete.win', 'race.complete.lose', 'race.complete.tie',
        'race.unavailable', ...Object.keys(deliveryPhrases)]) assert.ok(clips[key]?.data, key);
});

test('delivery narration describes useful actions without manual driving or hardware instructions', () => {
    assert.equal(clips['race.go'].text, 'Go! Let’s help along the way.');
    assert.equal(clips['race.cruise'].text, 'Off we go! Our next job is ahead.');
    for (const [key, phrase] of Object.entries(deliveryPhrases)) assert.equal(clips[key].text, phrase, key);
    for (const key of Object.keys(clips).filter(key => key.startsWith('race.'))) {
        assert.doesNotMatch(key, /(?:^race\.(?:preview|rule|act|track)\.|recovery|steady-speed|^race\.(?:mud|barrier|switch)$)/, `${key}: obsolete racing tasks are removed`);
        assert.doesNotMatch(clips[key].text, /\b(?:brak(?:e|es|ing)|accelerat\w*|gears?|fast(?:er)?)\b/i, `${key}: Thomas handles driving automatically`);
        assert.doesNotMatch(clips[key].text, /\b(?:retry|choose which|which track|stars?|change tracks)\b/i, `${key}: no stopped quiz or retired track-switching task remains`);
    }
    assert.ok(clips['race.go'].duration < 8, 'the introduction finishes before the first railway job');
    for (const key of Object.keys(deliveryPhrases)) assert.ok(clips[key].duration < 8, `${key}: a short task suitable for a non-reading child`);
});

test('all newly generated delivery narration has no clipped samples', () => {
    for (const key of ['race.go', ...Object.keys(deliveryPhrases)]) {
        const { data } = readWav(Buffer.from(clips[key].data, 'base64'));
        let clipped = 0;
        for (let offset = 0; offset < data.length; offset += 2) {
            const sample = data.readInt16LE(offset);
            if (sample === -32768 || sample === 32767) clipped++;
        }
        assert.equal(clipped, 0, `${key}: no full-scale samples`);
    }
});

const preservedClipHashes = {
    "race.ready": "5027d5558c927bfa278b0e22de320343b3a5738ca437e761a777638ebfe6df3e",
    "race.steady": "22a52d64c846c4ab36a07bb4431f7ec0497a22281b4e16f037bf9ca4e9b16775",
    "race.complete.tie": "b71dd062ea90b8f62c711d643b81d1dc8488b34150519e0752f776a73081d5bf",
};
test('unchanged countdown and tie recordings remain byte-identical', () => {
    for (const [key, digest] of Object.entries(preservedClipHashes)) {
        assert.equal(crypto.createHash('sha256').update(clips[key].data).digest('hex'), digest, key);
    }
});
