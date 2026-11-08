/* Browser adapter: the model owns rules; this file owns pictures, sound and input. */
const storage = (() => { try { return window.localStorage; } catch (_) { return null; } })();
const game = ThomasGameCore.createGame(storage);
const state = game.state;
state.isMuted = false;
state.musicEnabled = false;
const $ = id => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ui = {
    audioUnlocked:false,windowActive:true,task:'',taskKey:'',emoji:'🚂',lastGeneration:-1,
    festival:null,finishWelcomed:false,menuIndex:0,openPicker:null,albumOpen:false,speaking:false,time:0,whistle:0,lastTimestamp:null,
    pendingSpeech:null,hoverNode:null,hoverDeadline:null,suppressFocus:false,lastAnnouncement:'',
    raceView:null,raceUnavailable:false,raceLayoutKey:'',raceVoiceKey:null,upHeld:false,pedalPointer:null,ignorePedalClick:false
};
if (!globalThis.ThomasNarration) {
    try { globalThis.ThomasNarration = JSON.parse(document.getElementById('narration-data').textContent); }
    catch (_) { globalThis.ThomasNarration = {}; }
}
let music=null;
let runningAssets=null;
try{runningAssets=JSON.parse($('running-audio-data')?.textContent || 'null');}catch(_){}
const audio = ThomasAudio.create({runningAssets,getState:()=>state,getGeneration:()=>state.generation,onSpeaking:value=>{ui.speaking=value;if(music)music.update();}});
let musicAsset=null;
try{musicAsset=JSON.parse($('music-data')?.textContent || 'null');}catch(_){}
state.musicEnabled=!!(musicAsset && musicAsset.data);
if(globalThis.ThomasMusic)music=ThomasMusic.create({getContext:()=>audio.context,getOutput:()=>audio.masterBus,
    getState:()=>({...state,paused:state.paused || ui.albumOpen,hidden:!ui.windowActive || document.hidden,musicEnabled:state.musicEnabled && ui.audioUnlocked}),
    getGeneration:()=>state.generation,getAsset:()=>musicAsset,isSpeaking:()=>ui.speaking});
function playPeepPeepWhistle() { const power=state.race&&ThomasRaceCore.getCharacter(state.race).power;audio.effect(power==='rotor'?'radio':power==='diesel'?'horn':'whistle'); }
function playPopSound(frequency=500) { audio.effect('pop',frequency); }
function playStarChime(fanfare=false) { audio.effect('chime',fanfare); }

