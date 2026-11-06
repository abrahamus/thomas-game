'use strict';

// A small DOM/event simulation exercises the standalone file's real adapter.
// It deliberately does not claim to check browser layout, speech, or audio.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(__dirname, '..', '..', 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
function script(id) {
    const match = html.match(new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i'));
    assert.ok(match, `Missing inline ${id} script`);
    return match[1];
}
const coreSource = script('game-core');
const raceCoreSource = html.includes('id="race-core"') ? script('race-core') : '';
const audioSource = script('game-audio');
const musicSource = script('game-music');
const runtimeSource = script('game-runtime');
// Parse the embedded clips only once; individual simulations reuse immutable assets.
const narration = JSON.parse(script('narration-data'));
const uiNarrationMatch = html.match(/<script\b[^>]*\bid=["']ui-narration-data["'][^>]*>([\s\S]*?)<\/script>/i);
const uiNarration = uiNarrationMatch ? JSON.parse(uiNarrationMatch[1]) : {};

function createDocument() {
    const listeners = new Map();
    const doc = {
        hidden: false,
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        emit(type, details = {}) {
            const event = { type, target: doc.body, detail: 0, defaultPrevented: false,
                preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...details };
            for (const listener of listeners.get(type) || []) listener(event);
            return event;
        }
    };
    function matches(node, selector) {
        const parts = selector.trim().split(/\s+(?![^[]*\])/);
        const local = parts.pop();
        if (!local) return false;
        // Attribute values can contain # or ., which are not CSS ID/class selectors.
        const bare = local.replace(/\[[^\]]*\]/g, '');
        const tag = bare.match(/^[a-z][\w-]*/i);
        if (tag && node.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
        const id = bare.match(/#([\w-]+)/);
        if (id && node.id !== id[1]) return false;
        for (const cls of bare.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(cls[1])) return false;
        for (const attr of local.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]/g)) {
            if (!node.hasAttribute(attr[1])) return false;
            if (attr[2] !== undefined && node.getAttribute(attr[1]) !== attr[2]) return false;
        }
        if (!parts.length) return true;
        let parent = node.parentNode;
        const preceding = parts.join(' ');
        while (parent) { if (matches(parent, preceding)) return true; parent = parent.parentNode; }
        return false;
    }
    class Node {
        constructor(tag) {
            this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
            this.attributes = {}; this.dataset = {}; this.style = {}; this._text = ''; this.disabled = false;
            const classes = new Set();
            this.classList = { add: (...values) => values.forEach(value => classes.add(value)),
                remove: (...values) => values.forEach(value => classes.delete(value)),
                contains: value => classes.has(value),
                toggle: (value, enabled) => {
                    const add = enabled === undefined ? !classes.has(value) : enabled;
                    if (add) classes.add(value); else classes.delete(value); return add;
                } };
        }
        get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
        set textContent(value) { this._text = value; if (this.children) this.replaceChildren(); }
        get id() { return this.attributes.id || ''; }
        get hidden() { return this.hasAttribute('hidden'); }
        set hidden(value) { if (value) this.attributes.hidden = ''; else delete this.attributes.hidden; }
        get inert() { return this.hasAttribute('inert'); }
        set inert(value) { if (value) this.attributes.inert = ''; else delete this.attributes.inert; }
        get isContentEditable() { return ['true', ''].includes(this.attributes.contenteditable); }
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
            if (name === 'class') String(value).split(/\s+/).forEach(cls => this.classList.add(cls));
        }
        getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; }
        removeAttribute(name) { delete this.attributes[name]; }
        hasAttribute(name) { return this.attributes[name] !== undefined; }
        appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
        replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); nodes.forEach(node => this.appendChild(node)); }
        remove() {
            if (!this.parentNode) return;
            if (doc.activeElement === this) doc.activeElement = doc.body;
            this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null;
        }
        closest(selector) {
            let node = this;
            while (node) { if (selector.split(',').some(part => matches(node, part))) return node; node = node.parentNode; }
            return null;
        }
        contains(other) {
            let node = other;
            while (node) { if (node === this) return true; node = node.parentNode; }
            return false;
        }
        querySelectorAll(selector) {
            const result = [];
            const visit = node => { for (const child of node.children) {
                if (selector.split(',').some(part => matches(child, part))) result.push(child); visit(child);
            } };
            visit(this); return result;
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        focus() {
            if (!this.closest('[hidden],[inert]') && !this.disabled && doc.activeElement !== this) {
                doc.activeElement = this;
                doc.emit('focusin', { target: this });
            }
        }
        click() { if (!this.disabled) doc.emit('click', { target: this }); }
        dispatchEvent(event) { doc.emit(event.type, { ...event, target: this }); }
        addEventListener(type, listener) {
            doc.addEventListener(type, event => { if (event.target === this || event.target.closest(`#${this.id}`)) listener(event); });
        }
        getScreenCTM() { return { inverse: () => ({}) }; }
        createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }; }
    }
    doc.root = new Node('root');
    const stack = [doc.root];
    const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const match of markup.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
        const [, closing, tag, rawAttrs] = match;
        if (closing) {
            const index = stack.findLastIndex(node => node.tagName.toLowerCase() === tag.toLowerCase());
            if (index > 0) stack.length = index;
            continue;
        }
        const node = new Node(tag);
        for (const attr of rawAttrs.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            node.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '');
        }
        stack[stack.length - 1].appendChild(node);
        if (!['meta', 'link', 'br', 'hr', 'img', 'input'].includes(tag.toLowerCase()) && !rawAttrs.endsWith('/')) stack.push(node);
    }
    doc.body = doc.root.querySelector('body'); doc.activeElement = doc.body;
    // Keep real embedded audio catalogues without parsing their base64 as markup.
    for (const id of ['music-data', 'running-audio-data']) {
        if (!html.includes(`id="${id}"`)) continue;
        const data = new Node('script');
        data.setAttribute('id', id);
        data.setAttribute('type', 'application/json');
        data.textContent = script(id);
        doc.body.appendChild(data);
    }
    const ids = new Map();
    const indexIds = node => {
        if (node.id) ids.set(node.id, node);
        node.children.forEach(indexIds);
    };
    indexIds(doc.root);
    doc.getElementById = id => ids.get(id) || null;
    doc.querySelectorAll = selector => doc.root.querySelectorAll(selector);
    doc.querySelector = selector => doc.root.querySelector(selector);
    doc.createElement = tag => new Node(tag);
    doc.createElementNS = (_, tag) => new Node(tag);
    return doc;
}

