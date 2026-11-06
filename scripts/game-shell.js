/* Race-only application state, saved rewards, and screen navigation. */
(() => {
    'use strict';
    const STORAGE_KEY='thomas-first-adventure-progress-v1';
    const SPEEDS=ThomasRaceCore.SPEEDS,MAX_SPEED=ThomasRaceCore.CRUISE_SPEED;
    const STICKER_IDS=['apple-delivery','race-finisher','race-winner','driving-challenges'];
    // Labels only: preserve albums earned in older versions of the game.
    const LEGACY_STICKERS=[
        {id:'meet-friends',title:'Meet our friends',friend:'james'},
        {id:'wash-visit',title:'A wash-day visit',friend:'toby'},
        {id:'fallen-tree',title:'Fallen tree',friend:'toby'},
        {id:'closed-bridge',title:'Closed bridge',friend:'james'},
        {id:'find-james',title:'Find James',friend:'james'},
        {id:'find-toby',title:'Find Toby',friend:'toby'}
    ];
    function shouldIgnoreKey(event){
        if(!event||event.repeat||event.ctrlKey||event.altKey||event.metaKey)return true;
        const target=event.target;if(!target)return false;
        return ['INPUT','TEXTAREA','SELECT'].includes(String(target.tagName||'').toUpperCase())||target.isContentEditable||
            typeof target.closest==='function'&&Boolean(target.closest('[contenteditable="true"], [contenteditable=""]'));
    }
    function createGame(storage,random=Math.random){
        if(storage===undefined){try{storage=globalThis.localStorage;}catch(_){storage=null;}}
        const validId=id=>!!ThomasRaceCore.character(id),validChoice=id=>id==='random'||validId(id);
        let progress={stars:0,stickers:[],completedMissions:[],lastRace:null,selections:{playerId:'thomas',opponentId:'random'}};
        try{
            const saved=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');
            if(saved?.version===1&&Number.isSafeInteger(saved.stars)&&saved.stars>=0&&Array.isArray(saved.stickers)&&saved.stickers.every(id=>STICKER_IDS.includes(id))){
                progress={...progress,stars:saved.stars,stickers:[...new Set(saved.stickers)],
                    completedMissions:Array.isArray(saved.completedMissions)?[...new Set(saved.completedMissions.filter(id=>LEGACY_STICKERS.some(s=>s.id===id)))]:[],
                    lastRace:saved.lastRace&&['country','harbour','mountain'].includes(saved.lastRace.courseId)&&validId(saved.lastRace.opponentId)?
                        {courseId:saved.lastRace.courseId,playerId:validId(saved.lastRace.playerId)?saved.lastRace.playerId:'thomas',opponentId:saved.lastRace.opponentId,...(['passengers','cargo'].includes(saved.lastRace.deliveryTheme)?{deliveryTheme:saved.lastRace.deliveryTheme}:{})}:null};
                const choices=saved.selections;
                if(choices&&validChoice(choices.playerId)&&validChoice(choices.opponentId)&&(choices.playerId==='random'||choices.playerId!==choices.opponentId))progress.selections={playerId:choices.playerId,opponentId:choices.opponentId};
            }
        }catch(_){/* Private browsing and invalid saves still permit play. */}
        const state={screen:'race-start',mode:'race',activity:'drive',phase:'ready',paused:false,
            gear:0,speed:0,throttle:0,velocity:0,targetVelocity:0,distance:0,race:null,generation:0,...progress};
        function save(){
            try{if(!storage?.setItem)return false;storage.setItem(STORAGE_KEY,JSON.stringify({version:1,stars:state.stars,stickers:state.stickers,selections:state.selections,
                ...(state.completedMissions.length?{completedMissions:state.completedMissions}:{}),...(state.lastRace?{lastRace:state.lastRace}:{})}));return true;}catch(_){return false;}
        }
        function reset(){Object.assign(state,{paused:false,gear:0,speed:0,throttle:0,velocity:0,targetVelocity:0,distance:0,phase:'ready',race:null,generation:state.generation+1});}
        function syncRace(){
            const r=state.race;if(!r)return;
            Object.assign(state,{phase:r.phase,distance:r.player.distance,velocity:r.player.velocity,targetVelocity:r.player.targetVelocity,gear:r.player.gear});
            state.speed=state.velocity===0?0:Math.min(4,Math.ceil(state.velocity/MAX_SPEED*4));state.throttle=state.gear;
            if(r.phase==='complete'&&!r.rewarded){
                r.rewarded=true;if(!state.stickers.includes('race-finisher'))state.stickers.push('race-finisher');
                if(r.winner==='player'&&!state.stickers.includes('race-winner'))state.stickers.push('race-winner');
                if(Number.isSafeInteger(state.stars+3))state.stars+=3;save();
            }
        }
        function start(settings){reset();state.screen='play';state.race=ThomasRaceCore.createRace(settings);
            state.lastRace={playerId:state.race.playerId,courseId:state.race.courseId,opponentId:state.race.opponentId,deliveryTheme:state.race.deliveryTheme};syncRace();save();return true;}
        function randomValue(){const value=random();return Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):.5;}
        function dispatch(action,payload){
            if(action==='home'||action==='next-race'&&state.screen==='play'&&state.phase==='complete'){reset();state.screen='race-start';return true;}
            if(action==='resume'){if(state.screen!=='play'||!state.paused)return false;state.paused=false;return true;}
            if(state.paused)return false;
            if(action==='select-player'||action==='select-opponent'){
                if(state.screen!=='race-start'||!validChoice(payload))return false;
                const key=action==='select-player'?'playerId':'opponentId',other=key==='playerId'?'opponentId':'playerId';
                if(payload!=='random'&&payload===state.selections[other])return false;
                state.selections={...state.selections,[key]:payload};save();return true;
            }
            if(action==='start-race'){
                if(payload!==undefined || state.screen!=='race-start')return false;
                return start(ThomasRaceCore.chooseRace({...state.selections,lastRace:state.lastRace,random:randomValue}));
            }
            if(state.screen!=='play'||!state.race)return false;
            if(action==='pause'){state.paused=true;return true;}
            if(action==='rematch'&&state.phase==='complete'){
                const {playerId,opponentId,courseId,deliveryTheme,seed}=state.race;
                return start({playerId,opponentId,courseId,deliveryTheme,seed});
            }
            if(state.phase==='complete')return false;
            if(action==='accelerate')return ThomasRaceCore.adjustSpeed(state.race,1);
            if(action==='whistle'){ThomasRaceCore.whistle(state.race);syncRace();return true;}
            if(action==='race-help'||action==='race-clean-spot'){
                const accepted=action==='race-help'?ThomasRaceCore.serviceAction(state.race,payload):ThomasRaceCore.cleanMud(state.race,Number(payload));
                if(accepted)syncRace();return accepted;
            }
            return false;
        }
        function step(seconds,accelerating=false){
            if(!Number.isFinite(seconds)||seconds<=0||state.screen!=='play'||state.paused||!state.race||state.phase==='complete')return false;
            ThomasRaceCore.step(state.race,seconds,accelerating);syncRace();return true;
        }
        return{state,dispatch,step,save};
    }
    globalThis.ThomasGameCore={createGame,STORAGE_KEY,SPEEDS,MAX_SPEED,LEGACY_STICKERS,shouldIgnoreKey,NARRATION:{}};
})();