function show(id, visible) { const node = $(id); if (!node)return; if(visible)node.removeAttribute('hidden');else node.setAttribute('hidden',''); }
function svgShow(id, visible) { const node = $(id); if (node) node.style.display = visible ? '' : 'none'; }
function svgNode(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
}
function focusStage() { $('gameStage').focus({preventScroll: true}); }
function active() { return state.screen === 'play' && !state.paused && !ui.albumOpen; }
function unlockAudio() { ui.audioUnlocked=true;ui.windowActive=!document.hidden;audio.unlock(); }
if(!globalThis.ThomasUiNarration){
    try{globalThis.ThomasUiNarration=JSON.parse($('ui-narration-data').textContent);}catch(_){globalThis.ThomasUiNarration={};}
}
function words(key,fallback='') { return globalThis.ThomasRaceCore?.NARRATION[key] || globalThis.ThomasUiNarration[key] || ThomasGameCore.NARRATION[key] || (globalThis.ThomasNarration[key] || {}).text || fallback; }
function serviceVoice(key){return /^race\.(?:service\.|flight\.(?!(?:delivery|terrain)\.))/.test(key||'');}
function raceVoicePriority(key) {
    if(/^race\.(?:complete|festival)\./.test(key))return 100;
    if(/^race\.(?:ready|steady|go)$/.test(key))return 80;
    if(serviceVoice(key))return 50;
    if(/^race\.(?:flight\.)?delivery\./.test(key))return 40;
    return 0;
}
function raceSpeechRelevant(key) {
    if(state.mode!=='race' || !state.race || state.screen!=='play')return true;
    const view=ThomasRaceCore.getView(state.race);
    if(/^race\.complete\./.test(key))return false;
    if(/^race\.festival\./.test(key))return !!ui.festival && key===festivalKey();
    if(serviceVoice(key))return key==='race.service.done'?!view.currentService:key===view.taskKey;
    if(/^race\.(?:flight\.)?delivery\./.test(key))return state.phase==='racing' && !view.currentService;
    return true;
}
function say(text,key,{allowPaused=false,queue=false}={}) {
    if(!ui.audioUnlocked || state.isMuted || !ui.windowActive || document.hidden || state.paused && !allowPaused)return;
    if(ui.raceVoiceKey && !audio.busy)ui.raceVoiceKey=null;
    const racing=state.mode==='race' && state.screen==='play' && state.race;
    if(racing){
        if(!raceSpeechRelevant(key))return;
        const priority=raceVoicePriority(key),current=raceVoicePriority(ui.raceVoiceKey || '');
        if(!priority && /^(?:gear\.|ui\.(?:slower|faster|brake|accelerate)|drive\.)/.test(key))return;
        if(ui.raceVoiceKey && audio.busy && key!==ui.raceVoiceKey && priority<current){
            if(queue && raceSpeechRelevant(key))ui.pendingSpeech={text,key,allowPaused,generation:state.generation};
            return;
        }
        // Starting lights and the result take priority over encouragement.
        if(priority>=75&&!/^race\.festival\./.test(key))queue=false;
        if(queue && !raceSpeechRelevant(key))return;
    }
    if(queue && audio.busy){ui.pendingSpeech={text,key,allowPaused,generation:state.generation};return;}
    if(racing && raceVoicePriority(key))ui.raceVoiceKey=key;
    ui.pendingSpeech=null;audio.speak(key,text,{allowPaused});
}
function announce(key,{queue=false,force=false}={}) {
    if(!key || !ui.audioUnlocked || state.isMuted)return;
    if(!force && ui.lastAnnouncement===key && ui.speaking)return;
    ui.lastAnnouncement=key;say(words(key),key,{allowPaused:true,queue});
}
function task(text,emoji,key='') {
    $('promptText').textContent=text;$('promptEmoji').textContent=emoji;
    if(ui.task!==text || ui.taskKey!==key){
        ui.task=text;ui.taskKey=key;ui.emoji=emoji;
        const important=/retry|wait|peep|stopped|complete/.test(key);
        say(text,key,{allowPaused:state.screen==='race-start',queue:!important});
    }
}
function clearTransientPictures() {
    releasePedal();
    audio.stop();if(music)music.stop({reset:true});
    Object.assign(ui,{festival:null,finishWelcomed:false,raceVoiceKey:null,raceLayoutKey:'',whistle:0,pendingSpeech:null,hoverNode:null,hoverDeadline:null,lastAnnouncement:'',lastTimestamp:null});
}
function menuButtons() {
    const id=ui.albumOpen?'albumOverlay':state.paused?'pauseOverlay':state.screen==='race-start'?'raceStartOverlay':ui.festival?.results?'rewardOverlay':null;
    return id?[...$(id).querySelectorAll('button[data-action]')].filter(button=>!button.closest('[hidden],[inert]')&&!button.disabled):[];
}
function selectMenu(index,focus=true,read=true) {
    const buttons=menuButtons();if(!buttons.length)return;
    ui.menuIndex=(index+buttons.length)%buttons.length;
    buttons.forEach((button,i)=>button.classList.toggle('is-selected',i===ui.menuIndex));
    const selected=buttons[ui.menuIndex];
    if(focus){ui.suppressFocus=true;selected.focus({preventScroll:true});selected.scrollIntoView?.({block:'nearest',inline:'nearest'});ui.suppressFocus=false;}
    if(read && ui.audioUnlocked)announce(selected.dataset.narration,{force:true});
}
function renderCharacterChoices(){
    for(const [role,container,key,other]of [['player','playerChoices','playerId','opponentId'],['opponent','opponentChoices','opponentId','playerId']]){
        const chosen=state.selections[key],name=chosen==='random'?'Random':ThomasRaceCore.character(chosen).name,toggle=$(role+'PickerButton');
        $(role+'ChoiceName').textContent=name;$(role+'ChoicePortrait').setAttribute('href',`#portrait-${chosen}`);
        toggle.setAttribute('aria-label',`${role==='player'?'You':'Computer'}: ${name}. Change character`);
        toggle.setAttribute('data-narration',`race.character.${chosen}`);toggle.setAttribute('aria-expanded',ui.openPicker===role);
        show(role+'PickerMenu',ui.openPicker===role);
        if(!$(container).children.length)for(const c of [...ThomasRaceCore.CHARACTERS,{id:'random',name:'Random'}]){
            const button=htmlNode('button',{id:`choose-${role}-${c.id}`,class:'racer-choice','data-action':`select-${role}`,'data-value':c.id,'data-narration':`race.character.${c.id}`,'aria-label':`${role==='player'?'You':'Computer'}: ${c.name}`},'',$(container));
            picture(button,c.id,'portrait');htmlNode('span',{},c.name,button);
            htmlNode('span',{class:'racer-unavailable'},'',button);
        }
        for(const button of $(container).children){
            const id=button.dataset.value,unavailable=id!=='random'&&id===state.selections[other];
            button.disabled=unavailable;button.setAttribute('aria-pressed',state.selections[key]===id);
            button.setAttribute('aria-disabled',unavailable);
            button.setAttribute('aria-label',`${role==='player'?'You':'Computer'}: ${id==='random'?'Random':ThomasRaceCore.character(id).name}${unavailable?'. Already chosen by '+(role==='player'?'Computer':'You'):''}`);
            button.querySelector('.racer-unavailable').textContent=unavailable?'Already chosen':'';
            button.title=unavailable?'That character is already racing':'';
        }
    }
}
function setPicker(role,focus=false){
    const previous=ui.openPicker;ui.openPicker=role;renderCharacterChoices();
    if(!focus)return;
    const selected=role?$(role+'Choices').querySelector('[aria-pressed="true"]'):$(previous+'PickerButton');
    if(selected)selectMenu(menuButtons().indexOf(selected),true,!!role);
}
function focusMenuDefault(){
    const buttons=menuButtons(),index=state.screen==='race-start'&&!ui.albumOpen?buttons.indexOf($('startRaceButton')):0;
    selectMenu(Math.max(0,index),true,false);
}
function htmlNode(tag,attrs,text,parent) {
    const node=document.createElement(tag);
    Object.entries(attrs||{}).forEach(([name,value])=>node.setAttribute(name,value));
    if(text)node.textContent=text;
    if(parent)parent.appendChild(node);
    return node;
}
function picture(parent,id,kind='landmark') {
    const svg=svgNode('svg',{viewBox:kind==='portrait'?'0 0 100 100':'0 0 120 100','aria-hidden':'true',class:'card-picture-svg'},parent);
    svgNode('use',{href:`#${kind}-${id}`,width:kind==='portrait'?100:120,height:100},svg);
    return svg;
}
function resizeScene(){if(ui.raceView && state.race){ui.raceView.resize();ui.raceView.render(presentationRace(),{paused:state.paused,time:ui.time,whistle:ui.whistle,festival:ui.festival});}}
function drivingWheelTurns(){return ui.festival?.race.player.wheelTurns || state.race?.player.wheelTurns || 0;}
function ensureRaceView() {
    if(ui.raceView && ui.raceView.available!==false)return true;
    let failed=false;
    try{
        if(!globalThis.ThomasRaceView)failed=true;
        else ui.raceView=ThomasRaceView.create({canvas:$('raceCanvas'),onUnavailable:()=>{failed=true;}});
        if(!ui.raceView || ui.raceView.available===false)failed=true;
    }catch(error){failed=true;}
    if(!failed)return true;
    ui.raceUnavailable=true;ui.raceView=null;
    game.dispatch('home');render();
    announce('race.unavailable',{force:true});
    return false;
}
function raceTaskPicture(type) {
    const c=state.race&&ThomasRaceCore.getCharacter(state.race,'player');
    if(c?.vehicleType==='air')return ({'passenger-load':'race-flight-passengers','passenger-unload':'race-flight-passengers','cargo-load':'race-flight-cargo','cargo-unload':'race-flight-cargo',repairs:'race-flight-repairs',rocks:'race-ground-crane',tree:'race-flight-winch',coal:'race-flight-fuel',water:'race-flight-water',wash:'race-flight-wash',animals:'rule-radio','level-crossing':'race-flight-clearance',drawbridge:'race-flight-harbour',tunnel:'race-flight-cloud',hill:'race-flight-route',downhill:'race-flight-route',wet:'race-flight-wind',snow:'race-flight-snow'})[type]||'race-flag';
    if(c?.vehicleType==='road'&&type==='coal')return 'race-fuel';
    if(c?.vehicleType==='road'&&type==='repairs')return 'race-potholes';
    if(c?.vehicleType==='road'&&type==='level-crossing')return 'race-road-junction';
    if(c?.power!=='steam'&&['water','coal'].includes(type))return 'race-depot-'+type;
    return ({'passenger-load':'race-passengers','passenger-unload':'race-passengers',
        'cargo-load':'race-container','cargo-unload':'race-container',animals:'challenge-crossing',wash:'challenge-wash',
        water:'challenge-water',tree:'challenge-tree',drawbridge:'challenge-drawbridge',hill:'challenge-hill',
        downhill:'challenge-downhill',tunnel:'race-tunnel',snow:'race-snow',wet:'race-water',
        repairs:'challenge-repairs',rocks:'race-rocks',coal:'race-coal','level-crossing':'race-level-crossing'})[type] || 'race-flag';
}
function presentationRace(){return ui.festival?.race || (state.race&&ThomasRaceCore.getPresentationRace(state.race));}
function festivalKey(){
    if(!ui.festival)return '';
    if(ui.festival.results||ui.festival.stage==='thanks')return 'race.festival.'+state.race.deliveryTheme;
    return 'race.festival.'+(ui.festival.stage==='arrival'?'arrival':state.race.winner==='player'?'win':state.race.winner==='rival'?'lose':'tie');
}
function updateFestivalHud(){
    const f=ui.festival;if(!f)return;
    $('festivalTitle').textContent=f.stage==='arrival'&&!f.results?'Welcome to the finish festival!':state.race.winner==='tie'?'A shared first place!':state.race.winner==='player'?`${ThomasRaceCore.character(state.race.playerId).name} wins!`:`${ThomasRaceCore.character(state.race.opponentId).name} wins! ${ThomasRaceCore.character(state.race.playerId).name} finishes second.`;
    $('festivalMessage').textContent=f.stage==='arrival'&&!f.results?'The whole island is cheering you home.':f.stage==='award'&&!f.results?words(festivalKey()):words('race.festival.'+state.race.deliveryTheme);
    $('festivalResultAwardPicture').setAttribute('href',state.race.winner==='rival'?'#festival-rosette':'#festival-trophy');
    const thanks=f.results||f.elapsed>=7;show('festivalJobs',thanks);
    for(let i=0;i<$('festivalJobs').children.length;i++)$('festivalJobs').children[i].classList.toggle('lit',f.results||f.elapsed>=7+i*.18);
    ui.taskKey=festivalKey();ui.task=words(ui.taskKey);$('promptText').textContent=ui.task;
}
function ensureFestival(){
    if(state.phase!=='complete'||ui.festival)return;
    ui.festival=ThomasRaceCore.createFinishPresentation(state.race);
    audio.stop();ui.pendingSpeech=null;ui.raceVoiceKey=null;
    $('festivalJobs').replaceChildren();
    for(const job of state.race.services){const svg=svgNode('svg',{viewBox:'0 0 120 100','aria-hidden':'true'},$('festivalJobs'));svgNode('use',{href:'#'+raceTaskPicture(job.type),width:120,height:100},svg);}
    audio.effect('festival');say(words('race.festival.arrival'),'race.festival.arrival');
}
function advanceFestival(seconds){
    const f=ui.festival,stage=f.stage,results=f.results;
    ThomasRaceCore.stepFinishPresentation(f,seconds);
    if(f.stage!==stage&&!results){
        if(f.stage==='award')audio.effect('applause');
        say(words(festivalKey()),festivalKey(),{queue:f.stage==='thanks'});
    }
    if(!results&&f.results){render();ui.menuIndex=0;selectMenu(0,true,false);}else renderRacePresentation();
}