function setup(saved, { seed = 17, unavailableStorage = false, raceUnavailable = false } = {}) {
    const document = createDocument();
    const windowListeners = new Map();
    const values = new Map();
    if (saved) values.set('thomas-first-adventure-progress-v1', saved);
    const storage = {
        getItem: key => { if (unavailableStorage) throw new Error('Storage unavailable'); return values.get(key) || null; },
        setItem: (key, value) => { if (unavailableStorage) throw new Error('Storage unavailable'); values.set(key, value); }
    };
    const spoken = [], speechEvents = [];
    const window = { localStorage: storage,
        addEventListener(type, listener) { windowListeners.set(type, listener); },
        speechSynthesis: { cancel() { speechEvents.push('cancel'); }, getVoices: () => [], speak: utterance => {
            speechEvents.push('speak');
            spoken.push(utterance.text); if (utterance.onstart) utterance.onstart(); if (utterance.onend) utterance.onend();
        } } };
    // Seed only randomness; exercise the actual model, input adapter and render
    // functions without depending on a particular opponent or winning time.
    const randomMath = Object.create(Math);
    randomMath.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const context = vm.createContext({ document, window, Math: randomMath, ThomasNarration: narration, ThomasUiNarration: uiNarration,
        requestAnimationFrame() {},
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        MouseEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }
    });
    // Renderer substitution permits input/state checks without claiming WebGL
    // rendering. The real Three.js scene is checked separately from this DOM.
    context.ThomasRaceView = { create({ onUnavailable }) {
        if (raceUnavailable) { onUnavailable(new Error('Simulated WebGL unavailable')); return { available: false }; }
        return { available: true, renders: 0, resizes: 0, disposed: false,
            render(race) { this.renders++; this.lastDistance = race.player.distance; },
            resize() { this.resizes++; }, dispose() { this.disposed = true; } };
    } };
    vm.runInContext(raceCoreSource + '\n' + coreSource + '\n' + audioSource + '\n' + musicSource + '\n' + runtimeSource, context, { filename: 'standalone-game.js' });
    const evaluate = expression => vm.runInContext(expression, context);
    function key(key, { target = document.activeElement, repeat = false, hold = false, ...rest } = {}) {
        const event = document.emit('keydown', { key, target, repeat, ...rest });
        // Simulate the native default click once. The adapter must prevent it
        // when it handles the key itself, and suppress repeated activation.
        if (!event.defaultPrevented && [' ', 'Enter'].includes(key) && target.tagName === 'BUTTON') target.click();
        if(!hold)document.emit('keyup',{key,target});
        return event;
    }
    function click(selector) {
        const node = document.querySelector(selector);
        assert.ok(node, selector);
        assert.equal(Boolean(node.closest('[hidden],[inert]')), false, `${selector} must be visible and interactive`);
        assert.equal(node.disabled, false, `${selector} must be enabled`);
        document.emit('click', { target: node, detail: 1 });
    }
    function choose(role,id) {
        if(document.getElementById(role+'PickerButton').getAttribute('aria-expanded')!=='true')click('#'+role+'PickerButton');
        click('#choose-'+role+'-'+id);
    }
    function frames(seconds, hz = 10) {
        let now = evaluate('ui.lastTimestamp') || 0;
        evaluate(`frame(${now})`);
        const finish = now + seconds * 1000;
        while (finish - now > 1e-7) { now = Math.min(finish, now + 1000 / hz); evaluate(`frame(${now})`); }
    }
    return { document, evaluate, key, click, choose, frames, spoken, speechEvents, storage, windowListeners,
        state: () => JSON.parse(evaluate('JSON.stringify(state)')) };
}


function accelerateTo(ui,keyboard,percent=150){
    const up=ui.document.getElementById('action-accelerate');
    while(!up.hidden&&!up.disabled&&ui.evaluate('state.race.player.speedPercent')<percent){
        if(keyboard)ui.key('ArrowUp');
        else ui.click('#action-accelerate');
    }
}
module.exports = { html, setup, script, accelerateTo };