function renderRacePresentation() {
    const race=state.race;if(!race)return;
    const view=ThomasRaceCore.getView(race),service=view.currentService;
    const driving=active(),up=$('action-accelerate');
    up.disabled=!driving||!view.canSpeedUp;
    const mph=Math.round(view.mph),reading=$('speedReading');
    $('speedNeedle').setAttribute('transform',`rotate(${-135+Math.min(150,view.mph)*1.8} 50 50)`);
    if(reading.textContent!==String(mph)){
        reading.textContent=String(mph);
        up.setAttribute('aria-label',`Speed up. Current speed ${mph} miles per hour.`);
    }
    const working=service?.phase==='working',handling=service?.phase==='cargo-lowering'||service?.phase==='cargo-lifting';
    const help=$('action-race-help'),hasHelp=!!service && service.type!=='animals';
    show('action-race-help',hasHelp);
    help.disabled=state.paused || ui.albumOpen || !view.helpEnabled;
    help.setAttribute('data-narration',view.taskKey);help.setAttribute('aria-label',words(view.taskKey));
    const helpPicture=view.player.vehicleType==='air'?raceTaskPicture(service?.type):service?.type==='cargo-unload' || service?.type==='cargo-load' && service.selectedContainer?'race-crane':service?.type==='passenger-load'?'race-board':service?.type==='passenger-unload'?'race-alight':raceTaskPicture(service?.type);
    $('raceHelpPicture').setAttribute('href',working||handling?'#rule-wait':`#${helpPicture}`);
    const labels={'cargo-load':'Load','cargo-unload':'Unload','passenger-load':'Board','passenger-unload':'All off',wash:'Wash',water:'Water',repairs:'Repair',rocks:'Clear',coal:view.player.vehicleType==='rail'?'Coal':'Fuel',tree:'Clear','level-crossing':view.player.vehicleType==='air'?'Call':view.player.vehicleType==='road'?'Lights':'Cross',drawbridge:'Bridge'};
    $('raceHelpLabel').textContent=working||handling?'Wait':labels[service?.type]||'Help';
    help.classList.toggle('hint',!!view.helpEnabled);
    $('action-whistle').classList.toggle('hint',service?.type==='animals' && !working);
    const counting=race.phase==='countdown',green=race.phase==='racing' && race.elapsed<1.2;
    show('raceStartLights',counting || green);show('raceMatchup',counting);
    for(const [role,c]of [['Player',view.player],['Rival',view.opponent]]){
        $('matchup'+role+'Portrait').setAttribute('href',`#${c.portrait}`);$('matchup'+role+'Name').textContent=c.name;
    }
    $('raceRedLight').classList.toggle('lit-red',counting && race.countdown>2.3);
    $('raceAmberLight').classList.toggle('lit-amber',counting && race.countdown<=2.3);
    $('raceGreenLight').classList.toggle('lit-green',green);
    ui.taskKey=view.taskKey;ui.task=words(view.taskKey);$('promptText').textContent=ui.task;
    // A job stage can change while its previous slow narration is decoding or speaking.
    if(serviceVoice(ui.raceVoiceKey) && !raceSpeechRelevant(ui.raceVoiceKey)){
        audio.stopNarration();ui.raceVoiceKey=null;ui.pendingSpeech=null;
    }
    const events=race.phase==='complete'?[]:race.events.splice(0);
    for(const event of events){
        if(event.type.startsWith('rival-') || event.vehicle==='rival' || event.who==='rival')continue;
        if(event.type==='complete')continue;
        if(event.type==='service-done')playStarChime();
        if(!event.key)continue;
        if(event.type==='service-action')continue;
        if(event.type==='service-hint' && audio.busy && ui.raceVoiceKey===event.key)continue;
        say(words(event.key),event.key,{queue:event.type==='delivery-goal'});
    }
    if(race.rival.finishEvent&&!ui.finishWelcomed){ui.finishWelcomed=true;if(!ui.festival)audio.effect('applause');}
    if(ui.festival)updateFestivalHud();
    if(ui.raceView){
        const layoutKey=`${race.phase}:${state.paused}:${ui.albumOpen}:${!!service}:${!!ui.festival?.results}`;
        if(ui.raceLayoutKey!==layoutKey){ui.raceLayoutKey=layoutKey;ui.raceView.resize();}
        ui.raceView.render(presentationRace(),{paused:state.paused || ui.albumOpen,time:ui.time,whistle:ui.whistle,festival:ui.festival});
    }
}

function render() {
    if(ui.lastGeneration!==state.generation){clearTransientPictures();ui.lastGeneration=state.generation;ui.task='';ui.taskKey='';}
    ensureFestival();
    const playing=state.screen==='play',completed=playing && state.phase==='complete',results=completed&&ui.festival.results;
    const overlay=!playing || state.paused || results || ui.albumOpen;
    $('playSurface').classList.toggle('has-race-controls',playing&&!results);
    show('raceStartOverlay',!playing && !ui.albumOpen);show('raceUnavailable',!playing && ui.raceUnavailable);
    show('pauseOverlay',playing && state.paused && !ui.albumOpen);show('rewardOverlay',results && !state.paused && !ui.albumOpen);show('albumOverlay',ui.albumOpen);
    show('raceCanvas',playing);
    if(!playing){
        renderCharacterChoices();
        $('driveModeControl').setAttribute('data-selected',state.driveMode);
        $('driveModeLight').setAttribute('aria-pressed',state.driveMode==='light');
        $('driveModeFull').setAttribute('aria-pressed',state.driveMode==='full');
        show('raceMatchup',false);show('raceStartLights',false);show('action-race-help',false);$('action-whistle').classList.remove('hint');
    }
    $('playWorld').classList.add('is-race');$('footerDashboard').classList.add('is-race');
    if(playing && !ensureRaceView())return;
    if(!playing && ui.raceView){ui.raceView.dispose();ui.raceView=null;}
    $('playSurface').inert=overlay;$('footerDashboard').inert=overlay;
    show('festivalHud',completed&&!state.paused&&!ui.albumOpen);show('skipCelebration',completed&&!results);
    $('footerDashboard').classList.toggle('festival-footer',completed);
    show('footerDashboard',playing&&!results);show('action-whistle',playing&&!results);
    show('action-accelerate',playing&&!completed);
    document.querySelector('[data-action="pause"]').hidden=!playing;
    const drivingPrompt=state.race?.driveMode==='light'?'Use Up to speed up.':'Use Up to start and speed up.';
    $('statusText').textContent=playing?drivingPrompt+' Help at each stop.':'';
    if(playing){
        const character=ThomasRaceCore.getCharacter(state.race),signal=character.power==='rotor'?'radio':character.power==='diesel'?'horn':'whistle';
        $('pausePortrait').setAttribute('href',`#${character.portrait}`);$('pauseTitle').textContent=`${character.name} is having a rest`;
        $('raceCanvas').setAttribute('aria-label',`${character.name} racing against ${ThomasRaceCore.character(state.race.opponentId).name}`);
        $('action-whistle').setAttribute('data-narration','ui.'+signal);
        $('action-whistle').setAttribute('aria-label',words('ui.'+signal));
        $('action-whistle').querySelector('use').setAttribute('href','#rule-'+signal);
        $('signalLabel').textContent=signal==='radio'?'Radio':signal==='horn'?'Horn':'Whistle';
        $('raceResultPortrait').setAttribute('href',`#portrait-${state.race.playerId}`);
        const resultKey=`race.complete.${state.race.winner==='player'?'win':state.race.winner==='tie'?'tie':'lose'}`;
        $('rewardTitle').textContent=words(resultKey);$('resultText').textContent=words(resultKey);
        renderRacePresentation();
    }else task(words('race.menu'),'🏁','race.menu');
    if(music)music.update();
}

function pause() {
    releasePedal();
    audio.stop();if(music)music.stop();ui.lastTimestamp=null;ui.pendingSpeech=null;ui.hoverNode=null;ui.hoverDeadline=null;
    if(state.screen!=='play')return;
    if(state.paused){render();return;}
    game.dispatch('pause');ui.pendingSpeech=null;ui.hoverNode=null;render();ui.menuIndex=0;selectMenu(0,true,false);announce('ui.paused',{force:true});
}
function dispatchAction(action,payload) {
    if(ui.albumOpen && !['close-album','hear-sticker','mute','music','home','repeat'].includes(action))return false;
    unlockAudio();
    if(action==='repeat'){
        // Repeat is an explicit request for the current task, even if older,
        // higher-priority guidance is still finishing.
        if(state.mode==='race'){ui.raceVoiceKey=null;ui.pendingSpeech=null;}
        const selected=menuButtons()[ui.menuIndex];
        if(state.screen!=='play'&&selected)announce(selected.dataset.narration,{force:true});else say(ui.task,ui.taskKey,{allowPaused:true});
        return true;
    }
    if(action==='hear-sticker'){announce(payload,{force:true});return true;}
    if(action==='music'){if(!musicAsset || !musicAsset.data)return false;state.musicEnabled=!state.musicEnabled;if(music)music.update();return true;}
    if(action==='mute'){
        state.isMuted=!state.isMuted;audio.setMuted(state.isMuted);if(music)music.update();
        if(!state.isMuted){audio.unlock();say(ui.task,ui.taskKey,{allowPaused:true});}return true;
    }
    if(action==='album'){
        if(ui.openPicker)setPicker(null);pause();ui.albumOpen=true;$('albumItems').replaceChildren();
        state.completedMissions.forEach(id=>{
            const job=ThomasGameCore.LEGACY_STICKERS.find(item=>item.id===id);
            const sticker=htmlNode('button',{class:'sticker','data-action':'hear-sticker','data-value':`ui.sticker.${id}`,'data-narration':`ui.sticker.${id}`,'aria-label':job.title},'',$('albumItems'));
            picture(sticker,job.friend,'portrait');htmlNode('span',{class:'sr-only'},job.title,sticker);
        });
        const savedStickers=[['driving-challenges','🚦','Really Useful Driver','driver'],['apple-delivery','🍎','Apple Delivery','apple-delivery'],['race-finisher','🏅','Race Finisher','race-finisher'],['race-winner','🏆','Race Winner','race-winner']];
        savedStickers.forEach(([id,emoji,name,key])=>{
            if(!state.stickers.includes(id))return;
            const sticker=htmlNode('button',{class:'sticker','data-action':'hear-sticker','data-value':`ui.sticker.${key}`,'data-narration':`ui.sticker.${key}`,'aria-label':name},'',$('albumItems'));
            htmlNode('span',{'aria-hidden':'true'},emoji,sticker);htmlNode('span',{class:'sr-only'},name,sticker);
        });
        if(!$('albumItems').children.length)htmlNode('p',{class:'album-empty sr-only'},words('ui.album.empty'),$('albumItems'));
        render();selectMenu(0,true,false);announce(state.stickers.length || state.completedMissions.length?'ui.album.open':'ui.album.empty',{force:true});return true;
    }
    if(action==='close-album'){ui.albumOpen=false;render();focusMenuDefault();if(state.paused)announce('ui.paused',{force:true});return true;}
    if(action==='pause'){pause();return true;}
    if(['toggle-player-picker','toggle-opponent-picker'].includes(action)){
        if(state.screen!=='race-start'||ui.albumOpen)return false;
        const role=action==='toggle-player-picker'?'player':'opponent';setPicker(ui.openPicker===role?null:role,true);return true;
    }
    if(action==='skip-celebration'){
        if(!active()||!ui.festival||!ThomasRaceCore.skipFinishPresentation(ui.festival))return false;
        audio.stop();ui.pendingSpeech=null;ui.raceVoiceKey=null;render();ui.menuIndex=0;selectMenu(0,true,false);return true;
    }
    if(action==='whistle'&&ui.festival&&active()){playPeepPeepWhistle();ui.whistle=.8;return true;}
    const signalsAnimals=action==='race-help'&&state.race?.player.service?.type==='animals';
    const requestsClearance=action==='race-help'&&state.race?.player.service?.type==='level-crossing'&&ThomasRaceCore.getCharacter(state.race).vehicleType==='air';
    if(!game.dispatch(action,payload))return false;
    if(['select-player','select-opponent'].includes(action)){
        const role=action==='select-player'?'player':'opponent';ui.openPicker=null;renderCharacterChoices();selectMenu(menuButtons().indexOf($(role+'PickerButton')),true,false);announce(`race.character.${payload}`,{force:true});return true;
    }
    if(['home','next-race','start-race','rematch'].includes(action)){
        ui.albumOpen=false;ui.openPicker=null;ui.menuIndex=0;ui.raceUnavailable=false;
    }
    if(action==='resume'){ui.lastTimestamp=null;audio.unlock();say(ui.task,ui.taskKey);}
    if(action==='whistle'||signalsAnimals||requestsClearance){playPeepPeepWhistle();ui.whistle=.8;}
    else if(['race-help','race-clean-spot'].includes(action))playPopSound(700);
    render();
    if(action==='select-drive-mode'){
        selectMenu(menuButtons().findIndex(button=>button.dataset.action===action&&button.dataset.value===payload),true,false);
    }else if(menuButtons().length){focusMenuDefault();if(action==='home'||action==='next-race')announce('race.menu',{force:true});}
    else if(['resume','start-race','rematch','race-help','race-clean-spot'].includes(action))focusStage();
    return true;
}

function releasePedal(){
    ui.upHeld=false;
    ui.pedalPointer=null;
}
document.addEventListener('pointerdown',event=>{
    if(event.isPrimary===false||ui.pedalPointer!==null)return;
    ui.ignorePedalClick=false;
    const pedal=$('action-accelerate');
    if(event.button!==0||!active()||pedal.disabled||pedal.hidden||
        !pedal.contains(event.target)||!dispatchAction('accelerate'))return;
    ui.pedalPointer=event.pointerId;
    ui.ignorePedalClick=true;
    pedal.setPointerCapture?.(event.pointerId);
});
function releasePointer(event){
    if(ui.pedalPointer===event.pointerId)ui.pedalPointer=null;
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,releasePointer);
document.addEventListener('keyup',event=>{
    if(event.key==='ArrowUp')ui.upHeld=false;
});
document.addEventListener('click',event=>{
    if(ui.openPicker&&!$(ui.openPicker+'PickerPanel').contains(event.target))setPicker(null,true);
    const node=event.target.closest('[data-action]');
    if(node?.dataset.action==='accelerate'&&event.detail>0&&ui.ignorePedalClick){
        ui.ignorePedalClick=false;return;
    }
    if(!node || node.disabled || node.closest('[inert],[hidden]'))return;
    event.stopPropagation();dispatchAction(node.dataset.action,node.dataset.value);
    if(event.detail>0 && active() && !menuButtons().length)focusStage();
});
document.addEventListener('keydown',event=>{
    if(event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey &&
        !event.target.closest('input,textarea,select,[contenteditable]') &&
        [' ','Enter','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault();return;
    }
    if(ThomasGameCore.shouldIgnoreKey(event))return;
    if(!ui.audioUnlocked && ['Tab',' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))unlockAudio();
    if(state.screen==='race-start'&&!ui.albumOpen){
        if(ui.openPicker&&event.key==='Escape'){event.preventDefault();setPicker(null,true);return;}
        const toggle=event.target.closest('.racer-picker-toggle');
        if(toggle&&!ui.openPicker&&['ArrowDown','ArrowUp'].includes(event.key)){
            event.preventDefault();setPicker(toggle.id==='playerPickerButton'?'player':'opponent',true);return;
        }
        if(ui.openPicker&&$(ui.openPicker+'PickerPanel').contains(event.target)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
            event.preventDefault();const choices=[...$(ui.openPicker+'Choices').children].filter(button=>!button.disabled),current=choices.indexOf(document.activeElement);
            const index=event.key==='Home'?0:event.key==='End'?choices.length-1:current<0?choices.findIndex(button=>button.getAttribute('aria-pressed')==='true'):(current+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+choices.length)%choices.length;
            selectMenu(menuButtons().indexOf(choices[index]));return;
        }
    }
    const buttons=menuButtons();
    if(event.key==='Escape' && (state.screen==='play' || ui.albumOpen)){
        event.preventDefault();dispatchAction(ui.albumOpen?'close-album':state.paused?'resume':'pause');return;
    }
    if(buttons.length){
        if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){
            event.preventDefault();unlockAudio();const current=buttons.indexOf(document.activeElement);
            selectMenu((current>=0?current:ui.menuIndex)+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1));return;
        }
        if((event.key===' '||event.key==='Enter') && !event.target.closest('button')){
            event.preventDefault();buttons[ui.menuIndex%buttons.length].click();return;
        }
        return;
    }
    if(active()&&ui.festival&&!ui.festival.results){
        if(event.key===' '&&!event.target.closest('button')){event.preventDefault();dispatchAction('whistle');return;}
        if(event.key==='Enter'&&!event.target.closest('button')){event.preventDefault();dispatchAction('skip-celebration');return;}
    }
    const driving=active() && state.phase!=='complete';
    if(driving && event.key==='Enter' && !event.target.closest('button,[role="button"]')){
        event.preventDefault();if(ThomasRaceCore.getView(state.race).helpEnabled)dispatchAction('race-help');return;
    }
    if(driving && event.key===' ' && !event.target.closest('button')){event.preventDefault();dispatchAction('whistle');return;}
    if(driving && event.key==='ArrowUp'){
        event.preventDefault();if(dispatchAction('accelerate'))ui.upHeld=true;return;
    }
    if(driving && ['ArrowLeft','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();return;}
    const button=event.target.closest('button,[role="button"]');
    if(button){
        if(button.tagName.toLowerCase()!=='button' && (event.key===' '||event.key==='Enter')){
            event.preventDefault();button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        }
        return;
    }
    if(!active())return;
    if(event.key===' '){
        event.preventDefault();dispatchAction('whistle');
    }
});

function racePointer(event, click=false) {
    if(!active() || state.mode!=='race' || !state.race || !ui.raceView?.pick)return;
    const service=state.race.player.service;if(!service || service.phase!=='ready')return;
    if(!click && service.type!=='wash')return;
    const target=ui.raceView.pick(event.clientX,event.clientY);
    if(target?.kind==='mud')dispatchAction('race-clean-spot',target.id);
    else if(click && target?.kind==='service')dispatchAction('race-help',target.id);
}
$('raceCanvas').addEventListener('pointermove',event=>racePointer(event));
$('raceCanvas').addEventListener('click',event=>racePointer(event,true));

window.addEventListener('blur',()=>{ui.windowActive=false;pause();});
window.addEventListener('focus',()=>{ui.windowActive=true;});
document.addEventListener('visibilitychange',()=>{ui.windowActive=!document.hidden;if(document.hidden)pause();});

function frame(timestamp) {
    const elapsed=ui.lastTimestamp===null?0:Math.max(0,(timestamp-ui.lastTimestamp)/1000);
    const dt=Math.min(.1,elapsed); ui.lastTimestamp=timestamp;
    if(active() && ui.windowActive && !document.hidden && state.mode==='race'){
        ui.time+=elapsed;ui.whistle=Math.max(0,ui.whistle-elapsed);
        if(ui.festival)advanceFestival(elapsed);
        else {
            const before=state.phase;game.step(elapsed,ui.upHeld||ui.pedalPointer!==null);
            if(state.race.player.service||state.phase==='complete')releasePedal();
            if(before!==state.phase){render();if(state.phase==='complete')focusStage();}
            else renderRacePresentation();
        }
    }
    const motionRace=presentationRace(),motion=motionRace?.player;
    const rotorNearby=!!motionRace&&(ThomasRaceCore.getCharacter(motionRace).power==='rotor'||ThomasRaceCore.getCharacter(motionRace,'rival').power==='rotor'&&Math.abs(motionRace.player.distance-motionRace.rival.distance)<6000);
    audio.update(dt,{distance:motion?.distance||state.distance,velocity:motion?.velocity||0,targetVelocity:motion?.targetVelocity||0,wheelTurns:drivingWheelTurns(),vehiclePower:state.race?ThomasRaceCore.getCharacter(state.race).power:'steam',vehicleType:state.race?ThomasRaceCore.getCharacter(state.race).vehicleType:'rail',rotorActive:rotorNearby,rotorLevel:state.race&&ThomasRaceCore.getCharacter(state.race).power==='rotor'?.12:.045,isActive:active() && ui.windowActive && !document.hidden && (state.phase==='racing'||!!ui.festival&&(motion?.velocity>1||rotorNearby))});if(music)music.update();
    if(ui.hoverNode && ui.hoverDeadline!==null && timestamp>=ui.hoverDeadline){
        const node=ui.hoverNode;ui.hoverDeadline=null;
        if(!node.closest('[hidden],[inert]') && ui.audioUnlocked)announce(node.dataset.narration);
    }
    if(ui.pendingSpeech && !audio.busy && ui.windowActive && !document.hidden){
        const next=ui.pendingSpeech;ui.pendingSpeech=null;
        if(next.generation===state.generation && (!state.paused || next.allowPaused) && !state.isMuted && raceSpeechRelevant(next.key))say(next.text,next.key,{allowPaused:next.allowPaused});
    }
    requestAnimationFrame(frame);
}
document.addEventListener('focusin',event=>{
    if(ui.openPicker&&!$(ui.openPicker+'PickerPanel').contains(event.target))setPicker(null);
    event.target.closest('.racer-choice')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    if(ui.suppressFocus || !ui.audioUnlocked)return;
    const node=event.target.closest('[data-narration]');
    if(node && !node.closest('[hidden],[inert]'))announce(node.dataset.narration);
});
function hoverAnnouncement(event){
    const node=event.target.closest('[data-narration]');
    if(!node || node===ui.hoverNode || node.closest('[hidden],[inert]'))return;
    ui.hoverNode=node;ui.hoverDeadline=(ui.lastTimestamp || 0)+350;
}
document.addEventListener('pointerover',hoverAnnouncement);
document.addEventListener('mouseover',hoverAnnouncement);
function leaveAnnouncement(event){
    const node=event.target.closest('[data-narration]');
    if(node && event.relatedTarget && node.contains && node.contains(event.relatedTarget))return;
    if(node===ui.hoverNode){ui.hoverNode=null;ui.hoverDeadline=null;}
}
document.addEventListener('pointerout',leaveAnnouncement);
document.addEventListener('mouseout',leaveAnnouncement);
render();focusMenuDefault();
window.addEventListener('resize',resizeScene);
const sceneResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resizeScene):null;
if(sceneResizeObserver)sceneResizeObserver.observe($('raceCanvas'));
requestAnimationFrame(frame);
